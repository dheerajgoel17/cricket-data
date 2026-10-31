"""Feed F: player and match lines from an Indian exchange's open pages (no login): its sportsbook feed ("premium") and its session markets ("fancy").

The feed hosts and the name the book is published under are deployment configuration, never code (docs/OPERATIONS.md): ``FEEDF_NAME``, ``FEEDF_API`` (the exchange
root: event list, menu, fancy markets), ``FEEDF_PREMIUM`` (the sportsbook root) and ``FEEDF_TENANT`` (the account id the pages send). Unset, the source is skipped. It is
polite by construction: two listings and, per event, one fancy and one premium call, ``FEEDF_SPACING_SECS`` apart, one attempt each, and an HTTP error ends the run.

Premium is decimal and two-way: "1st innings - <Last, First> total" over/unders and "to score N" yes/nos are player rows; "Total fours / sixes" and a side's "total fours /
sixes" are ``fancy`` lines. Fancy is the exchange's session format: a market quotes Yes at line Ly and No at line Ln with a rate each. Yes (back) at rate R: 100
staked wins R, so decimal 1 + R / 100. No (lay) at rate R: R staked wins 100, so decimal 1 + 100 / R (100 is even money, 2.00, either way). Yes wins at Ly or more and No wins at
Ln - 1 or fewer: so Yes is "over Ly - 0.5" and No is "under Ln - 0.5", two lines a gap apart that are one-sided unless Ly == Ln. A player's "<name> Run Adv" gives two player
rows; match totals (fours, sixes, boundaries, wickets, fifties), first-over runs and a side's innings or first-N-overs session runs give ``fancy`` lines.

Rules the book states and the lines carry (``rules``): premium markets void unless 80% of the match is played and have no batting-order condition (a side's fours / sixes stand whether they bat first or second); a fancy side run line (the first N overs, or the full innings) counts
only the side batting first (``bat_first``) and voids if that side bowls first, or if even one ball is lost to weather or the match is abandoned; fancy player lines stand once the outcome is decided;
fancy match totals are not voided by lost balls. Fancy and player-performance markets close an hour before the scheduled start. Player-performance markets are
fantasy points (1 per run, 20 per wicket, 10 per catch, 25 per stumping; the premium one does not state its scoring): they come back as ``player_points`` rows,
published as the site's ``points`` stat (runs + 20 x wickets + 10 x catches + 25 x stumpings, counted from the ball by ball data; no model prices it). Meter, khado and lucky-number markets and multi-day matches (their markets are per innings) are left out.
"""
from __future__ import annotations

import datetime as dt
import os
import re
import time
import urllib.error
from collections import Counter

from .. import config
from ..util import http_json, iso, parse_ts
from .base import Pace, gender_hint, row

NAME = "feedf"
AUTO = True  # on whenever the FEEDF_* variables are set; no need to list it in CV_SOURCES
PREMIUM, FANCY = "feedf_p", "feedf_f"  # one book, two feeds with their own rules and lines: kept apart as two sources, never blended into one price
CRICKET = "4"  # the event list's own code for cricket
IST = dt.timedelta(hours=5, minutes=30)
TZ_HEADER = "Asia/Calcutta"

TOTAL = re.compile(r"^1st innings - (?P<last>[^,]+), (?P<first>.+?) total$")
TO_SCORE = re.compile(r"^1st innings - (?P<last>[^,]+), (?P<first>.+?) to score (?P<n>\d+)$")
PERFORMANCE = re.compile(r"^(?P<name>.+?) total player performance$")  # "Brook, Harry" or, for some players, "Samantha Bates"
TEAM_TOTAL = re.compile(r"^1st innings - (?P<team>.+?) total (?P<what>fours|sixes)$")
MATCH_TOTAL = {"Total fours": "match_fours", "Total sixes": "match_sixes"}
TEAM_KEY = {"fours": "team_total_fours", "sixes": "team_total_sixes"}
OU = re.compile(r"^(over|under) (\d+(?:\.\d+)?)$")

