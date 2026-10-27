import re
import time

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


class Pace:
    """One request at a time, at least ``gap`` seconds apart. ``get`` is the adapter's own fetch (one attempt, no retries), looked up at call time."""

    def __init__(self, gap: float, get):
        self.gap, self.last, self._get = gap, 0.0, get

    def get(self, url: str):
        wait = self.last + self.gap - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        try:
            return self._get(url)
        finally:
            self.last = time.monotonic()


WOMEN_RE = re.compile(r"\s*(\(w\)|\bwomen\b|\bwomens\b|\bwomen's\b)\s*", re.I)


def split_teams(name):
    for sep in (" vs ", " v ", " @ ", " at "):
        if sep in name:
            a, b = name.split(sep, 1)
            return a.strip(), b.strip()
    return None, None


def gender_hint(*names):
    return "female" if any(n and WOMEN_RE.search(n) for n in names) else None
