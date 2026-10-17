"""The Odds API free tier (500 credits/month). Optional: needs env ODDS_API_KEY.
Budget guard: at most one odds pull per ODDSAPI_MIN_INTERVAL_HOURS, and a monthly credit cap.
Cricket = match winner (h2h) only. /v4/sports is free (0 credits); each odds call = 1 credit (1 market x 1 region)."""
import json
import os

from .. import config
from ..util import http_json, iso, now_utc, parse_ts
from .base import gender_hint, row

NAME = "the_odds_api"
B = "https://api.the-odds-api.com/v4"
STATE = config.STATE / "oddsapi_usage.json"


class Skip(Exception):
    pass


def _state():
    try:
        return json.loads(STATE.read_text())
    except Exception:
        return {}


def fetch(fetched_at):
    key = os.environ.get("ODDS_API_KEY")
    if not key:
        raise Skip("ODDS_API_KEY not set")
    st = _state()
    now = now_utc()
    month = now.strftime("%Y-%m")
    if st.get("month") != month:
        st = {"month": month, "credits": 0, "last_call": None}
    last = parse_ts(st.get("last_call"))
    if last and (now - last).total_seconds() < config.get("ODDSAPI_MIN_INTERVAL_HOURS") * 3600:
        raise Skip(f"budget guard: last pull {iso(last)}, interval {config.get('ODDSAPI_MIN_INTERVAL_HOURS')}h")
    sports = [s for s in http_json(f"{B}/sports/?apiKey={key}")[0]
              if s.get("group") == "Cricket" and s.get("active") and not s.get("has_outrights")]
    cap = config.get("ODDSAPI_MONTHLY_CREDIT_CAP")
    rows, raw = [], {"sports": sports, "odds": {}}
    for s in sports:
        if st["credits"] + 1 > cap:
            break
        data, hdr = http_json(f"{B}/sports/{s['key']}/odds/?apiKey={key}&regions=uk&markets=h2h&oddsFormat=decimal")
        st["credits"] += int(hdr.get("x-requests-last", hdr.get("X-Requests-Last", 1)) or 1)
        st["remaining_reported"] = hdr.get("x-requests-remaining", hdr.get("X-Requests-Remaining"))
        raw["odds"][s["key"]] = data
        for ev in data:
            for bk in ev.get("bookmakers", []):
                for mk in bk.get("markets", []):
                    if mk.get("key") != "h2h":
                        continue
                    for o in mk.get("outcomes", []):
                        rows.append(row(source=f"{NAME}:{bk['key']}", source_type="bookmaker", event_id=ev["id"],
                                        match=f"{ev['home_team']} vs {ev['away_team']}", team_a=ev["home_team"],
                                        team_b=ev["away_team"], gender_hint=gender_hint(ev["home_team"], ev["away_team"]),
                                        competition=s.get("title"), start_utc=ev["commence_time"], in_play=False,
                                        market_type="match_winner", market_raw="h2h",
                                        group_key=f"{NAME}:{bk['key']}:{ev['id']}", selection=o["name"],
                                        team=o["name"], back=o.get("price"), fetched_at=fetched_at))
    st["last_call"] = iso(now)
    STATE.write_text(json.dumps(st, indent=1))
    return rows, raw
