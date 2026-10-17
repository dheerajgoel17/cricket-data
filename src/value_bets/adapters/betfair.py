"""Betfair Exchange API with the free *delayed* app key. Optional: env BETFAIR_APP_KEY, BETFAIR_USERNAME,
BETFAIR_PASSWORD (and optional BETFAIR_SSO_URL / BETFAIR_API_URL for regional endpoints).
Betfair blocks restricted jurisdictions (the box egresses from the US), so failures are reported, not fatal."""
import datetime as dt
import os

from ..util import http_json, iso, now_utc
from .base import gender_hint, row, split_teams

NAME = "betfair_delayed"


class Skip(Exception):
    pass


def fetch(fetched_at):
    app = os.environ.get("BETFAIR_APP_KEY")
    user = os.environ.get("BETFAIR_USERNAME")
    pw = os.environ.get("BETFAIR_PASSWORD")
    if not (app and user and pw):
        raise Skip("BETFAIR_APP_KEY/USERNAME/PASSWORD not set")
    sso = os.environ.get("BETFAIR_SSO_URL", "https://identitysso.betfair.com/api/login")
    api = os.environ.get("BETFAIR_API_URL", "https://api.betfair.com/exchange/betting/rest/v1.0")
    hdr = {"X-Application": app, "Content-Type": "application/x-www-form-urlencoded"}
    login, _ = http_json(sso, method="POST", headers=hdr, data={"username": user, "password": pw}, retries=0)
    if login.get("status") != "SUCCESS":
        raise RuntimeError(f"login failed: {login.get('error') or login.get('status')}")
    h = {"X-Application": app, "X-Authentication": login["token"], "Content-Type": "application/json"}
    now = now_utc()
    flt = {"filter": {"eventTypeIds": ["4"], "marketTypeCodes": ["MATCH_ODDS"],
                      "marketStartTime": {"from": iso(now - dt.timedelta(hours=1)),
                                          "to": iso(now + dt.timedelta(hours=30))}},
           "maxResults": "200", "marketProjection": ["EVENT", "RUNNER_DESCRIPTION", "MARKET_START_TIME", "COMPETITION"]}
    cat, _ = http_json(api + "/listMarketCatalogue/", method="POST", headers=h, data=flt, retries=0)
    rows, books = [], []
    ids = [m["marketId"] for m in cat]
    for i in range(0, len(ids), 40):
        b, _ = http_json(api + "/listMarketBook/", method="POST", headers=h,
                         data={"marketIds": ids[i:i + 40], "priceProjection": {"priceData": ["EX_BEST_OFFERS"]}},
                         retries=0)
        books += b
    B = {b["marketId"]: b for b in books}
    for m in cat:
        b = B.get(m["marketId"])
        if not b:
            continue
        names = {r["selectionId"]: r["runnerName"] for r in m.get("runners", [])}
        ev = m.get("event", {})
        a, bb = split_teams(ev.get("name", ""))
        for r in b.get("runners", []):
            ex = r.get("ex", {})
            atb = ex.get("availableToBack", [])
            atl = ex.get("availableToLay", [])
            rows.append(row(source=NAME, source_type="exchange", event_id=ev.get("id"), match=ev.get("name"),
                            team_a=a, team_b=bb, gender_hint=gender_hint(ev.get("name")),
                            competition=(m.get("competition") or {}).get("name"), start_utc=m.get("marketStartTime"),
                            in_play=bool(b.get("inplay")), market_type="match_winner", market_raw="MATCH_ODDS",
                            group_key=f"{NAME}:{m['marketId']}", selection=names.get(r["selectionId"]),
                            team=names.get(r["selectionId"]), back=atb[0]["price"] if atb else None,
                            lay=atl[0]["price"] if atl else None, back_size=atb[0]["size"] if atb else 0,
                            fetched_at=fetched_at))
    return rows, {"catalogue": cat, "books": books}
