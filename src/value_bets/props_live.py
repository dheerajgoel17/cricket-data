"""Live player-prop probabilities + human-readable 'why' from the context NB-GLM (value_bets.propmodel / value_bets.backtest)."""
import math
import pickle

import pandas as pd
from rapidfuzz import fuzz, process

from . import config, context, history
from . import propmodel as pm

D0 = pd.Timestamp("2000-01-01")
CACHE_VERSION = 2
LABEL = {"wx": "weather", "ven": "at this venue", "opp": "vs this opposition", "env": "venue environment",
         "oppstr": "opposition strength", "h2h": "team H2H context", "intl": "international match",
         "p_bat": "batting frequency (role)", "p_bowl": "bowling frequency (role)"}


def _prepare(H):
    p = H.players.copy()
    p["day"] = (p["date"] - D0).dt.days
    mm = H.matches[["match_id", "team_type"]].copy()
    mm["match_id"] = mm["match_id"].astype(str)
    return p.merge(mm, on="match_id", how="left")


def load_context(H):
    f = config.STATE / "context_cache.pkl"
    key = (history.repo_commit(), CACHE_VERSION)
    if f.exists():
        try:
            with open(f, "rb") as fh:
                k, ctx = pickle.load(fh)
            if k == key:
                return ctx
        except Exception:
            pass
    ctx, _, _ = context.build(_prepare(H), record_from_day=None)
    context.freeze(ctx)
    with open(f, "wb") as fh:
        pickle.dump((key, ctx), fh, protocol=pickle.HIGHEST_PROTOCOL)
    return ctx


