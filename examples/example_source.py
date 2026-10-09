"""Template for a custom provisional source.

Enable with:  CRICKET_DATA_SOURCES="example_source:MySource" cricket-data update
(run from this folder, or put the module on PYTHONPATH). Only use data you have the right to use.
"""
from datetime import date

from cricket_data.models import MatchRecord, PlayerPerf


class MySource:
    name = "my-source"

    def fetch(self, since: date):
        # Replace with a call to an API/feed you are allowed to use.
        yield MatchRecord(
            match_id="", date=date.today().isoformat(), match_type="T20", team_a="Team A", team_b="Team B",
            winner="Team A", source=self.name,
            players=[PlayerPerf(match_id="", date=date.today().isoformat(), player="A Player", runs=42)],
        )
