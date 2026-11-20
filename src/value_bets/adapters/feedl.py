"""Feed L: player and match prices from a BetConstruct-class Swarm parent feed (guest WebSocket session, no paid key).

The Swarm socket URL, site id and published name are deployment configuration (docs/OPERATIONS.md): ``FEEDL_WS``,
``FEEDL_SITE``, ``FEEDL_NAME`` (optional ``FEEDL_SOURCE``, default 42). Unset, the source is skipped. Same pattern as
Feed J / Feed K: scrape the **parent** odds engine once, not each white-label child.

Session: ``request_session`` then ``get`` for cricket (sport id 19) games and per-game markets. Polite: ``FEEDL_SPACING_SECS``
between game market pulls, ``FEEDL_BUDGET_SECS`` / ``FEEDL_MAX_EVENTS`` caps. Multi-day matches are skipped for player rows.

Mapped: batsman to-score-fifty / hundred yes-nos, Top Batter / Top Bowler (match and per side), match / team total fours and
sixes, first-over team / match totals, fall-of-1st-wicket runs (fancy). Everything else is catalogue-only.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import ssl
import time
from collections import Counter

from .. import config
from ..util import decimal_ok, iso, parse_ts
from .base import gender_hint, multi_day, row
from .feedi import SKIP_COMP, WOMEN, _fmt, flip

NAME = "feedl"
AUTO = True
SOURCE = "feedl"
CRICKET = 19
FIFTY = re.compile(r"^(.+?)\s*\([^)]+\)\s+to Score a Fifty\b", re.I)
HUNDRED = re.compile(r"^(.+?)\s*\([^)]+\)\s+to Score a Hundred\b", re.I)
OU_NAME = re.compile(r"^(Over|Under)\s*$", re.I)


class Skip(Exception):
    pass


def settings() -> dict:
    """FEEDL_WS / FEEDL_SITE / FEEDL_NAME (+ optional FEEDL_SOURCE); empty if not configured."""
    ws = os.environ.get("FEEDL_WS", "").strip()
    name = os.environ.get("FEEDL_NAME", "").strip()
    site = os.environ.get("FEEDL_SITE", "").strip()
    if not (ws.startswith("wss://") or ws.startswith("ws://")) or not name or not site.isdigit():
        return {}
    src = os.environ.get("FEEDL_SOURCE", "42").strip() or "42"
    return {"WS": ws, "NAME": name, "SITE": int(site), "SOURCE": int(src) if src.isdigit() else 42}


def published() -> dict[str, str]:
    s = settings()
    return {SOURCE: s["NAME"]} if s else {}


def _price(x) -> float | None:
    try:
        return decimal_ok(float(x))
    except (TypeError, ValueError):
        return None


def _ou_events(events: dict) -> tuple[float | None, dict[str, float]] | None:
    """-> (line, {over, under}) from Swarm Over/Under event dict, else None."""
    line, sides = None, {}
    for e in (events or {}).values():
        n = (e.get("name") or "").strip()
        if not OU_NAME.match(n):
            return None
        p = _price(e.get("price"))
        if p is None:
            return None
        side = "over" if n.lower().startswith("over") else "under"
        ln = e.get("base")
        try:
            ln = float(ln) if ln is not None else None
        except (TypeError, ValueError):
            ln = None
        if line is not None and ln is not None and ln != line:
            return None
        if ln is not None:
            line = ln
        sides[side] = p
    return (line, sides) if line is not None and len(sides) == 2 else None


def _yes_no(events: dict) -> dict[str, float] | None:
    sides = {}
    for e in (events or {}).values():
        side = {"yes": "over", "no": "under"}.get((e.get("name") or "").strip().lower())
        p = _price(e.get("price"))
        if side is None or p is None:
            return None
        sides[side] = p
    return sides if "over" in sides else None


def _named(events: dict) -> list[tuple[str, float]]:
    out = []
    for e in (events or {}).values():
        n, p = (e.get("name") or "").strip(), _price(e.get("price"))
        if n and p is not None and not OU_NAME.match(n) and n.lower() not in ("yes", "no", "w1", "w2", "x"):
            out.append((flip(n), p))
    return out


def _walk_markets(payload) -> list[dict]:
    """Every market dict that carries an ``event`` map."""
    out = []

    def walk(o):
        if isinstance(o, dict):
            if isinstance(o.get("event"), dict) and o.get("name"):
                out.append(o)
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(payload)
    return out


def _walk_games(payload) -> list[dict]:
    out = []

    def walk(o):
        if isinstance(o, dict):
            if o.get("team1_name") and o.get("team2_name") and o.get("id"):
                out.append(o)
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(payload)
    return out


def _cat(common: dict, name: str, player, team, line, over, under, mapped) -> dict:
    return {
        "match": common["match"], "home": common["team_a"], "away": common["team_b"], "start_utc": common["start_utc"],
        "competition": common["competition"], "fmt": common.get("fmt"), "source": common["source"], "kind": "bookmaker",
        "name": name, "player": player, "team": team, "line": line, "over": over, "under": under, "mapped": mapped,
    }


def parse_markets(markets: list[dict], common: dict) -> tuple[list[dict], list[dict], list[dict], Counter]:
    """(rows, fancy, catalogue, left_out) for one game's Swarm markets."""
    rows, fancy, cat, left = [], [], [], Counter()
    src, eid = common["source"], common["event_id"]
    home, away = common["team_a"], common["team_b"]
    multi = multi_day(common.get("competition"))
    base = {k: v for k, v in common.items() if k != "fmt"}
    fmt, competition, start = common.get("fmt"), common.get("competition"), common.get("start_utc")

    def add_fancy(key, team, line, over, under, **extra):
        fancy.append({
            "match": common["match"], "home": home, "away": away, "start_utc": start, "fmt": fmt, "competition": competition,
            "key": key, "scope": "team" if team else "match", "team": team, "line": line, "over": over, "under": under,
            "source": src, "kind": "bookmaker", **extra,
        })

    for m in markets:
        name = (m.get("name") or "").strip()
        mtype = (m.get("type") or m.get("market_type") or "").strip()
        events = m.get("event") or {}
        if not name or not events:
            continue

        if (mm := FIFTY.match(name)) or (mm := HUNDRED.match(name)):
            player = flip(mm.group(1).strip())
            n = 50 if FIFTY.match(name) else 100
            yn = _yes_no(events)
            if not yn or multi:
                left[name] += 1
                cat.append(_cat(common, name, player, None, n - 0.5, None, None, None))
                continue
            line = n - 0.5
            ov, un = round(yn["over"], 3), round(yn.get("under"), 3) if yn.get("under") else None
            cat.append(_cat(common, name, player, None, line, ov, un, "batter_milestone"))
            gk = f"{src}:{eid}:ms:{player}:{n}"
            for side, price in (("over", ov), ("under", un)):
                if price is None:
                    continue
                rows.append(row(**base, market_type="batter_milestone", market_raw=name, group_key=gk,
                                selection=f"{player} {n}+ {'yes' if side == 'over' else 'no'}", player=player,
                                line=line, side=side, back=price, ms_scope="match"))
            continue

        if mtype in ("TopMatchBatsman", "TopMatchBowler") or name in ("Top Batter", "Top Bowler"):
            mt = "top_batter_match" if "Bat" in mtype or name == "Top Batter" else "top_bowler_match"
            named = _named(events)
            if len(named) < 3 or multi:
                left[name] += 1
                cat.append(_cat(common, name, None, None, None, None, None, None))
                continue
            gk = f"{src}:{eid}:{mt}"
            for n, p in named:
                cat.append(_cat(common, name, n, None, None, p, None, mt))
                rows.append(row(**base, market_type=mt, market_raw=name, group_key=gk, selection=n, player=n, back=p))
            continue

        if mtype in ("TopHomeTeamBowler", "TopAwayTeamBowler") or re.search(r"Top Bowler$", name):
            team = home if "Home" in mtype or name.startswith(home) else away if "Away" in mtype or name.startswith(away) else None
            if team is None and home in name:
                team = home
            elif team is None and away in name:
                team = away
            named = _named(events)
            if not team or len(named) < 2 or multi:
                left[name] += 1
                continue
            mt = "top_bowler_team"
            gk = f"{src}:{eid}:{mt}:{team}"
            for n, p in named:
                cat.append(_cat(common, name, n, team, None, p, None, mt))
                rows.append(row(**base, market_type=mt, market_raw=name, group_key=gk, selection=n, player=n, team=team, back=p))
            continue

        ou = _ou_events(events)
        if ou:
            line, px = ou
            ov, un = round(px["over"], 3), round(px["under"], 3)
            team = None
            key = None
            if mtype in ("TotalMatchFours",) or name == "Total Fours":
                key = "match_fours"
            elif mtype in ("TotalMatchSixes",) or name == "Total Sixes":
                key = "match_sixes"
            elif mtype in ("Team1TotalMatchFours", "Team2TotalMatchFours") or re.search(r" Total Fours$", name):
                team = home if "Team1" in mtype or name.startswith(home) else away
                key = "team_total_fours"
            elif mtype in ("Team1TotalMatchSixes", "Team2TotalMatchSixes") or re.search(r" Total Sixes$", name):
                team = home if "Team1" in mtype or name.startswith(home) else away
                key = "team_total_sixes"
            elif mtype in ("Team11stOverTotalRuns", "Team21stOverTotalRuns") or re.search(r" 1st Over Total Runs$", name):
                team = home if "Team1" in mtype or name.startswith(home) else away
                key = "overs_1"
            elif name == "1st Over Total Runs" or mtype == "1stOverTotalRuns":
                key = "overs_1"
            cat.append(_cat(common, name, None, team, line, ov, un, key))
            if key:
                add_fancy(key, team, line, ov, un)
            else:
                left[name] += 1
            continue

        left[name] += 1
        cat.append(_cat(common, name, None, None, m.get("base"), None, None, None))
    return rows, fancy, cat, left


