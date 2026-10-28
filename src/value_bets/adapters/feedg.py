"""Feed G: session ("fancy") markets from an Indian exchange's open guest pages (no login), on the platform several white-label exchanges share.

The book and its API host are deployment configuration, never code (docs/OPERATIONS.md): ``FEEDG_NAME`` (the name its prices are published under) and ``FEEDG_API`` (its API
root). Unset, the source is skipped. It is polite by construction: one event list, then per event one catalogue call (market names and ids; it names the odds host) and one odds
call for all the session markets, ``FEEDG_SPACING_SECS`` apart, one attempt each, and an HTTP error ends the run. No header, cookie or account is sent.

A session market quotes Yes at a line with a rate and No at a line with a rate, exactly as Feed F reads them (``feedf.session``): Yes (back) at rate R pays R per 100 staked
(decimal 1 + R / 100), No (lay) at rate R needs R staked to win 100 (decimal 1 + 100 / R); Yes at Ly is "over Ly - 0.5" and No at Ln is "under Ln - 0.5", two lines usually a gap
apart and so one-sided unless Ly == Ln. Player "<name> Runs Adv" gives two player rows; match totals ("Total Match Fours (A vs B) Adv": fours, sixes, boundaries, wickets, fifties,
30s), the top score and the highest over are ``fancy`` lines, and so are a side's full-innings runs and "1st Inn Total Match Fours / Sixes <side>" (``bat_first``: the side must bat
first). Left out: odd/even, meter, khado, part-innings runs, per-batter boundaries, bowler and counting markets. The book's own rules are not read yet: the lines carry the rule
tags Feed F's fancy markets carry (an assumption: same family of exchange), and fancy markets close before the start.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import time
import urllib.error
import urllib.parse
from collections import Counter

from .. import config
from ..util import http_json, iso, parse_ts
from .base import Pace, gender_hint, row
from .feedf import RULES, abbreviates, session

NAME = "feedg"
AUTO = True  # on whenever FEEDG_NAME and FEEDG_API are set; no need to list it in CV_SOURCES
SOURCE = "feedg_f"
CRICKET = 4
HUB_CHUNK = 80

MATCH_TOTAL = re.compile(r"^Total Match (?P<what>Fours|Sixes|Boundaries|Wkts|Fifties|30s) \(.+ vs .+\) Adv$")
MATCH_KEY = {"Fours": "match_fours", "Sixes": "match_sixes", "Boundaries": "match_boundaries", "Wkts": "match_wickets", "Fifties": "match_50s", "30s": "match_30s"}
MATCH_OTHER = {"Top Batsman Runs in Match": "top_score", "Highest Scoring Over Runs in Match": "highest_over"}
TEAM_OVERS = re.compile(r"^(?P<n>\d+) Over Runs (?P<abbr>.+?) Adv$")
TEAM_FIRST = re.compile(r"^1st Inn Total Match (?P<what>Fours|Sixes) (?P<abbr>.+?) \(.+ vs .+\) Adv$")
TEAM_FIRST_KEY = {"Fours": "team_total_fours", "Sixes": "team_total_sixes"}
PLAYER_RUNS = re.compile(r"^(?P<p>[A-Z][A-Za-z.' -]*?) Runs Adv$")
NOT_A_PLAYER = re.compile(r"\b(over|overs|wkt|pship|match|fall|total|top|highest|most|inn)\b", re.I)


class Skip(Exception):
    pass


def settings() -> dict[str, str]:
    s = {k: os.environ.get(f"FEEDG_{k}", "").strip().rstrip("/") for k in ("NAME", "API")}
    return s if all(s.values()) and s["API"].startswith("http") else {}


def published() -> dict[str, str]:
    """{source key: the name it is published under}."""
    s = settings()
    return {SOURCE: f"{s['NAME']} Fancy"} if s else {}


def start_of(text) -> str | None:
    """The event list's "2026-10-29 04:40:00" (UTC) as an ISO time."""
    try:
        return iso(dt.datetime.strptime(str(text), "%Y-%m-%d %H:%M:%S").replace(tzinfo=dt.timezone.utc))
    except ValueError:
        return None


def split_event(name: str) -> tuple[str, str] | None:
    a, sep, b = str(name or "").strip(" ,").partition(" v ")
    return (a.strip(), b.strip()) if sep and a.strip() and b.strip() else None


