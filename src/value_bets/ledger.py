"""Internal edge-bet P&L ledger (Supabase ``edge_bets``): every recommended edge we scrape.

Stores model value bets that clear the pipeline filters and fancy-edge alerts, with odds and edge.
Settles flat 1u paper P&L against archive results where we can (player O/U, milestones, top markets).
Service role only; never shown on the site. Rows are never deleted.

    python -m value_bets.ledger --upsert-fancy value_bets/out/fancy_alerts.json
    python -m value_bets.ledger --backfill-history
    python -m value_bets.ledger --settle
    python -m value_bets.ledger --summary
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from . import archive, booklines, config, store
from .util import IST, UTC, now_utc, parse_ts

API_UA = "cricket-props-hub-ledger/0.1 (server)"
# Archive/book ``stat`` for every settleable model market (OU, milestones, top).
SETTLE_STAT = {
    **booklines.STAT,
    "batter_milestone": "runs",
    "bowler_milestone": "wickets",
    "top_batter_team": "runs",
    "top_batter_match": "runs",
    "top_bowler_team": "wickets",
    "top_bowler_match": "wickets",
}
TOP_MKTS = frozenset(k for k in SETTLE_STAT if k.startswith("top_"))
OU_OR_MS = frozenset(k for k in SETTLE_STAT if k not in TOP_MKTS)


def bet_key(v: dict) -> str:
    return store.alert_key(v)


def line_verdict(value, line) -> str:
    """Same rule as ``lineVerdict`` in site/packages/engine/live.js (over-line cleared)."""
    if value is None or line is None:
        return "push"
    if value > line:
        return "cleared"
    if value < line:
        return "missed"
    return "push"


def side_outcome(side: str | None, verdict: str) -> str:
    """Map over/under + cleared/missed/push -> won/lost/push."""
    if verdict == "push":
        return "push"
    over = (side or "over").lower() == "over"
    if verdict == "cleared":
        return "won" if over else "lost"
    return "lost" if over else "won"


def pnl_u(status: str, odds) -> float:
    """Flat 1u paper: +odds-1 win, -1 loss, 0 push/void."""
    if status == "won":
        return round(float(odds) - 1.0, 4) if odds else 0.0
    if status == "lost":
        return -1.0
    return 0.0


def _implied(odds) -> float | None:
    try:
        o = float(odds)
        return round(1 / o, 4) if o > 0 else None
    except (TypeError, ValueError):
        return None


def model_row(v: dict, *, seen_at: str) -> dict:
    """One Supabase row from a pipeline value bet (odds + full market-rate snapshot)."""
    mt = v.get("market_type") or ""
    stat = SETTLE_STAT.get(mt) or v.get("stat")
    # settleable markets stay open even without player_id (history backfill resolves the id from archive names)
    settleable = mt in SETTLE_STAT
    status = "open" if settleable else "unsettled"
    odds = v.get("best_odds")
    rates = {k: v.get(k) for k in ("kelly_quarter_stake_pct", "n_sources", "rain_risk", "weather", "model_detail",
                                    "player_matched_as", "start_ist") if v.get(k) is not None}
    return {
        "bet_key": bet_key(v),
        "kind": "model",
        "match": v.get("match") or "",
        "start_utc": v.get("start_utc"),
        "format": v.get("format") or "",
        "gender": v.get("gender") or "",
        "market_type": mt,
        "market": v.get("market") or "",
        "selection": v.get("selection") or "",
        "line": v.get("line"),
        "side": v.get("side"),
        "player_id": v.get("player_id"),
        "stat": stat,
        "team": v.get("player_team") or v.get("team") or "",
        "scope": v.get("team_scope") or "",
        "inn": int(v.get("inn") or 0),
        "best_odds": odds,
        "best_source": v.get("best_source") or "",
        "effective_odds": v.get("effective_odds_after_commission"),
        "fair_odds": v.get("fair_odds"),
        "lay_odds": v.get("lay_odds"),
        "back_liquidity": v.get("back_liquidity"),
        "overround": v.get("overround"),
        "implied_prob": v.get("implied_prob") if v.get("implied_prob") is not None else _implied(odds),
        "fair_prob": v.get("fair_prob"),
        "model_prob": v.get("model_prob"),
        "market_prob": v.get("market_prob"),
        "edge": v.get("edge"),
        "edge_pct": v.get("edge_pct"),
        "fair_basis": v.get("fair_basis") or "",
        "confidence": v.get("confidence") or "",
        "why": (v.get("why") or "")[:2000],
        "notes": (v.get("notes") or "")[:2000],
        "hits": None,
        "played": None,
        "sample_window": None,
        "rates": rates,
        "first_seen_at": seen_at,
        "last_seen_at": seen_at,
        "status": status,
    }


def fancy_row(a: dict, *, seen_at: str) -> dict:
    """One Supabase row from a fancy-edge alert (listed price + history rate snapshot)."""
    aid = a.get("alert_id") or ""
    odds = a.get("best_odds")
    rates = {k: a.get(k) for k in ("fixture_id", "series", "bat_first", "start_ist") if a.get(k) is not None}
    return {
        "bet_key": aid if aid.startswith("fancy|") else f"fancy|{aid}",
        "kind": "fancy",
        "match": a.get("match") or "",
        "start_utc": a.get("start_utc"),
        "format": a.get("format") or "",
        "gender": "",
        "market_type": a.get("key") or "fancy",
        "market": a.get("key") or "",
        "selection": f"{a.get('team') or 'match'} {a.get('side')} {a.get('line')}",
        "line": a.get("line"),
        "side": a.get("side"),
        "player_id": None,
        "stat": a.get("key"),
        "team": a.get("team") or "",
        "scope": "",
        "inn": int(a.get("inn") or 0),
        "best_odds": odds,
        "best_source": a.get("best_source") or "",
        "effective_odds": odds,
        "fair_odds": round(1 / float(a["chance"]), 3) if a.get("chance") else None,
        "lay_odds": None,
        "back_liquidity": None,
        "overround": None,
        "implied_prob": _implied(odds),
        "fair_prob": a.get("chance"),
        "model_prob": a.get("chance"),
        "market_prob": _implied(odds),
        "edge": a.get("edge"),
        "edge_pct": a.get("edge_pct"),
        "fair_basis": "fancy history edge",
        "confidence": "",
        "why": f"hits {a.get('hits')}/{a.get('played')} window {a.get('window')}",
        "notes": "",
        "hits": a.get("hits"),
        "played": a.get("played"),
        "sample_window": a.get("window"),
        "rates": rates,
        "first_seen_at": seen_at,
        "last_seen_at": seen_at,
        "status": "open",  # settled when archive/live can supply the market total
    }


def _creds() -> tuple[str, str] | None:
    base = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    key = (os.environ.get("SUPABASE_SERVICE_KEY") or "").strip()
    return (base, key) if base and key else None


def _req(method: str, url: str, key: str, data: bytes | None = None, headers: dict | None = None, timeout: int = 60):
    h = {"apikey": key, "User-Agent": API_UA, **(headers or {})}
    if not key.startswith("sb_"):
        h["Authorization"] = f"Bearer {key}"
    r = urllib.request.Request(url, data=data, method=method, headers=h)
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        return resp.status, resp.read()


def _fetch_by_keys(base: str, key: str, keys: list[str]) -> dict[str, dict]:
    """bet_key -> existing row (status, first_seen_at)."""
    out: dict[str, dict] = {}
    if not keys:
        return out
    # PostgREST ``in`` filter; chunk to keep URLs short. Quote the whole ``in.(...)`` value:
    # fancy keys carry team names with spaces, and a raw space raises ``http.client.InvalidURL``.
    for i in range(0, len(keys), 50):
        chunk = keys[i:i + 50]
        q = ",".join('"' + k.replace("\\", "\\\\").replace('"', '\\"') + '"' for k in chunk)
        filt = urllib.parse.quote(f"in.({q})", safe="")
        url = f"{base}/rest/v1/edge_bets?select=bet_key,status,first_seen_at&bet_key={filt}"
        _, body = _req("GET", url, key)
        for row in json.loads(body):
            out[row["bet_key"]] = row
    return out


def _upsert_rows(rows: list[dict]) -> dict:
    """Insert new / refresh open rows. Settled rows are never overwritten. No-op without secrets."""
    creds = _creds()
    if not creds:
        return {"skipped": True, "reason": "SUPABASE_URL / SUPABASE_SERVICE_KEY not set", "n": 0}
    base, key = creds
    if not rows:
        return {"upserted": 0, "skipped_settled": 0}
    existing = _fetch_by_keys(base, key, [r["bet_key"] for r in rows])
    to_write, skipped = [], 0
    for r in rows:
        prev = existing.get(r["bet_key"])
        if prev and prev.get("status") not in ("open", "unsettled"):
            skipped += 1
            continue
        if prev:
            r = {**r, "first_seen_at": prev.get("first_seen_at") or r["first_seen_at"]}
            # keep unsettled/open as already stored (do not flip unsettled -> open on re-see)
            if prev.get("status") == "unsettled":
                r["status"] = "unsettled"
            elif prev.get("status") == "open":
                r["status"] = "open"
        to_write.append(r)
    if to_write:
        body = json.dumps(to_write).encode()
        _req("POST", f"{base}/rest/v1/edge_bets?on_conflict=bet_key", key, data=body,
             headers={"Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"})
    return {"upserted": len(to_write), "skipped_settled": skipped}


def upsert_model(values: list[dict]) -> dict:
    seen = now_utc().strftime("%Y-%m-%dT%H:%M:%SZ")
    return _upsert_rows([model_row(v, seen_at=seen) for v in values])


def upsert_fancy(alerts: list[dict] | None = None, path: Path | None = None) -> dict:
    if alerts is None:
        p = path or (config.OUT / "fancy_alerts.json")
        if not p.is_file():
            return {"upserted": 0, "reason": "no fancy_alerts.json"}
        alerts = json.loads(p.read_text()).get("alerts") or []
    seen = now_utc().strftime("%Y-%m-%dT%H:%M:%SZ")
    return _upsert_rows([fancy_row(a, seen_at=seen) for a in alerts if a.get("alert_id")])


def parse_alert_key(key: str) -> dict | None:
    """Split a history ``alert_key`` (``gender|a|b|date|market_type|scope|selection|line|side``)."""
    parts = (key or "").split("|")
    if len(parts) < 9:
        return None
    # selection can itself contain "|"; line and side are always the last two
    side, line_s, selection = parts[-1], parts[-2], "|".join(parts[6:-2]) if len(parts) > 9 else parts[6]
    try:
        line = float(line_s) if line_s not in ("", "None") else None
    except ValueError:
        line = None
    return {
        "event_key": "|".join(parts[:4]),
        "gender": parts[0],
        "format": "",
        "market_type": parts[4],
        "team_scope": parts[5],
        "selection": selection,
        "line": line,
        "side": side or None,
    }


def player_name_from_selection(selection: str) -> str:
    """``Najmul Hossain Shanto over 0.5`` / ``X 50+ yes`` -> player name."""
    s = (selection or "").strip()
    m = re.match(r"^(.+?)\s+(?:over|under)\s+\d", s, re.I)
    if m:
        return m.group(1).strip()
    m = re.match(r"^(.+?)\s+\d+\+?\s+(?:yes|no)\b", s, re.I)
    if m:
        return m.group(1).strip()
    return s


def _name_key(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _ist_to_utc(start_ist: str | None) -> str | None:
    """``2026-10-17 17:00 IST`` -> ISO UTC."""
    if not start_ist:
        return None
    s = str(start_ist).replace(" IST", "").strip()
    try:
        local = dt.datetime.strptime(s, "%Y-%m-%d %H:%M").replace(tzinfo=IST)
    except ValueError:
        try:
            local = dt.datetime.strptime(s, "%Y-%m-%d %H:%M:%S").replace(tzinfo=IST)
        except ValueError:
            return None
    return local.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def history_to_value(a: dict) -> dict | None:
    """Rebuild a pipeline-like value dict from one ``alerts_history.jsonl`` line."""
    parsed = parse_alert_key(a.get("alert_key") or "")
    if not parsed:
        return None
    odds = a.get("best_odds")
    fair_odds = a.get("fair_odds")
    edge_pct = a.get("edge_pct")
    try:
        fair_prob = round(1 / float(fair_odds), 4) if fair_odds else None
    except (TypeError, ValueError, ZeroDivisionError):
        fair_prob = None
    edge = round(float(edge_pct) / 100.0, 4) if edge_pct is not None else None
    start_utc = _ist_to_utc(a.get("start_ist"))
    mt = parsed["market_type"]
    return {
        **parsed,
        "match": a.get("match") or "",
        "start_utc": start_utc,
        "start_ist": a.get("start_ist"),
        "market": a.get("market") or "",
        "player_id": None,  # resolved from archive lines at settle time
        "player_matched_as": player_name_from_selection(parsed["selection"]),
        "stat": SETTLE_STAT.get(mt),
        "inn": 0,
        "best_odds": odds,
        "best_source": a.get("best_source") or "",
        "effective_odds_after_commission": odds,
        "fair_odds": fair_odds,
        "fair_prob": fair_prob,
        "implied_prob": _implied(odds),
        "model_prob": None,
        "market_prob": None,
        "edge": edge,
        "edge_pct": edge_pct,
        "fair_basis": "history backfill",
        "confidence": "",
        "why": a.get("why") or "",
        "notes": f"backfill alert_id={a.get('alert_id') or ''}",
        "kelly_quarter_stake_pct": a.get("kelly_quarter_stake_pct"),
        "alerted_at_ist": a.get("alerted_at_ist"),
    }


def backfill_history(path: Path | None = None) -> dict:
    """Upsert every line of ``alerts_history.jsonl`` (past recommended tips) into the ledger."""
    p = path or (config.OUT / "alerts_history.jsonl")
    if not p.is_file():
        return {"upserted": 0, "reason": "no alerts_history.jsonl"}
    values, bad = [], 0
    for line in p.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            a = json.loads(line)
        except ValueError:
            bad += 1
            continue
        v = history_to_value(a)
        if not v:
            bad += 1
            continue
        seen = _ist_to_utc(a.get("alerted_at_ist")) or now_utc().strftime("%Y-%m-%dT%H:%M:%SZ")
        # freeze first_seen to the original alert time
        row = model_row(v, seen_at=seen)
        values.append(row)
    # dedupe by bet_key keeping earliest first_seen
    best: dict[str, dict] = {}
    for r in values:
        prev = best.get(r["bet_key"])
        if prev is None or (r.get("first_seen_at") or "") < (prev.get("first_seen_at") or ""):
            best[r["bet_key"]] = r
    out = _upsert_rows(list(best.values()))
    out["parsed"] = len(values)
    out["bad"] = bad
    out["unique"] = len(best)
    return out


def _archive_index(root: Path) -> list[dict]:
    """Each archive file with sides, start, player results and priced lines (for top/team filter)."""
    out = []
    if not root.is_dir():
        return out
    for f in sorted(root.glob("*/*.json")):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        st = parse_ts(d.get("start_utc"))
        a, b = archive._sides({"match": d.get("match")})
        if not st or not (a and b):
            continue
        results = {(r["pid"], r["stat"], r.get("inn", 0)): r["value"]
                   for r in d.get("results") or [] if r.get("pid") and r.get("stat") and r.get("value") is not None}
        lines = d.get("lines") or []
        out.append({
            "k": frozenset((archive.team_key(a), archive.team_key(b))),
            "start": st,
            "match": d.get("match") or "",
            "results": results,
            "has_results": bool(results),
            "lines": lines,
        })
    return out


def _find_archive(index: list[dict], match: str, start_utc) -> dict | None:
    st = parse_ts(start_utc)
    a, b = archive._sides({"match": match})
    if not st or not (a and b):
        return None
    k = frozenset((archive.team_key(a), archive.team_key(b)))
    return next((g for g in index if g["k"] == k and abs((g["start"] - st).total_seconds()) < archive.SAME), None)


def _settle_ou_ms(row: dict, value) -> dict | None:
    verdict = line_verdict(value, row.get("line"))
    status = side_outcome(row.get("side"), verdict)
    odds = row.get("best_odds")
    return {"status": status, "result_value": value, "pnl_u": pnl_u(status, odds)}


def resolve_player_id(row: dict, arc: dict) -> str | None:
    """Use stored player_id, else match selection / matched-as name to an archive line of the same stat."""
    if row.get("player_id"):
        return row["player_id"]
    stat = row.get("stat")
    name = player_name_from_selection(row.get("selection") or "") or (row.get("rates") or {}).get("player_matched_as") or ""
    nk = _name_key(name)
    if not (stat and nk):
        return None
    hits = []
    for ln in arc.get("lines") or []:
        if ln.get("stat") != stat or not ln.get("pid"):
            continue
        for field in ("player", "book_name"):
            if _name_key(ln.get(field) or "") == nk:
                hits.append(ln["pid"])
                break
    # unique pid only (ambiguous names stay unresolved)
    uniq = list(dict.fromkeys(hits))
    return uniq[0] if len(uniq) == 1 else None


def _settle_top(row: dict, arc: dict) -> dict | None:
    """Won if this player's result equals the best of the match (or team) for that stat."""
    pid, stat, inn = resolve_player_id(row, arc), row.get("stat"), int(row.get("inn") or 0)
    if not (pid and stat):
        return None
    mine = arc["results"].get((pid, stat, inn))
    if mine is None:
        if arc.get("has_results"):
            return {"status": "void", "result_value": None, "pnl_u": 0.0}
        return None
    team = (row.get("team") or "").strip()
    mt = row.get("market_type") or ""
    # team-scoped top: only players filed under that team name in the archive lines
    pool_pids = None
    if mt.endswith("_team") and team:
        pool_pids = {ln["pid"] for ln in arc["lines"]
                     if ln.get("stat") == stat and ln.get("pid")
                     and archive.team_key(ln.get("team") or "") == archive.team_key(team)}
        if pid not in pool_pids:
            pool_pids.add(pid)
    best = None
    for (p, s, i), v in arc["results"].items():
        if s != stat or i != inn:
            continue
        if pool_pids is not None and p not in pool_pids:
            continue
        if best is None or v > best:
            best = v
    if best is None:
        return None
    # sole top = won; tie at the top = push; below = lost
    tied = [p for (p, s, i), v in arc["results"].items()
            if s == stat and i == inn and v == best and (pool_pids is None or p in pool_pids)]
    if mine < best:
        status = "lost"
    elif len(tied) > 1:
        status = "push"
    else:
        status = "won"
    return {"status": status, "result_value": mine, "pnl_u": pnl_u(status, row.get("best_odds"))}


