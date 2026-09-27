"""Build a cleaned five* business directory for one area from Overture Places.

    python build.py baton_rouge

Stages (each is plain SQL over DuckDB, so the same code runs for a city, a
state, or the whole US; only the bbox changes):

  1. extract    - pull just the area's rows from Overture's S3 GeoParquet
  2. normalize  - name + street (number/street, suite stripped) + street name
  3. rules      - tag each row with a drop_reason (NULL = keep)
  4. write      - directory.csv (kept), dropped.csv (for review), report.txt
"""

import json
import re
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).parent
# Same normalization the app uses for search queries (backend/app/directory_text.py).
sys.path.insert(0, str(ROOT.parents[1] / "backend"))
from app.directory_text import norm_name, street_core  # noqa: E402

CONFIG = json.loads((ROOT / "config.json").read_text())

CREDENTIALS = r"(md|m\.d\.|dds|dmd|do|od|dc|dpm|phd|cpa|np|pa-c|lpc|lcsw|aprn|fnp|dpt|esq|rn)"
BUSINESS_WORDS = set(
    "llc inc co corp company group team realty properties homes real estate agency associates "
    "partners services service center clinic office law firm insurance store shop roofing construction "
    "mortgage lending bank solutions notary accountancy accounting dental rental rentals tower house "
    "institute resources enterprises advisors wealth financial title studio salon".split()
)


def looks_like_person(name: str | None) -> bool:
    """'Rosemary Prejean, MD', 'Dr. Emily Briscoe', 'Dean Ec Jr Dr', 'Ourso Jason G',
    'Gayle M. Sanchez', 'Marilyn Bowman, Realtor'. Plain two-word names are left
    to the person-prone category check in apply_rules."""
    if not name:
        return False
    n = name.strip()
    return bool(
        re.search(rf",?\s{CREDENTIALS}\.?$", n, re.I)
        or re.search(r",\s*(realtor|agent|broker|attorney|lawyer|notary)\b", n, re.I)
        or re.match(r"^dr\.?\s", n, re.I)
        or re.search(r"\s(jr|sr|ii|iii)\s+dr$", n, re.I)
        or re.fullmatch(r"[A-Z][a-z]+ [A-Z][a-z]+ [A-Z]\.?", n)          # Ourso Jason G
        or re.fullmatch(r"[A-Z][a-z]+ [A-Z]\. [A-Z][a-z]+", n)           # Gayle M. Sanchez
    )


def is_two_word_name(name: str | None) -> bool:
    """'Lydia Alexander' but not 'Mid City Roofing' or 'Kst Accountancy'."""
    if not name or not re.fullmatch(r"[A-Z][a-z]+ [A-Z][a-z'-]+", name.strip()):
        return False
    return not (set(name.lower().split()) & BUSINESS_WORDS)


def connect() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    con.sql("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';")
    con.create_function("norm_name", norm_name, ["VARCHAR"], "VARCHAR", null_handling="special")
    con.create_function("street_core", street_core, ["VARCHAR"], "VARCHAR", null_handling="special")
    con.create_function("looks_like_person", looks_like_person, ["VARCHAR"], "BOOLEAN", null_handling="special")
    con.create_function("is_two_word_name", is_two_word_name, ["VARCHAR"], "BOOLEAN", null_handling="special")
    return con


def extract(con, area_key: str, area: dict) -> Path:
    release = CONFIG["overture_release"]
    raw = ROOT / "data" / "raw" / f"{area_key}_{release}.parquet"
    if raw.exists():
        return raw
    raw.parent.mkdir(parents=True, exist_ok=True)
    b = area["bbox"]
    region = area.get("region")
    region_sql = f"AND addresses[1].region = '{region}'" if region else ""
    print(f"extracting {area_key} from Overture {release} ...")
    con.sql(f"""
        COPY (
          SELECT id, names, basic_category, taxonomy, operating_status, confidence, brand,
                 addresses, websites, phones, sources, bbox,
                 ST_Y(ST_Centroid(geometry)) AS lat, ST_X(ST_Centroid(geometry)) AS lon
          FROM read_parquet('s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*')
          WHERE bbox.xmin >= {b['xmin']} AND bbox.xmax <= {b['xmax']}
            AND bbox.ymin >= {b['ymin']} AND bbox.ymax <= {b['ymax']}
            {region_sql}
        ) TO '{raw}' (FORMAT parquet, COMPRESSION zstd)
    """)
    return raw


