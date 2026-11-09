"""Probe: what do the price feeds list for a match that has started? Prints market names and a few sample quotes (never a host).
Run from a workflow (the feed hosts are secrets, and some feeds only answer from the runners), see .github/workflows/inplay-probe.yml."""
from __future__ import annotations

import os
import sys
from collections import Counter

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from cricket_data.hosts import host  # noqa: E402
from value_bets.util import http_json  # noqa: E402

KEYS = ("group_name", "label", "line", "n2", "side", "handicap", "odds_dec", "market_id")


def main() -> int:
    d = http_json(host("PRICE_FEED_URL"), timeout=45)[0]
    ms = d.get("matches", [])
    live = [m for m in ms if m.get("in_play")]
    print(f"matches {len(ms)}, in play {len(live)}, top-level keys {sorted(d)}")
    print("match keys:", sorted(ms[0]) if ms else [])
    for m in live[:6]:
        qs = m.get("quotes", [])
        names = Counter((q.get("group_name") or "").strip() for q in qs)
        print(f"\n== {m.get('home')} vs {m.get('away')} | {m.get('league')} | quotes {len(qs)} | kickoff {m.get('kickoff_utc')}")
        for g, n in names.most_common():
            print(f"  {n:4d}  {g}")
        shown = set()
        for q in qs:
            g = (q.get("group_name") or "").strip()
            if g in shown or not any(w in g.lower() for w in ("inn", "over", "run", "six", "four", "wicket")):
                continue
            shown.add(g)
            print("  sample:", {k: q.get(k) for k in KEYS})
            if len(shown) >= 12:
                break
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
