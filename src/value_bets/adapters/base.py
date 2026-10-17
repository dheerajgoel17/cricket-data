import re

from ..util import decimal_ok, iso, ist, parse_ts

FIELDS = ["source", "source_type", "event_id", "match", "team_a", "team_b", "gender_hint", "competition",
          "start_utc", "start_ist", "in_play", "market_type", "market_raw", "group_key", "selection",
          "player", "team", "line", "side", "back", "lay", "back_size", "liquidity", "fetched_at", "venue", "ms_scope"]


def row(**kw):
    r = {k: None for k in FIELDS}
    r.update(kw)
    st = parse_ts(r["start_utc"]) if r["start_utc"] else None
    r["start_utc"] = iso(st)
    r["start_ist"] = ist(st)
    r["back"] = decimal_ok(r["back"])
    r["lay"] = decimal_ok(r["lay"])
    return r


WOMEN_RE = re.compile(r"\s*(\(w\)|\bwomen\b|\bwomens\b|\bwomen's\b)\s*", re.I)


def split_teams(name):
    for sep in (" vs ", " v ", " @ ", " at "):
        if sep in name:
            a, b = name.split(sep, 1)
            return a.strip(), b.strip()
    return None, None


def gender_hint(*names):
    return "female" if any(n and WOMEN_RE.search(n) for n in names) else None
