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


def _ms_payload(league):
    def q(g, side, odds, mid):
        return {"group_name": g, "side": side, "line": "T Bavuma", "n2": "South Africa",
                                       "odds_dec": odds, "market_id": mid}
    return [{"matches": [{"id": "9", "home": "South Africa", "away": "Australia", "league": league,
                          "kickoff_utc": "2026-10-18T08:00:00Z", "quotes": [
                              q("Batter Milestones", "100+ Runs", 4.33, "l1"),
                              q("Batsman to score a Hundred in the match", "Yes", 9.0, "h1"),
                              q("Batsman to score a Hundred in the match", "No", 1.0714, "h1"),
                          ]}]}]


def test_innings_milestones_not_merged_with_aggregate_ladder_in_tests(monkeypatch):
    """Regression (17 Oct 2026, SA v AUS 2nd Test): the single-innings 'Hundred in the match' Yes @ 9.0 shared a
    selection key with the match-aggregate '100+ Runs' ladder rung @ 4.33, so the ladder's O/U-anchored aggregate
    probability (~26%) was used as the 'market' for the single-innings bet -> fake 88% edge."""
    from value_bets.pipeline import INNINGS_MS_MKT, split_innings_milestones
    monkeypatch.setattr(moviodds, "http_json", lambda *a, **k: _ms_payload("South Africa v Australia - 2nd Test"))
    rows, _ = moviodds.fetch("2026-10-17T00:00:00Z")
    assert {r["ms_scope"] for r in rows} == {"match", "innings"}
    for r in rows:
        r["fmt"] = "MULTI"
    assert split_innings_milestones(rows) == 2
    ladder = [r for r in rows if r["ms_scope"] == "match"][0]
    yes = [r for r in rows if r["ms_scope"] == "innings" and r["side"] == "over"][0]
    assert ladder["market_type"] == "batter_milestone" and yes["market_type"] == INNINGS_MS_MKT
    def key(r):
        return (r["market_type"], r["selection"], r["line"], r["side"])
    assert key(ladder) != key(yes)
    assert "in an innings" in yes["selection"]


def test_innings_milestones_merge_in_single_innings_formats(monkeypatch):
    from value_bets.pipeline import split_innings_milestones
    monkeypatch.setattr(moviodds, "http_json", lambda *a, **k: _ms_payload("ODI"))
    rows, _ = moviodds.fetch("2026-10-17T00:00:00Z")
    for r in rows:
        r["fmt"] = "ODI"
    assert split_innings_milestones(rows) == 0
    assert {r["market_type"] for r in rows} == {"batter_milestone"}
    # unknown format: be conservative and keep them apart
    for r in rows:
        r["fmt"] = None
    assert split_innings_milestones(rows) == 2


def test_guard_value_direction_and_suspect():
    from value_bets.pipeline import guard_value
    # Bavuma case: model 15% < 1/9 implied? no (11%) -> passes direction, but blended edge 88% -> suspect
    assert guard_value(0.151, 0.209, 9.0, "moviodds_bet365") == (False, "suspect_edge")
    # ladder case: model 15% below 1/4.33 = 23% -> edge only from the market blend -> never alert
    assert guard_value(0.151, 0.21, 4.33, "moviodds_bet365") == (False, "model_disagrees")
    # commission counts: 0.5 model at 2.02 on Exchange S (eff 2.0) is not above implied
    assert guard_value(0.499, 0.53, 2.02, "smarkets")[1] == "model_disagrees"
    assert guard_value(0.30, 0.29, 4.0, "moviodds_bet365") == (True, None)
    assert guard_value(None, 0.29, 4.0, "moviodds_bet365") == (True, None)


def test_detect_fmt_hundred_milestone_is_not_the_hundred():
    from value_bets.pipeline import detect_fmt
    texts = ["One Day Cup", "South Australia vs Queensland", "Batsman to score a Hundred in the match"]
    assert detect_fmt(texts, False, None, None)[0] == "ODI"
    assert detect_fmt(["The Hundred Men's Competition"], False, None, None)[0] == "T20"


def test_fill_team_scope_keeps_unmatched_players_in_team_market():
    """Regression (17 Oct 2026, PAK v SL): 5 unmatched Pakistan names split off into a ':?' group, the remaining
    Pakistan 'Team - Top Batter' runners summed to 76% implied and the de-vig scaled H Nawaz 6.0 up to 21.8%."""
    from value_bets.pipeline import fill_team_scope
    def mk(sel, team):
        return {"market_type": "top_batter_team", "group_key_raw": "mo:1:1241", "selection": sel,
                                "team_scope": team, "player_team": None if team == "?" else team,
                                "group_key": f"mo:1:1241:{team}"}
    rows = [mk(f"p{i}", "Pakistan") for i in range(6)] + [mk("MB Azam", "?"), mk("S Agha", "?")]
    assert fill_team_scope(rows) == 2
    assert {r["group_key"] for r in rows} == {"mo:1:1241:Pakistan"}
    # a market that genuinely mixes teams is left alone
    mixed = [mk(f"p{i}", "Pakistan") for i in range(3)] + [mk(f"s{i}", "Sri Lanka") for i in range(3)] + [mk("x", "?")]
    assert fill_team_scope(mixed) == 0
