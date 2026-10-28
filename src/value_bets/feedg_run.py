"""``python -m value_bets.feedg_run``: read Feed G from this machine and keep the result in ``value_bets/state/feedg_latest.json``.

For a machine whose network the book accepts (the India runner, .github/workflows/feedg-india.yml). The hourly value-bets run reads that file when the book refuses GitHub's servers.
"""
from __future__ import annotations

from .adapters import feedg
from .util import iso, now_utc


def main() -> int:
    stamp = iso(now_utc())
    rows, raw = feedg.fetch(stamp, use_state=False)
    feedg.write_state(rows, raw, stamp)
    info = next(iter(raw["books"].values()))
    print(f"feedg: {info['events']} matches, {len(rows)} rows, {len(raw['fancy'])} fancy lines -> {feedg.STATE.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