def normalize(con, raw: Path) -> None:
    con.sql(f"""
        CREATE OR REPLACE TABLE p AS
        WITH base AS (
          SELECT
            id AS overture_id,
            trim(names."primary") AS name,
            -- street line: first address part, drop suite/unit and parentheticals
            nullif(trim(regexp_replace(regexp_replace(
                split_part(addresses[1].freeform, ',', 1),
                '\\(.*?\\)', '', 'g'),
                '\\s+(ste|suite|unit|apt|bldg|building|rm|room|fl|floor|spc|space|lot)\\b.*$|\\s*#.*$', '', 'i')), '') AS street,
            addresses[1].locality AS city,
            addresses[1].region AS state,
            left(addresses[1].postcode, 5) AS zip,
            round(lat, 6) AS lat, round(lon, 6) AS lon,
            basic_category AS category,
            taxonomy.hierarchy AS hierarchy,
            brand.names."primary" AS brand,
            coalesce(operating_status, 'unknown') AS status,
            round(confidence, 3) AS confidence,
            (SELECT max(s.update_time) FROM unnest(sources) AS t(s)
               WHERE s.dataset NOT LIKE 'Overture%') AS last_seen
          FROM '{raw}'
        )
        SELECT *,
          regexp_matches(street, '^\\d') AS has_number,
          nullif(trim(regexp_replace(street, '^[0-9]+[A-Za-z-]*\\s+', '')), '') AS street_name,
          norm_name(name) AS nname
        FROM base
    """)
    con.sql("ALTER TABLE p ADD COLUMN street_key VARCHAR")
    con.sql("UPDATE p SET street_key = street_core(street_name)")
    con.sql("ALTER TABLE p ADD COLUMN drop_reason VARCHAR")


def apply_rules(con) -> None:
    ex_top = CONFIG["exclude_top_categories"]
    ex_cat = CONFIG["exclude_categories"]
    stale = CONFIG["stale_before"]

    def tag(reason: str, where: str) -> None:
        con.sql(f"UPDATE p SET drop_reason = '{reason}' WHERE drop_reason IS NULL AND ({where})")

    tag("no_name", "name IS NULL")
    tag("closed", "status = 'permanently_closed'")
    tag("stale", f"last_seen IS NULL OR last_seen < '{stale}'")
    # A branded chain location is never dropped for its category (Costco is filed
    # under 'wholesaler'), except ATMs.
    tag("not_a_business",
        f"(hierarchy[1] IN {tuple(ex_top)} OR category IN {tuple(ex_cat)}) "
        "AND (brand IS NULL OR category = 'atm')")
    # Individuals (agents, doctors, lawyers) are dropped only when a real business
    # is listed at the same street address - the brokerage/clinic/firm is what
    # customers talk to. A solo practice with no other listing stays.
    con.sql("""
        CREATE OR REPLACE TEMP TABLE person AS
        SELECT overture_id, regexp_extract(street, '^(\\d+)', 1) AS num, street_key
        FROM p WHERE drop_reason IS NULL AND has_number AND (
          looks_like_person(name)
          OR (is_two_word_name(name) AND (
                list_contains(hierarchy, 'real_estate_agent')
                OR category IN ('real_estate_service', 'financial_service', 'attorney_or_law_firm',
                                'legal_service', 'insurance_agency'))))
    """)
    con.sql("""
        UPDATE p SET drop_reason = 'individual'
        WHERE overture_id IN (
          SELECT person.overture_id FROM person JOIN p biz
            ON biz.drop_reason IS NULL AND biz.has_number
           AND regexp_extract(biz.street, '^(\\d+)', 1) = person.num
           AND biz.street_key = person.street_key
           AND biz.overture_id NOT IN (SELECT overture_id FROM person))
    """)

    # Nearby-pair checks below join each row only to rows in its own and the 8
    # neighbouring ~200 m grid cells, so cost grows linearly with the area size.
    def make_cand() -> None:
        con.sql("""
            CREATE OR REPLACE TEMP TABLE cand AS
            SELECT overture_id, nname, lat, lon, street, street_key,
                   split_part(nname, ' ', 1) AS first_word,
                   regexp_extract(street, '^(\\d+)', 1) AS num,
                   floor(lat / 0.002)::BIGINT AS gy, floor(lon / 0.002)::BIGINT AS gx,
                   (brand IS NOT NULL)::INT * 4 + (status = 'open')::INT * 2 + confidence AS score
            FROM p WHERE drop_reason IS NULL
        """)
        # one row per (place, neighbouring cell) so pairs come from an equi-join
        con.sql("""
            CREATE OR REPLACE TEMP TABLE near AS
            SELECT c.*, c.gy + dy AS ny, c.gx + dx AS nx
            FROM cand c, range(-1, 2) t1(dy), range(-1, 2) t2(dx)
        """)

    # Departments: 'Walmart Pharmacy' near a 'Walmart'.
    make_cand()
    depts = tuple(CONFIG["department_words"])
    con.sql(f"""
        UPDATE p SET drop_reason = 'department'
        WHERE overture_id IN (
          SELECT c.overture_id FROM cand c JOIN near parent
            ON parent.ny = c.gy AND parent.nx = c.gx AND parent.overture_id <> c.overture_id
          WHERE length(parent.nname) >= 3
            AND starts_with(c.nname, parent.nname || ' ')
            AND substr(c.nname, length(parent.nname) + 2) IN {depts})
    """)

    # Duplicates: nearby rows with the same/similar name, or same street number +
    # street and the same first word.
    make_cand()
    pairs = con.sql("""
        SELECT a.overture_id, b.overture_id FROM cand a JOIN near b
          ON b.ny = a.gy AND b.nx = a.gx AND a.overture_id < b.overture_id
        WHERE abs(a.lat - b.lat) < 0.0015 AND abs(a.lon - b.lon) < 0.0015 AND (
              jaro_winkler_similarity(a.nname, b.nname) >= 0.93
           OR (a.num <> '' AND a.num = b.num AND a.street_key = b.street_key
               AND length(a.first_word) >= 3 AND a.first_word = b.first_word))
    """).fetchall()

    parent: dict[str, str] = {}

    def find(x: str) -> str:
        while parent.get(x, x) != x:
            parent[x] = parent.get(parent[x], parent[x])
            x = parent[x]
        return x

    for a, b in pairs:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb
    groups: dict[str, list[str]] = {}
    for x in {i for pair in pairs for i in pair}:
        groups.setdefault(find(x), []).append(x)
    if groups:
        rows = [(m, g) for g, members in groups.items() for m in members]
        con.sql("CREATE OR REPLACE TEMP TABLE grp (overture_id VARCHAR, g VARCHAR)")
        con.executemany("INSERT INTO grp VALUES (?, ?)", rows)
        con.sql("""
            UPDATE p SET drop_reason = 'duplicate'
            WHERE overture_id IN (
              SELECT overture_id FROM (
                SELECT grp.overture_id, row_number() OVER (
                  PARTITION BY g ORDER BY c.score DESC, length(c.nname), grp.overture_id) AS rn
                FROM grp JOIN cand c USING (overture_id)) WHERE rn > 1)
        """)


