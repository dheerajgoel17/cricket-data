"""Feed E: player and match prices from a public, login-free sportsbook feed (one feed root per book).

The books are deployment configuration, never code (docs/OPERATIONS.md): ``FEEDE_BOOKS`` is ``id=Name@root,id=Name@root``, each book's short id, the
name its prices are published under, and its feed root. Unset, the source is skipped. It is polite by construction: one listing and a few event
pages per book per run, ``FEEDE_SPACING_SECS`` apart, one attempt each, and an HTTP error ends that book for the run.

Rows are the player markets a line can be read from: "<player> - Over/Under N Runs" and the "<player> To Score N" yes/nos. Match totals of sixes and
fours come back as ``fancy`` lines (the site's Match Fancy tab), not rows. A multi-day match gives fancy lines and the innings-scoped lines: its unscoped player
runs lines are not the match total the pipeline prices, but "<player> - Over/Under N Runs 1st innings" (a Test only) is a row with ``inn`` set (1 or 2, the side's
own innings), and "<team> Over/Under N Runs 1st innings" is a ``fancy`` line with the same ``inn``. Top-runscorer style markets are left out until their scope is checked.
"""
from __future__ import annotations

import datetime as dt
import os
import re
import time
import urllib.error
import urllib.parse
from collections import Counter

from .. import config
from ..util import http_json, iso, parse_ts
from .base import Pace, gender_hint, row

NAME = "feede"
AUTO = True  # on whenever FEEDE_BOOKS is set; no need to list it in CV_SOURCES
PREFIX = "feede_"
QS = "translationLang=en&responseFormat=json"

RUNS = re.compile(r"^(?P<p>.+?) - Over/Under (?P<line>\d+(?:\.\d+)?) Runs(?: (?P<inn>1st|2nd) innings)?$")
TEAM_RUNS = re.compile(r"^(?P<team>.+?) Over/Under (?P<line>\d+(?:\.\d+)?) Runs (?P<inn>1st|2nd) innings$")
INNINGS_NO = {"1st": 1, "2nd": 2}
TO_SCORE = re.compile(r"^(?P<p>.+?) To Score (?P<n>\d+)$")
MATCH_TOTAL = re.compile(r"^Over/Under (?P<line>\d+(?:\.\d+)?) Match (?P<what>Sixes|Fours)$")
FANCY_KEY = {"Sixes": "match_sixes", "Fours": "match_fours"}
MULTI_DAY = re.compile(r"test|ashes|shield|first.class|championship|ranji", re.I)
TEST = re.compile(r"\btests?\b|ashes", re.I)  # the one multi-day format the site charts
WOMEN = re.compile(r"women|wbbl|\(w\)", re.I)


class Skip(Exception):
    pass


def books() -> dict[str, tuple[str, str]]:
    """{id: (published name, feed root)} from FEEDE_BOOKS ("id=Name@root,id=Name@root")."""
    out = {}
    for part in os.environ.get("FEEDE_BOOKS", "").split(","):
        k, _, rest = part.partition("=")
        name, _, root = rest.partition("@")
        if k.strip() and name.strip() and root.strip().startswith("http"):
            out[k.strip()] = (name.strip(), root.strip().rstrip("/"))
    return out


def published() -> dict[str, str]:
    """{source key: the name it is published under}: ``booklines.public`` swaps the first for the second."""
    return {PREFIX + k: name for k, (name, _) in books().items()}


def _price(outcome: dict) -> float | None:
    """The decimal price of an open outcome, else None."""
    if outcome.get("outcomeStatusCode") not in (None, "A"):
        return None
    for ch in outcome.get("children") or []:
        p = ch.get("price")
        if not p:
            continue
        try:
            dec = float(p["priceDec"])
        except (KeyError, TypeError, ValueError):
            try:
                dec = 1 + float(p["priceNum"]) / float(p["priceDen"])
            except (KeyError, TypeError, ValueError, ZeroDivisionError):
                return None
        return dec if dec > 1.0 else None
    return None


def _outcomes(market: dict) -> list[dict]:
    return [c["outcome"] for c in market.get("children") or [] if "outcome" in c]


def _sides(market: dict, names: dict[str, str]) -> dict[str, float] | None:
    """{"over": price, "under": price} from outcomes named by their first word (``names`` maps it to a side); None if any is unusable."""
    out = {}
    for o in _outcomes(market):
        side = names.get(re.split(r"[\s(-]+", (o.get("name") or "").strip().lower())[0])
        p = _price(o)
        if side is None or p is None:
            return None
        out[side] = p
    return out or None


def split_name(name: str) -> tuple[str | None, str | None]:
    a, _, b = name.partition(" v ")
    return (a.strip(), b.strip()) if b else (None, None)


