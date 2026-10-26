"""The real CREX feed + scorecard of one finished match (trimmed), shared by the ball-by-ball tests."""
import json
from pathlib import Path

from cricket_data.crex_scorecard import Batter, Bowler, Innings, Scorecard

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "crex_balls_13W5.json").read_text())


def card() -> Scorecard:
    c = FIXTURE["scorecard"]
    return Scorecard(
        teams=c["teams"], names=c["names"],
        innings=[Innings(batting_team=i["team"],
                         batters=[Batter(pid=b[0], runs=b[1], balls=b[2], fours=b[3], sixes=b[4], code=b[5])
                                  for b in i["batters"]],
                         bowlers=[Bowler(pid=w[0], runs=w[1], balls=w[2], wickets=w[3]) for w in i["bowlers"]])
                 for i in c["innings"]])