class PropEngine:
    def __init__(self, H):
        self.H = H
        m = pm.load()
        if not m:
            raise RuntimeError("state/prop_model.json missing - run `python -m value_bets.backtest` once")
        self.models, self.meta = m["models"], m["meta"]
        self.ctx = load_context(H)
        self.day = (pd.Timestamp.now().normalize() - D0).days
        self.venues = {}
        for (v, f, g) in self.ctx.venv:
            self.venues.setdefault((f, g), set()).add(v)
        intl = H.matches[H.matches.team_type == "international"]
        self.intl_teams = set(intl.team_a) | set(intl.team_b)

    def venue_key(self, raw, fmt, g):
        """Match a source venue name ('M.Chinnaswamy Stadium, Bangalore') to a history venue key."""
        v = context.norm_venue(raw)
        if not v:
            return None
        pool = self.venues.get((fmt, g)) or set()
        if v in pool:
            return v
        best = process.extractOne(v, list(pool), scorer=fuzz.token_set_ratio) if pool else None
        return best[0] if best and best[1] >= 90 else None

    def features(self, stat, pid, team, opp, venue_key, fmt, g):
        intl = team in self.intl_teams and opp in self.intl_teams
        fn = self.ctx.bat_features if pm.STATS[stat]["kind"] == "bat" else self.ctx.bowl_features
        f = fn(pid, team, opp, venue_key, fmt, g, intl, self.day)
        f["gender"] = g
        return f

    def model(self, stat, fmt):
        return self.models.get(f"{stat}/{fmt}")

    def mu(self, stat, fmt, f):
        m = self.model(stat, fmt)
        return float(pm.predict_mu(m, [f], stat)[0]), m

    def p_over(self, stat, fmt, f, line):
        mu, m = self.mu(stat, fmt, f)
        return float(pm.p_over(mu, m["alpha"], line)), mu, m

    def anchor_mu(self, stat, fmt, line, p_target):
        """Mean that makes NB P(X>line) equal a market probability (for pricing milestone ladders)."""
        m = self.model(stat, fmt)
        lo, hi = 1e-3, 400.0
        for _ in range(60):
            mid = math.sqrt(lo * hi)
            if pm.p_over(mid, m["alpha"], line) < p_target:
                lo = mid
            else:
                hi = mid
        return math.sqrt(lo * hi)

    def recent(self, pid, fmt, g, kind, n=5, col=None):
        d = self.H.by_pid.get(pid)
        if d is None:
            return []
        d = d[(d.fmt == fmt) & (d.gender == g) & (d["batted"] if kind == "bat" else d["bowled"])]
        col = col or ("wickets" if kind == "bowl" else "runs")
        return [int(x) for x in d[col].values[-n:][::-1]]

    def why(self, stat, fmt, g, f, pid, opp, venue_raw, venue_key, line, side, p_model, p_market, milestone=False, wx=None):
        s = pm.STATS[stat]
        m = self.model(stat, fmt)
        raw = f["raw_form"]
        unit = {"runs": "runs", "sixes": "sixes", "fours": "fours", "wkts": "wkts"}[stat]
        if s["kind"] == "bat":
            n = raw["w_bat"]
            avg = raw[stat] / n if n else float("nan")
            role = f"bats in {100 * f['p_bat']:.0f}% of games played"
            last = self.recent(pid, fmt, g, "bat", col=stat)
            ven, opp_raw = f["raw_ven"], f["raw_opp"]
            idx = {"runs": 1, "sixes": 2, "fours": 3}[stat]
        else:
            n = raw["w_bowl"]
            avg = raw["wkts"] / n if n else float("nan")
            role = f"bowls in {100 * f['p_bowl']:.0f}% of games, {raw['bb'] / max(n, 1e-9) / 6:.1f} overs/spell"
            last = self.recent(pid, fmt, g, "bowl")
            ven, opp_raw = f["raw_ven"], f["raw_opp"]
            idx = 1
        what = f"{int(line + 0.5)}+ {unit}" if milestone else f"{side} {line} {unit}"
        parts = [f"Model {100 * p_model:.0f}% vs market {100 * p_market:.0f}% for {what}" if p_market is not None
                 else f"Model {100 * p_model:.0f}% for {what}"]
        parts.append(f"form {avg:.1f} {unit}/{'inn' if s['kind'] == 'bat' else 'spell'} recency-weighted {fmt} "
                     f"(n_eff {n:.1f}; last {len(last)}: {', '.join(map(str, last)) or '-'}), {role}")
        if venue_key and ven[0]:
            parts.append(f"at {venue_raw}: {int(ven[0])} {'inns' if s['kind'] == 'bat' else 'spells'} avg {ven[idx] / ven[0]:.1f}")
        elif not venue_key:
            parts.append("venue unknown/unmatched (venue terms neutral)")
        if opp_raw[0]:
            parts.append(f"vs {opp}: {int(opp_raw[0])} {'inns' if s['kind'] == 'bat' else 'spells'} avg {opp_raw[idx] / opp_raw[0]:.1f}")
        # multiplicative effect of each backtest-selected context term on the expected value
        coef = m["coef"][5:]
        eff = []
        for c, name in zip(coef, m["ctx"], strict=False):
            if name in ("p_bat", "p_bowl", "intl"):
                continue
            e = math.exp(c * f[name]) - 1
            if abs(e) >= 0.01:
                lab = f"weather ({name[3:]})" if name.startswith("wx_") else LABEL.get(name.split('_')[0], name)
                eff.append(f"{lab} {100 * e:+.0f}%")
        if eff:
            parts.append("context adj: " + ", ".join(eff))
        if wx:  # weather when it matters: a model weather term moved the expectation, or rain/humidity/cloud stand out
            w = wx.get("window") or {}
            bits = []
            if (w.get("rain_prob_max") or 0) >= 40:
                bits.append(f"rain chance up to {w['rain_prob_max']}%")
            if (w.get("humidity_mean") or 0) >= 75:
                bits.append(f"high humidity {w['humidity_mean']}%")
            if (w.get("cloud_mean") or 0) >= 70:
                bits.append(f"cloud cover {w['cloud_mean']}%")
            wx_eff = [x for x in eff if x.startswith("weather")]
            if bits or wx_eff:
                parts.append("weather: " + ", ".join(bits or ["conditions typical"]))
        return "; ".join(parts)
