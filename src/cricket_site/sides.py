"""One side, two names: a team the books (or another feed) name differently from the schedule is one team key.

Keys are a team name lower-cased with everything but letters and digits removed. Kept equal to ``SAME_SIDE`` in site/packages/engine/util.js (tests/value_bets/test_vb_archive.py).
A key stands for one side only when the other side and the start also agree, so a short name like "central" never joins two different matches.
"""

import re

SAME_SIDE = {"aucklandaces": "auckland", "canterburykings": "canterbury", "wellingtonfirebirds": "wellington", "otagovolts": "otago", "northerndistricts": "northernbrave", "boland": "rocks",
             "southwesterndistricts": "gardenroutebadgers", "easterns": "easternstorm", "centraldistricts": "centralstags", "central": "centralstags", "eagles": "mashonalandeagles",
             "tuskers": "matabelelandtuskers", "uae": "unitedarabemirates", "uaeu19": "unitedarabemiratesu19"}

_YOUTH_COMP = re.compile(r"\b(?:u|under)[\s-]?(1[2-9]|2[0-3])s?\b", re.I)
_YOUTH_NAME = re.compile(r"\b(?:u[\s-]?\d{2}|under[\s-]?\d{2})\b", re.I)


def youth_sides(a: str, b: str, competition: str | None) -> tuple[str, str]:
    """A book that names a youth match by its competition alone ("India" v "United Arab Emirates" in "U19 Asia Cup") is naming the U19 sides: the schedule has "India U19", so without the tag
    the match is a second, unmatched fixture (a senior T20 that never has a score). A side that already carries an age tag is left as it is."""
    m = _YOUTH_COMP.search(competition or "")
    if not m:
        return a, b
    tag = f"U{m.group(1)}"
    return tuple(n if not n or _YOUTH_NAME.search(n) else f"{n.strip()} {tag}" for n in (a, b))  # type: ignore[return-value]


_AGE_TAG = re.compile(r"u\d{2}$")


def same_side_key(x: str, y: str) -> bool:
    """Two team keys (``_side`` / ``team_key``) that name one side: equal, or equal once an age tag is dropped from the one that has it ("india" / "indiau19").
    A book that leaves the tag off still means the side the schedule lists; the other side and the start must agree too (``same_pair``)."""
    if x == y:
        return True
    bx, by = _AGE_TAG.sub("", x), _AGE_TAG.sub("", y)
    return bool(bx) and bx == by and (bx != x or by != y)


def same_pair(p: frozenset, q: frozenset) -> bool:
    """One match by its two side keys. The single check every "is this a match we already have?" decision goes through: a priced match is mapped onto the fixture that exists,
    never filed as a new one because the book spelled a side differently (U19 tag, alias)."""
    if p == q:
        return True
    pa, qa = sorted(p), sorted(q)
    if len(pa) != 2 or len(qa) != 2:
        return False
    return (same_side_key(pa[0], qa[0]) and same_side_key(pa[1], qa[1])) or (same_side_key(pa[0], qa[1]) and same_side_key(pa[1], qa[0]))