FANCY_MATCH = {"Total Match Fours Adv": "match_fours", "Total Match Sixes Adv": "match_sixes", "Total Match Boundaries Adv": "match_boundaries",
               "Total Match Wkts Adv": "match_wickets", "Total Match Fifties Adv": "match_50s", "Total Match 30s Adv": "match_30s",
               "Match 1st Over Run Adv": "first_over"}
FANCY_PLAYER = re.compile(r"^(?P<p>[A-Za-z][A-Za-z.' -]*?)\s+Run Adv$")
NOT_A_PLAYER = re.compile(r"\b(over|wkt|pship|match|fall|total|top|boundaries)\b", re.I)
FANCY_TEAM_RUNS = re.compile(r"^(?P<n>\d+) Over Run (?P<abbr>[A-Z]{2,4})\s+Adv$")

MULTI_DAY = re.compile(r"\btests?\b|ashes|shield|first.class|championship|ranji|presidents? trophy", re.I)  # innings-scoped markets there: not the match totals the pipeline prices (a later job)

RULES = {"premium": "void_below_80pct", "fancy_side": "void_any_ball", "fancy_player": "stands_once_decided", "fancy_total": "not_voided_by_lost_balls"}


class Skip(Exception):
    pass


def settings() -> dict[str, str]:
    """The deployment's FEEDF_* variables; empty if the source is not configured."""
    s = {k: os.environ.get(f"FEEDF_{k}", "").strip().rstrip("/") for k in ("NAME", "API", "PREMIUM", "TENANT")}
    return s if all(s.values()) and s["API"].startswith("http") and s["PREMIUM"].startswith("http") else {}


def published() -> dict[str, str]:
    """{source key: the name it is published under}: ``booklines.public`` swaps the first for the second. The two feeds are two names ("<book> Premium", "<book> Fancy")."""
    s = settings()
    return {PREMIUM: f"{s['NAME']} Premium", FANCY: f"{s['NAME']} Fancy"} if s else {}


def dec(rate, lay: bool = False) -> float | None:
    """A session rate as a decimal price. Yes (back) at rate R: 100 staked wins R, so 1 + R / 100 (100 is 2.00, 85 is 1.85, 115 is 2.15).
    No (lay) at rate R: R staked wins 100, so 1 + 100 / R (100 is 2.00, 115 is 1.87, 85 is 2.18)."""
    try:
        r = float(rate)
    except (TypeError, ValueError):
        return None
    if r <= 0:
        return None
    return round(1 + 100 / r, 3) if lay else round(1 + r / 100, 3)


def session(yes_line, yes_rate, no_line, no_rate) -> tuple[tuple[float, float] | None, tuple[float, float] | None]:
    """A session market's two quotes as (over, under) = ((line, decimal), (line, decimal)): Yes at Ly is "over Ly - 0.5", No at Ln is "under Ln - 0.5"; None for a side that is not quoted."""
    yes, no = dec(yes_rate), dec(no_rate, lay=True)
    ov = (float(yes_line) - 0.5, yes) if yes and isinstance(yes_line, (int, float)) and yes_line > 0 else None
    un = (float(no_line) - 0.5, no) if no and isinstance(no_line, (int, float)) and no_line > 0 else None
    return ov, un


def person(last: str, first: str) -> str:
    return f"{first.strip()} {last.strip()}"


def abbreviates(abbr: str, name: str) -> bool:
    """True when ``abbr`` ("SL", "ENG") is the initials of ``name`` or its letters in order ("England" -> ENG)."""
    a, words = re.sub(r"[\s.]", "", abbr.lower()), name.lower().split()
    if a == "".join(w[0] for w in words):
        return True
    it = iter(name.lower().replace(" ", ""))
    return len(words) == 1 and all(ch in it for ch in a)


def event_start(text: str) -> str | None:
    """"29/10/2026 13:30:00" (the list is asked for in Asia/Calcutta) as UTC."""
    try:
        return iso(dt.datetime.strptime(text, "%d/%m/%Y %H:%M:%S").replace(tzinfo=dt.timezone.utc) - IST)
    except (TypeError, ValueError):
        return None


