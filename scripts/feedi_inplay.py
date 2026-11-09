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
        kind = ""
        if code:
            hdrs = getattr(e, "hdrs", None)
            up = hdrs.get("x-relay-upstream-status") if hdrs is not None else None
            try:
                body = (e.read() or b"").decode("utf-8", "replace")[:24]
            except Exception:
                body = ""
            if body.startswith("host not allowed"):
                kind = " relay-allow"
            elif body.strip() == "forbidden":
                kind = " relay-key"
            elif up:
                kind = " upstream"
            else:
                kind = " relay"
        print(f"feedi in-play failed: HTTP {code}{kind}{where}" if code else f"feedi in-play failed: {type(e).__name__}{where}", file=sys.stderr)
        return
    lines = sum(len(m.get("lines") or []) for m in matches)
    print(json.dumps({"matches": matches}))
    print(f"feedi in-play matches={len(matches)} lines={lines}", file=sys.stderr)


if __name__ == "__main__":
    main()
