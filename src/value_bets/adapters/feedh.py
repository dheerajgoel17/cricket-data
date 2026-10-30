"""Feed H: player and match prices from a public, login-free sportsbook (one host, guest JSON).

The book and its host are deployment configuration, never code (docs/OPERATIONS.md): ``FEEDH_URL`` is the sportsbook root and
``FEEDH_NAME`` is the name its prices are published under. Unset, the source is skipped. It never runs on a laptop: ``fetch`` raises
``Skip`` unless ``GITHUB_ACTIONS`` is set (tests use ``*.invalid`` hosts only). On GitHub it always goes through the Cloudflare Worker relay
(``FEEDH_RELAY`` or Feed G's pair); there is no direct call, so a home IP is never on the book's logs. Polite: one sport listing, then every
in-horizon game and competition page (internationals first), ``FEEDH_SPACING_SECS`` apart, one attempt each; a 429 ends the run and
``FEEDH_BUDGET_SECS`` stops new pages.

Rows are the player markets the other books already map: "Batsman Runs / Sixes / Fours - Last, First" and "Bowler Wickets - Last, First"
over/unders, "Player Performance - Last, First" (fantasy points: 1 per run, 20 per wicket, 10 per catch, 25 per stumping; the book's
own scoring is not in the payload), "To score N - Last, First" yes/nos, and Top Batsman / Top Bowler (match and per side). Match
totals of runs / fours / sixes and a side's total runs / fours / sixes come back as ``fancy`` lines. A Test's unscoped player line is
not the match total the pipeline prices and is left out of rows (it still goes in the catalogue). Head-to-head is never a row.

Every open market of a fetched match is also returned as a compact ``catalogue`` row (name, player, line, both decimal prices, which
existing mapping it used if any) so the archive can keep a historical record of odds, markets and lines the site does not yet chart.
"""
from __future__ import annotations

import datetime as dt
import os
import re
import time
import urllib.error
import urllib.parse
from collections import Counter

from cricket_data.hosts import host

from .. import config
from ..util import decimal_ok, http_json, iso, parse_ts
from .base import Pace, gender_hint, row
from .feedf import person

NAME = "feedh"
AUTO = True  # on whenever FEEDH_URL and FEEDH_NAME are set; no need to list it in CV_SOURCES
SOURCE = "feedh_d"
CRIC = 215
SKIP_PATH = re.compile(r"virtual|simulated|electronic|\bsrl\b|long term|futures", re.I)
INTL_PATH = re.compile(r"\binternational\b|\bworld cup\b|\basia cup\b|\btri[- ]?series\b|\btests?\b series|\bodi series\b|\bt20 series\b", re.I)
MULTI_DAY = re.compile(r"\btests?\b|ashes|shield|first.class|championship|ranji", re.I)
TEST = re.compile(r"\btests?\b|ashes", re.I)
WOMEN = re.compile(r"women|wbbl|\(w\)", re.I)
VS = re.compile(r"\s+vs\.?\s+", re.I)
INNINGS = re.compile(r"\b(1st|2nd|first|second)\s+innings?\b", re.I)
COMBO = re.compile(r"\band\b|\+", re.I)

BATSMAN_RUNS = re.compile(r"^Batsman Runs - (?P<p>.+)$", re.I)
BATSMAN_SIXES = re.compile(r"^Batsman Sixes - (?P<p>.+)$", re.I)
BATSMAN_FOURS = re.compile(r"^Batsman Fours - (?P<p>.+)$", re.I)
BOWLER_WICKETS = re.compile(r"^Bowler Wickets - (?P<p>.+)$", re.I)
PERFORMANCE = re.compile(r"^Player Performance - (?P<p>.+)$", re.I)
PLAYER_OU = ((BATSMAN_RUNS, "batter_runs"), (BATSMAN_SIXES, "batter_sixes"), (BATSMAN_FOURS, "batter_fours"),
             (BOWLER_WICKETS, "bowler_wickets"), (PERFORMANCE, "player_points"))