def parse_event(ev: dict, src: str, fetched_at: str) -> tuple[list[dict], list[dict], Counter]:
    """(player rows, fancy lines, a count of the market names left out) of one event with its markets."""
    home, away = split_name(ev.get("name") or "")
    if not home or not away:
        return [], [], Counter()
    typ = ev.get("typeName") or ""
    multi, test = bool(MULTI_DAY.search(typ)), bool(TEST.search(typ))
    female = "female" if WOMEN.search(f"{typ} {ev['name']}") else gender_hint(home, away)
    start = iso(parse_ts(ev["startTime"])) if ev.get("startTime") else None
    common = dict(source=src, source_type="bookmaker", event_id=str(ev["id"]), match=f"{home} vs {away}", team_a=home, team_b=away,
                  gender_hint=female, competition=typ, start_utc=start, in_play=False, fetched_at=fetched_at)
    rows, fancy, left = [], [], Counter()
    for m in (c["market"] for c in ev.get("children") or [] if "market" in c):
        name, gk = m.get("name") or "", f"{src}:{ev['id']}:{m.get('id')}"
        if m.get("marketStatusCode") != "A":
            left[name] += 1
            continue
        if (mm := MATCH_TOTAL.match(name)) and m.get("templateMarketName", "").startswith("Match Total"):
            px = _sides(m, {"over": "over", "under": "under"})
            if px and len(px) == 2:
                fancy.append({"match": common["match"], "home": home, "away": away, "start_utc": start, "key": FANCY_KEY[mm["what"]], "scope": "match",
                              "team": None, "line": float(mm["line"]), "over": round(px["over"], 3), "under": round(px["under"], 3), "source": src,
                              "kind": "bookmaker"})
            else:
                left[name] += 1
            continue
        if multi and (mm := TEAM_RUNS.match(name)) and m.get("templateMarketName", "").endswith("Team Innings Runs"):
            px = _sides(m, {"over": "over", "under": "under"})
            if px and len(px) == 2:
                fancy.append({"match": common["match"], "home": home, "away": away, "start_utc": start, "key": "team_total_runs", "scope": "team",
                              "team": mm["team"], "line": float(mm["line"]), "over": round(px["over"], 3), "under": round(px["under"], 3), "source": src,
                              "kind": "bookmaker", "inn": INNINGS_NO[mm["inn"]]})
            else:
                left[name] += 1
            continue
        mm = RUNS.match(name)
        if mm and m.get("templateMarketName") == "Batsman Runs" and (mm["inn"] is None and not multi or mm["inn"] is not None and test):  # a Test line names its innings; a limited-overs one does not
            px, line = _sides(m, {"over": "over", "under": "under"}), float(mm["line"])
            if not px or len(px) != 2:
                left[name] += 1
                continue
            for side in ("over", "under"):
                rows.append(row(**common, market_type="batter_runs", market_raw=name, group_key=gk, selection=f"{mm['p']} {side} {line}", player=mm["p"],
                                line=line, side=side, back=px[side], inn=INNINGS_NO.get(mm["inn"])))
            continue
        if multi:
            left[name] += 1
            continue
        if (mm := TO_SCORE.match(name)) and m.get("templateMarketName") == "Player To Score X Runs":
            px, line = _sides(m, {"yes": "over", "no": "under"}), int(mm["n"]) - 0.5
            if not px or "over" not in px:
                left[name] += 1
                continue
            for side, price in px.items():
                rows.append(row(**common, market_type="batter_milestone", market_raw=name, group_key=f"{gk}:{mm['p']}:{line}",
                                selection=f"{mm['p']} {int(line + 0.5)}+ {'yes' if side == 'over' else 'no'}", player=mm["p"], line=line, side=side,
                                back=price, ms_scope="match"))
            continue
        left[name] += 1
    return rows, fancy, left


def fetch(fetched_at: str):
    configured = books()
    if not configured:
        raise Skip("FEEDE_BOOKS not set")
    pace = Pace(config.get("FEEDE_SPACING_SECS"), lambda u: http_json(u, retries=0)[0])
    deadline = time.monotonic() + config.get("FEEDE_BUDGET_SECS")
    now = parse_ts(fetched_at)
    horizon = now + dt.timedelta(hours=config.get("FEEDE_HORIZON_HOURS"))
    rows: list[dict] = []
    fancy: list[dict] = []
    raw: dict = {"books": {}}
    errors: list[Exception] = []
    for bid, (name, root) in configured.items():
        src, info = PREFIX + bid, {"events": 0, "rows": 0, "fancy": 0, "left_out": Counter()}
        raw["books"][name] = info
        flt = ["event.categoryCode:equals:CRICKET", "event.eventSortCode:equals:MTCH", "event.isStarted:isFalse", f"event.startTime:greaterThan:{iso(now)}",
               f"event.startTime:lessThan:{iso(horizon)}", "event.siteChannels:contains:M"]
        try:
            listing = pace.get(f"{root}/Event?" + "&".join("simpleFilter=" + urllib.parse.quote(f, safe=":") for f in flt) + f"&{QS}")
        except Exception as e:  # one book failing never costs the others
            errors.append(e)
            info["error"] = f"{type(e).__name__}: {e}"[:200]
            continue
        evs = sorted((c["event"] for c in (listing.get("SSResponse") or {}).get("children") or [] if "event" in c
                      and c["event"].get("eventStatusCode") == "A" and " v " in (c["event"].get("name") or "")), key=lambda e: e["startTime"])
        for stub in evs[:config.get("FEEDE_MAX_EVENTS")]:
            if time.monotonic() > deadline:
                info["stopped"] = "time budget"
                break
            try:
                j = pace.get(f"{root}/EventToOutcomeForEvent/{stub['id']}?{QS}")
            except urllib.error.HTTPError as e:
                info["stopped"] = f"HTTP {e.code}"  # 429 and friends: leave this book alone until the next run
                break
            except Exception as e:
                errors.append(e)
                info["stopped"] = type(e).__name__
                break
            full = next((c["event"] for c in (j.get("SSResponse") or {}).get("children") or [] if "event" in c), None)
            if not full:
                continue
            r, fx, left = parse_event(full, src, fetched_at)
            rows += r
            fancy += fx
            info["events"] += 1
            info["rows"] += len(r)
            info["fancy"] += len(fx)
            info["left_out"].update(left)
    if not rows and not fancy and errors:
        raise errors[-1]
    return rows, {"books": {k: {**v, "left_out": dict(v["left_out"])} for k, v in raw["books"].items()}, "fancy": fancy}
