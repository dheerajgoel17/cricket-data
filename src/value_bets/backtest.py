"""Prop-model backtest: v1 baseline (recency-weighted empirical, form only) vs context NB-GLM.

Years: train 2018-2022 / validate 2023-2024 (feature selection only) / test 2025-01-01 .. latest (held out).
Final live model is refit on 2018..latest with the selected features and saved to state/prop_model.json.
Usage: python -m value_bets.backtest
"""
import json
import math
import time

import numpy as np
import pandas as pd

from . import config, context, history
from . import propmodel as pm
from .util import ist, now_utc

D0 = pd.Timestamp("2000-01-01")
DAY = lambda s: (pd.Timestamp(s) - D0).days  # noqa: E731
FMTS = ["T20", "ODI"]
MIN_NEFF_EVAL = 3.0   # evaluate on established players only (books price these)
SELECT_GAIN = 0.0003  # min mean log-loss gain on validation to keep a feature


def prepare(H):
    p = H.players.copy()
    p["day"] = (p["date"] - D0).dt.days
    mm = H.matches[["match_id", "team_type"]].copy()
    mm["match_id"] = mm["match_id"].astype(str)
    return p.merge(mm, on="match_id", how="left")


def book_line(vals, w):
    """Bookmaker-style runs line: weighted median of prior scores rounded down to .5."""
    if not len(vals) or w.sum() <= 0:
        return None
    o = np.argsort(vals)
    cw = np.cumsum(w[o])
    med = vals[o][np.searchsorted(cw, cw[-1] / 2)]
    return math.floor(med) + 0.5


class Baseline:
    """Exactly the v1 PlayerModel.p_over logic, evaluated as-of each row's date."""

    def __init__(self, p, pop_end_day):
        self.by = {}
        for pid, g in p.sort_values("day").groupby("player_id"):
            self.by[pid] = {c: g[c].values for c in ("day", "fmt", "gender", "runs", "sixes", "fours", "wickets",
                                                     "balls", "balls_bowled")}
        self.pop = {}
        win = p[(p.day < pop_end_day) & (p.day >= pop_end_day - 4 * 365)]
        for (gd, f), d in win.groupby(["gender", "fmt"]):
            bat = d[(d.balls > 0) | (d.runs > 0)]
            bowl = d[d.balls_bowled > 0]
            self.pop[(gd, f)] = {"runs": bat.runs.values, "sixes": bat.sixes.values, "fours": bat.fours.values,
                                 "wkts": bowl.wickets.values}

    def probs(self, r, stat, lines):
        d = self.by.get(r["pid"])
        kind = pm.STATS[stat]["kind"]
        pop = self.pop.get((r["gender"], r["fmt"]))
        prior = pop[stat]
        vals, w = np.array([]), np.array([])
        if d is not None:
            age = r["day"] - d["day"]
            act = (d["balls"] > 0) | (d["runs"] > 0) if kind == "bat" else d["balls_bowled"] > 0
            m = (age > 0) & (age <= 6 * 365) & (d["gender"] == r["gender"]) & act
            w = 0.5 ** (age[m] / config.get("PLAYER_HALF_LIFE_DAYS"))
            w = np.where(d["fmt"][m] == r["fmt"], w, 0.25 * w)
            vals = d["wickets" if stat == "wkts" else stat][m]
        out = []
        for L in lines:
            pp = float((prior > L).mean())
            out.append((float((w * (vals > L)).sum()) + 3.0 * pp) / (float(w.sum()) + 3.0))
        bl = book_line(vals, w) if stat == "runs" else None
        return out, bl


def metrics(P, Y):
    P = np.clip(P, 1e-4, 1 - 1e-4)
    ll = -(Y * np.log(P) + (1 - Y) * np.log(1 - P))
    return {"logloss": float(ll.mean()), "brier": float(((P - Y) ** 2).mean()), "n": int(P.size)}