TO_SCORE = re.compile(r"^To score (?P<n>\d+) - (?P<p>.+)$", re.I)
TOP_TEAM = re.compile(r"^Top (?P<who>Batsman|Bowler) - (?P<team>.+)$", re.I)
TOP_MATCH = re.compile(r"^Top (?P<who>Batsman|Bowler)$", re.I)
TEAM_TOTAL = re.compile(r"^Total Spreads - (?P<team>.+)$", re.I)
TEAM_FOURS = re.compile(r"^Total fours\s*- (?P<team>.+)$", re.I)
TEAM_SIXES = re.compile(r"^Total sixes\s*- (?P<team>.+)$", re.I)
MATCH_FOURS = re.compile(r"^Total fours\s*$", re.I)
MATCH_SIXES = re.compile(r"^Total sixes\s*$", re.I)
TOP_SCORE = re.compile(r"^Top batter total$", re.I)
MATCH_RUNS = re.compile(r"^Match Total Runs$", re.I)
OU = re.compile(r"^(Over|Under)\s+(\d+(?:\.\d+)?)$", re.I)
TOP_MT = {"Batsman": ("top_batter_team", "top_batter_match"), "Bowler": ("top_bowler_team", "top_bowler_match")}

PREMATCH = {
    "allBettableEvents": "true", "bettable": "true", "includeHiddenOutcomes": "true", "lightWeightResponse": "true",
    "marketFilter": "GAME", "marketStatus": "OPEN", "sportGroups": "REGULAR", "periodType": "PRE_MATCH",
    "includeHiddenMarkets": "false", "eventType": "GAME",
}


class Skip(Exception):
    pass


def settings() -> dict[str, str]:
    """The deployment's FEEDH_URL and FEEDH_NAME; empty if the source is not configured."""
    url, name = os.environ.get("FEEDH_URL", "").strip().rstrip("/"), os.environ.get("FEEDH_NAME", "").strip()
    return {"URL": url, "NAME": name} if url.startswith("http") and name else {}


def published() -> dict[str, str]:
    """{source key: the name it is published under}: ``booklines.public`` swaps the first for the second."""
    s = settings()
    return {SOURCE: s["NAME"]} if s else {}


def relay() -> tuple[str, str] | None:
    """(relay address, key) from FEEDH_RELAY and FEEDH_RELAY_KEY, else Feed G's relay when both of those are set."""
    addr = os.environ.get("FEEDH_RELAY", "").strip() or os.environ.get("FEEDG_RELAY", "").strip()
    key = os.environ.get("FEEDH_RELAY_KEY", "").strip() or os.environ.get("FEEDG_RELAY_KEY", "").strip()
    return (addr, key) if addr.startswith("https://") and key else None


def lab(url: str) -> bool:
    """Placeholder hosts used only in tests (never a real book)."""
    h = urllib.parse.urlparse(url).hostname or ""
    return h.endswith(".invalid") or h in ("localhost", "127.0.0.1")


def on_runner() -> bool:
    """True only in GitHub Actions. A laptop must never call the book, even through the relay (the relay would still see that IP)."""
    return os.environ.get("GITHUB_ACTIONS") == "true"


def _http_body(err: urllib.error.HTTPError) -> str:
    """The Worker/book body on a 4xx (``host not allowed``, ``forbidden``), else empty. ``HTTPError.read`` is one-shot."""
    try:
        raw = err.read() if err.fp is not None else b""
        return raw.decode("utf-8", "replace").strip()[:80]
    except Exception:
        return ""


