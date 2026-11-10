"""One side, two names: a team the books (or another feed) name differently from the schedule is one team key.

Keys are a team name lower-cased with everything but letters and digits removed. Kept equal to ``SAME_SIDE`` in site/packages/engine/util.js (tests/value_bets/test_vb_archive.py).
A key stands for one side only when the other side and the start also agree, so a short name like "central" never joins two different matches.
"""

from __future__ import annotations

import re

SAME_SIDE = {"aucklandaces": "auckland", "canterburykings": "canterbury", "wellingtonfirebirds": "wellington", "otagovolts": "otago", "northerndistricts": "northernbrave", "boland": "rocks",
             "southwesterndistricts": "gardenroutebadgers", "easterns": "easternstorm", "centraldistricts": "centralstags", "central": "centralstags", "eagles": "mashonalandeagles",
             "tuskers": "matabelelandtuskers", "uae": "unitedarabemirates", "uaeu19": "unitedarabemiratesu19", "englandlions": "englanda",
             "banglatigers": "unitedtigers", "delhibulls": "uaebulls", "royalchamps": "royaldesertchampions"}

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


# ---------------------------------------------------------------- the same match under other names
WEAK_WINDOW_S = 90 * 60  # the start a book gives is the schedule's own to the minute for a match both list; a wider window would join two different matches of one league
_GENERIC = {"cricket", "club", "team", "women", "womens", "men", "the", "and", "cc", "fc", "sc"}


def side_key(name: str | None) -> str:
    k = re.sub(r"[^a-z0-9]", "", re.sub(r"\(w\)|women'?s?|\sw$", "", str(name or "").lower()))
    return SAME_SIDE.get(k, k)


def _tokens(name: str | None, common: frozenset = frozenset()) -> set:
    return {w for w in re.findall(r"[a-z0-9]+", str(name or "").lower()) if len(w) >= 3 and w not in _GENERIC and w not in common}


def alike(x: str | None, y: str | None, common: frozenset = frozenset()) -> bool:
    """Two names that may be one side: the same key (alias, age tag), a distinctive word in common ("Royal Champs" / "Royal Desert Champions", "England Lions" / "England A"),
    or one an acronym of the other ("UAE"). ``common`` are words too frequent in the schedule to say anything ("Region", "Division")."""
    kx, ky = side_key(x), side_key(y)
    if not kx or not ky:
        return False
    if same_side_key(kx, ky) or _tokens(x, common) & _tokens(y, common):
        return True
    ix = "".join(w[0] for w in re.findall(r"[a-z]+", str(x or "").lower()))
    iy = "".join(w[0] for w in re.findall(r"[a-z]+", str(y or "").lower()))
    return (len(kx) >= 3 and kx == iy) or (len(ky) >= 3 and ky == ix)


def find_scheduled(a: str, b: str, start_s: float, female: bool, candidates: list[tuple]) -> object | None:
    """The one scheduled match a book's ``a`` v ``b`` at ``start_s`` (epoch seconds) is, or None.

    ``candidates``: ``(item, team_a, team_b, start_s, female)`` for every scheduled match. A candidate qualifies when the start is within ``WEAK_WINDOW_S``, the gender agrees and both
    sides are ``alike`` (either way round). Exactly one qualifying candidate is the match; none, or several (a day of first-class games on one start), is None: an unsure match
    stays what it was, a visible stop-gap, never a wrong join. This is the check every "is this a match we already have?" decision goes through once the exact side keys have failed
    (``same_pair``); a book's spelling is mapped onto the schedule's, never filed as a new fixture."""
    from collections import Counter

    seen = {n for _, x, y, _, _ in candidates for n in (x, y)}
    freq = Counter(w for n in seen for w in _tokens(n))
    common = frozenset(w for w, c in freq.items() if c >= 4)
    hits = []
    for item, x, y, t, f in candidates:
        if bool(f) != bool(female) or abs(t - start_s) >= WEAK_WINDOW_S:
            continue
        if (alike(a, x, common) and alike(b, y, common)) or (alike(a, y, common) and alike(b, x, common)):
            hits.append((item, x, y))
    return hits[0][0] if len(hits) == 1 else None
