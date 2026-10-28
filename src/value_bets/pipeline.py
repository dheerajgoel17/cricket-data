"""End-to-end: refresh data, pull odds, normalise, match names, model, price, find value, write outputs."""
import concurrent.futures as cf
import csv
import datetime as dt
import json
import math
import re
import subprocess
import time
import traceback
from collections import defaultdict

from . import archive, booklines, config, fancy, history, store, strategy, weather
from .adapters import betfair, feede, feedf, feedg, feedk, matchbook, moviodds, oddsapi, polymarket, smarkets
from .models import PlayerModel
from .names import PlayerResolver, TeamResolver, norm_team
from .pricing import devig, edge, effective_odds, exchange_mid, kelly_pct, logit
from .props_live import PropEngine
from .util import iso, ist, now_utc, parse_ts

ALL_ADAPTERS = [smarkets, moviodds, polymarket, matchbook, oddsapi, betfair, feedk, feede, feedf, feedg]


def adapters():
    """The sources named in CV_SOURCES, plus any that switch themselves on (``AUTO``: skipped unless their own variables are set)."""
    want = {x.strip() for x in config.get("SOURCES").split(",") if x.strip()}
    return [m for m in ALL_ADAPTERS if m.NAME in want or getattr(m, "AUTO", False)]



TEAM_MKTS = ("top_batter_team", "top_bowler_team")
TOP_MKTS = ("top_batter_team", "top_bowler_team", "top_batter_match", "top_bowler_match")
OU_MKTS = {"batter_runs": "runs", "batter_sixes": "sixes", "batter_fours": "fours", "bowler_wickets": "wkts"}
MS_MKTS = {"batter_milestone": "runs", "bowler_milestone": "wkts"}
PLAYER_STAT_MKTS = {**OU_MKTS, **MS_MKTS}
# Single-innings milestones in multi-day games ("to score a Hundred in the match" = 100+ in ONE innings). The history
# has one row per player per match (both innings summed), so these cannot be modelled and must never be merged with
# the match-aggregate ladder / O/U markets. Kept out of PLAYER_STAT_MKTS: no model, no market blend, never alerted.
INNINGS_MS_MKT = "batter_innings_milestone"
SINGLE_INNINGS_FMTS = ("T20", "ODI")  # one innings per side: innings milestone == match milestone


def split_innings_milestones(rows):
    """Re-type Yes/No 'in the match' milestones of multi-day (or unknown-format) games so they get their own
    selection key instead of colliding with the aggregate-runs ladder rung of the same number. Returns count."""
    n = 0
    for r in rows:
        if r.get("market_type") == "batter_milestone" and r.get("ms_scope") == "innings" and \
                r.get("fmt") not in SINGLE_INNINGS_FMTS:
            r["market_type"] = INNINGS_MS_MKT
            r["selection"] = f"{r['player']} {int(r['line'] + 0.5)}+ in an innings {'yes' if r['side'] == 'over' else 'no'}"
            n += 1
    return n


def whole_match(rows):
    """The rows that are about the whole match. An innings-scoped price ("his first innings", a Test only) is published as a book line (and so filed in the archive) but never
    priced: the history has one row per player per match, both innings summed, so there is no model for it and it must not meet the match-total lines of the same player."""
    return [r for r in rows if not r.get("inn")]


def fill_team_scope(rows):
    """Team top-batter/bowler: a book's market id is already one team's market (Feed P/Book A rows carry no team),
    and the team scope is inferred from the resolved players. Players we fail to match to history used to fall into a
    separate ':?' group, leaving the team group incomplete (implied probs summing < 1), which the de-vig then scaled
    UP (e.g. H Nawaz @ 6.0 -> 'fair' 21.8%). Put them back into the team the rest of that market resolved to."""
    by = defaultdict(list)
    for r in rows:
        if r.get("market_type") in TEAM_MKTS and r.get("group_key_raw"):
            by[r["group_key_raw"]].append(r)
    n = 0
    for g in by.values():
        teams = [r["team_scope"] for r in g if r["team_scope"] not in ("?", None)]
        if len(teams) < 3:
            continue
        top = max(set(teams), key=teams.count)
        if teams.count(top) < 0.8 * len(teams):
            continue  # market genuinely mixes teams (or resolution is unreliable): leave as is
        for r in g:
            if r["team_scope"] in ("?", None):
                r["team_scope"], r["player_team"] = top, r.get("player_team") or top
                r["group_key"] = f"{r['group_key_raw']}:{top}"
                n += 1
    return n


def guard_value(pm, pf, odds, source):
    """Sanity guard for a candidate value bet. Returns (ok, reason):
    - 'model_disagrees': the model alone says the offered price is NOT value (model prob below the probability implied
      by the odds after commission), so any edge comes purely from the market-consensus input -> never alert;
    - 'suspect_edge': edge above MAX_EDGE - real edges that size on liquid books are almost always a pricing/mapping
      error (wrong market, wrong line, wrong format), so flag it for a human instead of alerting."""
    eff = effective_odds(odds, source)
    if pm is not None and pm < 1 / eff:
        return False, "model_disagrees"
    if pf * eff - 1 > config.get("MAX_EDGE"):
        return False, "suspect_edge"
    return True, None
LOG = []


def log(msg):
    line = f"[{ist(now_utc())[11:16]} IST] {msg}"
    LOG.append(line)
    print(line, flush=True)