def request(url: str):
    """One GET through the Mumbai relay. Direct only for test hosts. A laptop never reaches a real book."""
    if not on_runner() and not lab(url):
        raise Skip("Feed H does not run on a local machine")
    rl = relay()
    if rl is None:
        if lab(url):
            return http_json(url, retries=0)[0]
        raise Skip("FEEDH_RELAY not set (never call the book directly)")
    try:
        return http_json(f"{rl[0]}?u={urllib.parse.quote(url, safe='')}", headers={"x-relay-key": rl[1]}, retries=0)[0]
    except urllib.error.HTTPError as e:
        raise urllib.error.HTTPError(e.url, e.code, _http_body(e) or e.reason, e.hdrs, None) from e


def flip(name: str) -> str:
    """"Last, First" as the history stores it ("First Last"); a name with no comma is left alone."""
    last, comma, first = (name or "").partition(", ")
    return person(last, first) if comma else (name or "").strip()


def _price(o: dict) -> float | None:
    if o.get("hidden") or o.get("withdrawn"):
        return None
    try:
        p = float(((o.get("consolidatedPrice") or {}).get("currentPrice") or {}).get("decimal"))
    except (TypeError, ValueError):
        return None
    return decimal_ok(p)


def _ou(market: dict) -> tuple[float, dict[str, float]] | None:
    """-> (line, {"over": price, "under": price}) of a two-sided over/under, else None."""
    line, sides = None, {}
    for o in market.get("outcomes") or []:
        m = OU.match((o.get("description") or "").strip())
        p = _price(o)
        if not m or p is None:
            return None
        ln = float(m.group(2))
        if line is not None and ln != line:
            return None
        line, sides[m.group(1).lower()] = ln, p
    return (line, sides) if line is not None and len(sides) == 2 else None


def _named(market: dict) -> list[tuple[str, float]]:
    """[(outcome name, decimal price)] of open named runners (top batter/bowler)."""
    out = []
    for o in market.get("outcomes") or []:
        n, p = (o.get("description") or "").strip(), _price(o)
        if n and p is not None and not OU.match(n):
            out.append((n, p))
    return out


def _fmt(competition: str, home: str, away: str) -> str | None:
    t = f"{competition} {home} {away}".lower()
    if re.search(r"\bt10\b", t) or ("10 over" in t and "t20" not in t):
        return "T10"
    if "the hundred" in t or "100 balls" in t or "100-ball" in t:
        return "Hundred"
    if TEST.search(t):
        return "Test"
    if "t20" in t or "twenty20" in t:
        return "T20"
    if "odi" in t or "one day" in t or "one-day" in t or "50 over" in t or "list a" in t:
        return "ODI"
    return None


def _qs(**extra) -> str:
    d = {**PREMATCH, **extra}
    return urllib.parse.urlencode({k: ("true" if v is True else "false" if v is False else v) for k, v in d.items()})


def _cat(common: dict, name: str, player, team, line, over, under, mapped) -> dict:
    return {"match": common["match"], "home": common["team_a"], "away": common["team_b"], "start_utc": common["start_utc"],
            "competition": common["competition"], "fmt": common.get("fmt"), "source": common["source"], "kind": "bookmaker",
            "name": name, "player": player, "team": team, "line": line, "over": over, "under": under, "mapped": mapped}


