"""De-vigging, exchange mid prices, consensus, edge and Kelly."""
import math

from . import config


def devig(odds):
    """odds: list of decimal odds (complete market). Multiplicative for 2-way; power method for n>2
    (reduces favourite-longshot bias). Returns list of probs summing to 1."""
    q = [1 / o for o in odds]
    s = sum(q)
    if len(q) <= 2 or s <= 1:
        return [x / s for x in q]
    lo, hi = 1.0, 3.0  # find k with sum(q^k) = 1
    for _ in range(60):
        k = (lo + hi) / 2
        if sum(x ** k for x in q) > 1:
            lo = k
        else:
            hi = k
    p = [x ** ((lo + hi) / 2) for x in q]
    t = sum(p)
    return [x / t for x in p]


def exchange_mid(back, lay):
    if not back or not lay or lay < back:
        return None
    if lay / back > config.get("MAX_SPREAD_RATIO"):
        return None
    return (1 / back + 1 / lay) / 2


def commission(source):
    s = source.split(":")[0]
    return {"smarkets": config.get("COMM_SMARKETS"), "matchbook": config.get("COMM_MATCHBOOK"),
            "betfair_delayed": config.get("COMM_BETFAIR"), "polymarket": config.get("COMM_POLYMARKET")}.get(s, 0.0)


def effective_odds(odds, source):
    return 1 + (odds - 1) * (1 - commission(source))


def edge(p, odds, source):
    return p * effective_odds(odds, source) - 1


def kelly_pct(p, odds, source):
    b = effective_odds(odds, source) - 1
    if b <= 0:
        return 0.0
    f = (b * p - (1 - p)) / b
    return max(0.0, min(config.get("MAX_STAKE_PCT"), 100 * config.get("KELLY_FRACTION") * f))


def logit(p):
    p = min(max(p, 1e-6), 1 - 1e-6)
    return math.log(p / (1 - p))
