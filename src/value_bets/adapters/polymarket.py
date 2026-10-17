"""Polymarket Gamma API (public). Moneyline markets only. Back odds = 1/best ask."""
import json

from ..util import http_json
from .base import gender_hint, row

NAME = "polymarket"
URL = "https://gamma-api.polymarket.com/events?tag_slug=cricket&active=true&closed=false&limit=200"


def fetch(fetched_at):
    d = http_json(URL, timeout=40)[0]
    rows = []
    for e in d:
        for m in e.get("markets", []):
            if m.get("closed") or m.get("sportsMarketType") != "moneyline":
                continue
            outs = json.loads(m.get("outcomes") or "[]")
            prices = [float(x) for x in json.loads(m.get("outcomePrices") or "[]")]
            if len(outs) != 2 or len(prices) != 2 or {o.lower() for o in outs} & {"yes", "no"}:
                continue
            ask0, bid0 = m.get("bestAsk"), m.get("bestBid")
            asks = [ask0, (1 - bid0) if bid0 is not None else None]
            bids = [bid0, (1 - ask0) if ask0 is not None else None]
            liq = float(m.get("liquidity") or 0)
            for i, o in enumerate(outs):
                back = 1 / asks[i] if asks[i] and 0 < asks[i] < 1 else None
                lay = 1 / bids[i] if bids[i] and 0 < bids[i] < 1 else None
                rows.append(row(source=NAME, source_type="exchange", event_id=m.get("id"),
                                match=f"{outs[0]} vs {outs[1]}", team_a=outs[0], team_b=outs[1],
                                gender_hint=gender_hint(*outs), competition=e.get("title", "").split(":")[0],
                                start_utc=m.get("gameStartTime") or e.get("startTime"), in_play=False,
                                market_type="match_winner", market_raw=m.get("question"),
                                group_key=f"{NAME}:{m.get('id')}", selection=o, team=o, back=back, lay=lay,
                                liquidity=liq, back_size=liq, fetched_at=fetched_at))
    return rows, d
