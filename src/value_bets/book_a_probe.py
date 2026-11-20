"""Book A (bet365) direct guest-scrape probe: classify responses and score PASS/FAIL.

Pure helpers — no network, no hosts. The Actions script ``scripts/probe_book_a.py`` fetches;
this module decides whether a body looks like free guest cricket props we can map.
Market names match Feed P's map in ``adapters/moviodds.py`` (same Book A board).
"""
from __future__ import annotations

import json
import re
from collections import Counter
from typing import Any

# Same raw group names Feed P maps today (adapters/moviodds.MAP). A direct scrape must surface these.
MAPPED_MARKETS = {
    "To Win the Match": "match_winner",
    "Team - Top Batter": "top_batter_team",
    "Top Match Batter": "top_batter_match",
    "Team - Top Bowler": "top_bowler_team",
    "Top Match Bowler": "top_bowler_match",
    "Batsman Match Runs": "batter_runs",
    "Batsman Total Match Sixes": "batter_sixes",
    "Bowler Total Match Wickets": "bowler_wickets",
    "Batter Total Match Fours": "batter_fours",
    "Batsman to Score a Fifty in the Match": "batter_milestone",
    "Batsman to score a Hundred in the match": "batter_milestone",
    "Batter Milestones": "batter_milestone",
    "Bowler Milestones": "bowler_milestone",
    "Player Performance": "player_points",
}
PROP_KEYS = frozenset({"batter_runs", "batter_sixes", "batter_fours", "bowler_wickets"})

IMPERSONATE_LADDER = (
    "chrome", "chrome152", "chrome146", "chrome136", "chrome133a",
    "chrome_android", "chrome131_android", "safari270", "firefox155", "chrome131",
)

# Relative paths only (never a host). Ops can extend with BOOK_A_PATHS.
DEFAULT_PATHS = (
    "/",
    "/defaultapi/sports-configuration",
    "/sportsbookcontentapi/public/v1/sports",
)

CHALLENGE = re.compile(
    r"just a moment|cf-browser-verification|cf-challenge|attention required|"
    r"enable javascript|access denied|request blocked|captcha",
    re.I,
)
LOGIN_WALL = re.compile(
    r"sign[\s-]?in|log[\s-]?in|create account|join now|members only|session expired|"
    r"please log in|authentication required",
    re.I,
)
CRICKET = re.compile(r"\bcricket\b|\bt20\b|\bodi\b|\btest match\b|\bbbl\b|\bipl\b", re.I)
DECIMAL = re.compile(r"\b(?:1\.\d{2,}|[2-9]\.\d{1,}|[1-9]\d\.\d+)\b")


def content_class(content_type: str | None, body: str) -> str:
    ct = (content_type or "").lower()
    head = (body or "")[:200].lstrip().lower()
    if "json" in ct or head.startswith("{") or head.startswith("["):
        return "json"
    if "html" in ct or head.startswith("<!doctype") or head.startswith("<html"):
        return "html"
    return "other"


def is_challenge(body: str, status: int | None = None) -> bool:
    t = (body or "")[:2000]
    if status in (403, 503) and (CHALLENGE.search(t) or "<html" in t.lower()):
        return True
    return bool(CHALLENGE.search(t))


def is_login_wall(body: str, status: int | None = None) -> bool:
    if status in (401, 403) and LOGIN_WALL.search((body or "")[:2000]):
        return True
    # HTML interstitial that only offers sign-in, no sports JSON
    head = (body or "")[:4000]
    if content_class("", head) == "html" and LOGIN_WALL.search(head) and not MAPPED_MARKETS.keys() & _names_in(head):
        return bool(LOGIN_WALL.search(head))
    return False


def _names_in(text: str) -> set[str]:
    found: set[str] = set()
    for name in MAPPED_MARKETS:
        if name in text:
            found.add(name)
    return found


