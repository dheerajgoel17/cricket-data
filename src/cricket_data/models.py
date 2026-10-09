"""Record types and CSV column order shared by every module."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum


class MatchStatus(str, Enum):
    """Classification for how to handle scraped match data.
    
    - provisional: Normal lag between live match and Cricsheet release.
                   Delete after Cricsheet data arrives and is reconciled.
    - cricsheet_missing: Match is on Cricsheet's missing-matches list.
                         Keep permanently as source of truth unless Cricsheet
                         later provides it.
    - cricsheet_withheld: Match involves Afghanistan men's team or APL.
                          Cricsheet has withheld these matches since Nov 2024.
                          Keep permanently unless Cricsheet restores them.
    """
    PROVISIONAL = "provisional"
    CRICSHEET_MISSING = "cricsheet_missing"
    CRICSHEET_WITHHELD = "cricsheet_withheld"


# Player-performance points (fantasy-style scoring): 1/run, 20/wicket, 10/catch, 25/stumping.
PTS_RUN, PTS_WICKET, PTS_CATCH, PTS_STUMPING = 1, 20, 10, 25

MATCH_FIELDS = [
    "match_id", "date", "match_type", "team_type", "gender", "event", "venue",
    "team_a", "team_b", "toss_winner", "toss_decision", "winner", "result",
    "result_margin", "player_of_match", "status", "source",
]
PLAYER_FIELDS = [
    "match_id", "date", "player", "player_id", "team", "opponent",
    "runs", "balls", "fours", "sixes", "wickets", "balls_bowled", "runs_conceded",
    "catches", "stumpings", "run_outs", "points",
]
INT_PLAYER_FIELDS = (
    "runs", "balls", "fours", "sixes", "wickets", "balls_bowled", "runs_conceded",
    "catches", "stumpings", "run_outs",
)


def points(runs: int, wickets: int, catches: int, stumpings: int) -> int:
    return runs * PTS_RUN + wickets * PTS_WICKET + catches * PTS_CATCH + stumpings * PTS_STUMPING


@dataclass
class PlayerPerf:
    match_id: str
    date: str
    player: str
    team: str = ""
    opponent: str = ""
    player_id: str = ""
    runs: int = 0
    balls: int = 0
    fours: int = 0
    sixes: int = 0
    wickets: int = 0
    balls_bowled: int = 0
    runs_conceded: int = 0
    catches: int = 0
    stumpings: int = 0
    run_outs: int = 0

    @property
    def points(self) -> int:
        return points(self.runs, self.wickets, self.catches, self.stumpings)

    def row(self) -> dict[str, str]:
        d = asdict(self)
        d["points"] = self.points
        return {k: str(d[k]) for k in PLAYER_FIELDS}


@dataclass
class MatchRecord:
    match_id: str
    date: str
    match_type: str = ""
    team_type: str = ""
    gender: str = ""
    event: str = ""
    venue: str = ""
    team_a: str = ""
    team_b: str = ""
    toss_winner: str = ""
    toss_decision: str = ""
    winner: str = ""
    result: str = ""
    result_margin: str = ""
    player_of_match: str = ""
    status: str = "canonical"  # canonical | provisional
    source: str = ""
    players: list[PlayerPerf] = field(default_factory=list)

    def row(self) -> dict[str, str]:
        d = asdict(self)
        return {k: str(d[k]) for k in MATCH_FIELDS}
