"""Sequential, leakage-free context engine over the cricket-data players table.

Matches are processed in date order. For every player-row we first *read* features from the state built from
strictly earlier matches, then update the state with the whole match. The same state answers live queries.
cricket-data stores per-player match aggregates only (Cricsheet ball-by-ball is parsed upstream but not stored), so
there is no batting position and no batter-vs-bowler data: balls-faced and overs-bowled shares are the role proxies.
"""
import math
import re
from collections import defaultdict

H_FORM = 540.0   # days, player form half-life
H_TEAM = 365.0   # days, team strength half-life
K_FORM = 3.0     # pseudo-innings toward population
K_SPLIT = 6.0    # pseudo-innings for player-at-venue / player-vs-opposition splits
K_ENV = 60.0     # pseudo-innings for venue environment
K_TEAM = 40.0    # pseudo-innings for team strength / H2H team context

BAT_STATS = ("runs", "balls", "sixes", "fours")


def norm_venue(v):
    """'M.Chinnaswamy Stadium, Bengaluru' -> 'm chinnaswamy stadium' (city suffix dropped)."""
    if not isinstance(v, str) or not v.strip():
        return None
    v = v.split(",")[0].lower()
    v = re.sub(r"[^a-z0-9 ]", " ", v)
    return re.sub(r"\s+", " ", v).strip() or None


def _decay(dt_days, h):
    return 0.5 ** (max(dt_days, 0) / h)


class EW:
    """Exponentially time-decayed sums."""
    __slots__ = ("t", "s")

    def __init__(self, n):
        self.t = None
        self.s = [0.0] * n

    def read(self, day, h):
        if self.t is None:
            return [0.0] * len(self.s)
        f = _decay(day - self.t, h)
        return [x * f for x in self.s]

    def add(self, day, h, vals):
        if self.t is not None:
            f = _decay(day - self.t, h)
            self.s = [x * f for x in self.s]
        self.t = day
        self.s = [a + b for a, b in zip(self.s, vals, strict=False)]


def zeros(n):
    return lambda: [0.0] * n


