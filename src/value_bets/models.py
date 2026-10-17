"""Player-level models from recency-weighted per-player distributions (cricket-data players table).
All probabilities are conditional on the player actually playing (books void non-starters); O/U runs/sixes are
conditional on batting and wickets on bowling (assumed void otherwise - check each book's rules)."""
import numpy as np

from . import config

PRIOR_K = 3.0  # pseudo-innings of population prior


class PlayerModel:
    def __init__(self, hist):
        self.h = hist
        self.cache = {}

    def profile(self, pid, gender, fmt):
        key = (pid, gender, fmt)
        if key in self.cache:
            return self.cache[key]
        d = self.h.by_pid.get(pid)
        prof = None
        if d is not None and len(d):
            d = d[d.gender == gender]
        if d is not None and len(d):
            age = (self.h.last_date - d["date"]).dt.days.values
            w = 0.5 ** (age / config.get("PLAYER_HALF_LIFE_DAYS"))
            w = np.where(d["fmt"].values == fmt, w, 0.25 * w)  # other formats count a quarter
            w = np.where(age > 6 * 365, 0, w)
            bat = d["batted"].values
            bowl = d["bowled"].values
            pop = self.h.pop.get((gender, fmt)) or self.h.pop.get(("male", fmt))
            prof = {
                "n_eff_bat": float(w[bat].sum()), "n_eff_bowl": float(w[bowl].sum()),
                "n_fmt": int((d["fmt"].values == fmt).sum()),
                "runs": d["runs"].values[bat], "sixes": d["sixes"].values[bat], "w_bat": w[bat],
                "wkts": d["wickets"].values[bowl], "w_bowl": w[bowl],
                "p_bat": float((w * bat).sum() + 2 * pop["p_bat"]) / float(w.sum() + 2),
                "p_bowl": float((w * bowl).sum() + 2 * pop["p_bowl"]) / float(w.sum() + 2),
                "last": str(d["date"].max().date()), "team": d["team"].iloc[-1],
            }
        self.cache[key] = prof
        return prof

    def p_over(self, prof, stat, line, gender, fmt):
        pop = self.h.pop.get((gender, fmt)) or self.h.pop.get(("male", fmt))
        if stat == "wkts":
            vals, w, prior = prof["wkts"], prof["w_bowl"], pop["wkts"]
        else:
            vals, w, prior = prof[stat], prof["w_bat"], pop[stat]
        pp = float((prior > line).mean())
        return float((w * (vals > line)).sum() + PRIOR_K * pp) / float(w.sum() + PRIOR_K)

    def p_selected(self, pid, team, fmt):
        tr = self.h.team_recent.get(team)
        d = self.h.by_pid.get(pid)
        if tr is None or d is None:
            return 0.3
        t = tr[tr.fmt == fmt].tail(8)
        if len(t) < 4:
            t = tr.tail(8)
        if not len(t):
            return 0.3
        mine = set(d["match_id"].astype(str))
        return float(np.mean([m in mine for m in t["match_id"].astype(str)]))

    def top_probs(self, players, gender, fmt, stat="runs", sims=None, seed=7):
        """players: list of dict(key, pid or None, team). Returns {key: P(top | plays)} with dead-heat split.
        stat 'runs' (top batter) or 'wkts' (top bowler)."""
        sims = sims or config.get("MC_SIMS")
        rng = np.random.default_rng(seed)
        pop = self.h.pop.get((gender, fmt)) or self.h.pop.get(("male", fmt))
        n = len(players)
        psel = np.zeros(n)
        out_vals = np.zeros((sims, n))
        for i, p in enumerate(players):
            prof = self.profile(p["pid"], gender, fmt) if p.get("pid") else None
            if prof is None:
                psel[i] = 0.3
                pact = pop["p_bat"] if stat == "runs" else pop["p_bowl"]
                pool, pw, kprior = (pop["runs"] if stat == "runs" else pop["wkts"]), None, 1.0
            else:
                psel[i] = self.p_selected(p["pid"], p["team"], fmt)
                pact = prof["p_bat"] if stat == "runs" else prof["p_bowl"]
                pool = prof["runs"] if stat == "runs" else prof["wkts"]
                pw = prof["w_bat"] if stat == "runs" else prof["w_bowl"]
                kprior = PRIOR_K / (pw.sum() + PRIOR_K) if len(pool) else 1.0
            prior = pop["runs"] if stat == "runs" else pop["wkts"]
            use_prior = rng.random(sims) < kprior
            a = rng.choice(prior, sims)
            if len(pool) and pw is not None and pw.sum() > 0:
                b = rng.choice(pool, sims, p=pw / pw.sum())
            else:
                b = a
            v = np.where(use_prior, a, b).astype(float)
            act = rng.random(sims) < pact
            out_vals[:, i] = np.where(act, v, -1.0)  # -1: did not bat / bowl
        # sample an XI per team: 11 without replacement, weighted by recent selection rate (Gumbel top-k)
        psel = np.maximum(psel, 0.05)
        plays = np.zeros((sims, n), dtype=bool)
        teams = {}
        for i, p in enumerate(players):
            teams.setdefault(p["team"], []).append(i)
        for t, idx in teams.items():
            idx = np.array(idx)
            if len(idx) <= 11:
                plays[:, idx] = True
                continue
            g = np.log(psel[idx] / (1 - np.minimum(psel[idx], 0.999))) + rng.gumbel(size=(sims, len(idx)))
            top = np.argsort(-g, axis=1)[:, :11]
            sel = np.zeros((sims, len(idx)), dtype=bool)
            np.put_along_axis(sel, top, True, axis=1)
            plays[:, idx] = sel
        vals = np.where(plays, out_vals, -2.0)
        best = vals.max(axis=1, keepdims=True)
        top = (vals == best) & plays & (vals >= 0)
        share = top / np.maximum(top.sum(axis=1, keepdims=True), 1)
        res = {}
        for i, p in enumerate(players):
            pl = plays[:, i]
            res[p["key"]] = float(share[pl, i].mean()) if pl.sum() > 50 else None
        return res, dict(zip([p["key"] for p in players], psel, strict=False))