def menu_index(menu) -> dict[str, tuple[int | None, str]]:
    """{exchange event id: (sportsbook match number, competition)} from the menu tree: a leaf carries ``eventId`` and ``betRadarId`` ("sr:match:75329894"), its parent group the competition."""
    out: dict[str, tuple[int | None, str]] = {}

    def walk(node, comp):
        if isinstance(node, list):
            for x in node:
                walk(x, comp)
        elif isinstance(node, dict):
            if node.get("eventId"):
                m = re.search(r"(\d+)$", str(node.get("betRadarId") or ""))
                out[str(node["eventId"])] = (int(m.group(1)) if m else None, comp)
            d = node.get("data")
            c = d.get("name", comp) if isinstance(d, dict) else comp
            for k in ("children", "data"):
                if isinstance(node.get(k), (list, dict)):
                    walk(node[k], c)

    walk((menu or {}).get("data", menu), "")
    return out


def _open(m: dict) -> bool:
    return (m.get("marketStatus") or m.get("status")) in ("Active", "OPEN")


def _pair(m: dict) -> tuple[float, dict[str, float]] | None:
    """(line, {"over": price, "under": price}) of an open two-way "over X / under X" premium market."""
    out, line = {}, None
    for o in m.get("uofOutComeOdds") or []:
        mm = OU.match(str(o.get("name") or "").strip().lower())
        if not mm or not o.get("active") or not (o.get("odd") or 0) > 1:
            return None
        ln = float(mm[2])
        if line not in (None, ln):
            return None
        line, out[mm[1]] = ln, round(float(o["odd"]), 3)
    return (line, out) if line is not None and len(out) == 2 else None


def _yes_no(m: dict) -> dict[str, float] | None:
    out = {}
    for o in m.get("uofOutComeOdds") or []:
        n = str(o.get("name") or "").strip().lower()
        if n not in ("yes", "no") or not o.get("active") or not (o.get("odd") or 0) > 1:
            return None
        out[n] = round(float(o["odd"]), 3)
    return out if len(out) == 2 else None


def parse_premium(markets: list[dict], ev: dict, fetched_at: str) -> tuple[list[dict], list[dict], Counter]:
    """(player rows, fancy lines, a count of the market names left out) of one event's sportsbook markets. ``ev`` has the event's names and times."""
    rows, fancy, left = [], [], Counter()
    common = {**ev["common"], "source": PREMIUM}
    for m in markets:
        name = m.get("marketName") or ""
        if not _open(m):
            continue  # a suspended or closed market carries no prices
        gk = f"{PREMIUM}:{ev['id']}:{m.get('marketId')}"
        if (mm := TOTAL.match(name)):
            p = _pair(m)
            if not p:
                left[name] += 1
                continue
            player, line = person(mm["last"], mm["first"]), p[0]
            for side, price in p[1].items():
                rows.append(row(**common, market_type="batter_runs", market_raw=name, group_key=f"{gk}:{line}", selection=f"{player} {side} {line}", player=player,
                                line=line, side=side, back=price))
        elif (mm := PERFORMANCE.match(name)):
            p = _pair(m)
            if not p:
                left[name] += 1
                continue
            last, comma, first = mm["name"].partition(", ")
            player, line = (person(last, first) if comma else mm["name"].strip()), p[0]
            for side, price in p[1].items():
                rows.append(row(**common, market_type="player_points", market_raw=name, group_key=f"{gk}:{line}", selection=f"{player} {side} {line}", player=player,
                                line=line, side=side, back=price))
        elif (mm := TO_SCORE.match(name)):
            px = _yes_no(m)
            if not px:
                left[name] += 1
                continue
            player, line = person(mm["last"], mm["first"]), int(mm["n"]) - 0.5
            for side, key in (("over", "yes"), ("under", "no")):
                rows.append(row(**common, market_type="batter_milestone", market_raw=name, group_key=f"{gk}:{player}:{line}",
                                selection=f"{player} {int(line + 0.5)}+ {key}", player=player, line=line, side=side, back=px[key], ms_scope="match"))
        elif name in MATCH_TOTAL or (mm := TEAM_TOTAL.match(name)):
            p = _pair(m)
            if not p:
                left[name] += 1
                continue
            key, team = (MATCH_TOTAL[name], None) if name in MATCH_TOTAL else (TEAM_KEY[mm["what"]], mm["team"])
            fancy.append(_fancy(ev, key, team, p[0], p[1]["over"], p[1]["under"], "premium", PREMIUM))
        else:
            left[name] += 1
    return rows, fancy, left


