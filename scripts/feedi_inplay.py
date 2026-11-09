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
        code = getattr(e, "code", None)
        where = f" at {feedi.LAST_STEP}" if feedi.LAST_STEP else ""
        reason = str(getattr(e, "reason", "") or "")
        kind = f" {reason}" if reason in {"relay-allow", "relay-key", "cf-challenge", "upstream", "relay"} else ""
        print(f"feedi in-play failed: HTTP {code}{kind}{where}" if code else f"feedi in-play failed: {type(e).__name__}{where}", file=sys.stderr)
        return
    lines = sum(len(m.get("lines") or []) for m in matches)
    print(json.dumps({"matches": matches}))
    print(f"feedi in-play matches={len(matches)} lines={lines}", file=sys.stderr)


if __name__ == "__main__":
    main()
