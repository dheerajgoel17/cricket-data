"""Upcoming and live fixtures from Source A's own schedule page (`the schedule page`).

The page is rendered on the server and embeds its data (``the source's data host/fixture/getFixture``) in the same ``app-root-state`` block the
scorecards use: the next ~20 matches in time order with the real start time, format, venue, series, teams and live status. Unlike the sitemap
approach in ``fixtures.py`` (which only finds candidate pages and can surface stale or placeholder ones), this is Source A's actual schedule.
Run hourly it gives the site an accurate "today / tomorrow" list across internationals, leagues and domestic cricket.
"""
from __future__ import annotations

import json
import re
import urllib.request
from datetime import datetime, timezone

from .crex_scorecard import unescape_state
from .hosts import host, rel, state_at

KEY = "/fixture/getFixture"  # matched against the end of the state keys
UA = "Mozilla/5.0 (compatible; cricket-data/0.1; +https://github.com/dheerajgoel17/cricket-data)"
_STATE = re.compile(r'<script id="app-root-state"[^>]*>(.*?)</script>', re.S)


def format_of(text: str) -> str:
    """Source A format label -> T20 / ODI / Test / Hundred / FC (first-class, not part of the site's stats) / ''."""
    t = (text or "").lower()
    if "100" in t and "ball" in t:
        return "Hundred"
    if "t20" in t:
        return "T20"
    if "first class" in t or "four day" in t or "multi" in t:
        return "FC"
    if t == "test" or t.endswith(" test") or "test" in t.split():
        return "Test"
    if "odi" in t or "one day" in t or "list a" in t:
        return "ODI"
    return ""


def parse_schedule(html: str) -> list[dict]:
    m = _STATE.search(html)
    if not m:
        return []
    try:
        items = state_at(json.loads(unescape_state(m.group(1))), KEY) or []
    except ValueError:
        return []
    rows = []
    for x in items:
        if not x.get("t") or not x.get("team1") or not x.get("team2"):
            continue
        link = x.get("link") or ""
        rows.append({
            "start_utc": datetime.fromtimestamp(x["t"] / 1000, timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
            "match_id": (link.rsplit("/", 1)[-1] if link else str(x.get("id", ""))),
            "series": x.get("n", ""),
            "format": format_of(x.get("formats") or x.get("fo")),
            "gender": "male" if x.get("g") == 1 else "female",  # Source A: g=1 men, g=0 women (India Women have g=0)
            "team_a": x["team1"], "team_b": x["team2"], "venue": x.get("venue", ""),
            "status": "Live" if x.get("status") == 1 else "Upcoming",
            "url": rel(link),  # host-relative: committed data names no host
        })
    return sorted(rows, key=lambda r: (r["start_utc"], r["match_id"]))


def fetch_schedule(timeout: int = 40) -> list[dict]:
    req = urllib.request.Request(f"{host('LIVE_SOURCE_BASE')}/schedule", headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return parse_schedule(r.read().decode("utf-8", "replace"))
