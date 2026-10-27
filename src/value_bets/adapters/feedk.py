"""Feed K: player prices from a public, login-free sportsbook feed that several operators share (one feed root, one account id per book).

The feed root and the books are deployment configuration, never code (docs/OPERATIONS.md): ``FEEDK_URL`` is the root and ``FEEDK_BOOKS`` is
``id=Name,id=Name``, each account id with the name its prices are published under. Unset, the source is skipped. It is polite by construction:
one listing and a few event pages per book per run, ``FEEDK_SPACING_SECS`` apart, and a 429 ends that book for the run.

Rows are the player markets a line can be read from: "Player's Total Runs" (and sixes, fours, wickets) over/unders, and the "To score a
Half-Century / Century / at least N runs" yes/nos. A Test's "Innings 1" runs line is not the match total the pipeline prices, so multi-day matches give milestones only
(single-innings scope, as in Feed P). Top-batter style markets are left out: their team and innings scope has not been checked against a limited-overs match.
"""
from __future__ import annotations

import datetime as dt
import os
import re
import time
import urllib.error
from collections import Counter

from .. import config
from ..util import http_json, parse_ts
from .base import gender_hint, row

NAME = "feedk"
AUTO = True  # on whenever FEEDK_URL and FEEDK_BOOKS are set; no need to list it in CV_SOURCES
PREFIX = "feedk_"
QS = "lang=en_GB&market=GB&client_id=2&channel_id=1"

RUNS = re.compile(r"^Player's Total Runs\b", re.I)
SIXES = re.compile(r"^Player's Total Sixes\b", re.I)
FOURS = re.compile(r"^Player's Total Fours\b", re.I)
WICKETS = re.compile(r"^(?:Bowler's|Player's) Total Wickets\b", re.I)
OU_MARKETS = ((RUNS, "batter_runs"), (SIXES, "batter_sixes"), (FOURS, "batter_fours"), (WICKETS, "bowler_wickets"))
HALF_CENTURY = re.compile(r"^To score a Half-Century\b", re.I)
CENTURY = re.compile(r"^To score a Century\b", re.I)
AT_LEAST = re.compile(r"^To score at least (\d+) Runs?\b", re.I)
OVER_UNDER = re.compile(r"^(Over|Under) (\d+(?:\.\d+)?)$", re.I)


class Skip(Exception):
    pass


def books() -> dict[str, str]:
    """{account id: published name} from FEEDK_BOOKS ("id=Name,id=Name")."""
    out = {}
    for part in os.environ.get("FEEDK_BOOKS", "").split(","):
        k, _, v = part.partition("=")
        if k.strip() and v.strip():
            out[k.strip()] = v.strip()
    return out


def published() -> dict[str, str]:
    """{source key: the name it is published under}: ``booklines.public`` swaps the first for the second."""
    return {PREFIX + k: v for k, v in books().items()}


def milestone_line(label: str) -> float | None:
    """The runs line of a "to score ..." yes/no: a half-century is over 49.5, a century over 99.5, "at least N runs" over N - 0.5."""
    if HALF_CENTURY.match(label):
        return 49.5
    if CENTURY.match(label):
        return 99.5
    m = AT_LEAST.match(label)
    return int(m.group(1)) - 0.5 if m else None


def _price(o: dict) -> float | None:
    """Prices come as thousandths (2000 = 2.0); a suspended or closed outcome has none."""
    if o.get("status", "OPEN") != "OPEN":
        return None
    try:
        p = float(o["odds"]) / 1000.0
    except (KeyError, TypeError, ValueError):
        return None
    return p if p > 1.0 else None


def _label(offer: dict) -> str:
    c = offer.get("criterion") or {}
    return c.get("englishLabel") or c.get("label") or ""


def multi_day(ev: dict, offers: list[dict]) -> bool:
    """A match with a draw outcome in its Match Odds (or a Test in its competition path) runs over more than one innings per side."""
    if any(p.get("englishName", "").lower().find("test") >= 0 or p.get("name", "").lower().find("test") >= 0 for p in ev.get("path") or []):
        return True
    return any(_label(b) == "Match Odds" and any(o.get("type") == "OT_CROSS" for o in b.get("outcomes") or []) for b in offers)


def _over_under(offer: dict):
    """-> (player, line, {"over": price, "under": price}) for a two-sided player line, else None."""
    player, line, sides = None, None, {}
    for o in offer.get("outcomes") or []:
        m = OVER_UNDER.match((o.get("englishLabel") or o.get("label") or "").strip())
        p = _price(o)
        if not m or p is None:
            return None
        ln = float(m.group(2))
        if line is not None and ln != line:
            return None
        line = ln
        sides[m.group(1).lower()] = p
        player = player or o.get("participant")
    return (player, line, sides) if player and len(sides) == 2 else None


def _yes_no(offer: dict):
    """-> (player, {"over": yes price, "under": no price}); a ladder rung ("at least 20 runs") is often priced for Yes only."""
    player, sides = None, {}
    for o in offer.get("outcomes") or []:
        side = {"yes": "over", "no": "under"}.get((o.get("englishLabel") or o.get("label") or "").strip().lower())
        p = _price(o)
        if side is None or p is None:
            return None
        sides[side] = p
        player = player or o.get("participant")
    return (player, sides) if player and "over" in sides else None