class Swarm:
    """One guest Swarm session: request_session + get. Uses websocket-client when installed."""

    def __init__(self, url: str, site: int, source: int):
        try:
            import websocket
        except ImportError as e:
            raise Skip("websocket-client not installed (pip install -e '.[value-bets]')") from e
        self._ws_mod = websocket
        self.url, self.site, self.source = url, site, source
        self._ws = None
        self._rid = 0

    def __enter__(self):
        self._ws = self._ws_mod.create_connection(self.url, timeout=30, sslopt={"cert_reqs": ssl.CERT_NONE})
        r = self.call("request_session", {"language": "eng", "site_id": self.site, "source": self.source})
        if r.get("code") != 0 or not (r.get("data") or {}).get("sid"):
            raise Skip(f"swarm session failed: code={r.get('code')}")
        return self

    def __exit__(self, *exc):
        try:
            if self._ws:
                self._ws.close()
        except Exception:
            pass

    def call(self, command: str, params: dict, tries: int = 40) -> dict:
        self._rid += 1
        rid = str(self._rid)
        self._ws.send(json.dumps({"command": command, "params": params, "rid": rid}))
        last = {}
        for _ in range(tries):
            last = json.loads(self._ws.recv())
            if str(last.get("rid")) == rid:
                return last
        return last


