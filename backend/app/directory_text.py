"""Text normalization shared by the directory loader and directory search.

Stored columns and incoming queries must be normalized the same way, so the
loader (tools/directory-poc) imports this module rather than keeping a copy.
"""

import re

STREET_SUFFIXES = frozenset(
    "rd road dr drive blvd boulevard ave avenue st street hwy highway ln lane pkwy parkway "
    "ct court cir circle pl place way trl trail expy expressway fwy freeway ter terrace sq "
    "loop pike thruway row".split()
)
DIRECTIONS = frozenset("n s e w ne nw se sw north south east west".split())


def norm_name(s: str | None) -> str | None:
    """"Raising Cane's Chicken Fingers #12" -> "raising canes chicken fingers"."""
    if s is None:
        return None
    s = s.lower().replace("'", "").replace("’", "")
    s = re.sub(r"#\s*\d+|\bstore\s+\d+\b", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(s.split()) or None


def street_core(s: str | None) -> str | None:
    """"S Sherwood Forest Blvd" -> "sherwood forest"; "W. Lee Dr" -> "lee"."""
    words = (norm_name(s) or "").split()
    if not words:
        return None
    while len(words) > 1 and words[0] in DIRECTIONS:
        words = words[1:]
    while len(words) > 1 and (words[-1] in STREET_SUFFIXES or words[-1] in DIRECTIONS):
        words = words[:-1]
    return " ".join(words)


def split_query(q: str, max_words: int = 6) -> list[tuple[str, str]]:
    """Candidate (name, street) readings of a customer query.

    "canes on lee"   -> [("canes", "lee")]
    "rouses bluebonnet" -> [("rouses bluebonnet", ""), ("rouses", "bluebonnet")]
    """
    words = (norm_name(q) or "").split()[:max_words]
    for sep in ("on", "at", "near"):
        if sep in words[1:-1]:
            i = words.index(sep, 1)
            return [(" ".join(words[:i]), street_core(" ".join(words[i + 1 :])) or "")]
    readings = [(" ".join(words), "")]
    for i in range(len(words) - 1, 0, -1):
        readings.append((" ".join(words[:i]), street_core(" ".join(words[i:])) or ""))
    return [r for r in readings if r[0]]