class Context:
    def __init__(self):
        # player form per (pid, fmt, gender): w_app, w_bat, runs, balls, sixes, fours, w_bowl, wkts, balls_bowled
        self.form = {}
        self.form_all = {}  # per (pid, gender), same layout, all formats
        self.pv_bat = defaultdict(zeros(5))  # (pid, venue, fmt): n, runs, sixes, fours, balls
        self.pv_bowl = defaultdict(zeros(3))  # n, wkts, balls_bowled
        self.po_bat = defaultdict(zeros(5))  # (pid, opp, fmt)
        self.po_bowl = defaultdict(zeros(3))
        self.venv = defaultdict(zeros(6))  # (venue, fmt, g): n_bat, runs, sixes, fours, n_bowl, wkts
        self.glob = defaultdict(zeros(6))  # (fmt, g) same
        self.team_conc = {}   # (team, fmt, g) EW of batters facing team: n, runs, sixes, fours
        self.team_frag = {}   # (team, fmt, g) EW of bowlers bowling at team: n, wkts
        self.h2h = defaultdict(zeros(2))     # (team, opp, fmt, g): n_bat, runs
        self.teambat = defaultdict(zeros(2))  # (team, fmt, g): n_bat, runs

    # ------------------------------------------------------------ reads
    def pop(self, fmt, g):
        G = self.glob[(fmt, g)]
        nb, nw = max(G[0], 1), max(G[4], 1)
        return {"runs": G[1] / nb if G[0] else 20.0, "sixes": G[2] / nb if G[0] else 0.8,
                "fours": G[3] / nb if G[0] else 1.8, "wkts": G[5] / nw if G[4] else 0.9}

    def player(self, pid, fmt, g, day):
        e = self.form.get((pid, fmt, g))
        s = e.read(day, H_FORM) if e else [0.0] * 9
        a = self.form_all.get((pid, g))
        sa = a.read(day, H_FORM) if a else [0.0] * 9
        # other formats count a quarter (mirrors the v1 model)
        mix = [x + 0.25 * (y - x) for x, y in zip(s, sa, strict=False)]
        return {"w_app": mix[0], "w_bat": mix[1], "runs": mix[2], "balls": mix[3], "sixes": mix[4],
                "fours": mix[5], "w_bowl": mix[6], "wkts": mix[7], "bb": mix[8], "w_bat_fmt": s[1], "w_bowl_fmt": s[6]}

    def bat_features(self, pid, team, opp, venue, fmt, g, intl, day):
        P = self.pop(fmt, g)
        pl = self.player(pid, fmt, g, day)
        wb = pl["w_bat"]
        f = {"w_bat": wb, "w_bat_fmt": pl["w_bat_fmt"], "p_bat": (pl["w_bat"] + 2 * 0.7) / (pl["w_app"] + 2)}
        for st in ("runs", "sixes", "fours"):
            f[f"form_{st}"] = (pl[st] + K_FORM * P[st]) / (wb + K_FORM)
        f["form_balls"] = (pl["balls"] + K_FORM * 18.0) / (wb + K_FORM)
        # player at venue / vs opposition, shrunk to own form (log ratio)
        for name, tab, key in (("ven", self.pv_bat, (pid, venue, fmt)), ("opp", self.po_bat, (pid, opp, fmt))):
            n, r, s6, s4, _ = tab.get(key, [0.0] * 5) if key[1] else [0.0] * 5
            for st, tot in (("runs", r), ("sixes", s6), ("fours", s4)):
                base = f[f"form_{st}"]
                f[f"{name}_{st}"] = math.log(((tot + K_SPLIT * base) / (n + K_SPLIT)) / base) if base > 0 else 0.0
            f[f"n_{name}"] = n
            f[f"raw_{name}"] = [n, r, s6, s4]
        f["raw_form"] = pl
        # venue environment vs global
        V = self.venv.get((venue, fmt, g), [0.0] * 6) if venue else [0.0] * 6
        for i, st in ((1, "runs"), (2, "sixes"), (3, "fours")):
            f[f"env_{st}"] = math.log(((V[i] + K_ENV * P[st]) / (V[0] + K_ENV)) / P[st]) if P[st] > 0 else 0.0
        f["n_env"] = V[0]
        # opposition bowling strength (runs conceded per batter innings), time-decayed
        T = self.team_conc.get((opp, fmt, g))
        t = T.read(day, H_TEAM) if T else [0.0] * 4
        for i, st in ((1, "runs"), (2, "sixes"), (3, "fours")):
            f[f"oppstr_{st}"] = math.log(((t[i] + K_TEAM * P[st]) / (t[0] + K_TEAM)) / P[st]) if P[st] > 0 else 0.0
        # team-vs-this-opposition context (batting team's runs/inn vs opp relative to its overall)
        hb = self.h2h.get((team, opp, fmt, g), [0.0, 0.0])
        tb = self.teambat.get((team, fmt, g), [0.0, 0.0])
        tmean = (tb[1] + K_TEAM * P["runs"]) / (tb[0] + K_TEAM)
        f["h2h_runs"] = math.log(((hb[1] + K_TEAM * tmean) / (hb[0] + K_TEAM)) / tmean)
        f["intl"] = 1.0 if intl else 0.0
        return f

    def bowl_features(self, pid, team, opp, venue, fmt, g, intl, day):
        P = self.pop(fmt, g)
        pl = self.player(pid, fmt, g, day)
        wb = pl["w_bowl"]
        f = {"w_bowl": wb, "w_bowl_fmt": pl["w_bowl_fmt"], "p_bowl": (pl["w_bowl"] + 2 * 0.5) / (pl["w_app"] + 2)}
        f["form_wkts"] = (pl["wkts"] + K_FORM * P["wkts"]) / (wb + K_FORM)
        f["form_bb"] = (pl["bb"] + K_FORM * 18.0) / (wb + K_FORM)
        for name, tab, key in (("ven", self.pv_bowl, (pid, venue, fmt)), ("opp", self.po_bowl, (pid, opp, fmt))):
            n, wk, _ = tab.get(key, [0.0] * 3) if key[1] else [0.0] * 3
            base = f["form_wkts"]
            f[f"{name}_wkts"] = math.log(((wk + K_SPLIT * base) / (n + K_SPLIT)) / base) if base > 0 else 0.0
            f[f"n_{name}"] = n
            f[f"raw_{name}"] = [n, wk]
        f["raw_form"] = pl
        V = self.venv.get((venue, fmt, g), [0.0] * 6) if venue else [0.0] * 6
        f["env_wkts"] = math.log(((V[5] + K_ENV * P["wkts"]) / (V[4] + K_ENV)) / P["wkts"]) if P["wkts"] > 0 else 0.0
        f["n_env"] = V[4]
        T = self.team_frag.get((opp, fmt, g))
        t = T.read(day, H_TEAM) if T else [0.0, 0.0]
        f["oppstr_wkts"] = math.log(((t[1] + K_TEAM * P["wkts"]) / (t[0] + K_TEAM)) / P["wkts"]) if P["wkts"] > 0 else 0.0
        f["intl"] = 1.0 if intl else 0.0
        return f

    # ------------------------------------------------------------ update with one whole match
    def update(self, rows, fmt, g, venue, day):
        for r in rows:
            pid, team, opp = r["player_id"], r["team"], r["opponent"]
            bat = r["balls"] > 0 or r["runs"] > 0
            bowl = r["balls_bowled"] > 0
            vals = [1.0, float(bat), r["runs"] * bat, r["balls"] * bat, r["sixes"] * bat, r["fours"] * bat,
                    float(bowl), r["wickets"] * bowl, r["balls_bowled"] * bowl]
            for d, k in ((self.form, (pid, fmt, g)), (self.form_all, (pid, g))):
                if k not in d:
                    d[k] = EW(9)
                d[k].add(day, H_FORM, vals)
            if bat:
                for tab, key in ((self.pv_bat, (pid, venue, fmt)), (self.po_bat, (pid, opp, fmt))):
                    v = tab[key]
                    v[0] += 1; v[1] += r["runs"]; v[2] += r["sixes"]; v[3] += r["fours"]; v[4] += r["balls"]
                for tab, key in ((self.venv, (venue, fmt, g)), (self.glob, (fmt, g))):
                    v = tab[key]
                    v[0] += 1; v[1] += r["runs"]; v[2] += r["sixes"]; v[3] += r["fours"]
                k = (opp, fmt, g)
                if k not in self.team_conc:
                    self.team_conc[k] = EW(4)
                self.team_conc[k].add(day, H_TEAM, [1.0, r["runs"], r["sixes"], r["fours"]])
                h = self.h2h[(team, opp, fmt, g)]
                h[0] += 1; h[1] += r["runs"]
                t = self.teambat[(team, fmt, g)]
                t[0] += 1; t[1] += r["runs"]
            if bowl:
                for tab, key in ((self.pv_bowl, (pid, venue, fmt)), (self.po_bowl, (pid, opp, fmt))):
                    v = tab[key]
                    v[0] += 1; v[1] += r["wickets"]; v[2] += r["balls_bowled"]
                for tab, key in ((self.venv, (venue, fmt, g)), (self.glob, (fmt, g))):
                    v = tab[key]
                    v[4] += 1; v[5] += r["wickets"]
                k = (opp, fmt, g)
                if k not in self.team_frag:
                    self.team_frag[k] = EW(2)
                self.team_frag[k].add(day, H_TEAM, [1.0, r["wickets"]])


