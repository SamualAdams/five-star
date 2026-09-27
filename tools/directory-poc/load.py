"""Load a built area into the app's directory_places table.

    python build.py baton_rouge      # produces data/processed/baton_rouge/directory.parquet
    python load.py baton_rouge       # upserts into DATABASE_URL (default: backend/.env)

Refresh-safe: rows are matched on (source, source_id), so five*'s own ids never
change. Places inside the area that are missing from this release are marked
inactive, never deleted - feedback may already point at them. Any database that
isn't on localhost needs --yes.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

import duckdb
import psycopg

from build import CONFIG, ROOT, norm_name, street_core

COLUMNS = [
    "source", "source_id", "source_release", "name", "street", "city", "state", "zip",
    "lat", "lon", "category", "brand", "name_search", "street_search",
]


def database_url(arg: str | None) -> str:
    url = arg or os.environ.get("DATABASE_URL")
    env_file = ROOT.parents[1] / "backend" / ".env"
    if not url and env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("DATABASE_URL="):
                url = line.split("=", 1)[1].strip()
    if not url:
        sys.exit("No DATABASE_URL (pass --database-url, set the env var, or add it to backend/.env)")
    return url.replace("postgresql+psycopg://", "postgresql://")


def rows(area_key: str, release: str):
    path = ROOT / "data" / "processed" / area_key / "directory.parquet"
    if not path.exists():
        sys.exit(f"{path} not found - run: python build.py {area_key}")
    for (overture_id, name, street, street_name, city, state, zip_, lat, lon, category, brand) in duckdb.sql(
        f"SELECT overture_id, name, street, street_name, city, state, zip, lat, lon, category, brand FROM '{path}'"
    ).fetchall():
        name_norm = norm_name(name)
        if not name_norm:
            continue
        street_norm = street_core(street_name)
        yield (
            "overture", overture_id, release, name[:255], street and street[:255], city and city[:128],
            state and state[:32], zip_, lat, lon, category and category[:64], brand and brand[:255],
            f" {name_norm} "[:300], f" {street_norm} " if street_norm else None,
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("area")
    parser.add_argument("--database-url")
    parser.add_argument("--yes", action="store_true", help="required for a non-local database")
    args = parser.parse_args()

    area = CONFIG["areas"][args.area]
    release = CONFIG["overture_release"]
    url = database_url(args.database_url)
    host = urlparse(url).hostname
    print(f"loading {area['label']} (Overture {release}) into {host}")
    if host not in ("localhost", "127.0.0.1", "::1") and not args.yes:
        sys.exit("Refusing to write to a non-local database without --yes")

    with psycopg.connect(url) as conn, conn.cursor() as cur:
        cur.execute(
            f"CREATE TEMP TABLE stage ON COMMIT DROP AS "
            f"SELECT {', '.join(COLUMNS)} FROM directory_places WITH NO DATA"
        )
        with cur.copy(f"COPY stage ({', '.join(COLUMNS)}) FROM STDIN") as copy:
            for row in rows(args.area, release):
                copy.write_row(row)
        cur.execute("SELECT count(*) FROM stage")
        staged = cur.fetchone()[0]

        updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in COLUMNS if c not in ("source", "source_id"))
        cur.execute(f"""
            INSERT INTO directory_places ({', '.join(COLUMNS)}, active, created_at, updated_at)
            SELECT {', '.join(COLUMNS)}, true, now(), now() FROM stage
            ON CONFLICT (source, source_id) DO UPDATE SET {updates}, active = true, updated_at = now()
            RETURNING (xmax = 0) AS inserted
        """)
        results = cur.fetchall()
        inserted = sum(1 for (i,) in results if i)

        b = area["bbox"]
        region_sql = "AND state = %(region)s" if area.get("region") else ""
        cur.execute(f"""
            UPDATE directory_places SET active = false, updated_at = now()
            WHERE source = 'overture' AND active AND source_release <> %(release)s
              AND lat BETWEEN %(ymin)s AND %(ymax)s AND lon BETWEEN %(xmin)s AND %(xmax)s
              {region_sql}
        """, {"release": release, "region": area.get("region"), **b})
        deactivated = cur.rowcount

        cur.execute("SELECT count(*) FROM directory_places WHERE active")
        active_total = cur.fetchone()[0]
        conn.commit()

    print(json.dumps({
        "staged": staged, "inserted": inserted, "updated": len(results) - inserted,
        "deactivated": deactivated, "active_in_table": active_total,
    }, indent=2))


if __name__ == "__main__":
    main()
