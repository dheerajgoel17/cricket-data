"""All tunables in one place. Override any key with env CV_<KEY> (e.g. CV_MIN_EDGE=0.07)."""
import os
from pathlib import Path

_PKG = Path(__file__).resolve().parent
# Inside the cricket-data repo (src/value_bets): working dir is <repo>/value_bets and the data is the repo itself.
IN_DATA_REPO = _PKG.parent.name == "src" and (_PKG.parent.parent / "data" / "matches").is_dir()
_DEF_ROOT = _PKG.parent.parent / "value_bets" if IN_DATA_REPO else _PKG.parent
ROOT = Path(os.environ.get("CV_ROOT") or _DEF_ROOT)
DATA_REPO = Path(os.environ.get("CV_DATA_REPO") or (_PKG.parent.parent if IN_DATA_REPO else ROOT / "data-repo"))
OUT = Path(os.environ.get("CV_OUT") or ROOT / "out")
STATE = Path(os.environ.get("CV_STATE") or ROOT / "state")
ARCHIVE = Path(os.environ.get("CV_ARCHIVE") or ROOT / "archive")
SNAPSHOTS = Path(os.environ.get("CV_SNAPSHOTS") or OUT / "snapshots")
MAPPINGS = Path(os.environ.get("CV_MAPPINGS") or ROOT / "mappings")

DEFAULTS = {
    "MIN_EDGE": 0.05,              # minimum edge (expected return) to report
    "WINDOW_HOURS": 24.0,          # only matches starting within this many hours
    "MIN_MINUTES_TO_START": 5.0,   # and at least this far in the future
    "KELLY_FRACTION": 0.25,
    "MAX_STAKE_PCT": 2.0,          # cap on stake % of bankroll
    "MIN_ODDS": 1.25,
    "MAX_ODDS_WINNER": 8.0,
    "MAX_ODDS_PROP": 6.0,          # O/U player props
    "MAX_ODDS_TOP": 15.0,          # top batter/bowler
    "MIN_EXCHANGE_LIQ_GBP": 20.0,  # money available at the back price (Exchange S/Matchbook)
    "MIN_POLY_LIQ_USD": 1000.0,
    "MAX_SPREAD_RATIO": 1.25,      # exchange lay/back ratio to trust a mid price
    "MIN_PLAYER_NEFF": 8.0,        # effective (recency-weighted) innings needed for prop bets
    "MIN_TEAM_MATCHES": 10,        # matches in history needed per team for winner model
    "MAX_MODEL_MARKET_GAP": 0.15,  # abs prob gap; bigger model-vs-market disagreement = likely model/data error -> drop
    "MAX_MODEL_MARKET_LOGIT_GAP": 0.9,  # same in log-odds (odds ratio ~2.5); matters for longshots
    "MIN_P_SELECTED": 0.6,         # top batter/bowler: player must be in >=60% of team's recent XIs
    "W_MODEL_WINNER": 0.30,        # blend weight for model vs market consensus
    "W_MODEL_PROP": 0.45,
    "W_MODEL_TOP": 0.35,
    "REALERT_EDGE_DELTA": 0.03,    # re-alert only if edge grew by >= 3 percentage points
    "COMM_SMARKETS": 0.02,
    "COMM_MATCHBOOK": 0.02,
    "COMM_BETFAIR": 0.05,
    "COMM_POLYMARKET": 0.0,
    "DATA_MAX_AGE_HOURS": 20.0,
    "SNAPSHOT_KEEP_DAYS": 45,
    "SNAPSHOT_MAX_MB": 1500,
    "HTTP_TIMEOUT": 25,
    "SOURCE_TIMEOUT": 90,          # per-adapter wall clock
    "MC_SIMS": 20000,
    "ODDSAPI_MIN_INTERVAL_HOURS": 8.0,
    "ODDSAPI_MONTHLY_CREDIT_CAP": 150,
    "PLAYER_HALF_LIFE_DAYS": 540,
    # Props only (match winner dropped). Polymarket/Matchbook/Odds API/Exchange B only price match winner, so they
    # are off by default; add them back e.g. CV_SOURCES=smarkets,moviodds_bet365,betfair
    "SOURCES": "smarkets,moviodds_bet365",
    "FEEDK_SPACING_SECS": 2.0,     # Feed K (adapters/feedk.py, on whenever FEEDK_URL and FEEDK_BOOKS are set): seconds between its requests
    "FEEDK_MAX_EVENTS": 10,        # ... event pages fetched per book per run
    "FEEDK_MIN_OFFERS": 4,         # ... only events with at least this many offers (the others carry no player markets)
    "FEEDK_HORIZON_HOURS": 72.0,   # ... only matches starting within this many hours
    "FEEDK_BUDGET_SECS": 70.0,     # ... starts no request after this long (the whole source is cut at SOURCE_TIMEOUT)
    "FEEDE_SPACING_SECS": 2.0,     # Feed E (adapters/feede.py, on whenever FEEDE_BOOKS is set): seconds between its requests
    "FEEDE_MAX_EVENTS": 24,        # ... event pages fetched per book per run
    "FEEDE_HORIZON_HOURS": 72.0,   # ... only matches starting within this many hours
    "FEEDE_BUDGET_SECS": 70.0,     # ... starts no request after this long (the whole source is cut at SOURCE_TIMEOUT)
    "DATA_REFRESH": 0 if IN_DATA_REPO else 1,  # 0 = never git-pull the data repo (e.g. when running inside it)
    "MIN_ODDS_MILESTONE": 1.25,
    "WEATHER": 1,                  # Open-Meteo forecast per event (free, no key); 0 = off
    "RAIN_PROB_WARN": 50,          # rain-risk flag if max hourly precipitation probability in the match window >= this
    "RAIN_MM_WARN": 2.0,           # ... or forecast rain in the window >= this many mm
    "MAX_ODDS_MILESTONE": 10.0,
    "MAX_EDGE": 0.30,
    "CROSS_FORMAT_WEIGHT": 0.0,    # weight of other-format form in player features (was 0.25; see MODEL_BACKTEST.md)              # edges above this are flagged 'suspect' (likely mapping/pricing error), never alerted
}

def get(key):
    v = os.environ.get("CV_" + key)
    d = DEFAULTS[key]
    if v is None:
        return d
    return type(d)(v)

for p in (OUT, STATE, SNAPSHOTS):
    p.mkdir(parents=True, exist_ok=True)
