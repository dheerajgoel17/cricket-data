"""Market policy chosen by the walk-forward backtest (scripts/model_backtest, docs/MODEL_BACKTEST.md).

`gate()` is applied to every candidate value bet after the edge/odds/liquidity filters. It encodes what the backtest
and the settled alerts showed:
* batter sixes OVER is disabled (no over strategy passed validation; settled alerts went 1-8 at 2.5-6.0);
* long-odds props are capped (the model's tail probabilities are its least calibrated part);
* the model itself must show value: a bet whose edge exists only because the blended market fair is off a wide,
  thin price (typical for top-batter/bowler books) is dropped;
* top-batter/bowler bets need >= 2 independent market sources and a book overround <= MAX_TOP_OVERROUND;
* loosely matched player names (score < MIN_NAME_SCORE) are dropped instead of only flagged.
The policy can be overridden per key with value_bets/state/market_policy.json (written by the backtest).
"""
import json

from . import config
from .pricing import effective_odds

DEFAULT_POLICY = {
    "disabled": ["batter_sixes:over"],          # market_type:side ("*" = both sides)
    "max_odds": {"batter_sixes": 3.0, "batter_fours": 3.5, "batter_runs": 3.5, "bowler_wickets": 4.0,
                 "batter_milestone": 5.0, "bowler_milestone": 5.0},
    "min_edge": {"batter_sixes": 0.08, "bowler_wickets": 0.07},
    "min_model_edge": 0.02,                     # model prob alone x effective odds - 1 must reach this
    "min_sources_top": 2,
    "max_top_overround": 0.30,
    "min_name_score": 90,
}


def policy():
    p = json.loads(json.dumps(DEFAULT_POLICY))
    f = config.STATE / "market_policy.json"
    if f.exists():
        try:
            p.update(json.loads(f.read_text()))
        except (ValueError, OSError):
            pass
    return p


TOP = ("top_batter_team", "top_bowler_team", "top_batter_match", "top_bowler_match")


def gate(mt, side, pm, odds, source, n_src=1, name_score=None, overround=None, edge=None, pol=None):
    """-> (ok, reason). side is 'over'/'under'/'yes'/'no'/None."""
    p = pol or policy()
    s = (side or "").lower()
    if f"{mt}:{s}" in p["disabled"] or f"{mt}:*" in p["disabled"]:
        return False, "market_disabled"
    mo = p["max_odds"].get(mt)
    if mo and odds > mo:
        return False, "policy_max_odds"
    me = p["min_edge"].get(mt)
    if me is not None and edge is not None and edge < me:
        return False, "policy_min_edge"
    if pm is not None and pm * effective_odds(odds, source) - 1 < p["min_model_edge"]:
        return False, "model_alone_no_value"
    if mt in TOP:
        if n_src < p["min_sources_top"]:
            return False, "top_thin_market"
        if overround is not None and overround > p["max_top_overround"]:
            return False, "top_wide_book"
    if name_score is not None and name_score < p["min_name_score"]:
        return False, "loose_name_match"
    return True, ""