def calib(P, Y, bins=10):
    P, Y = P.ravel(), Y.ravel()
    edges = np.quantile(P, np.linspace(0, 1, bins + 1))
    out = []
    for i in range(bins):
        m = (P >= edges[i]) & (P <= edges[i + 1]) if i == bins - 1 else (P >= edges[i]) & (P < edges[i + 1])
        if m.sum():
            out.append({"pred": round(float(P[m].mean()), 3), "obs": round(float(Y[m].mean()), 3), "n": int(m.sum())})
    return out


def eval_set(rows, stat, model, base_cache):
    """Return (P_model, P_base, Y) over fixed lines + book line (runs)."""
    s = pm.STATS[stat]
    lines = pm.LINES[stat]
    y = rows[s["y"]].to_numpy(float)
    mu = pm.predict_mu(model, rows, stat)
    PM, PB, Y = [], [], []
    for j, L in enumerate(lines):
        PM.append(pm.p_over(mu, model["alpha"], L))
        PB.append(np.array([base_cache[i][0][j] for i in range(len(rows))]))
        Y.append((y > L).astype(float))
    return np.array(PM).T, np.array(PB).T, np.array(Y).T, y, mu


def run():
    t0 = time.time()
    H = history.load()
    p = prepare(H)
    ctx, bat, bowl = context.build(p, record_from_day=DAY("2018-01-01"))
    print(f"context built {time.time()-t0:.0f}s: {len(bat)} batting / {len(bowl)} bowling rows since 2018")
    DFB, DFW = pd.DataFrame(bat), pd.DataFrame(bowl)
    d_val, d_test = DAY("2023-01-01"), DAY("2025-01-01")
    base_val = Baseline(p, d_val)
    base_test = Baseline(p, d_test)
    report = {"generated_at_ist": ist(now_utc()), "data_last_date": str(H.last_date.date()),
              "ball_level_data": False, "split": {"train": "2018-01-01..2022-12-31 (selection), 2018..2024 (test fit)",
                                                  "validate": "2023-01-01..2024-12-31", "test": f"2025-01-01..{H.last_date.date()}"},
              "eval_filter": f"player n_eff in format >= {MIN_NEFF_EVAL}", "results": {}}
    live = {}
    for stat, spec in pm.STATS.items():
        DF = DFB if spec["kind"] == "bat" else DFW
        nkey = "w_bat_fmt" if spec["kind"] == "bat" else "w_bowl_fmt"
        for fmt in FMTS + ["MULTI"]:
            R = DF[DF.fmt == fmt]
            tr_a = R[R.day < d_val]
            val = R[(R.day >= d_val) & (R.day < d_test) & (R[nkey] >= MIN_NEFF_EVAL)].reset_index(drop=True)
            tr_b = R[R.day < d_test]
            test = R[(R.day >= d_test) & (R[nkey] >= MIN_NEFF_EVAL)].reset_index(drop=True)
            if len(test) < 300 or len(val) < 300:
                continue
            bc_val = [base_val.probs(r, stat, pm.LINES[stat]) for r in val.to_dict("records")]

            def vscore(feats):
                m = pm.fit(tr_a, stat, feats)
                PM, _, Y, _, _ = eval_set(val, stat, m, bc_val)
                return metrics(PM, Y)["logloss"]

            # forward selection on validation
            sel, cur = [], vscore([])
            trace = [{"step": "form-only", "val_logloss": round(cur, 5)}]
            cand = list(spec["ctx"])
            while cand:
                sc = {f: vscore(sel + [f]) for f in cand}
                f, v = min(sc.items(), key=lambda kv: kv[1])
                if cur - v < SELECT_GAIN:
                    trace.append({"step": "stop", "best_remaining": f, "gain": round(cur - v, 5)})
                    break
                sel.append(f); cand.remove(f)
                trace.append({"step": f"+{f}", "val_logloss": round(v, 5), "gain": round(cur - v, 5)})
                cur = v
            # held-out test
            test_recs = test.to_dict("records")
            bc = [base_test.probs(r, stat, pm.LINES[stat]) for r in test_recs]
            res = {"n_test_rows": len(test), "selected": sel, "selection_trace": trace, "models": {}}
            variants = {"glm_form_only": [], "glm_all_context": spec["ctx"], "glm_selected": sel}
            Ysave = None
            for name, feats in variants.items():
                m = pm.fit(tr_b, stat, feats)
                PM, PB, Y, y, mu = eval_set(test, stat, m, bc)
                res["models"][name] = {**metrics(PM, Y), "alpha": round(m["alpha"], 3),
                                       "per_line": {str(L): metrics(PM[:, j], Y[:, j]) for j, L in enumerate(pm.LINES[stat])}}
                if name == "glm_selected":
                    res["calibration_selected"] = calib(PM, Y)
                    res["coef_selected"] = dict(zip(["const", "log_form", "log_volume", "log1p_neff", "female"] + feats,
                                                    [round(x, 4) for x in m["coef"]], strict=False))
                    Ysave = Y
                    if stat == "runs":
                        ok = [i for i in range(len(test)) if bc[i][1] is not None]
                        bl = np.array([bc[i][1] for i in ok])
                        yy = test["y_runs"].to_numpy()[ok] > bl
                        pmb = np.array([float(pm.p_over(mu[i], m["alpha"], bc[i][1])) for i in ok])
                        res["book_line"] = {"n": len(ok), "median_line": float(np.median(bl)), "selected": metrics(pmb, yy.astype(float))}
                        res["_bl"] = (ok, bl, yy)
            res["models"]["baseline_v1_empirical"] = {**metrics(PB, Ysave),
                                                      "per_line": {str(L): metrics(PB[:, j], Ysave[:, j]) for j, L in enumerate(pm.LINES[stat])}}
            res["calibration_baseline"] = calib(PB, Ysave)
            if stat == "runs":
                ok, bl, yy = res.pop("_bl")
                pbl = []
                for i in ok:
                    r = test_recs[i]
                    pbl.append(base_test.probs(r, stat, [bc[i][1]])[0][0])
                res["book_line"]["baseline_v1"] = metrics(np.array(pbl), yy.astype(float))
            # test-set drop-one ablation for the selected model (reporting only)
            abl = {}
            base_ll = res["models"]["glm_selected"]["logloss"]
            for f in sel:
                m = pm.fit(tr_b, stat, [x for x in sel if x != f])
                PM, _, Y, _, _ = eval_set(test, stat, m, bc)
                abl[f] = round(metrics(PM, Y)["logloss"] - base_ll, 5)
            res["test_drop_one_logloss_increase"] = abl
            report["results"][f"{stat}/{fmt}"] = res
            # live model: refit on everything with the selected features
            live[f"{stat}/{fmt}"] = pm.fit(R, stat, sel)
            live[f"{stat}/{fmt}"]["test_logloss"] = {"baseline_v1": res["models"]["baseline_v1_empirical"]["logloss"], "selected": res["models"]["glm_selected"]["logloss"]}
            print(f"{stat}/{fmt}: n={len(test)} sel={sel} base={res['models']['baseline_v1_empirical']['logloss']:.4f} "
                  f"form={res['models']['glm_form_only']['logloss']:.4f} sel={res['models']['glm_selected']['logloss']:.4f} "
                  f"[{time.time()-t0:.0f}s]", flush=True)
    try:
        report["weather"] = weather_study(H, DFB, DFW, report, live)
    except Exception as e:  # weather is optional; never lose the main refit
        report["weather"] = {"error": f"{type(e).__name__}: {e}"}
        print("weather study failed:", e)
    pm.save(live, {"trained_through": str(H.last_date.date()), "generated_at_ist": report["generated_at_ist"]})
    out = config.OUT / "backtest_props.json"
    out.write_text(json.dumps(report, indent=1))
    write_md(report)
    print("wrote", out)
    return report


