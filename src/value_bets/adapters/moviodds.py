"""Feed P: unofficial mirror of Book A prices (pre-match). Bookmaker prices, back only.

One GET per hourly run of ``PRICE_FEED_URL`` (cricket board). Free tier ~5k requests/month —
keep the key off the in-play snapshot (that would burn the quota). Auth: repository secret
``PRICE_FEED_KEY`` as ``X-API-Key`` (required since the mirror gated keyless access).
"""
from __future__ import annotations

import os
import re
import urllib.error

from cricket_data.hosts import host

from ..util import http_json
from .base import gender_hint, row

NAME = "moviodds_bet365"

MAP = {
    "To Win the Match": "match_winner",
    "Team - Top Batter": "top_batter_team",
    "Top Match Batter": "top_batter_match",
    "Team - Top Bowler": "top_bowler_team",
    "Top Match Bowler": "top_bowler_match",
    "Batsman Match Runs": "batter_runs",
    "Batsman Total Match Sixes": "batter_sixes",
    "Bowler Total Match Wickets": "bowler_wickets",
    "Batter Total Match Fours": "batter_fours",
    # milestones: two-way Yes/No (de-viggable) and one-sided ladders (priced off the player's O/U market).
    # NB they are DIFFERENT markets in multi-day games: "to score a Fifty/Hundred in the match" is settled on a single
    # innings (50+ in either innings), the "Batter Milestones" ladder on the player's match aggregate (both innings,
    # same basis as "Batsman Match Runs"). Rows carry ms_scope = "innings" | "match" so the pipeline can split them.
    "Batsman to Score a Fifty in the Match": "batter_milestone",
    "Batsman to score a Hundred in the match": "batter_milestone",
    "Batter Milestones": "batter_milestone",
    "Bowler Milestones": "bowler_milestone",
    "Player Performance": "player_points",  # fantasy points: 1 per run, 20 per wicket, 10 per catch, 25 per stumping (the site's one scoring)
}
OU = ("batter_runs", "batter_sixes", "batter_fours", "bowler_wickets", "player_points")
YESNO_LINE = {"Batsman to Score a Fifty in the Match": 49.5, "Batsman to score a Hundred in the match": 99.5}
LADDER_RE = re.compile(r"^\s*(\d+)\+")


def api_headers() -> dict[str, str]:
    """``X-API-Key`` from ``PRICE_FEED_KEY`` when set (never logged)."""
    key = os.environ.get("PRICE_FEED_KEY", "").strip()
    return {"X-API-Key": key} if key else {}


def fetch(fetched_at):
    url = host("PRICE_FEED_URL")
    headers = api_headers()
    try:
        d = http_json(url, timeout=45, headers=headers)[0]
    except urllib.error.HTTPError as e:
        # 401 = missing/invalid PRICE_FEED_KEY (or stale URL). Key never goes in the message.
        if e.code == 401:
            hint = "set/rotate PRICE_FEED_KEY (X-API-Key)" if not headers else "invalid/revoked PRICE_FEED_KEY or stale PRICE_FEED_URL"
            raise urllib.error.HTTPError(
                e.url, 401, f"{e.reason}; {hint}", e.hdrs, None,
            ) from e
        raise
    rows = []
    for m in d.get("matches", []):
        if m.get("in_play"):
            continue  # pre-match only; in-play stays off this free-tier key
        name = f"{m['home']} vs {m['away']}"
        for q in m.get("quotes", []):
            mt = MAP.get((q.get("group_name") or "").strip())
            if not mt:
                continue
            player = team = line = side = ms_scope = None
            if mt == "match_winner":
                sel = q.get("label")
                team = sel
            elif mt in ("top_batter_team", "top_bowler_team"):
                sel = player = q.get("line") or q.get("label")
            elif mt in ("top_batter_match", "top_bowler_match"):
                sel = player = q.get("label")
            elif mt in ("batter_milestone", "bowler_milestone"):
                player, team = q.get("line"), q.get("n2")
                raw_side = (q.get("side") or "").strip()
                g = (q.get("group_name") or "").strip()
                if g in YESNO_LINE:
                    if raw_side.lower() not in ("yes", "no"):
                        continue
                    line, side = YESNO_LINE[g], ("over" if raw_side.lower() == "yes" else "under")
                    ms_scope = "innings"
                else:
                    mm = LADDER_RE.match(raw_side)
                    if not mm:
                        continue
                    line, side = int(mm.group(1)) - 0.5, "over"
                    ms_scope = "match"
                sel = f"{player} {int(line + 0.5)}+ {'yes' if side == 'over' else 'no'}"
            else:
                player = q.get("line")
                team = q.get("n2")
                side = (q.get("side") or "").lower()
                try:
                    line = float(q.get("handicap") or q.get("label"))
                except (TypeError, ValueError):
                    continue
                sel = f"{player} {side} {line}"
            gk = f"{NAME}:{m['id']}:{q.get('market_id')}"
            if mt in OU or mt in ("batter_milestone", "bowler_milestone"):
                gk += f":{player}:{line}"
            rows.append(row(source=NAME, source_type="bookmaker", event_id=m["id"], match=name, team_a=m["home"],
                            team_b=m["away"], gender_hint=gender_hint(m["home"], m["away"]),
                            competition=m.get("league"), start_utc=m.get("kickoff_utc"), in_play=False,
                            market_type=mt, market_raw=q.get("group_name"), group_key=gk, selection=sel,
                            player=player, team=team, line=line, side=side, back=q.get("odds_dec"),
                            fetched_at=fetched_at, ms_scope=ms_scope))
    return rows, d
