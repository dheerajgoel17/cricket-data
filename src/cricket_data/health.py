"""Canary checks that say *which layer* of the CREX scraper broke, and save what the site returned.

CREX changes its pages from time to time. Each check exercises one assumption the scraper makes
and, on failure, writes the raw HTML/text it saw to ``diagnostics/`` so a human or repair agent
can fix the parser against the real page (and turn it into a new test fixture) without guessing.

Layers, in the order the scraper depends on them:

* ``sitemap_matches`` / ``sitemap_series``: XML shape and size of the two sitemaps;
* ``match_page``: a finished historical match (stable forever) still yields date, teams, winner;
* ``homepage_links``: the home page still links completed matches.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path

from .crex_lookup import parse_match_page
from .crex_sitemap import BASE, MATCH_SITEMAP, SERIES_SITEMAP, parse_match_sitemap, parse_series_sitemap

# India v Afghanistan, 1st T20I, Mohali, 2024-01-11: a finished match that will never change.
CANARY_SLUG = "afg-vs-ind-1st-t20-afghanistan-tour-of-india-2024-match-updates-LR3"
MIN_MATCHES, MIN_SERIES = 10_000, 300


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str
    snapshot: str = ""  # path of the saved raw response, when there is one
    hint: str = field(default="")


def _save(out: Path, name: str, body: str) -> str:
    out.mkdir(parents=True, exist_ok=True)
    p = out / name
    p.write_text(body[:2_000_000], encoding="utf-8")
    return str(p)


def run_checks(browser, fetcher, out_dir: Path) -> list[CheckResult]:
    res: list[CheckResult] = []

    for name, url, parse, minimum in (
        ("sitemap_matches", MATCH_SITEMAP, parse_match_sitemap, MIN_MATCHES),
        ("sitemap_series", SERIES_SITEMAP, parse_series_sitemap, MIN_SERIES),
    ):
        try:
            xml = fetcher.get(url)
            n = len(parse(xml))
            ok = n >= minimum
            res.append(CheckResult(name, ok, f"{n} entries (need >= {minimum})",
                                   "" if ok else _save(out_dir, f"{name}.xml", xml[:200_000]),
                                   "" if ok else "sitemap layout changed: update parse_*_sitemap in crex_sitemap.py"))
        except Exception as exc:
            res.append(CheckResult(name, False, f"{type(exc).__name__}: {exc}",
                                   hint="sitemap unreachable or blocked by robots.txt"))

    url = f"{BASE}/cricket-live-score/{CANARY_SLUG}"
    try:
        page = browser.render(url, wait_selector="script#sports-event-schema")
        facts = parse_match_page(page.html, page.text, page.title, url) if page.status < 400 else None
        problems = []
        if facts is None:
            problems.append(f"no sports-event schema (HTTP {page.status})")
        else:
            if facts.start_date != date(2024, 1, 11):
                problems.append(f"start date {facts.start_date}, expected 2024-01-11")
            if {facts.team_a, facts.team_b} != {"India", "Afghanistan"}:
                problems.append(f"teams {facts.team_a}/{facts.team_b}")
            if facts.winner != "India" or not facts.finished:
                problems.append(f"winner '{facts.winner}', status '{facts.status}'")
        snap = ""
        if problems:
            snap = _save(out_dir, "match_page.html", page.html)
            _save(out_dir, "match_page.txt", page.text)
        res.append(CheckResult("match_page", not problems, "; ".join(problems) or "date, teams, winner ok", snap,
                               "" if not problems else "match page markup changed: fix parse_match_page in "
                               "crex_lookup.py, then save the new page as a tests/fixtures/crex fixture"))
    except Exception as exc:
        res.append(CheckResult("match_page", False, f"{type(exc).__name__}: {exc}",
                               hint="browser could not render CREX (Chromium install, block, or outage)"))

    try:  # the Chromium fallback must keep working even though plain HTTP is tried first
        page = browser.render(url, wait_selector="script#sports-event-schema", force_browser=True)
        ok = parse_match_page(page.html, page.text, page.title, url) is not None
        res.append(CheckResult("browser_fallback", ok, "Chromium renders the canary page" if ok else
                               f"Chromium got no match data (HTTP {page.status})",
                               "" if ok else _save(out_dir, "browser_fallback.html", page.html),
                               "" if ok else "Chromium fallback broken: check the Playwright install step"))
    except Exception as exc:
        res.append(CheckResult("browser_fallback", False, f"{type(exc).__name__}: {exc}",
                               hint="Chromium could not start: check the Playwright install step"))

    try:
        page, links = browser.links(BASE, "/cricket-live-score/")
        ok = len(links) > 0
        res.append(CheckResult("homepage_links", ok, f"{len(links)} match links",
                               "" if ok else _save(out_dir, "homepage.html", page.html),
                               "" if ok else "home page no longer links matches: fix fetch_recent_match_ids"))
    except Exception as exc:
        res.append(CheckResult("homepage_links", False, f"{type(exc).__name__}: {exc}"))
    return res


def write_report(results: list[CheckResult], out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    p = out_dir / "health.json"
    p.write_text(json.dumps({"checks": [asdict(r) for r in results],
                             "ok": all(r.ok for r in results)}, indent=1) + "\n", encoding="utf-8")
    return p