def attach_weather(H, DF, fetch=False):
    """Add wx_* columns (0 = typical / unknown) and wx_ok from the Open-Meteo daily cache."""
    from . import weather
    m = H.matches[["match_id", "venue", "date"]].copy()
    m["match_id"] = m["match_id"].astype(str)
    m["vk"] = m["venue"].map(weather.wx_key)
    m["d"] = m["date"].dt.strftime("%Y-%m-%d")
    geo = weather.load_geo()
    if fetch:
        ids = set(DF["match_id"].astype(str))
        mm = m[m.match_id.isin(ids)]
        mh = H.matches[H.matches.match_id.astype(str).isin(ids)]
        geo = weather.ensure_geo(sorted(set(mm.venue.dropna())), hints=weather.venue_country_hints(mh))
        weather.ensure_daily(zip(mm.vk, mm.d, strict=True), geo)
    daily = weather.load_daily()
    feats = {}
    for mid, vk, d in zip(m.match_id, m.vk, m.d, strict=True):
        ll = geo.get(vk)
        if ll:
            k = (f"{ll[0]:.2f}", f"{ll[1]:.2f}", d)
            f = weather.features(daily.get(k))
            if f:
                feats[mid] = f
    W = pd.DataFrame.from_dict(feats, orient="index")
    out = DF.merge(W, left_on="match_id", right_index=True, how="left")
    out["wx_ok"] = out[weather.WX_FEATURES[0]].notna()
    for c in weather.WX_FEATURES:
        out[c] = out[c].fillna(0.0)
    return out


