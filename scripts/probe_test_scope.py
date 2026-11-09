"""Diagnostic: how do Feed H and Feed F write a Test's player markets? Prints market description and every field that could name an innings, never a host."""
import json
import re
import sys

from value_bets.adapters import feedf, feedh

SEEN = {"h": 0, "hi": 0}


def show_h(full):
    paths = " ".join(p.get("name") or "" for p in (full.get("eventPaths") or []))
    blob = f"{full.get('name') or ''} {paths}"
    test = re.search(r"\btests?\b", blob, re.I)
    print(f"H event {full.get('name')!r} paths={paths[:80]!r} test_in_text={bool(test)} market_count={len(full.get('markets') or [])}", file=sys.stderr)
    shown = 0
    for m in full.get("markets") or []:
        d = (m.get("description") or "")
        if re.search(r"batsman runs|bowler wickets|batsman fours", d, re.I) and shown < 4:
            shown += 1
            extra = {k: (v if not isinstance(v, (dict, list)) else f"<{type(v).__name__}>") for k, v in m.items() if k not in ("outcomes",)}
            print(f"H   market {d!r} fields={json.dumps(extra)[:600]}", file=sys.stderr)
        if re.search(r"inning|1st|2nd|first|second", d, re.I) and SEEN["hi"] < 12:
            SEEN["hi"] += 1
            print(f"H   innings-ish name {d!r}", file=sys.stderr)


orig_h = feedh.parse_event


def parse_h(full, src, fetched_at):
    if SEEN["h"] < 6:
        SEEN["h"] += 1
        show_h(full)
    return orig_h(full, src, fetched_at)


feedh.parse_event = parse_h
try:
    rows, raw = feedh.fetch("2026-11-09T09:00:00Z")
    tests = [r for r in rows if r.get("market_type") == "batter_runs"]
    print(f"H rows={len(rows)} batter_runs={len(tests)} inn={[(r.get('match'), r.get('line'), r.get('inn'), r.get('market_raw')) for r in tests[:6]]}", file=sys.stderr)
except Exception as e:
    print(f"H failed {type(e).__name__} {e}"[:300], file=sys.stderr)

orig_f = feedf.parse_event if hasattr(feedf, "parse_event") else None
print(f"F has parse_event={orig_f is not None}", file=sys.stderr)