def parse_event(ev: dict, src: str, fetched_at: str) -> tuple[list[dict], list[dict], list[dict], Counter]:
    """(player rows, fancy lines, catalogue rows, names left out of rows) of one pre-match cricket event."""
    if (ev.get("sportCode") or "") != "CRIC":
        return [], [], [], Counter()
    home = next((o.get("name") for o in (ev.get("opponents") or [])[:1]), None)
    away = next((o.get("name") for o in (ev.get("opponents") or [])[1:2]), None)
    if not home or not away:
        parts = VS.split(ev.get("description") or "", maxsplit=1)
        home, away = (parts[0].strip(), parts[1].strip()) if len(parts) == 2 else (None, None)
    if not home or not away:
        return [], [], [], Counter()
    paths = " / ".join(p.get("name") or "" for p in (ev.get("eventPaths") or []))
    competition = next((p.get("name") for p in reversed(ev.get("eventPaths") or []) if p.get("name")), None) or paths
    if SKIP_PATH.search(f"{paths} {ev.get('description') or ''}"):
        return [], [], [], Counter()
    start = iso(parse_ts(ev.get("eventDate")))
    female = "female" if WOMEN.search(f"{paths} {home} {away}") else gender_hint(home, away)
    multi = bool(MULTI_DAY.search(paths + " " + (competition or "")))
    fmt = _fmt(competition or "", home, away)
    common = dict(source=src, source_type="bookmaker", event_id=str(ev.get("id")), match=f"{home} vs {away}", team_a=home, team_b=away,
                  gender_hint=female, competition=competition, start_utc=start, in_play=False, fetched_at=fetched_at, fmt=fmt)
    rows, fancy, catalogue, left = [], [], [], Counter()

    def add_ou(name, player, team, mapped, mt=None, fancy_key=None, scope="match", inn=None, ms_scope=None):
        got = _ou(m)
        if not got:
            left[name] += 1
            catalogue.append(_cat(common, name, player, team, None, None, None, None))
            return
        line, px = got
        ov, un = round(px["over"], 3), round(px["under"], 3)
        catalogue.append(_cat(common, name, player, team, line, ov, un, mapped))
        if mapped is None:
            return
        if fancy_key:
            fancy.append({"match": common["match"], "home": home, "away": away, "start_utc": start, "fmt": fmt, "competition": competition,
                          "key": fancy_key, "scope": scope, "team": team, "line": line, "over": ov, "under": un, "source": src, "kind": "bookmaker",
                          **({"inn": inn} if inn else {})})
            return
        gk = f"{src}:{ev.get('id')}:{m.get('id')}"
        for side, price in (("over", ov), ("under", un)):
            rows.append(row(**{k: v for k, v in common.items() if k != "fmt"}, market_type=mt, market_raw=name, group_key=gk,
                            selection=f"{player} {side} {line}" if player else name, player=player, team=team, line=line, side=side,
                            back=price, inn=inn, ms_scope=ms_scope))

    for m in ev.get("markets") or []:
        name = (m.get("description") or "").strip()
        if not name or (m.get("status") or "open").lower() != "open":
            if name:
                left[name] += 1
            continue
        player_ou = False
        for rx, mt in PLAYER_OU:
            mm = rx.match(name)
            if mm and not COMBO.search(mm["p"]):
                if multi and not INNINGS.search(name):
                    add_ou(name, flip(mm["p"]), None, None)  # a Test's unscoped line is not the match total
                else:
                    add_ou(name, flip(mm["p"]), None, mt, mt=mt)
                player_ou = True
                break
        if player_ou:
            continue
        if (mm := TO_SCORE.match(name)) and not COMBO.search(mm["p"]):
            player, line = flip(mm["p"]), int(mm["n"]) - 0.5
            add_ou(name, player, None, "batter_milestone", mt="batter_milestone", ms_scope="match")
            for r in rows[-2:]:
                if r.get("market_type") == "batter_milestone" and r.get("player") == player:
                    r["line"], r["ms_scope"] = line, "match"
                    r["selection"] = f"{player} {int(line + 0.5)}+ {'yes' if r['side'] == 'over' else 'no'}"
            continue
        if MATCH_RUNS.match(name):
            add_ou(name, None, None, "match_runs", fancy_key="match_runs")
            continue
        if (mm := TEAM_TOTAL.match(name)):
            add_ou(name, None, mm["team"], "team_total_runs", fancy_key="team_total_runs", scope="team")
            continue
        if MATCH_FOURS.match(name):
            add_ou(name, None, None, "match_fours", fancy_key="match_fours")
            continue
        if MATCH_SIXES.match(name):
            add_ou(name, None, None, "match_sixes", fancy_key="match_sixes")
            continue
        if (mm := TEAM_FOURS.match(name)):
            add_ou(name, None, mm["team"], "team_total_fours", fancy_key="team_total_fours", scope="team")
            continue
        if (mm := TEAM_SIXES.match(name)):
            add_ou(name, None, mm["team"], "team_total_sixes", fancy_key="team_total_sixes", scope="team")
            continue
        if TOP_SCORE.match(name):
            add_ou(name, None, None, "top_score", fancy_key="top_score")
            continue
        if (mm := TOP_TEAM.match(name)):
            mt = TOP_MT[mm["who"].title()][0]
            named, gk = _named(m), f"{src}:{ev.get('id')}:{m.get('id')}"
            if not named:
                left[name] += 1
                continue
            for n, p in named:
                player = flip(n)
                catalogue.append(_cat(common, name, player, mm["team"], None, round(p, 3), None, mt))
                rows.append(row(**{k: v for k, v in common.items() if k != "fmt"}, market_type=mt, market_raw=name, group_key=gk,
                                selection=player, player=player, team=mm["team"], back=round(p, 3)))
            continue
        if (mm := TOP_MATCH.match(name)):
            mt = TOP_MT[mm["who"].title()][1]
            named, gk = _named(m), f"{src}:{ev.get('id')}:{m.get('id')}"
            if not named:
                left[name] += 1
                continue
            for n, p in named:
                player = flip(n)
                catalogue.append(_cat(common, name, player, None, None, round(p, 3), None, mt))
                rows.append(row(**{k: v for k, v in common.items() if k != "fmt"}, market_type=mt, market_raw=name, group_key=gk,
                                selection=player, player=player, back=round(p, 3)))
            continue
        got = _ou(m)
        if got:
            line, px = got
            catalogue.append(_cat(common, name, None, None, line, round(px["over"], 3), round(px["under"], 3), None))
        else:
            named = _named(m)
            if named:
                for n, p in named:
                    catalogue.append(_cat(common, name, flip(n) if "," in n else n, None, None, round(p, 3), None, None))
            else:
                left[name] += 1
                catalogue.append(_cat(common, name, None, None, None, None, None, None))
    return rows, fancy, catalogue, left