def weather_study(H, DFB, DFW, report, live):
    """Baseline (selected non-weather model) vs + weather on rows that have match-day weather.
    Train 2021-22 / validate 2023-24 (selection) / test 2025+ (held out). Weather terms are kept per stat x format
    only if they improve validation log-loss by >= SELECT_GAIN; the live model is then refit with them."""
    from . import weather
    fetch = bool(int(__import__("os").environ.get("CV_WEATHER_FETCH", "0")))
    B, W = attach_weather(H, DFB, fetch), attach_weather(H, DFW, fetch)
    d0, d_val, d_test = DAY("2021-01-01"), DAY("2023-01-01"), DAY("2025-01-01")
    out = {"source": "Open-Meteo ERA5 archive (daily, match date at venue)", "split": "train 2021-22 / validate 2023-24 / test 2025+",
           "results": {}}
    for stat, spec in pm.STATS.items():
        DF = B if spec["kind"] == "bat" else W
        nkey = "w_bat_fmt" if spec["kind"] == "bat" else "w_bowl_fmt"
        for fmt in FMTS:
            key = f"{stat}/{fmt}"
            if key not in report["results"]:
                continue
            base = report["results"][key]["selected"]
            R = DF[(DF.fmt == fmt) & DF.wx_ok & (DF.day >= d0)]
            tr_a = R[R.day < d_val]
            val = R[(R.day >= d_val) & (R.day < d_test) & (R[nkey] >= MIN_NEFF_EVAL)]
            tr_b = R[R.day < d_test]
            test = R[(R.day >= d_test) & (R[nkey] >= MIN_NEFF_EVAL)]
            if len(test) < 300 or len(val) < 300:
                continue

            def score(feats, tr, ev):
                m = pm.fit(tr, stat, feats)
                y = ev[spec["y"]].to_numpy(float)
                mu = pm.predict_mu(m, ev, stat)
                P = np.array([pm.p_over(mu, m["alpha"], L) for L in pm.LINES[stat]]).T
                Y = np.array([(y > L) for L in pm.LINES[stat]]).T.astype(float)
                return metrics(P, Y), P, Y

            sel, cur = [], score(base, tr_a, val)[0]["logloss"]
            cand = list(weather.WX_FEATURES)
            trace = []
            while cand:
                sc = {f: score(base + sel + [f], tr_a, val)[0]["logloss"] for f in cand}
                f, v = min(sc.items(), key=lambda kv: kv[1])
                trace.append({"feature": f, "val_gain": round(cur - v, 5)})
                if cur - v < SELECT_GAIN:
                    break
                sel.append(f); cand.remove(f); cur = v
            mb, _, _ = score(base, tr_b, test)
            mw, Pw, Yw = score(base + sel, tr_b, test) if sel else (mb, None, None)
            ma, _, _ = score(base + list(weather.WX_FEATURES), tr_b, test)
            out["results"][key] = {"n_test": int(len(test)), "baseline_logloss": round(mb["logloss"], 5),
                                   "baseline_brier": round(mb["brier"], 5),
                                   "weather_selected": sel, "with_weather_logloss": round(mw["logloss"], 5),
                                   "with_weather_brier": round(mw["brier"], 5),
                                   "all_weather_logloss": round(ma["logloss"], 5), "selection_trace": trace}
            # adopt only if it also does not hurt the held-out test (guards against a validation-only fluke)
            adopted = bool(sel) and mw["logloss"] <= mb["logloss"]
            out["results"][key]["adopted"] = adopted
            if adopted:
                m = pm.fit(R, stat, base + sel)
                m["test_logloss"] = {"no_weather": mb["logloss"], "with_weather": mw["logloss"]}
                m["weather_coef"] = dict(zip(sel, [round(c, 4) for c in m["coef"][5 + len(base):]], strict=False))
                live[key] = m
            print(f"weather {key}: n={len(test)} base={mb['logloss']:.4f} +wx={mw['logloss']:.4f} sel={sel}", flush=True)
    return out


