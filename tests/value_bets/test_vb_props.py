import math

import numpy as np
import pandas as pd

from value_bets import context
from value_bets import propmodel as pm
from value_bets.adapters import moviodds


def _rows():
    recs = []
    for i, (day, runs) in enumerate([(100, 10), (200, 30), (300, 50)]):
        for pid, team, opp, r, bb, wk in (("a", "X", "Y", runs, 0, 0), ("b", "Y", "X", 5, 24, 2)):
            recs.append(dict(match_id=str(i), day=day, fmt="T20", gender="male", venue="Ground, City",
                             team_type="international", player_id=pid, team=team, opponent=opp, runs=r,
                             balls=max(r, 1), sixes=r // 20, fours=r // 10, wickets=wk, balls_bowled=bb,
                             date=pd.Timestamp("2020-01-01")))
    return pd.DataFrame(recs)


def test_context_is_leakage_free():
    ctx, bat, bowl = context.build(_rows(), record_from_day=0)
    a = [r for r in bat if r["pid"] == "a"]
    assert a[0]["w_bat"] == 0  # first innings sees no history
    assert a[1]["w_bat"] > 0 and a[1]["y_runs"] == 30
    # second innings' form only knows the first score (10) shrunk toward the prior
    assert a[1]["form_runs"] < 30
    assert context.norm_venue("M.Chinnaswamy Stadium, Bangalore") == "m chinnaswamy stadium"


def test_nb_p_over_and_poisson_fit():
    rng = np.random.default_rng(0)
    x = rng.normal(size=4000)
    y = rng.poisson(np.exp(1.0 + 0.5 * x))
    X = np.column_stack([np.ones_like(x), x])
    b = pm.fit_poisson(X, y.astype(float))
    assert abs(b[1] - 0.5) < 0.05
    p = float(pm.p_over(2.0, 0.01, 1.5))
    assert abs(p - (1 - math.exp(-2) * 3)) < 0.01  # ~Poisson(2): P(X>=2)


def test_moviodds_milestones(monkeypatch):
    payload = [{"matches": [{"id": "1", "home": "India", "away": "West Indies", "league": "T20", "kickoff_utc": "2026-10-17T13:30:00Z",
                             "quotes": [
                                 {"group_name": "Batter Milestones", "side": "30+ Runs", "line": "V Kohli", "n2": "India", "odds_dec": 2.1, "market_id": "m1"},
                                 {"group_name": "Batsman to Score a Fifty in the Match", "side": "Yes", "line": "V Kohli", "n2": "India", "odds_dec": 4, "market_id": "m2"},
                                 {"group_name": "Batsman to Score a Fifty in the Match", "side": "No", "line": "V Kohli", "n2": "India", "odds_dec": 1.22, "market_id": "m2"},
                                 {"group_name": "Batter Total Match Fours", "side": "Over", "line": "V Kohli", "handicap": "2.5", "n2": "India", "odds_dec": 1.83, "market_id": "m3"},
                             ]}]}]
    monkeypatch.setattr(moviodds, "http_json", lambda *a, **k: payload)
    rows, _ = moviodds.fetch("2026-10-17T00:00:00Z")
    by = {(r["market_type"], r["line"], r["side"]) for r in rows}
    assert ("batter_milestone", 29.5, "over") in by
    assert ("batter_milestone", 49.5, "over") in by and ("batter_milestone", 49.5, "under") in by
    assert ("batter_fours", 2.5, "over") in by
