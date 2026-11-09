"""This book's live lines for the minute snapshot. JSON on stdout (matches only), a count on stderr. No host."""
import json
import sys

from value_bets.adapters import feedi
from value_bets.util import iso, now_utc


def main():
    try:
        matches = feedi.inplay(iso(now_utc()))
    except feedi.Skip as e:
        print(json.dumps({"matches": []}))
        print(f"feedi in-play skipped: {e}", file=sys.stderr)
        return
    except Exception as e:
        print(json.dumps({"matches": []}))
        print(f"feedi in-play failed: {type(e).__name__}", file=sys.stderr)
        return
    lines = sum(len(m.get("lines") or []) for m in matches)
    print(json.dumps({"matches": matches}))
    print(f"feedi in-play matches={len(matches)} lines={lines}", file=sys.stderr)


if __name__ == "__main__":
    main()
