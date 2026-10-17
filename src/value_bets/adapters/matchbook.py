"""Matchbook public 'edge' REST events endpoint (no login needed for reading prices)."""
from ..util import http_json
from .base import gender_hint, row, split_teams

NAME = "matchbook"
URL = ("https://api.matchbook.com/edge/rest/events?sport-ids=110&per-page=200&include-prices=true"
       "&price-depth=1&states=open,suspended&exchange-type=back-lay&odds-type=DECIMAL")


def fetch(fetched_at):
    d = http_json(URL)[0]
    rows = []
    for e in d.get("events", []):
        a, b = split_teams(e["name"])
        for m in e.get("markets", []):
            if m.get("name") not in ("Moneyline", "Match Odds"):
                continue
            for r in m.get("runners", []):
                bk = [p for p in r.get("prices", []) if p["side"] == "back"]
                ly = [p for p in r.get("prices", []) if p["side"] == "lay"]
                rows.append(row(source=NAME, source_type="exchange", event_id=e["id"], match=e["name"], team_a=a,
                                team_b=b, gender_hint=gender_hint(e["name"]), start_utc=e["start"],
                                in_play=False, market_type="match_winner",
                                market_raw=m["name"], group_key=f"{NAME}:{m['id']}", selection=r["name"],
                                team=r["name"], back=bk[0]["decimal-odds"] if bk else None,
                                lay=ly[0]["decimal-odds"] if ly else None,
                                back_size=round(bk[0]["available-amount"], 2) if bk else 0, fetched_at=fetched_at))
    return rows, d
