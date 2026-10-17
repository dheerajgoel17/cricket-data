"""Context-aware player-prop model: negative-binomial GLM (log link) over leakage-free context features.

Mean:   log mu = b0 + b1*log(form_stat) + b2*log(form_volume) + b3*log1p(n_eff) + [gender] + selected context terms
Spread: NB2 variance mu + alpha*mu^2, alpha fitted by maximum likelihood per (stat, format).
Context terms are empirical-Bayes shrunk log-ratios produced by value_bets.context. Which context terms are used is decided by
forward selection on a validation split *inside* the training years (backtest.py); test years are never used to choose.
"""
import json
import math

import numpy as np
from scipy.special import gammaln
from scipy.stats import nbinom

from . import config

STATS = {
    "runs":  {"kind": "bat", "y": "y_runs", "form": "form_runs", "vol": "form_balls", "n": "w_bat",
              "ctx": ["ven_runs", "opp_runs", "env_runs", "oppstr_runs", "h2h_runs", "intl", "p_bat"]},
    "sixes": {"kind": "bat", "y": "y_sixes", "form": "form_sixes", "vol": "form_balls", "n": "w_bat",
              "ctx": ["ven_sixes", "opp_sixes", "env_sixes", "oppstr_sixes", "h2h_runs", "intl", "p_bat"]},
    "fours": {"kind": "bat", "y": "y_fours", "form": "form_fours", "vol": "form_balls", "n": "w_bat",
              "ctx": ["ven_fours", "opp_fours", "env_fours", "oppstr_fours", "h2h_runs", "intl", "p_bat"]},
    "wkts":  {"kind": "bowl", "y": "y_wkts", "form": "form_wkts", "vol": "form_bb", "n": "w_bowl",
              "ctx": ["ven_wkts", "opp_wkts", "env_wkts", "oppstr_wkts", "intl", "p_bowl"]},
}
LINES = {"runs": [9.5, 19.5, 29.5, 49.5, 99.5], "sixes": [0.5, 1.5, 2.5], "fours": [1.5, 2.5, 3.5],
         "wkts": [0.5, 1.5, 2.5]}
MODEL_FILE = config.STATE / "prop_model.json"


def design(rows, stat, ctx_feats):
    """rows: DataFrame (fast path) or list of feature dicts."""
    import pandas as pd
    if not isinstance(rows, pd.DataFrame):
        rows = pd.DataFrame(rows)
    s = STATS[stat]
    cols = [np.ones(len(rows)),
            np.log(rows[s["form"]].to_numpy(float) + 1e-3),
            np.log(rows[s["vol"]].to_numpy(float) + 1e-3),
            np.log1p(rows[s["n"]].to_numpy(float)),
            (rows["gender"] == "female").to_numpy(float)]
    for f in ctx_feats:
        cols.append(rows[f].to_numpy(float))
    return np.column_stack(cols)


def _y(rows, stat):
    import pandas as pd
    if isinstance(rows, pd.DataFrame):
        return rows[STATS[stat]["y"]].to_numpy(float)
    return np.array([r[STATS[stat]["y"]] for r in rows], dtype=float)


def fit_poisson(X, y, ridge=1e-3, iters=30, w=None):
    w = np.ones(len(y)) if w is None else w
    b = np.zeros(X.shape[1])
    b[0] = math.log(max(y.mean(), 1e-3))
    for _ in range(iters):
        eta = np.clip(X @ b, -10, 8)
        mu = np.exp(eta)
        H = X.T @ (X * (w * mu)[:, None]) + ridge * np.eye(X.shape[1])
        g = X.T @ (w * (y - mu)) - ridge * b
        step = np.linalg.solve(H, g)
        b += step
        if np.abs(step).max() < 1e-7:
            break
    return b


def nb_ll(y, mu, a):
    r = 1.0 / a
    return (gammaln(y + r) - gammaln(r) - gammaln(y + 1) + r * np.log(r / (r + mu)) + y * np.log(mu / (r + mu)))


def fit_alpha(y, mu):
    grid = np.exp(np.linspace(np.log(0.01), np.log(5), 80))
    ll = [nb_ll(y, mu, a).sum() for a in grid]
    return float(grid[int(np.argmax(ll))])


def p_over(mu, alpha, line):
    """P(X > line) for NB2(mu, alpha); vectorised over mu."""
    r = 1.0 / alpha
    k = math.floor(line)
    return nbinom.sf(k, r, r / (r + np.asarray(mu)))


TRAIN_HALF_LIFE_DAYS = None  # set by backtest experiment; None = unweighted


def fit(rows, stat, ctx_feats, half_life=None):
    X = design(rows, stat, ctx_feats)
    y = _y(rows, stat)
    w = None
    hl = half_life or TRAIN_HALF_LIFE_DAYS
    if hl:
        d = rows["day"].to_numpy(float)
        w = 0.5 ** ((d.max() - d) / hl)
        w = w / w.mean()
    b = fit_poisson(X, y, w=w)
    mu = np.exp(np.clip(X @ b, -10, 8))
    return {"coef": b.tolist(), "alpha": fit_alpha(y, mu), "ctx": list(ctx_feats), "n_train": int(len(y))}


def predict_mu(m, rows, stat):
    X = design(rows, stat, m["ctx"])
    return np.exp(np.clip(X @ np.array(m["coef"]), -10, 8))


def save(models, meta):
    MODEL_FILE.parent.mkdir(parents=True, exist_ok=True)
    MODEL_FILE.write_text(json.dumps({"models": models, "meta": meta}, indent=1))


def load():
    if not MODEL_FILE.exists():
        return None
    return json.loads(MODEL_FILE.read_text())