def _fancy(ev: dict, key: str, team: str | None, line: float, over, under, rules: str, source: str, **extra) -> dict:
    f = {"match": ev["common"]["match"], "home": ev["home"], "away": ev["away"], "start_utc": ev["common"]["start_utc"], "key": key,
         "scope": "team" if team else "match", "team": team, "line": line, "over": over, "under": under, "source": source, "kind": "bookmaker", "rules": RULES[rules]}
    f.update(extra)
    return f


def parse_fancy(data: list[dict], ev: dict, fetched_at: str) -> tuple[list[dict], list[dict], Counter]:
    """(player rows, fancy lines, a count left out) of one event's session markets. Yes at Ly is "over Ly - 0.5", No at Ln is "under Ln - 0.5"."""
    rows, fancy, left = [], [], Counter()
    common = {**ev["common"], "source": FANCY}
    for cat in data or []:
        catname = (cat.get("categoryDetails") or {}).get("catName")
        if catname not in ("Fancy Market", "Player Performance Market"):
            for m in cat.get("markets") or []:
                left[m.get("marketType") or "?"] += 1  # bookmaker, meter, khado, lucky number: not read
            continue
        for m in cat.get("markets") or []:
            name = (m.get("marketType") or "").strip()
            r = (m.get("runners") or [{}])[0]
            if m.get("status") != "OPEN" or m.get("ballRunning") or r.get("rnrSuspended") or r.get("backRnrSuspended") or r.get("layRnrSuspended"):
                continue
            ov, un = session(r.get("backRuns"), r.get("backOdds"), r.get("layRuns"), r.get("layOdds"))
            if not (ov or un):
                left[name] += 1
                continue
            gk = f"{FANCY}:{ev['id']}:{m.get('marketId')}"
            clean = re.sub(r"\s+", " ", name)
            if catname == "Player Performance Market":  # "H Brook": runs + 20 per wicket + 10 per catch + 25 per stumping, Yes / No like any session market
                for side, v in (("over", ov), ("under", un)):
                    if v:
                        rows.append(row(**common, market_type="player_points", market_raw=name, group_key=f"{gk}:{v[0]}", selection=f"{clean} {side} {v[0]}",
                                        player=clean, line=v[0], side=side, back=v[1]))
                continue
            if clean in FANCY_MATCH:
                key, team, rules = FANCY_MATCH[clean], None, "fancy_total"
            elif (mm := FANCY_TEAM_RUNS.match(clean)):
                teams = [t for t in (ev["home"], ev["away"]) if abbreviates(mm["abbr"], t)]
                if len(teams) != 1:
                    left[name] += 1
                    continue
                n = int(mm["n"])
                key, team, rules = ("team_total_runs", teams[0], "fancy_side") if n >= 20 else (f"overs_{n}", teams[0], "fancy_side")
            elif (mm := FANCY_PLAYER.match(clean)) and not NOT_A_PLAYER.search(mm["p"]):
                player = mm["p"].strip()
                for side, v in (("over", ov), ("under", un)):
                    if v:
                        rows.append(row(**common, market_type="batter_runs", market_raw=name, group_key=f"{gk}:{v[0]}", selection=f"{player} {side} {v[0]}",
                                        player=player, line=v[0], side=side, back=v[1]))
                continue
            else:
                left[name] += 1
                continue
            extra = {"bat_first": True} if rules == "fancy_side" else {}
            if ov and un and ov[0] == un[0]:
                fancy.append(_fancy(ev, key, team, ov[0], ov[1], un[1], rules, FANCY, **extra))
            else:  # a gap between the two lines: each side stands alone on its own line
                for line, price, side in [(ov[0], ov[1], "over")] * bool(ov) + [(un[0], un[1], "under")] * bool(un):
                    fancy.append(_fancy(ev, key, team, line, price if side == "over" else None, price if side == "under" else None, rules, FANCY, **extra))
    return rows, fancy, left


