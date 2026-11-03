"""``python -m value_bets.feedg_run``: read Feed G (usually through ``FEEDG_RELAY``) and keep the result in ``value_bets/state/feedg_latest.json``.

The hourly value-bets run can fall back to that file when the live hop is refused. Free hops only (Vercel bom1 / Cloudflare Worker) — no paid VPS.
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