def _list_open(base: str, key: str) -> list[dict]:
    out, start = [], 0
    while True:
        url = (f"{base}/rest/v1/edge_bets?select=*&status=eq.open&order=start_utc"
               f"&limit=1000&offset={start}")
        _, body = _req("GET", url, key)
        rows = json.loads(body)
        out.extend(rows)
        if len(rows) < 1000:
            return out
        start += 1000


def _patch_settled(base: str, key: str, bet_key: str, upd: dict, settled_at: str):
    payload = json.dumps({**upd, "settled_at": settled_at}).encode()
    q = urllib.parse.quote(bet_key, safe="")
    _req("PATCH", f"{base}/rest/v1/edge_bets?bet_key=eq.{q}&status=eq.open", key, data=payload,
         headers={"Content-Type": "application/json", "Prefer": "return=minimal"})


def settle(root: Path | None = None) -> dict:
    """Settle open model rows from archive results; fancy stays open until a later pass can price the market total."""
    creds = _creds()
    if not creds:
        return {"skipped": True, "reason": "SUPABASE_URL / SUPABASE_SERVICE_KEY not set", "settled": 0}
    base, key = creds
    index = _archive_index(root or config.ARCHIVE)
    open_rows = _list_open(base, key)
    settled_at = now_utc().strftime("%Y-%m-%dT%H:%M:%SZ")
    n = {"settled": 0, "left_open": 0, "void": 0, "fancy_skipped": 0}
    for row in open_rows:
        if row.get("kind") == "fancy":
            n["fancy_skipped"] += 1
            continue
        mt = row.get("market_type") or ""
        arc = _find_archive(index, row.get("match") or "", row.get("start_utc"))
        if not arc:
            n["left_open"] += 1
            continue
        upd = None
        if mt in OU_OR_MS:
            pid = resolve_player_id(row, arc)
            stat, inn = row.get("stat"), int(row.get("inn") or 0)
            if not (pid and stat):
                # archive has finals but we still cannot place the player: void
                if arc.get("has_results"):
                    upd = {"status": "void", "result_value": None, "pnl_u": 0.0}
                else:
                    n["left_open"] += 1
                    continue
            elif (pid, stat, inn) in arc["results"]:
                upd = _settle_ou_ms(row, arc["results"][(pid, stat, inn)])
                upd["player_id"] = pid  # fill in for history backfills
            elif arc["has_results"]:
                upd = {"status": "void", "result_value": None, "pnl_u": 0.0, "player_id": pid}
        elif mt in TOP_MKTS:
            upd = _settle_top(row, arc)
            if upd and not row.get("player_id"):
                pid = resolve_player_id(row, arc)
                if pid:
                    upd = {**upd, "player_id": pid}
        if not upd:
            n["left_open"] += 1
            continue
        _patch_settled(base, key, row["bet_key"], upd, settled_at)
        n["settled"] += 1
        if upd["status"] == "void":
            n["void"] += 1
    return n