# ---------------------------------------------------------------- data refresh
def refresh_data():
    repo = config.DATA_REPO
    if not config.get("DATA_REFRESH"):
        return {"status": "refresh disabled (running against a local cricket-data checkout)"}
    marker = config.STATE / "data_last_pull"
    age_h = (time.time() - marker.stat().st_mtime) / 3600 if marker.exists() else 1e9
    if not repo.exists():
        log("data: cloning cricket-data (shallow)")
        subprocess.run(["git", "clone", "--depth", "1", "https://github.com/dheerajgoel17/cricket-data.git", str(repo)],
                       check=True, capture_output=True, timeout=180)
        marker.touch()
        return {"status": "cloned"}
    if age_h < config.get("DATA_MAX_AGE_HOURS"):
        return {"status": "fresh", "age_hours": round(age_h, 1)}
    try:
        subprocess.run(["git", "-C", str(repo), "fetch", "--depth", "1", "origin", "main"], check=True,
                       capture_output=True, timeout=180)
        subprocess.run(["git", "-C", str(repo), "reset", "--hard", "FETCH_HEAD"], check=True, capture_output=True,
                       timeout=60)
        marker.touch()
        return {"status": "pulled", "commit": history.repo_commit()[:10]}
    except Exception as e:  # keep going on stale data
        return {"status": "pull_failed", "error": str(e)[:200], "age_hours": round(age_h, 1)}


# ---------------------------------------------------------------- odds
def pull_odds(stamp):
    status, rows, raws = {}, [], {}

    def run(mod):
        t = time.time()
        try:
            r, raw = mod.fetch(stamp)
            return mod.NAME, {"status": "ok", "rows": len(r), "secs": round(time.time() - t, 1)}, r, raw
        except getattr(mod, "Skip", ()) as e:
            return mod.NAME, {"status": "skipped", "reason": str(e)}, [], None
        except Exception as e:
            msg = f"{type(e).__name__}: {e}"
            code = getattr(e, "code", None)
            if code in (403, 451):
                msg = f"blocked (HTTP {code}) - likely geo/bot protection from this box's US IP"
            return mod.NAME, {"status": "error", "reason": msg[:300], "secs": round(time.time() - t, 1)}, [], None

    mods = adapters()
    with cf.ThreadPoolExecutor(max(len(mods), 1)) as ex:
        futs = {ex.submit(run, m): m.NAME for m in mods}
        try:
            for f in cf.as_completed(futs, timeout=config.get("SOURCE_TIMEOUT")):
                name, st, r, raw = f.result()
                status[name] = st
                rows += r
                if raw is not None:
                    raws[name] = raw
        except cf.TimeoutError:
            for f, name in futs.items():
                if name not in status:
                    status[name] = {"status": "error", "reason": "timeout"}
    return status, rows, raws


PERFORMANCE = re.compile(r"player performance|performance points|fantasy", re.I)


def performance_markets(raws: dict) -> dict[str, list[str]]:
    """The "player performance" (fantasy points) market names each source offered and no adapter reads yet, by source: what an adapter listed as left out, and the Book A mirror's group names.
    The run's log prints them, so a source that offers the market shows itself in the next committed output."""
    out: dict[str, list[str]] = {}
    for src, raw in raws.items():
        seen: set[str] = set()
        if isinstance(raw, dict):
            for book in (raw.get("books") or {}).values():
                seen |= {n for n in (book.get("left_out") or {}) if PERFORMANCE.search(n)}
            for m in raw.get("matches", []):
                seen |= {g for q in m.get("quotes", []) if PERFORMANCE.search(g := q.get("group_name") or "")}
        if seen:
            out[src] = sorted(seen)[:8]
    return out


# ---------------------------------------------------------------- event + name resolution
def load_fixtures():
    p = config.DATA_REPO / "data" / "fixtures" / "upcoming.csv"
    out = []
    if p.exists():
        with open(p) as f:
            for r in csv.DictReader(f):
                out.append(r)
    return out


def detect_fmt(texts, has_draw, fixture_fmt, last_meeting_fmt):
    if fixture_fmt:
        return {"T20": "T20", "T20I": "T20", "ODI": "ODI", "TEST": "MULTI", "Test": "MULTI"}.get(fixture_fmt,
                                                                                            "T20" if "20" in fixture_fmt else None), "fixtures"
    if has_draw:
        return "MULTI", "draw-market"
    t = " ".join(x for x in texts if x).lower()
    if "test" in t or "first class" in t or "shield" in t or "trophy-grade" in t or "ranji" in t:
        return "MULTI", "name"
    if "t20" in t or "t10" in t or "the hundred" in t or "twenty20" in t or "bash" in t or "premier league" in t:
        return "T20", "name"
    if "odi" in t or "one day" in t or "one-day" in t or "50 over" in t or "league 2" in t or "list a" in t:
        return "ODI", "name"
    if last_meeting_fmt:
        return last_meeting_fmt, "last-meeting"
    return None, "unknown"


