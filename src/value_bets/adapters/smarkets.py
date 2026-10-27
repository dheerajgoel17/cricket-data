"""Exchange S public (unauthenticated) read API. Note: Exchange S' T&Cs say automated access needs their
approval; this is read-only, low-frequency. Prices are probability in basis points: decimal = 10000/price."""
import re

from cricket_data.hosts import host

from ..util import http_json
from .base import gender_hint, row, split_teams

NAME = "smarkets"


def _chunks(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]


def classify(mname):
    m = mname.strip()
    ml = m.lower()
    if ml in ("winner", "match winner (including super over)", "match odds"):
        return "match_winner", None
    if "innings" in ml or ml.startswith("team with"):
        return None, None
    g = re.match(r"^(.*) top batsman$", m, re.I)
    if g:
        return "top_batter_team", g.group(1).strip()
    g = re.match(r"^(.*) top bowler$", m, re.I)
    if g:
        return "top_bowler_team", g.group(1).strip()
    return None, None


def _comp(e):
    parts = (e.get("full_slug") or "").split("/")
    return parts[3] if len(parts) > 3 else None


def fetch(fetched_at):
    ev = http_json(host("EXCHANGE_API_URL") + "/events/?type_domain=cricket&type_scope=single_event&state=upcoming&state=live"
                   "&sort=start_datetime,id&limit=200")[0]["events"]
    raw = {"events": ev}
    E = {e["id"]: e for e in ev}
    mk = []
    for c in _chunks(list(E), 20):
        mk += http_json(host("EXCHANGE_API_URL") + f"/events/{','.join(c)}/markets/")[0]["markets"]
    keep = [m for m in mk if classify(m["name"])[0]]
    M = {m["id"]: m for m in keep}
    ct, qt = [], {}
    for c in _chunks(list(M), 40):
        ct += http_json(host("EXCHANGE_API_URL") + f"/markets/{','.join(c)}/contracts/")[0]["contracts"]
        qt.update(http_json(host("EXCHANGE_API_URL") + f"/markets/{','.join(c)}/quotes/")[0])
    raw.update(markets=keep, contracts=ct, quotes=qt)
    rows = []
    for c in ct:
        m = M.get(c["market_id"])
        if not m:
            continue
        e = E[m["event_id"]]
        mt, team = classify(m["name"])
        q = qt.get(c["id"], {})
        offers = q.get("offers", [])
        bids = q.get("bids", [])
        bo = min((o["price"] for o in offers), default=None)
        bb = max((o["price"] for o in bids), default=None)
        back = 10000 / bo if bo else None
        lay = 10000 / bb if bb and bb > 100 else None  # bid at <=1% is noise
        size = sum(o["quantity"] for o in offers if o["price"] == bo) * bo / 1e8 if bo else 0
        a, b = split_teams(e["name"])
        is_player = mt.startswith("top_")
        rows.append(row(source=NAME, source_type="exchange", event_id=e["id"], match=e["name"], team_a=a, team_b=b,
                        gender_hint=gender_hint(e["name"]), competition=_comp(e), start_utc=e["start_datetime"], in_play=e["state"] == "live",
                        market_type=mt, market_raw=m["name"], group_key=f"{NAME}:{m['id']}",
                        selection=c["name"], player=c["name"] if is_player else None,
                        team=team if is_player else c["name"], back=back, lay=lay, back_size=round(size, 2),
                        fetched_at=fetched_at, venue=_venue(e)))
    return rows, raw


def _venue(e):
    v = e.get("venue") or {}
    if not isinstance(v, dict) or not v.get("name"):
        return None
    return ", ".join(x for x in (v.get("name"), v.get("city")) if x)