def _event(stub: dict, sr: tuple[int | None, str], fetched_at: str) -> dict | None:
    home, sep, away = str(stub.get("eventName") or "").strip(" ,").partition(" v ")  # the list prints "South Australia v Western Australia," with a stray comma
    if not sep or not home.strip() or not away.strip():
        return None
    home, away, comp = home.strip(), away.strip(), sr[1]
    start = event_start(stub.get("eventDateTime"))
    female = gender_hint(home, away, comp)
    return {"id": str(stub["eventId"]), "home": home, "away": away, "sr": sr[0],
            "common": dict(source_type="bookmaker", event_id=str(stub["eventId"]), match=f"{home} vs {away}", team_a=home, team_b=away,
                           gender_hint=female, competition=comp, start_utc=start, in_play=False, fetched_at=fetched_at)}


def fetch(fetched_at: str):
    s = settings()
    if not s:
        raise Skip("FEEDF_* not set")
    hdr = {"x-timeZone": TZ_HEADER, "Tenant-ID": s["TENANT"]}
    pace = Pace(config.get("FEEDF_SPACING_SECS"), lambda u: http_json(u, headers=hdr, retries=0)[0])
    deadline = time.monotonic() + config.get("FEEDF_BUDGET_SECS")
    now = parse_ts(fetched_at)
    horizon = now + dt.timedelta(hours=config.get("FEEDF_HORIZON_HOURS"))
    info = {"events": 0, "rows": 0, "fancy": 0, "left_out": Counter()}
    rows, fancy = [], []
    names = pace.get(f"{s['API']}/exchange/v2/dashboard/getEventNames")
    menu = menu_index(pace.get(f"{s['API']}/exchange/v2/dashboard/loadPlayerMenu"))
    stubs = []
    for c in ((names.get("data") or {}).get("children") or []):
        st = event_start(c.get("eventDateTime"))
        if c.get("eventTypeId") == CRICKET and st and now < parse_ts(st) < horizon and c.get("eventId") in menu:
            stubs.append((st, c))
    errors: list[Exception] = []
    for _, stub in sorted(stubs, key=lambda x: x[0])[:config.get("FEEDF_MAX_EVENTS")]:
        if time.monotonic() > deadline:
            info["stopped"] = "time budget"
            break
        ev = _event(stub, menu[stub["eventId"]], fetched_at)
        if not ev:
            continue
        if MULTI_DAY.search(ev["common"]["competition"] or ""):
            info["left_out"]["multi-day match"] += 1
            continue
        try:
            if True:  # the event list does not flag fancy markets reliably: ask
                j = pace.get(f"{s['API']}/exchange/v1/dashboard/getFancyEventDetails?eventId={ev['id']}")
                r, fx, left = parse_fancy(j.get("data"), ev, fetched_at)
                rows += r; fancy += fx; info["left_out"].update(left)
            if ev["sr"]:
                j = pace.get(f"{s['PREMIUM']}/exsr/v1/sports/getMarketWithOdds?eventId={ev['sr']}&etId=21")
                r, fx, left = parse_premium(j.get("data") or [], ev, fetched_at)
                rows += r; fancy += fx; info["left_out"].update(left)
        except urllib.error.HTTPError as e:
            info["stopped"] = f"HTTP {e.code}"  # leave the book alone until the next run
            break
        except Exception as e:  # noqa: BLE001
            errors.append(e)
            info["stopped"] = type(e).__name__
            break
        info["events"] += 1
    info["rows"], info["fancy"] = len(rows), len(fancy)
    if not rows and not fancy and errors:
        raise errors[-1]
    return rows, {"books": {s["NAME"]: {**info, "left_out": dict(info["left_out"])}}, "fancy": fancy}