def resolve_events(rows, H, tres):
    """Assign event_key, canonical teams, gender to each row; cluster same match across sources."""
    events = {}
    unmatched = set()
    for r in rows:
        k = (r["source"].split(":")[0], r["event_id"])
        if k in events:
            continue
        g = r["gender_hint"] or "male"
        ca = tres.resolve(r["team_a"], g) if r["team_a"] else None
        cb = tres.resolve(r["team_b"], g) if r["team_b"] else None
        for raw, c in ((r["team_a"], ca), (r["team_b"], cb)):
            if raw and not c:
                unmatched.add(f"{raw} ({g})")
        ta = ca or norm_team(r["team_a"])[0]
        tb = cb or norm_team(r["team_b"])[0]
        events[k] = {"gender": g, "teams": frozenset((ta, tb)), "canon": (ca, cb), "start": parse_ts(r["start_utc"]),
                     "raw": (r["team_a"], r["team_b"]), "texts": set()}
    # cluster
    clusters = []
    for k, e in events.items():
        for c in clusters:
            if c["gender"] == e["gender"] and c["teams"] == e["teams"] and e["start"] and c["start"] and \
                    abs((e["start"] - c["start"]).total_seconds()) < 6 * 3600:
                c["members"].append(k)
                break
        else:
            clusters.append({**e, "members": [k]})
    keymap = {}
    for c in clusters:
        ta, tb = sorted(c["teams"])
        ek = f"{c['gender']}|{ta}|{tb}|{c['start'].strftime('%Y-%m-%d') if c['start'] else ''}"
        c["key"] = ek
        for m in c["members"]:
            keymap[m] = c
    for r in rows:
        c = keymap[(r["source"].split(":")[0], r["event_id"])]
        r["event_key"] = c["key"]
        e = events[(r["source"].split(":")[0], r["event_id"])]
        r["canon_a"], r["canon_b"] = e["canon"]
        r["gender"] = c["gender"]
        c["texts"].update([r.get("competition") or "", r.get("match") or "", r.get("market_raw") or ""])
    return {c["key"]: c for c in clusters}, sorted(unmatched)


def canon_team_name(raw, ev, tres):
    if not raw:
        return None
    rl = raw.strip().lower()
    if rl in ("draw", "the draw", "tie"):
        return "DRAW"
    c = tres.resolve(raw, ev["gender"])
    if c and c in ev["teams"]:
        return c
    base = norm_team(raw)[0]
    if base in ev["teams"]:
        return base
    return c