def _walk(nodes):
    """Listing items, flattening nested ``events`` so a competition node is not treated as a match."""
    for ev in nodes or []:
        if not isinstance(ev, dict):
            continue
        kids = ev.get("events")
        if isinstance(kids, list) and kids:
            yield from _walk(kids)
        else:
            yield ev


def _path_id(ev) -> int | str | None:
    """The deepest competition id on a game, else the node id when this listing row is a path (no opponents). Never the sport id."""
    ids = [p.get("id") for p in (ev.get("eventPaths") or []) if isinstance(p, dict) and p.get("id") and p.get("id") != CRIC]
    if ids:
        return ids[-1]
    if ev.get("opponents") or (ev.get("eventType") or "").upper() == "GAME":
        return None
    eid = ev.get("id")
    return eid if eid and eid != CRIC else None


def _path_rank(ev) -> int:
    """0 = international / series (fetch first), 1 = everything else. Club trees must not starve Pak vs SL."""
    blob = " ".join(p.get("name") or "" for p in (ev.get("eventPaths") or []))
    blob += " " + (ev.get("description") or ev.get("name") or "")
    return 0 if INTL_PATH.search(blob) else 1


def fetch(fetched_at: str):
    s = settings()
    if not s:
        raise Skip("FEEDH_URL / FEEDH_NAME not set")
    if not on_runner() and not lab(s["URL"]):
        raise Skip("Feed H does not run on a local machine")
    if not relay() and not lab(s["URL"]):
        raise Skip("FEEDH_RELAY not set (never call the book directly)")
    base = host("FEEDH_URL")
    pace = Pace(config.get("FEEDH_SPACING_SECS"), lambda u: request(u))
    deadline = time.monotonic() + config.get("FEEDH_BUDGET_SECS")
    now, horizon = parse_ts(fetched_at), parse_ts(fetched_at) + dt.timedelta(hours=config.get("FEEDH_HORIZON_HOURS"))
    info: dict = {"events": 0, "rows": 0, "fancy": 0, "catalogue": 0, "left_out": Counter()}
    rows: list[dict] = []
    fancy: list[dict] = []
    catalogue: list[dict] = []
    listing = pace.get(f"{base}/xapi/rest/events?" + _qs(eventPathIds=str(CRIC), includeMarkets="false", maxMarketPerEvent=0))
    if not isinstance(listing, list):
        raise Skip("events listing was not a list")
    path_rank, games, seen = {}, [], set()
    for ev in _walk(listing):
        if (ev.get("sportCode") or "") not in ("", "CRIC"):
            continue
        if SKIP_PATH.search(" ".join(p.get("name") or "" for p in (ev.get("eventPaths") or []))):
            continue
        pid = _path_id(ev)
        if pid:
            path_rank[pid] = min(path_rank.get(pid, 9), _path_rank(ev))
            continue
        st = parse_ts(ev.get("eventDate"))
        if not st or st <= now or st > horizon:
            continue
        eid = ev.get("id")
        if eid and eid != CRIC and eid not in seen:
            seen.add(eid)
            games.append(eid)
    paths = [pid for pid, _ in sorted(path_rank.items(), key=lambda kv: (kv[1], str(kv[0])))]
    info["listed"] = len(paths) + len(games)
    cap = config.get("FEEDH_MAX_EVENTS")
    targets = [("event", x) for x in games] + [("path", x) for x in paths]
    if cap > 0:
        targets = targets[:cap]

    def pull(kind, eid):
        extra = {"includeMarkets": "true", ("eventPathIds" if kind == "path" else "eventIds"): str(eid)}
        return pace.get(f"{base}/xapi/rest/events?" + _qs(**extra))

    parsed = set()
    for kind, eid in targets:
        if time.monotonic() > deadline:
            info["stopped"] = "time budget"
            break
        try:
            got = pull(kind, eid)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                info["stopped"] = "HTTP 429"
                break
            if kind == "event" and e.code == 400:
                try:
                    got = pull("path", eid)
                except urllib.error.HTTPError as e2:
                    info["stopped"] = f"HTTP {e2.code}"
                    if e2.code == 429:
                        break
                    continue
            else:
                info["stopped"] = f"HTTP {e.code}"
                continue
        items = got if isinstance(got, list) else []
        for full in items:
            fid = full.get("id")
            if fid and fid in parsed:
                continue
            st = parse_ts(full.get("eventDate"))
            if st and (st <= now or st > horizon):
                continue
            r, fx, cat, left = parse_event(full, SOURCE, fetched_at)
            if not r and not fx and not cat:
                continue
            if fid:
                parsed.add(fid)
            rows += r
            fancy += fx
            catalogue += cat
            info["events"] += 1
            info["rows"] += len(r)
            info["fancy"] += len(fx)
            info["catalogue"] += len(cat)
            info["left_out"].update(left)
    return rows, {"books": {s["NAME"]: {**info, "left_out": dict(info["left_out"])}}, "fancy": fancy, "catalogue": catalogue}


if __name__ == "__main__":
    from ..util import now_utc

    stamp = iso(now_utc())
    try:
        rows, raw = fetch(stamp)
    except Skip as e:
        print(f"feedh skipped: {e}")
        raise SystemExit(1) from None
    except urllib.error.HTTPError as e:
        print(f"feedh HTTP {e.code}: {e.reason}")
        raise SystemExit(1) from None
    book = next(iter((raw.get("books") or {}).values()), {})
    print(
        "feedh ok"
        f" listed={book.get('listed')}"
        f" events={book.get('events')}"
        f" rows={len(rows)}"
        f" fancy={book.get('fancy')}"
        f" catalogue={book.get('catalogue')}"
        f" stopped={book.get('stopped')}"
    )
