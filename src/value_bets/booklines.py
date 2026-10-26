"""Bookmaker / exchange player lines for the site: every two-sided over/under price on a runs, sixes, fours or wickets line.

The pipeline already holds these rows (to price value bets) and used to discard them. ``book_lines`` keeps the ones whose
player was matched to the Cricsheet registry, so the site can show the market's line and decimal odds on that player's page
and use the market line as the default. Prices are decimal back prices only; no stake advice is made here.
"""
from __future__ import annotations

from collections import defaultdict

STAT = {"batter_runs": "runs", "batter_sixes": "sixes", "batter_fours": "fours", "bowler_wickets": "wickets"}
FMT = {"T20": "T20", "ODI": "ODI", "MULTI": "Test"}  # the pipeline calls a multi-day match MULTI; the site calls it Test


def book_lines(rows: list[dict], generated_at: str) -> dict:
    """rows: pipeline rows after player resolution. Returns {"generated_at_utc", "lines": [...]} sorted by start time, player, stat, line."""
    groups: dict[tuple, dict] = {}
    for r in rows:
        stat = STAT.get(r.get("market_type"))
        pid, line, side, back = r.get("player_id"), r.get("line"), r.get("side"), r.get("back")
        if not stat or not pid or line is None or side not in ("over", "under") or not back or r.get("in_play"):
            continue
        fmt = FMT.get(r.get("fmt") or "")
        if fmt is None:
            continue
        key = (r["event_key"], pid, stat, float(line))
        g = groups.setdefault(key, {
            "pid": pid, "player": r.get("player_hist_name") or r.get("player"), "team": r.get("player_team"), "fmt": fmt, "stat": stat,
            "line": float(line), "match": r.get("match"), "competition": r.get("competition"), "start_utc": r.get("start_utc"), "_books": defaultdict(dict)})
        g["_books"][(r["source"], r.get("source_type"))][side] = round(float(back), 3)
    lines = []
    for g in groups.values():
        books = [{"source": s, "kind": k, "over": sides["over"], "under": sides["under"]}
                 for (s, k), sides in sorted(g.pop("_books").items(), key=lambda kv: kv[0])
                 if "over" in sides and "under" in sides]  # a one-sided price is not a line the player page can show
        if books:
            lines.append({**g, "books": books})
    lines.sort(key=lambda x: (x["start_utc"] or "", x["player"] or "", x["stat"], x["line"]))
    return {"generated_at_utc": generated_at, "lines": lines}