def _ev(stub: dict, fetched_at: str) -> dict | None:
    sides = split_event(stub.get("name"))
    start = start_of(stub.get("open_date"))
    if not sides or not start:
        return None
    home, away = sides
    women = all(re.search(r"\sW$", t) for t in (home, away))  # the exchange tags a women's side "Melbourne Renegades W"
    return {"id": str(stub["event_id"]), "home": home, "away": away, "common": dict(
        source=SOURCE, source_type="bookmaker", event_id=str(stub["event_id"]), match=f"{home} vs {away}", team_a=home, team_b=away,
        gender_hint="female" if women else gender_hint(home, away), competition="", start_utc=start, in_play=False, fetched_at=fetched_at)}


def decode(rows: list[str], keys: dict[str, int]) -> dict[str, dict[str, str]]:
    """{market id: {field: value}} from the odds call's pipe-separated rows, read through the key map the catalogue call gives."""
    out = {}
    for line in rows:
        p = line.split("|")
        r = {k: p[i] for k, i in keys.items() if i < len(p)}
        if r.get("market_id"):
            out[r["market_id"]] = r
    return out


def _int(x) -> int | None:
    try:
        return int(float(x))
    except (TypeError, ValueError):
        return None


def parse_event(catalogue: list[dict], odds: dict[str, dict[str, str]], ev: dict) -> tuple[list[dict], list[dict], Counter]:
    """(player rows, fancy lines, a count of the market names left out) of one event: ``catalogue`` is its fancy market list, ``odds`` the decoded odds rows by market id."""
    rows, fancy, left = [], [], Counter()
    common = ev["common"]
    runs = [m for m in catalogue if m.get("fancy_type") == "RUN"]
    full = max((int(mm["n"]) for m in runs if (mm := TEAM_OVERS.match(m["name"].strip()))), default=0)  # the longest "N Over Runs" is the whole innings (20 or 50)
    teams = (ev["home"], ev["away"])
    for m in catalogue:
        name = re.sub(r"\s+", " ", m["name"]).strip()
        if m.get("fancy_type") != "RUN":
            left[name] += 1
            continue
        o = odds.get(m["market_id"])
        if not o or o.get("status") != "1" or o.get("suspended") == "1" or o.get("ball_running") == "1" or o.get("active_rate") != "1":
            continue  # not open: no price
        ov, un = session(_int(o.get("back_price")), _int(o.get("back_rate")), _int(o.get("lay_price")), _int(o.get("lay_rate")))
        if not (ov or un):
            continue
        gk = f"{SOURCE}:{ev['id']}:{m['market_id']}"
        key = team = None
        rules, extra = "fancy_total", {}
        if (mm := MATCH_TOTAL.match(name)):
            key = MATCH_KEY[mm["what"]]
        elif (base := re.sub(r" \(.+ vs .+\) Adv$", "", name)) in MATCH_OTHER:
            key = MATCH_OTHER[base]
        elif (mm := TEAM_OVERS.match(name)) and int(mm["n"]) == full >= 20:
            hit = [t for t in teams if abbreviates(mm["abbr"], t)]
            if len(hit) == 1:
                key, team, rules, extra = "team_total_runs", hit[0], "fancy_side", {"bat_first": True}
        elif (mm := TEAM_FIRST.match(name)):
            hit = [t for t in teams if abbreviates(mm["abbr"], t)]
            if len(hit) == 1:
                key, team, rules, extra = TEAM_FIRST_KEY[mm["what"]], hit[0], "fancy_side", {"bat_first": True}
        elif (mm := PLAYER_RUNS.match(name)) and not NOT_A_PLAYER.search(mm["p"]):
            player = mm["p"].strip()
            for side, v in (("over", ov), ("under", un)):
                if v:
                    rows.append(row(**common, market_type="batter_runs", market_raw=name, group_key=f"{gk}:{v[0]}", selection=f"{player} {side} {v[0]}", player=player,
                                    line=v[0], side=side, back=v[1]))
            continue
        if key is None:
            left[name] += 1
            continue
        f = {"match": common["match"], "home": ev["home"], "away": ev["away"], "start_utc": common["start_utc"], "key": key, "scope": "team" if team else "match", "team": team,
             "source": SOURCE, "kind": "bookmaker", "rules": RULES[rules], **extra}
        if ov and un and ov[0] == un[0]:
            fancy.append({**f, "line": ov[0], "over": ov[1], "under": un[1]})
        else:  # the two lines sit a gap apart: each side stands alone
            for v, side in ((ov, "over"), (un, "under")):
                if v:
                    fancy.append({**f, "line": v[0], "over": v[1] if side == "over" else None, "under": v[1] if side == "under" else None})
    return rows, fancy, left