def parse_event(ev: dict, offers: list[dict], src: str, fetched_at: str) -> tuple[list[dict], Counter]:
    """The player rows of one event, and a count of the criterion labels it left out (so a run can say what it did not read)."""
    home, away = ev.get("homeName"), ev.get("awayName")
    if not home or not away or ev.get("state") not in (None, "NOT_STARTED"):
        return [], Counter()
    comp = " / ".join(p.get("englishName") or p.get("name") or "" for p in (ev.get("path") or [])[1:])
    multi = multi_day(ev, offers)
    common = dict(source=src, source_type="bookmaker", event_id=str(ev["id"]), match=f"{home} vs {away}", team_a=home, team_b=away,
                  gender_hint=gender_hint(home, away), competition=comp, start_utc=ev.get("start"), in_play=False, fetched_at=fetched_at)
    rows: list[dict] = []
    skipped: Counter = Counter()
    for offer in offers:
        label, gk = _label(offer), f"{src}:{ev['id']}:{offer.get('id')}"
        market = next((mt for rx, mt in OU_MARKETS if rx.match(label)), None)
        if market:
            got = None if multi else _over_under(offer)
            if not got:
                skipped[label] += 1
                continue
            player, line, sides = got
            for side in ("over", "under"):
                rows.append(row(**common, market_type=market, market_raw=label, group_key=gk, selection=f"{player} {side} {line}",
                                player=player, line=line, side=side, back=sides[side]))
            continue
        ms = milestone_line(label)
        if ms is not None:
            got = _yes_no(offer)
            ladder = AT_LEAST.match(label) is not None  # "at least N runs" is the match total; a half-century / century is one innings
            if not got or (ladder and multi):
                skipped[label] += 1
                continue
            player, sides = got
            for side, price in sides.items():
                rows.append(row(**common, market_type="batter_milestone", market_raw=label, group_key=f"{gk}:{player}:{ms}",
                                selection=f"{player} {int(ms + 0.5)}+ {'yes' if side == 'over' else 'no'}", player=player, line=ms, side=side,
                                back=price, ms_scope="match" if ladder else "innings"))
            continue
        skipped[label] += 1
    return rows, skipped


class _Pace:
    """One request at a time, at least ``gap`` seconds apart."""

    def __init__(self, gap: float):
        self.gap, self.last = gap, 0.0

    def get(self, url: str) -> dict:
        wait = self.last + self.gap - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        try:
            return http_json(url, retries=0)[0]
        finally:
            self.last = time.monotonic()


def fetch(fetched_at: str):
    from cricket_data.hosts import host
    try:
        base = host("FEEDK_URL")
    except RuntimeError as e:
        raise Skip(str(e)) from e
    accounts = books()
    if not accounts:
        raise Skip("FEEDK_BOOKS not set")
    pace = _Pace(config.get("FEEDK_SPACING_SECS"))
    deadline = time.monotonic() + config.get("FEEDK_BUDGET_SECS")
    horizon = parse_ts(fetched_at) + dt.timedelta(hours=config.get("FEEDK_HORIZON_HOURS"))
    rows: list[dict] = []
    raw: dict = {"books": {}}
    errors: list[Exception] = []
    for aid, name in accounts.items():
        src, info = PREFIX + aid, {"events": 0, "rows": 0, "left_out": Counter()}
        raw["books"][name] = info
        try:
            listing = pace.get(f"{base}/{aid}/listView/cricket.json?{QS}&useCombined=true&ncid={int(time.time() * 1000)}")
        except Exception as e:  # one book failing never costs the others
            errors.append(e)
            info["error"] = f"{type(e).__name__}: {e}"[:200]
            continue
        evs = sorted((e["event"] for e in listing.get("events") or []
                      if e.get("event", {}).get("state") == "NOT_STARTED" and parse_ts(e["event"]["start"]) <= horizon
                      and (e["event"].get("nonLiveBoCount") or 0) >= config.get("FEEDK_MIN_OFFERS")), key=lambda x: x["start"])
        for ev in evs[:config.get("FEEDK_MAX_EVENTS")]:
            if time.monotonic() > deadline:
                info["stopped"] = "time budget"
                break
            try:
                j = pace.get(f"{base}/{aid}/betoffer/event/{ev['id']}.json?{QS}&includeParticipants=true&ncid={int(time.time() * 1000)}")
            except urllib.error.HTTPError as e:
                info["stopped"] = f"HTTP {e.code}"  # 429 and friends: leave this book alone until the next run
                break
            except Exception as e:
                errors.append(e)
                info["stopped"] = f"{type(e).__name__}"
                break
            r, left = parse_event(j.get("events", [ev])[0] if j.get("events") else ev, j.get("betOffers") or [], src, fetched_at)
            rows += r
            info["events"] += 1
            info["rows"] += len(r)
            info["left_out"].update(left)
    if not rows and errors:
        raise errors[-1]
    return rows, {"books": {k: {**v, "left_out": dict(v["left_out"])} for k, v in raw["books"].items()}}
