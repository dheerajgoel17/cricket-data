"""The in-play lines of the books that list started matches, for the minute snapshot. JSON on stdout ({"matches": [...]}), a count per source on stderr. No host."""
import json
import sys

from value_bets import inplay_extra
from value_bets.util import now_utc


def main():
    try:
        matches, counts = inplay_extra.all_matches(now_utc())
    except Exception as e:
        print(json.dumps({"matches": []}))
        print(f"inplay extra failed: {type(e).__name__}", file=sys.stderr)
        return
    lines = sum(len(m["lines"]) for m in matches)
    print(json.dumps({"matches": matches}))
    print(f"inplay extra matches={len(matches)} lines={lines} by_source={counts}", file=sys.stderr)


if __name__ == "__main__":
    main()
