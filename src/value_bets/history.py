"""Load the cricket-data history and build: team Elo (per gender x format group), venue/H2H features,
a logistic match-winner model fitted on past seasons, team rosters and per-player innings tables."""
import glob
import math
import pickle
import subprocess
from collections import defaultdict

import numpy as np
import pandas as pd

from . import config

FMT = {"T20": "T20", "IT20": "T20", "ODI": "ODI", "ODM": "ODI", "Test": "MULTI", "MDM": "MULTI"}
FEATURES = ["elo_diff", "home", "h2h"]


def repo_commit():
    try:
        return subprocess.check_output(["git", "-C", str(config.DATA_REPO), "rev-parse", "HEAD"], text=True).strip()
    except Exception:
        return "unknown"


def _read(kind, since=None):
    fs = sorted(glob.glob(str(config.DATA_REPO / "data" / kind / "*.csv.gz")))
    if since:
        fs = [f for f in fs if f.rsplit("/", 1)[-1] >= since]
    return pd.concat([pd.read_csv(f, low_memory=False) for f in fs], ignore_index=True)


class History:
    def __init__(self):
        m = _read("matches")
        m["date"] = pd.to_datetime(m["date"])
        m["fmt"] = m["match_type"].map(FMT)
        m = m[m["fmt"].notna()].sort_values(["date", "match_id"]).reset_index(drop=True)
        self.matches = m
        self.last_date = m["date"].max()
        self._elo_pass()
        self._fit_logit()
        self._players()

    # ---------------- team model ----------------
    def _elo_pass(self):
        R = defaultdict(lambda: 1500.0)
        N = defaultdict(int)
        venue = defaultdict(int)
        h2h = defaultdict(list)  # (g, fmt, a, b) sorted -> [(date, winner)]
        rows = []
        for r in self.matches.itertuples(index=False):
            a, b, g, f = r.team_a, r.team_b, r.gender, r.fmt
            feats = self._features(R, N, venue, h2h, a, b, g, f, r.venue, r.date)
            res = r.result if isinstance(r.result, str) else ""
            if isinstance(r.winner, str) and r.winner in (a, b):
                y = 1.0 if r.winner == a else 0.0
            elif res in ("draw", "tie"):
                y = 0.5
            else:
                y = None
            if y is not None:
                if feats["n_min"] >= config.get("MIN_TEAM_MATCHES") and y != 0.5:
                    rows.append({**feats, "y": y, "date": r.date, "fmt": f})
                ea = 1 / (1 + 10 ** (-(feats["elo_raw"]) / 400))
                for key_f in (f, "ALL"):
                    ka, kb = (a, g, key_f), (b, g, key_f)
                    k = 24 * (1.6 if min(N[ka], N[kb]) < 15 else 1.0)
                    e = 1 / (1 + 10 ** ((R[kb] - R[ka]) / 400)) if key_f == "ALL" else ea
                    R[ka] += k * (y - e)
                    R[kb] -= k * (y - e)
                    N[ka] += 1
                    N[kb] += 1
                h2h[(g, f) + tuple(sorted((a, b)))].append((r.date, r.winner if y != 0.5 else None))
            if isinstance(r.venue, str):
                venue[(a, g, r.venue)] += 1
                venue[(b, g, r.venue)] += 1
        self.R, self.N, self.venue, self.h2h = R, N, venue, h2h
        self.train = pd.DataFrame(rows)

    def rating(self, team, g, f, R=None, N=None):
        R = self.R if R is None else R
        N = self.N if N is None else N
        if N.get((team, g, f), 0) >= 8:
            return R.get((team, g, f), 1500.0), N.get((team, g, f), 0)
        return R.get((team, g, "ALL"), 1500.0), N.get((team, g, "ALL"), 0)

    def _features(self, R, N, venue, h2h, a, b, g, f, ven, date):
        ra, na = self.rating(a, g, f, R, N)
        rb, nb = self.rating(b, g, f, R, N)
        home = 0.0
        if isinstance(ven, str):
            va, vb = venue.get((a, g, ven), 0), venue.get((b, g, ven), 0)
            if va >= 3 and va > 2 * vb:
                home = 1.0
            elif vb >= 3 and vb > 2 * va:
                home = -1.0
        hs = 0.0
        recs = h2h.get((g, f) + tuple(sorted((a, b))), [])
        if recs:
            wsum = ssum = 0.0
            for d, w in recs[-15:]:
                age = (date - d).days / 365.0
                wt = 0.5 ** (age / 2.0)
                wsum += wt
                ssum += wt * (1 if w == a else (-1 if w == b else 0))
            hs = ssum / (wsum + 3.0)
        return {"elo_raw": ra - rb, "elo_diff": (ra - rb) / 400.0, "home": home, "h2h": hs, "n_min": min(na, nb)}

    def _fit_logit(self):
        t = self.train
        cut = pd.Timestamp("2025-01-01")
        tr, te = t[t.date < cut], t[t.date >= cut]

        def fit(df, cols):
            X = np.c_[np.ones(len(df)), df[cols].values]
            y = df["y"].values
            w = np.zeros(X.shape[1])
            for _ in range(300):  # Newton / IRLS with small ridge
                p = 1 / (1 + np.exp(-X @ w))
                H = X.T @ (X * (p * (1 - p))[:, None]) + 1e-3 * np.eye(len(w))
                w -= np.linalg.solve(H, X.T @ (p - y) + 1e-3 * w)
            return w

        def ll(df, w, cols):
            X = np.c_[np.ones(len(df)), df[cols].values]
            p = np.clip(1 / (1 + np.exp(-X @ w)), 1e-6, 1 - 1e-6)
            y = df["y"].values
            return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))), float(np.mean((p - y) ** 2)), \
                float(np.mean((p > 0.5) == (y == 1)))

        self.coef = {}
        self.backtest = {}
        for f in ("T20", "ODI", "MULTI"):
            trf, tef = tr[tr.fmt == f], te[te.fmt == f]
            if len(trf) < 200:
                continue
            w = fit(trf, FEATURES)
            w_elo = fit(trf, ["elo_diff"])
            self.coef[f] = w
            if len(tef) > 30:
                self.backtest[f] = {"n_test": int(len(tef)), "n_train": int(len(trf)),
                                    "model_logloss_brier_acc": ll(tef, w, FEATURES),
                                    "elo_only_logloss_brier_acc": ll(tef, w_elo, ["elo_diff"]),
                                    "coin_flip_logloss": math.log(2),
                                    "coef[intercept,elo_diff,home,h2h]": [round(x, 3) for x in w]}
        # refit on everything for live use
        for f in list(self.coef):
            self.coef[f] = fit(t[t.fmt == f], FEATURES)

    def p_team_a(self, a, b, g, f, venue=None):
        """Model probability team a beats team b (2-way, excluding tie/draw). None if unsupported."""
        if f not in self.coef:
            return None, {}
        feats = self._features(self.R, self.N, self.venue, self.h2h, a, b, g, f, venue, self.last_date)
        if feats["n_min"] < config.get("MIN_TEAM_MATCHES"):
            return None, feats
        w = self.coef[f]
        z = w[0] * 0 + w[1] * feats["elo_diff"] + w[2] * feats["home"] + w[3] * feats["h2h"]  # no intercept: symmetric
        return float(1 / (1 + math.exp(-z))), feats

    # ---------------- players ----------------
    def _players(self):
        p = _read("players", since="2016")
        p["date"] = pd.to_datetime(p["date"])
        mm = self.matches[["match_id", "fmt", "gender", "venue"]].copy()
        mm["match_id"] = mm["match_id"].astype(str)
        p["match_id"] = p["match_id"].astype(str)
        p = p.merge(mm, on="match_id", how="inner")
        p["batted"] = (p["balls"] > 0) | (p["runs"] > 0)
        p["bowled"] = p["balls_bowled"] > 0
        self.players = p
        self.by_pid = {pid: g.sort_values("date") for pid, g in p.groupby("player_id")}
        cut = self.last_date - pd.Timedelta(days=5 * 365)
        recent = p[p.date >= cut]
        ros = defaultdict(list)
        agg = recent.groupby(["team", "player_id"]).agg(name=("player", "last"), last=("date", "max"),
                                                       n=("match_id", "count")).reset_index()
        for r in agg.itertuples(index=False):
            ros[r.team].append((r.name, r.player_id, str(r.last.date()), int(r.n)))
        self.rosters = dict(ros)
        # team -> recent match ids (for selection probability)
        self.team_recent = {}
        for team, g in recent.groupby("team"):
            self.team_recent[team] = g.drop_duplicates("match_id").sort_values("date")[["match_id", "date", "fmt"]]
        # population priors by gender x fmt
        self.pop = {}
        for (g, f), d in p[p.date >= self.last_date - pd.Timedelta(days=4 * 365)].groupby(["gender", "fmt"]):
            bat = d[d.batted]
            bowl = d[d.bowled]
            self.pop[(g, f)] = {"runs": bat["runs"].values, "sixes": bat["sixes"].values,
                                "wkts": bowl["wickets"].values, "p_bat": float(d["batted"].mean()),
                                "p_bowl": float(d["bowled"].mean())}

    def teams_by_gender(self):
        cut = self.last_date - pd.Timedelta(days=4 * 365)
        r = self.matches[self.matches.date >= cut]
        out = {}
        for g, d in r.groupby("gender"):
            c = pd.concat([d.team_a, d.team_b]).value_counts()
            out[g] = c.to_dict()
        return out


def load(force=False):
    """Cached build keyed on the data repo commit (rebuild ~10-20 s)."""
    cache = config.STATE / "history_cache.pkl"
    commit = repo_commit()
    if cache.exists() and not force:
        try:
            with open(cache, "rb") as f:
                c, h = pickle.load(f)
            if c == commit:
                return h
        except Exception:
            pass
    h = History()
    h.R, h.N, h.venue, h.h2h = dict(h.R), dict(h.N), dict(h.venue), dict(h.h2h)
    with open(cache, "wb") as f:
        pickle.dump((commit, h), f)
    return h
