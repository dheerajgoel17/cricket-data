"""Match-level "fancy" over/under lines from the MoviOdds (bet365 mirror) feed, for the site's Match Fancy tab.

These markets are about the whole match or one side (total runs, sixes, fours, boundaries, first-innings score, highest over, top score,
a team's sixes / fours / boundaries) rather than a player, so they bypass the player-prop pipeline: they are read straight from the raw feed,
paired into a line with its over and under decimal prices, and published as ``fancy`` in ``book_lines.json``. Keys match the site's engine
markets (``site/src/engine/markets.js``). Back prices only; nothing here prices or recommends a bet.
"""
from __future__ import annotations

import re

from .util import iso, parse_ts

SOURCE = "moviodds_bet365"


def _fmt(m: dict) -> str | None:
    """Format from the book's own league name. T10 is not T20; 60-over is not ODI; a T20 in a Test series cannot price the Test."""
    t = f"{m.get('league') or ''} {m.get('home') or ''} {m.get('away') or ''}".lower()
    if re.search(r"\bt10\b", t) or ("10 over" in t and "t20" not in t):
        return "T10"
    if "the hundred" in t or "100 balls" in t or "100-ball" in t:
        return "Hundred"
    if re.search(r"\b60[- ]overs?\b", t):
        return "O60"
    if re.search(r"\b40[- ]overs?\b", t):
        return "O40"
    if re.search(r"\btest\b", t) or "first class" in t or "first-class" in t:
        return "Test"
    if "t20" in t or "twenty20" in t:
        return "T20"
    if "odi" in t or "one day" in t or "one-day" in t or "50 over" in t or "list a" in t:
        return "ODI"
    return None

# group name -> (engine market key, scope) for groups whose quotes carry the side in `label` (or `side`) and the line in `handicap`
MATCH_GROUPS = {"Total Match Runs": "match_runs", "Most Runs in a Single Over": "highest_over", "1st Innings Score": "first_innings_runs"}
# "Match Totals" holds several lines in one group; the quote's `line` names which
TOTALS = {"Boundaries": "match_boundaries", "Sixes": "match_sixes", "Fours": "match_fours"}
# team totals: the quote's `line` is the team name
TEAM_GROUPS = {"Team Total Match Sixes": "team_total_sixes", "Team Total Match Fours": "team_total_fours", "Total Match Boundaries - Team": "team_total_boundaries"}


def _num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def _side(q) -> str | None:
    s = (q.get("side") or "").strip().lower()
    if s in ("over", "under"):
        return s
    lab = (q.get("label") or "").strip().lower()
    for w in ("over", "under"):
        if lab == w or lab.startswith(w + " "):
            return w
    return None


def _line(q):
    ln = _num(q.get("handicap"))
    if ln is None:  # "Over 72.5" style labels carry the line in the label
        parts = (q.get("label") or "").split()
        ln = _num(parts[-1]) if len(parts) == 2 else _num(q.get("label"))
    return ln


def match_fancy(raw: dict | None) -> list[dict]:
    """Pre-match over/under lines with both prices, sorted by start time. `raw` is the MoviOdds feed (or None)."""
    out = []
    for m in (raw or {}).get("matches", []):
        if m.get("in_play"):
            continue
        name = f"{m['home']} vs {m['away']}"
        start = iso(parse_ts(m["kickoff_utc"])) if m.get("kickoff_utc") else None
        fmt = _fmt(m)
        pairs: dict[tuple, dict] = {}
        for q in m.get("quotes", []):
            g = (q.get("group_name") or "").strip()
            price, side, line = _num(q.get("odds_dec")), _side(q), _line(q)
            if not price or price <= 1 or side is None or line is None:
                continue
            if g in MATCH_GROUPS:
                key, scope, team = MATCH_GROUPS[g], "match", None
            elif g == "Match Totals" and (q.get("line") or "").strip() in TOTALS:
                key, scope, team = TOTALS[q["line"].strip()], "match", None
            elif g in TEAM_GROUPS and (q.get("line") or "").strip():
                key, scope, team = TEAM_GROUPS[g], "team", q["line"].strip()
            elif g == "Highest Individual Score":
                key, scope, team = "top_score", "match", None
            else:
                continue
            pairs.setdefault((key, scope, team, line), {})[side] = round(price, 3)
        for (key, scope, team, line), px in pairs.items():
            if "over" in px and "under" in px:  # a one-sided price is not a line
                out.append({"match": name, "home": m["home"], "away": m["away"], "start_utc": start, "fmt": fmt,
                            "competition": m.get("league") or None, "key": key, "scope": scope, "team": team,
                            "line": line, "over": px["over"], "under": px["under"], "source": SOURCE, "kind": "bookmaker"})
    return sorted(out, key=lambda x: (x["start_utc"] or "", x["match"], x["key"], x["team"] or "", x["line"]))
