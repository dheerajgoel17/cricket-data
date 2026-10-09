"""Template for a site-specific provisional source (keep site-specific scrapers in a PRIVATE fork).

1. Check the site's terms allow automated access. PoliteFetcher also enforces robots.txt.
2. Fill in LIST_URL and parse_match_list / parse_scorecard for that site's markup or JSON.
3. Test the parsers offline against saved sample pages (see tests/test_polite.py for the pattern).
4. Enable:  CRICKET_DATA_SOURCES="private_source_template:MySource" cricket-data update
Keep requests few: only matches from the last ~3 days are needed, because Cricsheet takes over after that.
"""
from __future__ import annotations

from collections.abc import Iterable
from datetime import date

from cricket_data.models import MatchRecord, PlayerPerf
from cricket_data.polite import PoliteFetcher, RobotsDisallowed

LIST_URL = "https://example.invalid/recent-results"  # replace


def parse_match_list(html: str) -> list[str]:
    """Return scorecard URLs for matches finished recently. Site specific."""
    raise NotImplementedError


def parse_scorecard(html: str) -> MatchRecord:
    """Turn one scorecard page into a MatchRecord with PlayerPerf rows. Site specific."""
    raise NotImplementedError


class MySource:
    name = "my-private-source"

    def __init__(self):
        self.http = PoliteFetcher(min_interval=10.0)

    def fetch(self, since: date) -> Iterable[MatchRecord]:
        try:
            urls = parse_match_list(self.http.get(LIST_URL))
        except RobotsDisallowed as exc:
            print(f"{self.name}: skipped ({exc})")
            return
        for url in urls[:20]:  # hard cap per run
            rec = parse_scorecard(self.http.get(url))
            rec.source = self.name
            if rec.date >= since.isoformat():
                yield rec


__all__ = ["MySource", "PlayerPerf"]