# ---------------------------------------------------------------- main
def run():
    t0 = time.time()
    LOG.clear()
    now = now_utc()
    stamp = iso(now)
    data_status = refresh_data()
    log(f"data: {data_status}")
    H = history.load()
    log(f"history: {len(H.matches)} matches, last {H.last_date.date()}, players {len(H.players)}")
    src_status, rows, raws = pull_odds(stamp)
    for k, v in src_status.items():
        log(f"source {k}: {v}")
    snap = store.save_snapshot(rows, raws, stamp) if rows else None

    tres = TeamResolver(H.teams_by_gender())
    clusters, unmatched_teams = resolve_events(rows, H, tres)
    fixtures = load_fixtures()
    pres = PlayerResolver(H.rosters)
    PM = PlayerModel(H)
    PE = PropEngine(H)
    log(f"prop model: trained through {PE.meta.get('trained_through')}, {len(PE.models)} stat/format models")

    win_lo = now + dt.timedelta(minutes=config.get("MIN_MINUTES_TO_START"))
    win_hi = now + dt.timedelta(hours=config.get("WINDOW_HOURS"))

    # ---- per-event context (format, venue, teams)
    for c in clusters.values():
        ca = [x for x in c["canon"] if x]
        c["canon_teams"] = sorted(set(ca)) if len(set(ca)) == 2 else None
        fx = None
        if c["canon_teams"] and c["start"]:
            for f in fixtures:
                g = f.get("gender") or "male"
                fa = tres.resolve(f["team_a"], g)
                fb = tres.resolve(f["team_b"], g)
                st = parse_ts(f.get("start_utc"))
                if g == c["gender"] and {fa, fb} == set(c["canon_teams"]) and st and \
                        abs((st - c["start"]).total_seconds()) < 12 * 3600:
                    fx = f
                    break
        last_fmt = None
        if c["canon_teams"]:
            a, b = c["canon_teams"]
            mm = H.matches[(H.matches.gender == c["gender"]) & (((H.matches.team_a == a) & (H.matches.team_b == b)) |
                                                                ((H.matches.team_a == b) & (H.matches.team_b == a)))]
            if len(mm):
                last_fmt = mm.iloc[-1]["fmt"]
        c["fixture"] = fx
        c["venue"] = fx.get("venue") if fx else None
        if not c["venue"]:
            c["venue"] = next((r["venue"] for r in rows if r.get("venue") and r["event_key"] == c["key"]), None)
        c["has_draw"] = False
        c["fmt_last"] = last_fmt

    for r in rows:
        if r["market_type"] == "match_winner" and (r["selection"] or "").strip().lower() in ("draw", "the draw"):
            clusters[r["event_key"]]["has_draw"] = True
    for c in clusters.values():
        c["fmt"], c["fmt_src"] = detect_fmt(list(c["texts"]), c["has_draw"],
                                            (c["fixture"] or {}).get("format"), c["fmt_last"])

    # ---- selection resolution
    for r in rows:
        c = clusters[r["event_key"]]
        r["fmt"] = c["fmt"]
        r["team_scope"] = ""
        r["player_id"] = None
        mt = r["market_type"]
        if mt == "match_winner":
            r["sel_id"] = canon_team_name(r["selection"], c, tres) or norm_team(r["selection"])[0]
        else:
            cand = c["canon_teams"] or []
            scope_team = None
            if r.get("team") and mt in TEAM_MKTS:
                scope_team = canon_team_name(r["team"], c, tres)
            elif r.get("team") and mt in PLAYER_STAT_MKTS:
                scope_team = canon_team_name(r["team"], c, tres)
            pr = pres.resolve(r["player"], [scope_team] if scope_team in cand else cand)
            if pr:
                r["player_id"], r["player_hist_name"], r["match_score"] = pr["player_id"], pr["name"], pr["score"]
                scope_team = scope_team or pr["team"]
                r["sel_id"] = pr["player_id"]
            else:
                r["sel_id"] = "raw:" + norm_team(r["player"] or "")[0]
            r["player_team"] = scope_team
            if mt in TEAM_MKTS:
                r["team_scope"] = scope_team or "?"
                r["group_key_raw"] = r["group_key"]
                r["group_key"] = f"{r['group_key']}:{r['team_scope']}"
    n_scope_fix = fill_team_scope(rows)
    if n_scope_fix:
        log(f"{n_scope_fix} unmatched players kept in their team top-batter/bowler market (team taken from market)")

    n_inns_ms = split_innings_milestones(rows)
    if n_inns_ms:
        log(f"{n_inns_ms} multi-day single-innings milestone prices kept separate from match-aggregate markets (not modelled)")

    pm = performance_markets(raws)
    if pm:
        log(f"player performance markets not read yet: {pm}")
    book = booklines.book_lines(rows, stamp, fancy.match_fancy(raws.get("moviodds_bet365")) + fancy.adapter_fancy(raws))  # every matched two-sided player line, kept for the site (value_bets/out/book_lines.json)
    log(f"book lines: {len(book['lines'])} player lines from {len({x['source'] for r in book['lines'] for x in r['books']})} source(s)")
    n_inn = sum(1 for r in rows if r.get("inn"))
    if n_inn:
        rows = whole_match(rows)
        log(f"{n_inn} innings-scoped prices published as book lines, kept out of the value-bet pricing")

    # ---- fair-price signals per source group
    groups = defaultdict(list)
    for r in rows:
        groups[r["group_key"]].append(r)
    for gk, g in groups.items():
        mt = g[0]["market_type"]
        stype = g[0]["source_type"]
        for r in g:
            r["p_src"] = None
        if mt in PLAYER_STAT_MKTS:
            if len(g) != 2 or {x["side"] for x in g} != {"over", "under"}:
                continue  # one-sided milestone ladders are priced off the player's O/U market below
        elif mt == "match_winner":
            if len(g) < 2:
                continue
        elif len(g) < 6 or (mt in TEAM_MKTS and g[0]["team_scope"] == "?"):
            continue
        if stype == "bookmaker":
            if any(not x["back"] for x in g):
                continue
            if sum(1 / x["back"] for x in g) < 1.0:
                continue  # incomplete market (runners missing): de-vig would inflate every probability
            ps = devig([x["back"] for x in g])
            for x, p in zip(g, ps, strict=False):
                x["p_src"] = p
                x["overround"] = sum(1 / y["back"] for y in g) - 1
        else:
            mids = [exchange_mid(x["back"], x["lay"]) for x in g]
            if mt == "match_winner" or mt in PLAYER_STAT_MKTS:
                if any(m is None for m in mids):
                    continue
                s = sum(mids)
                for x, m in zip(g, mids, strict=False):
                    x["p_src"] = m / s
            else:  # top batter on exchange: use only tight-spread runners, no renormalisation
                for x, m in zip(g, mids, strict=False):
                    x["p_src"] = m
        if g[0]["source"] == "polymarket" and (g[0].get("liquidity") or 0) < config.get("MIN_POLY_LIQ_USD"):
            for x in g:
                x["p_src"] = None

    def skey(r):
        return (r["event_key"], r["market_type"], r["team_scope"], r["sel_id"], r.get("line"), r.get("side"))

    by_sel = defaultdict(list)
    for r in rows:
        by_sel[skey(r)].append(r)

    # ---- model probabilities
    model = {}
    model_info = {}
    n_priced_markets = set()
    # match winner is not modelled or alerted (props only)
    # top markets: one MC per group
    for gk, g in groups.items():
        mt = g[0]["market_type"]
        if mt not in TOP_MKTS:
            continue
        c = clusters[g[0]["event_key"]]
        if not c["canon_teams"] or not c["fmt"]:
            continue
        ps = [{"key": skey(x), "pid": x["player_id"], "team": x["player_team"] or "?"} for x in g]
        if sum(1 for p in ps if p["pid"]) < 0.7 * len(ps) or len(ps) < 6:
            for x in g:
                x["model_note"] = f"only {sum(1 for p in ps if p['pid'])}/{len(ps)} players matched to history"
            continue
        if mt in TEAM_MKTS and g[0]["team_scope"] in ("?", None):
            continue
        try:
            res, psel = PM.top_probs(ps, c["gender"], c["fmt"], stat="runs" if "batter" in mt else "wkts")
        except Exception as e:  # one bad market must not kill the run
            log(f"model error {gk}: {e}")
            continue
        # Market-calibrate: the MC is used for *relative* strength inside the market. Remove the group's mean
        # log-odds offset vs the de-vigged market (the MC is biased by unknown XIs / batting order).
        diffs = [logit(res[skey(x)]) - logit(x["p_src"]) for x in g
                 if res.get(skey(x)) and x.get("p_src") and 0 < res[skey(x)] < 1]
        off = sum(diffs) / len(diffs) if len(diffs) >= 4 else 0.0
        for k, v in res.items():
            if v is not None and k not in model and 0 < v < 1:
                model[k] = 1 / (1 + math.exp(-(logit(v) - off)))
                model_info[k] = {"p_selected": round(float(psel[k]), 2), "mc_raw_p": round(v, 4),
                                 "group_logit_offset_removed": round(off, 3)}
    # O/U and milestones: context NB-GLM (value_bets.propmodel), conditional on batting/bowling for O/U
    feat_cache = {}
    wx_geo = weather.load_geo()
    n_wx = [0, 0]

    def event_weather(c):
        """Open-Meteo forecast for the event venue at its start (cached per event); None if venue unknown."""
        if "wx" in c:
            return c["wx"]
        c["wx"] = None
        if not c.get("venue") or not c.get("start") or not config.get("WEATHER"):
            return None
        try:
            vk = weather.wx_key(c["venue"])
            ll = wx_geo.get(vk)
            if not ll:
                hints = set().union(*[weather.TEAM_CC.get(str(t).lower().replace(" women", ""), set())
                                      for t in (c.get("canon_teams") or [])])
                _, ll, _ = weather.geocode(c["venue"], hints or None)
                wx_geo[vk] = ll
            if ll:
                hours = {"T20": 4, "ODI": 8}.get(c["fmt"], 8)
                daily, window = weather.forecast(ll, c["start"], hours=hours)
                c["wx"] = {"features": weather.features(daily) or {}, "daily": daily, "window": window,
                           "latlon": [round(ll[0], 3), round(ll[1], 3)]}
                n_wx[0] += 1
        except Exception as e:
            n_wx[1] += 1
            log(f"weather failed for {c['key']}: {e}")
        return c["wx"]

    def player_ctx(r):
        c = clusters[r["event_key"]]
        stat = PLAYER_STAT_MKTS[r["market_type"]]
        team = r.get("player_team")
        if not c["canon_teams"] or team not in c["canon_teams"] or not PE.model(stat, c["fmt"]):
            return None
        opp = [t for t in c["canon_teams"] if t != team][0]
        vk = PE.venue_key(c["venue"], c["fmt"], c["gender"])
        ck = (r["player_id"], stat, c["key"])
        if ck not in feat_cache:
            f = PE.features(stat, r["player_id"], team, opp, vk, c["fmt"], c["gender"])
            f["gender"] = c["gender"]
            wx = event_weather(c)
            for k_ in weather.WX_FEATURES:
                f[k_] = (wx or {}).get("features", {}).get(k_, 0.0)
            feat_cache[ck] = f
        return {"stat": stat, "f": feat_cache[ck], "team": team, "opp": opp, "vk": vk, "c": c}

    why_ctx = {}
    for r in rows:
        mt = r["market_type"]
        if mt not in PLAYER_STAT_MKTS or not r["player_id"] or not r["fmt"] or r.get("line") is None:
            continue
        k = skey(r)
        if k in model:
            continue
        try:
            pc_ = player_ctx(r)
        except Exception as e:
            log(f"prop model error {r['player']}: {e}")
            continue
        if not pc_:
            continue
        stat, f = pc_["stat"], pc_["f"]
        po, mu, m = PE.p_over(stat, r["fmt"], f, r["line"])
        play = f["p_bat"] if stat != "wkts" else f["p_bowl"]
        if mt in MS_MKTS:
            po = play * po  # milestone loses if the player doesn't bat/bowl
        model[k] = po if r["side"] == "over" else 1 - po
        model_info[k] = {"n_eff": round(f["w_bat"] if stat != "wkts" else f["w_bowl"], 1),
                         "expected": round(mu, 2), "nb_alpha": round(m["alpha"], 3),
                         "p_bats_or_bowls": round(play, 3), "venue_matched": pc_["vk"],
                         "context_terms": m["ctx"]}
        why_ctx[k] = pc_
    # milestone ladders (one-sided): market-anchored fair price from the same player's de-vigged O/U market
    ou_fair = {}
    for r in rows:
        if r["market_type"] in OU_MKTS and r.get("p_src") is not None and r["side"] == "over" and r["player_id"]:
            ou_fair.setdefault((r["event_key"], OU_MKTS[r["market_type"]], r["player_id"]), []).append((r["line"], r["p_src"]))
    n_anch = 0
    for r in rows:
        if r["market_type"] not in MS_MKTS or r.get("p_src") is not None or not r["player_id"] or r["side"] != "over":
            continue
        k = skey(r)
        anc = ou_fair.get((r["event_key"], MS_MKTS[r["market_type"]], r["player_id"]))
        pc_ = why_ctx.get(k)
        if not anc or not pc_:
            continue
        L0, p0 = min(anc, key=lambda t: abs(t[0] - r["line"]))  # nearest O/U line
        stat, f = pc_["stat"], pc_["f"]
        mu_m = PE.anchor_mu(stat, r["fmt"], L0, p0)
        play = f["p_bat"] if stat != "wkts" else f["p_bowl"]
        r["p_src"] = float(play * pm_p_over(PE, stat, r["fmt"], mu_m, r["line"]))
        r["p_src_from"] = f"anchored on {r['source']} O/U {L0} (de-vigged {p0:.3f})"
        n_anch += 1
    log(f"weather: forecasts for {n_wx[0]} events, {n_wx[1]} failed")
    log(f"prop model: {len(why_ctx)} prop selections modelled, {n_anch} milestone ladder prices anchored to O/U")

    # ---- value search
    values, suspect, dropped = [], [], defaultdict(int)
    diag = defaultdict(list)
    stats = {"events_in_window": 0, "rows_in_window": 0, "selections_with_model": 0, "selections_with_market_fair": 0}
    evs_in_window = set()
    for k, rs in by_sel.items():
        r0 = rs[0]
        st = parse_ts(r0["start_utc"])
        if not st or not (win_lo <= st <= win_hi) or any(x["in_play"] for x in rs):
            continue
        evs_in_window.add(r0["event_key"])
        stats["rows_in_window"] += len(rs)
        mt = r0["market_type"]
        if mt == "match_winner":
            continue  # props only
        n_priced_markets.add((r0["event_key"], mt, r0["team_scope"], r0.get("player_id") if mt in OU_MKTS else ""))
        pm = model.get(k)
        if pm is not None:
            stats["selections_with_model"] += 1
        sig = [x for x in rs if x.get("p_src") is not None]
        if sig:
            stats["selections_with_market_fair"] += 1
        for x in rs:
            if not x["back"]:
                continue
            # leave-one-out market consensus; exchanges weighted double. A ladder price anchored on a different
            # market (the O/U) counts as an independent signal.
            others = [y for y in sig if y["source"] != x["source"] or (y.get("p_src_from") and y is not x)]
            pool = others or [y for y in sig if y["source"] == x["source"]]
            if pool:
                wts = [2.0 if y["source_type"] == "exchange" and y["source"] != "polymarket" else 1.0 for y in pool]
                pc = sum(w * y["p_src"] for w, y in zip(wts, pool, strict=False)) / sum(wts)
            else:
                pc = None
            if pm is None and pc is None:
                continue
            notes = []
            if pm is not None and pc is not None:
                diag[mt].append((pm, pc))
                if abs(pm - pc) > config.get("MAX_MODEL_MARKET_GAP") or \
                        abs(logit(pm) - logit(pc)) > config.get("MAX_MODEL_MARKET_LOGIT_GAP"):
                    dropped["model_market_gap"] += 1
                    continue
                w = config.get("W_MODEL_WINNER") if mt == "match_winner" else (
                    config.get("W_MODEL_TOP") if mt in TOP_MKTS else config.get("W_MODEL_PROP"))
                pf = w * pm + (1 - w) * pc
                basis = f"blend {w:.2f} model + {1 - w:.2f} market"
            elif pc is not None:
                if not others:
                    continue  # own de-vigged price alone can never show value
                pf = pc
                basis = "market consensus only (no model)"
                notes.append("no model for this market")
            else:
                dropped["model_only_no_market"] += 1
                continue  # never bet on model alone
            o = x["back"]
            e = edge(pf, o, x["source"])
            lim = config.get("MAX_ODDS_TOP") if mt in TOP_MKTS else (
                config.get("MAX_ODDS_MILESTONE") if mt in MS_MKTS else config.get("MAX_ODDS_PROP"))
            if o < config.get("MIN_ODDS") or o > lim:
                dropped["odds_range"] += 1 if e >= config.get("MIN_EDGE") else 0
                continue
            if e < config.get("MIN_EDGE"):
                continue
            if x["source_type"] == "exchange" and x["source"] != "polymarket" and \
                    (x.get("back_size") or 0) < config.get("MIN_EXCHANGE_LIQ_GBP"):
                dropped["liquidity"] += 1
                continue
            if x["source"] == "polymarket" and (x.get("liquidity") or 0) < config.get("MIN_POLY_LIQ_USD"):
                dropped["liquidity"] += 1
                continue
            mi = model_info.get(k) or model_info.get((r0["event_key"], mt)) or {}
            if mt in PLAYER_STAT_MKTS and mi.get("n_eff", 0) < config.get("MIN_PLAYER_NEFF"):
                dropped["small_sample"] += 1
                continue
            if mt in TOP_MKTS and mi.get("p_selected", 1) < config.get("MIN_P_SELECTED"):
                dropped["rarely_selected"] += 1
                continue
            ok, why_bad = guard_value(pm, pf, o, x["source"])
            if not ok:
                dropped[why_bad] += 1
                if why_bad == "suspect_edge":
                    suspect.append({"match": x["match"], "start_ist": r0["start_ist"], "market_type": mt,
                                    "market": x["market_raw"], "selection": x["selection"], "odds": round(o, 3),
                                    "source": x["source"], "fair_prob": round(pf, 4),
                                    "model_prob": round(pm, 4) if pm is not None else None,
                                    "market_prob": round(pc, 4) if pc is not None else None,
                                    "edge_pct": round(100 * e, 2), "fair_basis": basis,
                                    "market_fair_from": x.get("p_src_from") or [y.get("p_src_from") for y in pool if y.get("p_src_from")] or None})
                continue
            n_src = len({y["source"] for y in sig})
            ok, why_bad = strategy.gate(mt, x.get("side"), pm, o, x["source"], n_src=n_src,
                                        name_score=x.get("match_score"), overround=x.get("overround"), edge=e)
            if not ok:
                dropped[why_bad] += 1
                continue
            notes.append(f"{n_src} market source(s) for fair price")
            if pm is not None and pc is not None:
                notes.append(f"model {pm:.3f} vs market {pc:.3f}")
            c = clusters[r0["event_key"]]
            if c["fmt_src"] in ("last-meeting", "unknown"):
                notes.append(f"format guessed ({c['fmt']} via {c['fmt_src']})")
            if x.get("match_score") is not None and x["match_score"] < 90:
                notes.append(f"name matched loosely: '{x['player']}' -> '{x.get('player_hist_name')}' (score {x['match_score']}) - verify")
            if mt in OU_MKTS:
                notes.append("assumes bet void if player doesn't bat/bowl - check book rules")
            if mt in MS_MKTS:
                notes.append("milestone: assumes loses if player doesn't bat/bowl (void if not in XI)")
            if x.get("p_src_from"):
                notes.append("market fair " + x["p_src_from"])
            if x["source"].startswith("moviodds"):
                notes.append("price via unofficial Book A mirror - confirm on Book A before betting")
            conf = "low"
            if pm is not None and pc is not None and n_src >= 2:
                conf = "medium"
            wx_ = c.get("wx") if "wx" in c else event_weather(c)
            wx_out, rain_risk = None, None
            if wx_:
                w_ = wx_["window"]
                wx_out = {"rain_prob_max_pct": w_.get("rain_prob_max"), "rain_mm_in_window": w_.get("rain_mm"),
                          "humidity_pct": w_.get("humidity_mean"), "cloud_pct": w_.get("cloud_mean"),
                          "source": "Open-Meteo forecast"}
                rain_risk = bool((w_.get("rain_prob_max") or 0) >= config.get("RAIN_PROB_WARN") or
                                 (w_.get("rain_mm") or 0) >= config.get("RAIN_MM_WARN"))
                if rain_risk:
                    notes.append(f"RAIN RISK: up to {w_.get('rain_prob_max')}% rain chance, {w_.get('rain_mm')} mm forecast "
                                 "during the match - shortened match or void props possible")
            why = ""
            if k in why_ctx and pm is not None:
                w_ = why_ctx[k]
                try:
                    wctx = why_ctx[k]
                    why = PE.why(wctx["stat"], c["fmt"], c["gender"], wctx["f"], r0["player_id"], wctx["opp"], c["venue"],
                                 wctx["vk"], x["line"], x["side"], pm, pc, milestone=mt in MS_MKTS, wx=wx_)
                except Exception as e_:
                    why = f"(why unavailable: {e_})"
            elif mt in TOP_MKTS and pm is not None:
                why = (f"Model {100 * pm:.0f}% vs market {100 * pc:.0f}%: Monte Carlo over both XIs from recency-weighted "
                       f"{c['fmt']} scores, picked {100 * mi.get('p_selected', 0):.0f}% of last team games; model "
                       f"re-centred on the market (offset {mi.get('group_logit_offset_removed')})") if pc is not None else ""
            values.append({
                "event_key": r0["event_key"], "match": x["match"], "start_utc": r0["start_utc"],
                "start_ist": r0["start_ist"], "format": c["fmt"], "gender": c["gender"], "market_type": mt,
                "market": x["market_raw"], "team_scope": r0["team_scope"],
                "selection": x["selection"], "player_matched_as": x.get("player_hist_name"),
                "line": x.get("line"), "side": x.get("side"),
                "best_odds": round(o, 3), "best_source": x["source"],
                "effective_odds_after_commission": round(effective_odds(o, x["source"]), 3),
                "lay_odds": x.get("lay"), "back_liquidity": x.get("back_size") or x.get("liquidity"),
                "fair_odds": round(1 / pf, 3), "fair_prob": round(pf, 4),
                "model_prob": round(pm, 4) if pm is not None else None,
                "market_prob": round(pc, 4) if pc is not None else None, "fair_basis": basis,
                "edge": round(e, 4), "edge_pct": round(100 * e, 2),
                "kelly_quarter_stake_pct": round(kelly_pct(pf, o, x["source"]), 2),
                "confidence": conf, "why": why, "notes": "; ".join(notes), "model_detail": mi,
                "rain_risk": rain_risk, "weather": wx_out,
            })
    # keep best price per selection
    best = {}
    for v in values:
        k = store.alert_key(v)
        if k not in best or v["edge"] > best[k]["edge"]:
            best[k] = v
    values = sorted(best.values(), key=lambda v: (v["start_utc"], -v["edge"]))
    stats["events_in_window"] = len(evs_in_window)
    stats["markets_in_window"] = len(n_priced_markets)
    stats["value_bets"] = len(values)
    stats["dropped_by_filter"] = dict(dropped)
    stats["suspect_edges"] = len(suspect)
    stats["innings_milestones_unmodelled"] = n_inns_ms
    calib = {}
    for mt, xs in diag.items():
        import numpy as np
        a = np.array(xs)
        ld = np.array([logit(x) - logit(y) for x, y in xs])
        calib[mt] = {"n_prices": len(xs), "mean_model_p": round(float(a[:, 0].mean()), 3),
                     "mean_market_p": round(float(a[:, 1].mean()), 3),
                     "mean_logit_diff_model_minus_market": round(float(ld.mean()), 3),
                     "mean_abs_logit_diff": round(float(np.abs(ld).mean()), 3),
                     "corr": _corr(a)}
    stats["model_vs_market"] = calib
    alerts = store.new_alerts(values)

    unmatched_players = sorted({r["player"] for r in rows if r.get("player") and not r.get("player_id")
                                and parse_ts(r["start_utc"]) and win_lo <= parse_ts(r["start_utc"]) <= win_hi})
    events_out = []
    for c in clusters.values():
        if c["start"] and win_lo <= c["start"] <= win_hi:
            events_out.append({"event": c["key"], "start_ist": ist(c["start"]), "format": c["fmt"],
                               "format_source": c["fmt_src"], "teams_matched": c["canon_teams"],
                               "sources": sorted({m[0] for m in c["members"]})})
    result = {
        "generated_at_utc": stamp, "generated_at_ist": ist(now), "runtime_secs": round(time.time() - t0, 1),
        "data": {**data_status, "history_last_match": str(H.last_date.date()), "commit": history.repo_commit()[:10]},
        "sources": src_status, "snapshot": snap, "settings": {k: config.get(k) for k in config.DEFAULTS},
        "stats": stats, "events_in_window": sorted(events_out, key=lambda e: e["start_ist"]),
        "value_bets": values, "suspect_not_alerted": suspect, "unmatched_teams": unmatched_teams, "unmatched_players_in_window": unmatched_players[:200],
        "model_backtest": _prop_backtest_summary(), "log": LOG,
    }
    (config.OUT / "value_bets_latest.json").write_text(json.dumps(result, indent=1, default=str))
    try:
        prev_book = json.loads((config.OUT / "book_lines.json").read_text())
    except (OSError, ValueError):
        prev_book = None
    try:  # every match's props are kept for good; this must never stop the run
        fx_of = {(r.get("match"), r.get("start_utc")): clusters[r["event_key"]]["fixture"] for r in rows if (clusters.get(r.get("event_key")) or {}).get("fixture")}
        wrote, bad = archive.update(config.ARCHIVE, book, now, fx_of, fixtures)
        log(f"archive: {len(wrote)} match file(s) written" + (f", {len(bad)} unreadable and left as they are" if bad else ""))
    except Exception as e:
        log(f"archive failed: {e!r}")
    book = booklines.carry_started(book, prev_book, now)  # a match stays in the file while it is being played
    (config.OUT / "book_lines.json").write_text(json.dumps(book, separators=(",", ":")))
    (config.OUT / "new_alerts.json").write_text(json.dumps({"generated_at_ist": ist(now), "alerts": alerts},
                                                          indent=1, default=str))
    (config.OUT / "value_bets_latest.md").write_text(render_md(result, alerts))
    (config.OUT / "last_error.txt").unlink(missing_ok=True)
    log(f"done: {len(values)} value bets, {len(alerts)} new alerts, {round(time.time() - t0, 1)}s")
    return result