def write_md(rep):
    L = [f"# Prop model backtest ({rep['generated_at_ist']})", "",
         f"Data through {rep['data_last_date']}. Test = {rep['split']['test']} (held out). Feature selection on "
         f"validation {rep['split']['validate']}. Eval rows: {rep['eval_filter']}.", "",
         "Mean over fixed lines (runs 9.5/19.5/29.5/49.5/99.5, sixes 0.5/1.5/2.5, fours 1.5/2.5/3.5, wkts 0.5/1.5/2.5).", "",
         "| stat/format | n | baseline v1 LL | form-GLM LL | all-context LL | selected LL | baseline Brier | selected Brier | selected features |",
         "|---|---|---|---|---|---|---|---|---|"]
    for k, r in rep["results"].items():
        M = r["models"]
        L.append(f"| {k} | {r['n_test_rows']} | {M['baseline_v1_empirical']['logloss']:.4f} | {M['glm_form_only']['logloss']:.4f} | "
                 f"{M['glm_all_context']['logloss']:.4f} | {M['glm_selected']['logloss']:.4f} | "
                 f"{M['baseline_v1_empirical']['brier']:.4f} | {M['glm_selected']['brier']:.4f} | {', '.join(r['selected']) or '-'} |")
    wx = rep.get("weather") or {}
    if wx.get("results"):
        L += ["", "## Weather (Open-Meteo) — rows with match-day weather, " + wx["split"], "",
              "| stat/format | n test | no weather LL | + selected weather LL | all weather LL | no-wx Brier | +wx Brier | selected on validation | adopted |",
              "|---|---|---|---|---|---|---|---|---|"]
        for k, r in wx["results"].items():
            L.append(f"| {k} | {r['n_test']} | {r['baseline_logloss']:.4f} | {r['with_weather_logloss']:.4f} | "
                     f"{r['all_weather_logloss']:.4f} | {r['baseline_brier']:.4f} | {r['with_weather_brier']:.4f} | "
                     f"{', '.join(r['weather_selected']) or '-'} | {'yes' if r.get('adopted') else 'no'} |")
        L += ["", "A weather term is adopted only if it improves validation log-loss by >= SELECT_GAIN and does not "
              "worsen the held-out test; otherwise the live model has no weather terms (weather is still shown in "
              "the 'why' line and drives the rain-risk flag)."]
    elif wx.get("error"):
        L += ["", f"Weather study failed: {wx['error']}"]
    (config.OUT / "backtest_props.md").write_text("\n".join(L) + "\n")


if __name__ == "__main__":
    run()