def fetch(fetched_at: str):
    s = settings()
    if not s:
        raise Skip("FEEDL_WS / FEEDL_SITE / FEEDL_NAME not set")
    pace_gap = config.get("FEEDL_SPACING_SECS")
    deadline = time.monotonic() + config.get("FEEDL_BUDGET_SECS")
    horizon = parse_ts(fetched_at) + dt.timedelta(hours=config.get("FEEDL_HORIZON_HOURS"))
    now = parse_ts(fetched_at)
    src = SOURCE
    rows: list[dict] = []
    fancy: list[dict] = []
    catalogue: list[dict] = []
    left = Counter()
    info = {"events": 0, "rows": 0, "fancy": 0}

    with Swarm(s["WS"], s["SITE"], s["SOURCE"]) as swarm:
        listing = swarm.call("get", {
            "source": "betting",
            "what": {
                "sport": ["id", "name"], "region": ["id", "name"], "competition": ["id", "name"],
                "game": ["id", "team1_name", "team2_name", "start_ts", "markets_count", "is_live", "type"],
            },
            "where": {"sport": {"id": CRICKET}},
        })
        games = _walk_games(listing)
        games = [
            g for g in games
            if not g.get("is_live") and (g.get("markets_count") or 0) >= 3
            and g.get("start_ts") and now.timestamp() <= float(g["start_ts"]) <= horizon.timestamp()
            and not SKIP_COMP.search(f"{g.get('team1_name')} {g.get('team2_name')}")
        ]
        games.sort(key=lambda g: (-(g.get("markets_count") or 0), g.get("start_ts") or 0))
        last_pull = 0.0
        for g in games[: config.get("FEEDL_MAX_EVENTS")]:
            if time.monotonic() > deadline:
                info["stopped"] = "time budget"
                break
            wait = last_pull + pace_gap - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            home, away = (g.get("team1_name") or "").strip(), (g.get("team2_name") or "").strip()
            if not home or not away:
                continue
            start = iso(dt.datetime.fromtimestamp(float(g["start_ts"]), tz=dt.timezone.utc))
            # competition name: best-effort from listing walk not always present on game
            competition = None
            female = "female" if WOMEN.search(f"{home} {away}") else gender_hint(home, away)
            common = dict(
                source=src, source_type="bookmaker", event_id=str(g["id"]), match=f"{home} vs {away}",
                team_a=home, team_b=away, gender_hint=female, competition=competition, start_utc=start,
                in_play=False, fetched_at=fetched_at, fmt=_fmt(competition or "", home, away),
            )
            mr = swarm.call("get", {
                "source": "betting",
                "what": {
                    "market": ["id", "name", "type", "market_type", "base", "display_key"],
                    "event": ["id", "price", "name", "base", "type_1"],
                },
                "where": {"game": {"id": g["id"]}},
            })
            last_pull = time.monotonic()
            r, fx, cat, lo = parse_markets(_walk_markets(mr), common)
            rows += r
            fancy += fx
            catalogue += cat
            left.update(lo)
            info["events"] += 1
            info["rows"] += len(r)
            info["fancy"] += len(fx)

    return rows, {
        "books": {s["NAME"]: {**info, "left_out": dict(left), "catalogue": len(catalogue)}},
        "fancy": fancy,
        "catalogue": catalogue,
    }


def main():
    """Dispatch probe: one Swarm listing + sample markets (redacts the socket host)."""
    from value_bets.wl_fingerprint import redact

    s = settings()
    if not s:
        print("FEEDL_WS / FEEDL_SITE / FEEDL_NAME not set")
        return 2
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        rows, raw = fetch(stamp)
    except Skip as e:
        print("skip:", e)
        return 1
    book = next(iter((raw.get("books") or {}).values()), {})
    print(redact(
        f"feedl ok events={book.get('events')} rows={len(rows)} fancy={len(raw.get('fancy') or [])} "
        f"catalogue={book.get('catalogue')} stopped={book.get('stopped')}",
        [s["WS"]],
    ))
    print("left_out sample:", list((book.get("left_out") or {}).items())[:12])
    for r in rows[:8]:
        print("row", r.get("market_type"), r.get("player"), r.get("line"), r.get("side"), r.get("back"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