def pm_p_over(PE, stat, fmt, mu, line):
    from . import propmodel
    return float(propmodel.p_over(mu, PE.model(stat, fmt)["alpha"], line))


def _prop_backtest_summary():
    p = config.OUT / "backtest_props.json"
    if not p.exists():
        return None
    r = json.loads(p.read_text())
    return {"generated_at_ist": r["generated_at_ist"], "test": r["split"]["test"],
            "results": {k: {"n": v["n_test_rows"], "baseline_logloss": round(v["models"]["baseline_v1_empirical"]["logloss"], 4),
                            "new_logloss": round(v["models"]["glm_selected"]["logloss"], 4), "features": v["selected"]}
                        for k, v in r["results"].items()}}


def _corr(a):
    import numpy as np
    if len(a) < 3 or a[:, 0].std() == 0 or a[:, 1].std() == 0:
        return None
    return round(float(np.corrcoef(a[:, 0], a[:, 1])[0, 1]), 3)


def render_md(res, alerts):
    L = [f"# Cricket value bets - {res['generated_at_ist']}", ""]
    L.append("Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. "
             "Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.")
    L.append("")
    L.append("## Sources")
    for k, v in res["sources"].items():
        L.append(f"- **{k}**: {v.get('status')}" + (f", {v.get('rows')} prices" if v.get("rows") is not None else "")
                 + (f" - {v.get('reason')}" if v.get("reason") else ""))
    s = res["stats"]
    L += ["", f"Matches starting in next {res['settings']['WINDOW_HOURS']:.0f}h: **{s['events_in_window']}**, "
               f"markets priced: **{s['markets_in_window']}**, value bets: **{s['value_bets']}** "
               f"(new alerts: {len(alerts)}). Min edge {100 * res['settings']['MIN_EDGE']:.0f}%.", ""]
    if res["value_bets"]:
        L.append("| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |")
        L.append("|---|---|---|---|---|---|---|---|---|---|")
        for v in res["value_bets"]:
            sel = v["selection"] if not v.get("line") else f"{v['selection']}"
            mk = v["market"] + (f" ({v['team_scope']})" if v["team_scope"] else "")
            L.append(f"| {v['start_ist'][5:]} | {v['match']} | {mk} | {sel} | {v['best_odds']:.2f} @ {v['best_source']} | "
                     f"{v['fair_odds']:.2f} | {v['model_prob'] if v['model_prob'] is not None else '-'} | "
                     f"{v['edge_pct']:.1f}% | {v['kelly_quarter_stake_pct']:.2f}% | {v['confidence']} |")
        L += ["", "### Why / notes per bet"]
        for v in res["value_bets"]:
            L.append(f"- **{v['match']} / {v['market']} / {v['selection']}** - why: {v.get('why') or '-'}. Notes: {v['notes']}")
    else:
        L.append("_No value bets passed the filters this run._")
    if res.get("suspect_not_alerted"):
        L += ["", f"### Suspect edges (> {100 * res['settings']['MAX_EDGE']:.0f}%, NOT alerted - likely a pricing/mapping error)"]
        for v in res["suspect_not_alerted"]:
            L.append(f"- {v['start_ist'][5:]} {v['match']} / {v['market']} / {v['selection']} @ {v['odds']:.2f} ({v['source']}): "
                     f"edge {v['edge_pct']:.1f}%, model {v['model_prob']}, market {v['market_prob']}")
    if res["unmatched_teams"]:
        L += ["", "Unmatched team names (add to mappings/teams.csv): " + ", ".join(res["unmatched_teams"][:40])]
    L += ["", f"Runtime {res['runtime_secs']}s. Snapshot: `{res['snapshot']}`"]
    return "\n".join(L) + "\n"


def main():
    try:
        run()
    except Exception:
        tb = re.sub(r"(/Users|/home)/[A-Za-z0-9._-]+", "~", traceback.format_exc())  # no absolute home paths
        print(tb)
        (config.OUT / "last_error.txt").write_text(tb)
        try:
            (config.OUT / "value_bets_latest.json").write_text(json.dumps(
                {"generated_at_utc": iso(now_utc()), "error": tb[-2000:], "log": LOG}, indent=1))
        except Exception:
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
