from value_bets import strategy
from value_bets.names import PlayerResolver


def test_sixes_over_disabled_under_allowed():
    assert strategy.gate("batter_sixes", "over", 0.5, 2.5, "x", edge=0.2) == (False, "market_disabled")
    assert strategy.gate("batter_sixes", "under", 0.7, 1.7, "x", edge=0.19)[0]


def test_long_odds_and_model_alone():
    assert strategy.gate("bowler_milestone", "yes", 0.2, 8.0, "x", edge=0.3)[1] == "policy_max_odds"
    # blended fair shows edge but the model alone does not
    assert strategy.gate("batter_runs", "over", 0.45, 2.1, "x", edge=0.06)[1] == "model_alone_no_value"


def test_top_markets_need_depth():
    assert strategy.gate("top_batter_team", None, 0.3, 4.0, "x", n_src=1, edge=0.1)[1] == "top_thin_market"
    assert strategy.gate("top_batter_team", None, 0.3, 4.0, "x", n_src=2, overround=0.45, edge=0.1)[1] == "top_wide_book"
    assert strategy.gate("top_batter_team", None, 0.3, 4.0, "x", n_src=2, overround=0.2, edge=0.1)[0]


def test_loose_name_dropped():
    assert strategy.gate("batter_runs", "over", 0.6, 2.0, "x", name_score=70, edge=0.1)[1] == "loose_name_match"


def test_initial_surname_ambiguous_is_rejected():
    r = PlayerResolver({"India W": [("Shafali Verma", "a", "2026-10-01", 80), ("Sneh Verma", "b", "2026-09-01", 3)]})
    assert r.resolve("S Verma", ["India W"]) is None
    assert r.resolve("Shafali Verma", ["India W"])["player_id"] == "a"
    r2 = PlayerResolver({"India W": [("Shafali Verma", "a", "2026-10-01", 80)]})
    assert r2.resolve("S Verma", ["India W"])["player_id"] == "a"
    assert r2.resolve("Verma", ["India W"]) is None  # surname alone is not enough