def _fetch_all_settled(base: str, key: str) -> list[dict]:
    out, start = [], 0
    while True:
        url = (f"{base}/rest/v1/edge_bets?select=kind,format,market_type,status,pnl_u,edge_pct"
               f"&status=in.(won,lost,push,void)&order=settled_at&limit=1000&offset={start}")
        _, body = _req("GET", url, key)
        rows = json.loads(body)
        out.extend(rows)
        if len(rows) < 1000:
            return out
        start += 1000


def summary(path: Path | None = None) -> dict:
    """Aggregate settled P&L (internal ops artifact)."""
    creds = _creds()
    empty = {"generated_at_utc": now_utc().strftime("%Y-%m-%dT%H:%M:%SZ"), "n": 0, "pnl_u": 0.0, "by": {}}
    if not creds:
        return {**empty, "skipped": True}
    base, key = creds
    rows = _fetch_all_settled(base, key)
    by: dict[str, dict] = {}
    total = 0.0
    for r in rows:
        bucket = f"{r.get('kind')}|{r.get('format') or '?'}|{r.get('market_type') or '?'}"
        b = by.setdefault(bucket, {"n": 0, "won": 0, "lost": 0, "push": 0, "void": 0, "pnl_u": 0.0})
        b["n"] += 1
        st = r.get("status") or ""
        if st in b:
            b[st] += 1
        p = float(r.get("pnl_u") or 0)
        b["pnl_u"] = round(b["pnl_u"] + p, 4)
        total += p
    doc = {"generated_at_utc": empty["generated_at_utc"], "n": len(rows), "pnl_u": round(total, 4), "by": by}
    out = path or (config.OUT / "edge_pnl_summary.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, indent=1) + "\n")
    return doc


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--upsert-fancy", metavar="FILE", nargs="?", const=str(config.OUT / "fancy_alerts.json"),
                    help="upsert fancy alerts from FILE (default out/fancy_alerts.json)")
    ap.add_argument("--backfill-history", metavar="FILE", nargs="?", const=str(config.OUT / "alerts_history.jsonl"),
                    help="upsert past tips from alerts_history.jsonl (default out/alerts_history.jsonl)")
    ap.add_argument("--settle", action="store_true", help="settle open model rows from the archive")
    ap.add_argument("--summary", action="store_true", help="write out/edge_pnl_summary.json")
    ap.add_argument("--archive", default="", help="archive root (default value_bets/archive)")
    a = ap.parse_args(argv)
    try:
        if a.upsert_fancy is not None:
            print(json.dumps(upsert_fancy(path=Path(a.upsert_fancy))))
        if a.backfill_history is not None:
            print(json.dumps(backfill_history(path=Path(a.backfill_history))))
        if a.settle:
            print(json.dumps(settle(Path(a.archive) if a.archive else None)))
        if a.summary:
            print(json.dumps(summary()))
        if a.upsert_fancy is None and a.backfill_history is None and not a.settle and not a.summary:
            ap.print_help()
            return 2
    except Exception as exc:  # noqa: BLE001 — best effort: InvalidURL / HTTP / JSON must not sink the job
        detail = ""
        if isinstance(exc, urllib.error.HTTPError):
            try:
                detail = f" body={exc.read(300).decode('utf-8', 'replace')!r}"
            except OSError:
                pass
        print(f"ledger failed: {exc}{detail}", file=sys.stderr)
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