def extract_group_names(blob: Any) -> Counter[str]:
    """Walk JSON (or scan text) for Book A group / market names we know."""
    counts: Counter[str] = Counter()

    def walk(obj: Any) -> None:
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k in ("group_name", "GroupName", "marketName", "MarketName", "name", "NA") and isinstance(v, str):
                    if v in MAPPED_MARKETS:
                        counts[v] += 1
                        continue  # already counted; do not substring-scan the same string
                walk(v)
        elif isinstance(obj, list):
            for x in obj:
                walk(x)
        elif isinstance(obj, str):
            for name in _names_in(obj):
                counts[name] += 1

    if isinstance(blob, (dict, list)):
        walk(blob)
    elif isinstance(blob, str):
        # Prefer JSON parse; fall back to substring scan
        s = blob.strip()
        if s.startswith("{") or s.startswith("["):
            try:
                walk(json.loads(s))
                if counts:
                    return counts
            except json.JSONDecodeError:
                pass
        for name in _names_in(blob):
            counts[name] += blob.count(name)
    return counts


def mapped_prop_keys(group_counts: Counter[str]) -> set[str]:
    return {MAPPED_MARKETS[n] for n in group_counts if n in MAPPED_MARKETS} & PROP_KEYS


def score_probe(
    *,
    status: int | None,
    content_type: str | None,
    body: str,
    impersonate: str | None = None,
) -> dict[str, Any]:
    """Score one HTTP response. ``verdict`` is pass | fail; ``reasons`` lists gate failures."""
    cls = content_class(content_type, body)
    challenge = is_challenge(body, status)
    login = is_login_wall(body, status)
    cricket = bool(CRICKET.search(body or ""))
    groups = extract_group_names(body)
    props = mapped_prop_keys(groups)
    has_decimal = bool(DECIMAL.search(body or ""))
    transport_ok = status is not None and 200 <= status < 300 and not challenge

    reasons: list[str] = []
    if status is None:
        reasons.append("no_response")
    elif not transport_ok:
        if challenge:
            reasons.append("challenge")
        elif status in (401, 403):
            reasons.append(f"http_{status}")
        else:
            reasons.append(f"http_{status}")
    if login:
        reasons.append("login_wall")
    if cls == "html" and not props:
        reasons.append("html_only")
    if not cricket and not props:
        reasons.append("no_cricket")
    if not props:
        reasons.append("no_prop_markets")
    if props and not has_decimal:
        reasons.append("no_decimal_odds")

    # PASS: transport OK, guest (no login wall), at least one mapped prop market with decimals
    ok = transport_ok and not login and bool(props) and has_decimal
    return {
        "verdict": "pass" if ok else "fail",
        "reasons": reasons if not ok else [],
        "status": status,
        "content_class": cls,
        "challenge": challenge,
        "login_wall": login,
        "cricket": cricket or bool(props),
        "impersonate": impersonate,
        "group_counts": dict(groups.most_common(20)),
        "prop_keys": sorted(props),
        "has_decimal": has_decimal,
    }


def merge_scores(scores: list[dict[str, Any]]) -> dict[str, Any]:
    """Overall PASS if any single response PASSes (one working path is enough)."""
    if not scores:
        return {"verdict": "fail", "reasons": ["no_attempts"], "best": None, "attempts": 0}
    passed = [s for s in scores if s.get("verdict") == "pass"]
    if passed:
        best = max(passed, key=lambda s: len(s.get("prop_keys") or []))
        return {"verdict": "pass", "reasons": [], "best": best, "attempts": len(scores)}
    # Prefer the most informative failure for the summary
    best = max(scores, key=lambda s: (len(s.get("prop_keys") or []), len(s.get("group_counts") or {})))
    reasons = list(dict.fromkeys(r for s in scores for r in (s.get("reasons") or [])))
    return {"verdict": "fail", "reasons": reasons or ["all_failed"], "best": best, "attempts": len(scores)}