def write(con, area_key: str, area: dict) -> None:
    out = ROOT / "data" / "processed" / area_key
    out.mkdir(parents=True, exist_ok=True)
    cols = "overture_id, name, street, street_name, city, state, zip, lat, lon, category, brand"
    con.sql(f"COPY (SELECT {cols} FROM p WHERE drop_reason IS NULL ORDER BY name) "
            f"TO '{out / 'directory.csv'}' (HEADER)")
    con.sql(f"COPY (SELECT {cols} FROM p WHERE drop_reason IS NULL ORDER BY name) "
            f"TO '{out / 'directory.parquet'}' (FORMAT parquet, COMPRESSION zstd)")
    con.sql(f"COPY (SELECT drop_reason, name, street, city, status, category, confidence, last_seen, overture_id "
            f"FROM p WHERE drop_reason IS NOT NULL ORDER BY drop_reason, name) TO '{out / 'dropped.csv'}' (HEADER)")

    total = con.sql("SELECT count(*) FROM p").fetchone()[0]
    kept = con.sql("SELECT count(*) FROM p WHERE drop_reason IS NULL").fetchone()[0]
    lines = [f"{area['label']} - Overture {CONFIG['overture_release']}", "",
             f"raw places:        {total:>7,}"]
    for reason, n in con.sql("SELECT drop_reason, count(*) FROM p WHERE drop_reason IS NOT NULL "
                             "GROUP BY 1 ORDER BY 2 DESC").fetchall():
        lines.append(f"  - {reason:<16}{n:>7,}")
    lines += [f"directory:         {kept:>7,}", ""]
    for label, sql in [
        ("with street number", "has_number"),
        ("branded (chain)", "brand IS NOT NULL"),
        ("status open", "status = 'open'"),
        ("status unknown", "status = 'unknown'"),
    ]:
        n = con.sql(f"SELECT count(*) FROM p WHERE drop_reason IS NULL AND {sql}").fetchone()[0]
        lines.append(f"  {label:<20}{n:>7,}  ({n / kept:.0%})")
    lines += ["", "examples dropped per reason:"]
    for reason, in con.sql("SELECT DISTINCT drop_reason FROM p WHERE drop_reason IS NOT NULL ORDER BY 1").fetchall():
        ex = con.sql(f"SELECT name || ' - ' || coalesce(street, '?') FROM p WHERE drop_reason = '{reason}' "
                     "ORDER BY hash(overture_id) LIMIT 6").fetchall()
        lines.append(f"  {reason}: " + "; ".join(e[0] for e in ex))
    for f in ["directory.csv", "directory.parquet"]:
        lines.append(f"{f}: {(out / f).stat().st_size / 1e6:.1f} MB")
    report = "\n".join(lines)
    (out / "report.txt").write_text(report + "\n")
    print(report)


def main() -> None:
    area_key = sys.argv[1] if len(sys.argv) > 1 else "baton_rouge"
    area = CONFIG["areas"][area_key]
    con = connect()
    raw = extract(con, area_key, area)
    normalize(con, raw)
    apply_rules(con)
    write(con, area_key, area)


if __name__ == "__main__":
    main()
