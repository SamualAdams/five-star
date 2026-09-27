"""Try the directory search the way a customer types it.

    python search.py baton_rouge "canes on lee"
    python search.py baton_rouge "chick fil a ben hur"
    python search.py baton_rouge "coffee call"

Query = business words + optional street words, split on ' on ' / ' at '. With no
separator, every split point is tried and the best-scoring one wins. Ranking is
token matching over the normalized name and street name (the same logic maps
to Postgres pg_trgm + a street column in the app).
"""

import sys
from pathlib import Path

import duckdb

from build import norm_name, street_core  # re-exported from backend/app/directory_text.py

ROOT = Path(__file__).parent


def splits(q: str) -> list[tuple[str, str]]:
    q = norm_name(q) or ""
    for sep in (" on ", " at ", " near "):
        if sep in f" {q} ":
            name, _, street = f" {q} ".partition(sep)
            return [(name.strip(), street.strip())]
    words = q.split()
    return [(q, "")] + [(" ".join(words[:i]), " ".join(words[i:])) for i in range(1, len(words))]


def token_score(query: str, target: str) -> float:
    """Share of query words found as a prefix of some target word ('star' ~ 'starbucks')."""
    q, t = query.split(), target.split()
    if not q:
        return 0.0
    return sum(any(tw.startswith(qw) for tw in t) for qw in q) / len(q)


def search(area: str, query: str, limit: int = 8) -> list[tuple]:
    con = duckdb.connect()
    rows = con.sql(
        f"SELECT name, street, city, street_name FROM '{ROOT / 'data/processed' / area / 'directory.parquet'}'"
    ).fetchall()
    best: dict[tuple, float] = {}
    for name_q, street_q in splits(query):
        street_q = street_core(street_q) or ""
        for name, street, city, street_name in rows:
            n = token_score(name_q, norm_name(name) or "")
            if n < 1:
                continue
            s = token_score(street_q, street_core(street_name) or "") if street_q else 0.0
            if street_q and s < 1:
                continue
            score = n + s + (0.5 if street_q else 0) - len((norm_name(name) or "").split()) * 0.01
            key = (name, street, city)
            best[key] = max(best.get(key, 0), score)
    return sorted(best.items(), key=lambda kv: -kv[1])[:limit]


if __name__ == "__main__":
    area, *queries = sys.argv[1:]
    for q in queries:
        print(f"\n> {q}")
        results = search(area, q)
        for (name, street, city), _ in results:
            print(f"   {name} - {street}, {city}")
        if not results:
            print("   (no match)")