def build(players_df, record_from_day=None):
    """Run the engine over the whole table. Returns (context, bat_rows, bowl_rows) where *_rows are the
    leakage-free feature dicts (+targets) for rows on/after record_from_day."""
    ctx = Context()
    cols = ["match_id", "day", "fmt", "gender", "venue", "team_type", "player_id", "team", "opponent", "runs",
            "balls", "sixes", "fours", "wickets", "balls_bowled", "date"]
    df = players_df[cols].sort_values(["day", "match_id"])
    bat_rows, bowl_rows = [], []
    recs = df.to_dict("records")
    i = 0
    n = len(recs)
    while i < n:
        j = i
        mid = recs[i]["match_id"]
        while j < n and recs[j]["match_id"] == mid:
            j += 1
        grp = recs[i:j]
        r0 = grp[0]
        fmt, g, venue, day = r0["fmt"], r0["gender"], norm_venue(r0["venue"]), r0["day"]
        intl = r0["team_type"] == "international"
        if record_from_day is not None and day >= record_from_day:
            for r in grp:
                if not isinstance(r["player_id"], str):
                    continue
                if r["balls"] > 0 or r["runs"] > 0:
                    f = ctx.bat_features(r["player_id"], r["team"], r["opponent"], venue, fmt, g, intl, day)
                    f.pop("raw_form"); f.pop("raw_ven"); f.pop("raw_opp")
                    f.update(y_runs=r["runs"], y_sixes=r["sixes"], y_fours=r["fours"], fmt=fmt, gender=g, day=day,
                             pid=r["player_id"], match_id=mid)
                    bat_rows.append(f)
                if r["balls_bowled"] > 0:
                    f = ctx.bowl_features(r["player_id"], r["team"], r["opponent"], venue, fmt, g, intl, day)
                    f.pop("raw_form"); f.pop("raw_ven"); f.pop("raw_opp")
                    f.update(y_wkts=r["wickets"], fmt=fmt, gender=g, day=day, pid=r["player_id"], match_id=mid)
                    bowl_rows.append(f)
        ctx.update([r for r in grp if isinstance(r["player_id"], str)], fmt, g, venue, day)
        i = j
    return ctx, bat_rows, bowl_rows


def freeze(ctx):
    """Turn defaultdicts into dicts so the context can be pickled (reads only use .get)."""
    for k, v in list(vars(ctx).items()):
        if isinstance(v, defaultdict):
            setattr(ctx, k, dict(v))
    return ctx
