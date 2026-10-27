"""Upcoming fixtures / schedule from Source A's public sitemap plus each match page's own metadata.

The sitemap lists pages for matches that have not been played yet, but only some of them carry a
real start time in ``<lastmod>`` (unscheduled ones get the time the sitemap was generated). So the
sitemap only picks *candidates*; the start time, venue and status come from the page's
``SportsEvent`` JSON-LD (the same block ``crex_lookup`` already parses).

Output is ``data/fixtures/upcoming.csv``: one row per upcoming or live match, rewritten on every run
(deterministic order, so an unchanged schedule produces no git diff). It never touches the match
store: fixtures are context, not results.
"""
from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from .crex_lookup import PageFacts, parse_match_page
from .crex_sitemap import MatchEntry
from .hosts import rel
from .polite import PoliteFetcher

FIELDS = ["start_utc", "match_id", "series", "format", "gender", "team_a", "team_b",
          "venue", "status", "url"]
PLAYED = {"finished", "completed", "abandoned", "cancelled"}


def _has_team(entry: MatchEntry, team: str) -> bool:
    """``team`` is a Source A slug code such as ``aus-w`` or ``ind``."""
    mid = entry.match_id
    return mid.startswith(f"{team}-vs-") or f"-vs-{team}-" in mid


def select_candidates(entries: list[MatchEntry], today: date, teams: list[str] | None = None,
                      lookback_days: int = 3) -> list[MatchEntry]:
    """Entries that could still be upcoming: lastmod today or later (or recent, for placeholders)."""
    floor = today - timedelta(days=lookback_days)
    seen: set[str] = set()
    out = []
    for e in sorted(entries, key=lambda e: (e.lastmod or "", e.match_id)):
        d = e.start_date
        if d is None or d < floor:
            continue
        if teams and not any(_has_team(e, t) for t in teams):
            continue
        if e.crex_id in seen:  # some matches are listed with and without '-match-updates'
            continue
        seen.add(e.crex_id)
        out.append(e)
    return out


def _format(entry: MatchEntry) -> str:
    """Slug-derived format; a lone ``only`` match with no format in its name is a Test."""
    return entry.format_hint or ("Test" if "-only-" in entry.match_id else "")


@dataclass
class Fixture:
    start: datetime
    entry: MatchEntry
    facts: PageFacts

    def row(self) -> dict[str, str]:
        e = self.entry
        return {
            "start_utc": self.start.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
            "match_id": e.match_id, "series": e.series_name, "format": _format(e),
            "gender": "female" if e.is_women else "male",
            "team_a": self.facts.team_a, "team_b": self.facts.team_b,
            "venue": self.facts.venue.replace("''", "'"), "status": self.facts.status, "url": rel(e.url),
        }


def fixture_from_html(entry: MatchEntry, html: str, now: datetime, horizon_days: int) -> Fixture | None:
    facts = parse_match_page(html, url=entry.url)
    if facts is None or facts.start is None or facts.status.lower() in PLAYED:
        return None
    if facts.start > now + timedelta(days=horizon_days):
        return None
    return Fixture(start=facts.start, entry=entry, facts=facts)


def collect(entries: list[MatchEntry], fetcher: PoliteFetcher, now: datetime | None = None,
            teams: list[str] | None = None, days: int = 30, max_pages: int = 40) -> list[Fixture]:
    now = now or datetime.now(timezone.utc)
    cands = select_candidates(entries, now.date(), teams)[:max_pages]
    out = []
    for e in cands:
        try:
            html = fetcher.get(e.url)
        except OSError:
            continue  # one flaky page must not lose the rest of the schedule
        fx = fixture_from_html(e, html, now, days)
        if fx:
            out.append(fx)
    return sorted(out, key=lambda f: (f.start, f.entry.match_id))


def write_fixtures(path: Path, fixtures: list[Fixture]) -> None:
    buf = io.StringIO(newline="")
    w = csv.DictWriter(buf, fieldnames=FIELDS, lineterminator="\n")
    w.writeheader()
    w.writerows(f.row() for f in fixtures)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(buf.getvalue(), encoding="utf-8")
