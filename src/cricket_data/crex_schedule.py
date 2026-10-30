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
    """Source A format label -> T20 / ODI / Test / Hundred / T10 / O60 / O40 / FC. Never collapse T10 into T20 or 60-over into ODI."""
    t = (text or "").lower()
    if re.search(r"\bt10\b", t) or ("10 over" in t and "t20" not in t):
        return "T10"
    if ("100" in t and "ball" in t) or "the hundred" in t:
        return "Hundred"
    if re.search(r"\b60[- ]overs?\b", t):
        return "O60"
    if re.search(r"\b40[- ]overs?\b", t):
        return "O40"
    if "t20" in t:
        return "T20"
    if "first class" in t or "four day" in t or "multi" in t:
        return "FC"
    if t == "test" or t.endswith(" test") or "test" in t.split():
        return "Test"
    if "odi" in t or "one day" in t or "list a" in t or "50 over" in t:
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
    return rows_from(items)


def rows_from(items: list) -> list[dict]:
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
            "status": "Live" if x.get("status") == 1 else "Completed" if x.get("status") == 2 or x.get("result") else "Upcoming",
            "result": x.get("result") or "",
            "url": rel(link),  # host-relative: committed data names no host
        })
    return sorted(rows, key=lambda r: (r["start_utc"], r["match_id"]))


def fetch_schedule(timeout: int = 40) -> list[dict]:
    req = urllib.request.Request(f"{host('LIVE_SOURCE_BASE')}/schedule", headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return parse_schedule(r.read().decode("utf-8", "replace"))


_CARDS_JS = """() => {
  const out = []; let day = "";
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === 3) { const t = n.textContent.trim(); if (/^[A-Z][a-z]{2}, \\d{1,2} [A-Z][a-z]{2} \\d{4}$/.test(t)) day = t; continue; }
    if (!n.matches("a.match-card-wrapper")) continue;
    const st = n.querySelector(".start-text"), meta = n.querySelector("p.time");
    out.push({day, href: n.getAttribute("href"), teams: [...n.querySelectorAll(".team-name")].map(e => e.textContent.trim()),
              time: st ? st.innerText.trim() : "", fmt: meta && meta.children[1] ? meta.children[1].textContent.trim() : "", meta: meta ? meta.innerText.trim() : ""});
  }
  return out;
}"""


def row_from_card(c: dict) -> dict | None:
    """One card of a later schedule page (read as the page shows it, in UTC) as a row. Venue and live scores are not on the card; a live match is not an upcoming row."""
    try:
        start = datetime.strptime(f"{c['day']} {c['time']}", "%a, %d %b %Y %I:%M %p")
    except ValueError:
        return None  # a live or finished card has no start time
    if len(c.get("teams") or []) != 2 or not c.get("href"):
        return None
    series = c["meta"].split(",", 1)[1].strip() if "," in c["meta"] else ""
    link = c["href"]
    return {"start_utc": start.strftime("%Y-%m-%dT%H:%MZ"), "match_id": link.rsplit("/", 1)[-1], "series": series, "format": format_of(c["fmt"] or c["meta"]),
            "gender": "female" if re.search(r"-w-vs-|-vs-\w+-w-|women", link + series.lower() + " ".join(c["teams"]).lower()) else "male",
            "team_a": c["teams"][0], "team_b": c["teams"][1], "venue": "", "status": "Upcoming", "result": "", "url": rel(link)}


def fetch_schedule_paged(days: int = 5, max_pages: int = 12, now: datetime | None = None) -> list[dict]:
    """The schedule page's first 20 matches (from its HTML, complete rows) plus the following pages, until the page reaches ``days`` ahead.

    Later pages load in the browser when "Next" is pressed, as for any visitor, so the page is opened in Chromium (set to UTC) and each page's cards are read
    from what it shows. Paging stops at the horizon, at the last page or after ``max_pages``. A later page's row has no venue."""
    from datetime import timedelta

    from .crex_browser import CREXBrowser

    now = now or datetime.now(timezone.utc)
    horizon = (now + timedelta(days=days)).strftime("%Y-%m-%dT%H:%MZ")
    cards: list[dict] = []
    with CREXBrowser() as b:
        page = b._browser.new_context(user_agent=UA, timezone_id="UTC", locale="en-GB").new_page()
        try:
            page.goto(f"{host('LIVE_SOURCE_BASE')}/schedule", wait_until="networkidle", timeout=60000)
            html = page.content()
            for _ in range(max_pages):
                got = [r for c in page.evaluate(_CARDS_JS) if (r := row_from_card(c))]
                cards += got
                nxt = page.get_by_role("button", name="Next >")
                if not got or max(r["start_utc"] for r in got) > horizon or nxt.count() == 0 or not nxt.first.is_enabled():
                    break
                first = got[0]["match_id"]
                nxt.first.click()
                page.wait_for_function("f => { const a = document.querySelector('a.match-card-wrapper'); return a && !a.href.endsWith(f); }", arg=first, timeout=10000)
        finally:
            page.close()
    rows = {r["match_id"]: r for r in cards}
    rows.update({r["match_id"]: r for r in parse_schedule(html)})  # the page's own first 20 carry the venue
    return sorted(rows.values(), key=lambda r: (r["start_utc"], r["match_id"]))


def fill_venues(rows: list[dict], held: list[dict], fetcher=None, cap: int = 30) -> int:
    """Give a row with no venue (a later schedule page has none) the one we already hold for that match, else the one on its own match page.

    At most ``cap`` pages are fetched per run, the soonest matches first; the rest are filled on the runs after (the venue is then held). Returns how many were filled."""
    from .crex_lookup import parse_match_page

    have = {r["match_id"]: r["venue"] for r in held if r.get("venue")}
    n = fetched = 0
    for r in sorted(rows, key=lambda r: r["start_utc"]):
        if r.get("venue"):
            continue
        if r["match_id"] in have:
            r["venue"] = have[r["match_id"]]
            n += 1
        elif fetcher is not None and r.get("url") and fetched < cap:
            fetched += 1
            try:
                facts = parse_match_page(fetcher.get(f"{host('LIVE_SOURCE_BASE')}{r['url']}"), url=r["url"])
            except Exception:  # noqa: BLE001  one page that will not load must not cost the schedule
                continue
            if facts and facts.venue:
                r["venue"] = facts.venue.replace("''", "'")
                n += 1
    return n