STATE = config.STATE / "feedg_latest.json"
BLOCKED = (401, 403, 451)


def write_state(rows: list[dict], raw: dict, fetched_at: str, path=None) -> None:
    """What a read from an allowed network (the India runner, ``python -m value_bets.feedg_run``) found, for the hourly run to use when GitHub's own servers are refused."""
    p = path or STATE
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps({"fetched_at": fetched_at, "rows": rows, "fancy": raw["fancy"], "books": raw["books"]}, separators=(",", ":")), encoding="utf-8")


def from_state(fetched_at: str, path=None):
    """The last read from the allowed network if it is recent enough, minus matches that have started; None when there is none."""
    p = path or STATE
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    now = parse_ts(fetched_at)
    if now - parse_ts(d["fetched_at"]) > dt.timedelta(hours=config.get("FEEDG_STATE_MAX_HOURS")):
        return None
    upcoming = lambda x: x.get("start_utc") and parse_ts(x["start_utc"]) > now  # noqa: E731
    rows, fancy = [r for r in d["rows"] if upcoming(r)], [f for f in d["fancy"] if upcoming(f)]
    books = {k: {**v, "rows": len(rows), "fancy": len(fancy), "from_state": d["fetched_at"]} for k, v in d["books"].items()}
    return rows, {"books": books, "fancy": fancy}


def fetch(fetched_at: str, use_state: bool = True):
    """Read the book now; if it refuses this network (GitHub's US servers are refused with 403) use the last read from the India runner when it is fresh."""
    try:
        return _fetch(fetched_at)
    except urllib.error.HTTPError as e:
        if use_state and e.code in BLOCKED and (got := from_state(fetched_at)) is not None:
            return got
        raise


def _fetch(fetched_at: str):
    s = settings()
    if not s:
        raise Skip("FEEDG_* not set")
    gap = config.get("FEEDG_SPACING_SECS")
    pace = Pace(gap, lambda u: http_json(u, retries=0)[0])
    post = Pace(gap, lambda a: http_json(a[0], method="POST", data=a[1], headers={"Content-Type": "application/x-www-form-urlencoded"}, retries=0)[0])
    deadline = time.monotonic() + config.get("FEEDG_BUDGET_SECS")
    now = parse_ts(fetched_at)
    horizon = now + dt.timedelta(hours=config.get("FEEDG_HORIZON_HOURS"))
    info = {"events": 0, "rows": 0, "fancy": 0, "left_out": Counter()}
    rows, fancy, errors = [], [], []
    listing = pace.get(f"{s['API']}/api/guest/event_list")
    stubs = []
    for e in (listing.get("data") or {}).get("events") or []:
        st = start_of(e.get("open_date"))
        if e.get("event_type_id") == CRICKET and e.get("fancy_active") and st and now < parse_ts(st) < horizon:
            stubs.append((st, e))
    for _, stub in sorted(stubs, key=lambda x: x[0])[:config.get("FEEDG_MAX_EVENTS")]:
        if time.monotonic() > deadline:
            info["stopped"] = "time budget"
            break
        ev = _ev(stub, fetched_at)
        if not ev:
            continue
        try:
            cat = post.get((f"{s['API']}/api/guest/event/{ev['id']}", b""))["data"]
            market_list = (cat.get("event") or {}).get("fancy") or []
            hub, keys = cat.get("odds_hub"), cat.get("fancy_odds_keys") or {}
            ev["common"]["competition"] = ""
            if not market_list or not hub or not keys:
                continue
            ids = [m["market_id"] for m in market_list if m.get("fancy_type") == "RUN"]
            odds: dict[str, dict[str, str]] = {}
            for i in range(0, len(ids), HUB_CHUNK):
                body = "&".join("market_ids[]=" + urllib.parse.quote(x) for x in ids[i:i + HUB_CHUNK])
                odds.update(decode(post.get((f"https://{hub}/ws/getMarketDataNew", body.encode())), keys))
        except urllib.error.HTTPError as e:
            info["stopped"] = f"HTTP {e.code}"  # leave the book alone until the next run
            break
        except Exception as e:  # noqa: BLE001
            errors.append(e)
            info["stopped"] = type(e).__name__
            break
        r, fx, left = parse_event(market_list, odds, ev)
        rows += r
        fancy += fx
        info["events"] += 1
        info["left_out"].update(left)
    info["rows"], info["fancy"] = len(rows), len(fancy)
    if not rows and not fancy and errors:
        raise errors[-1]
    return rows, {"books": {s["NAME"]: {**info, "left_out": dict(info["left_out"])}}, "fancy": fancy}
