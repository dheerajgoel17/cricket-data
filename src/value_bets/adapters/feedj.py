"""Feed J: player and match prices from a Betby-style sportsbook's public feed (no login, no token).

The book, its feed host and its account are deployment configuration, never code (docs/OPERATIONS.md): ``FEEDJ_API`` is the
feed root (ending in ``/api``), ``FEEDJ_BRAND`` the account id in its paths, ``FEEDJ_ORIGIN`` the sportsbook page origin the feed
expects in ``Origin`` / ``Referer`` and ``FEEDJ_NAME`` the name its prices are published under. Unset, the source is skipped.
The feed's own page (a guest "demo" session) only fetches these same public files, so nothing here needs a login.

Reading: ``v4/prematch/brand/B/LANG/0`` is a manifest of version numbers; each version file lists events (teams, start,
tournament). ``v4/prematch/brand/B/event/LANG/E`` is one event with every market, ``v3/descriptions/brand/B/event/E/LANG`` names
its players. Bodies are gzip whatever the request says. Polite: ``FEEDJ_SPACING_SECS`` between calls, ``FEEDJ_BUDGET_SECS`` /
``FEEDJ_MAX_EVENTS`` caps, one attempt each, HTTP 429 ends the run.

A market is ``{market id: {specifier string: {outcome id: {"k": price}}}}``; the specifier is ``key=value|key=value`` (``player``,
``total``, ``milestone``, ``overnr``, ``inningnr``). Outcome ids are fixed by the feed's market descriptions, so over / under is
never a guess: **12 = over, 13 = under** (both are named "over {total}" / "under {total}" in the descriptions) and **74 = yes,
76 = no**. Checked 2026-11-17 against two other books on the same match: the player fours / sixes lines carry the same prices on
the same side as the other book (a ladder's over price also falls as the line drops), so no order swap exists here.

Mapped (market ids probed 2026-11-17 on an ODI): player total runs / fours / sixes, to-score-N milestones, highest individual
score, total dismissals, total run outs, total extras and a side's first-N-overs runs (competitor 1 is the first team listed;
innings 1, so ``bat_first``). Everything else (per-delivery and per-over markets, odd/even, top batter of a team, the "Total
runs" ladder, whose lines do not match any other book's match total) is read into the catalogue and never becomes a row.
Multi-day matches are skipped (this feed has no whole-match player totals).
"""
from __future__ import annotations

import datetime as dt
import gzip
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter

from .. import config
from ..util import decimal_ok, iso, parse_ts
from .base import Pace, gender_hint, multi_day, row
from .feedi import SKIP_COMP, WOMEN, _fmt

NAME = "feedj"
AUTO = True
SOURCE = "feedj_d"
CRICKET = "21"
LANG = "en-IN"
OVER, UNDER, YES, NO = "12", "13", "74", "76"

PLAYER_OU = {"13700": "batter_runs", "13710": "batter_fours", "13711": "batter_sixes"}
MILESTONE = "662"
# match-level two-way totals -> fancy key (lines checked against another book's same line on 2026-11-17)
MATCH_FANCY = {"13613": "top_score", "697": "match_wickets", "654": "match_runouts", "655": "match_extras", "50110": "match_runs"}
# "innings over N - competitor total" (runs in over N; over 1 is the site's overs_1, the same market another book calls "total runs for over 1 in 1st innings - team")
SIDE_OVER = {"356": 0, "357": 1}
# top batter / top bowler of one side: the outcomes are player ids, the market names the side
TOP_SIDE = {"13701": ("top_batter_team", 0), "13702": ("top_batter_team", 1), "13703": ("top_bowler_team", 0), "13704": ("top_bowler_team", 1)}
SIDE_OVERS = {"352": 0, "353": 1}  # "innings overs 0 to N - competitor 1 / 2 total"


class Skip(Exception):
    pass


def settings() -> dict[str, str]:
    s = {k: os.environ.get(f"FEEDJ_{k}", "").strip().rstrip("/") for k in ("API", "BRAND", "ORIGIN", "NAME")}
    return s if all(s.values()) and s["API"].startswith("http") and s["ORIGIN"].startswith("http") else {}


def published() -> dict[str, str]:
    s = settings()
    return {SOURCE: s["NAME"]} if s else {}


def relay() -> tuple[str, str] | None:
    """(relay address, key): FEEDJ_RELAY / FEEDJ_RELAY_KEY, else Feed H's or Feed G's pair. GitHub's US servers get "access blocked" from the feed; the Mumbai Worker hop does not."""
    for p in ("FEEDJ", "FEEDH", "FEEDG"):
        addr, key = os.environ.get(f"{p}_RELAY", "").strip(), os.environ.get(f"{p}_RELAY_KEY", "").strip()
        if addr.startswith("https://") and key:
            return addr, key
    return None


def request(url: str, origin: str):
    """GET JSON (gzip or not). The feed answers 403 unless the sportsbook page's Origin / Referer is sent. On GitHub it goes through the relay when one is set."""
    ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"
    headers = {"User-Agent": ua, "Accept": "application/json, text/plain, */*", "Origin": origin, "Referer": origin + "/"}
    rl = relay() if os.environ.get("GITHUB_ACTIONS") == "true" else None
    if rl:
        headers = {**headers, "x-relay-key": rl[1], "x-relay-origin": origin, "x-relay-referer": origin + "/"}
        url = f"{rl[0]}?u={urllib.parse.quote(url, safe='')}"
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=config.get("HTTP_TIMEOUT")) as r:
        body = r.read()
    if body[:2] == b"\x1f\x8b":
        body = gzip.decompress(body)
    return json.loads(body)


def spec(s: str) -> dict[str, str]:
    return dict(p.split("=", 1) for p in (s or "").split("|") if "=" in p)


def _price(o) -> float | None:
    try:
        return decimal_ok(float((o or {})["k"]))
    except (KeyError, TypeError, ValueError):
        return None


def _num(x) -> float | None:
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def ev_common(eid: str, ev: dict, tournaments: dict, src: str, fetched_at: str) -> dict | None:
    d = ev.get("desc") or {}
    comps = d.get("competitors") or []
    if d.get("sport") != CRICKET or d.get("type") != "match" or len(comps) != 2 or not d.get("scheduled"):
        return None
    home, away = (str(c.get("name") or "").strip() for c in comps)
    comp = str((tournaments.get(d.get("tournament")) or {}).get("name") or "")
    if not home or not away or SKIP_COMP.search(f"{comp} {home} {away}"):
        return None
    return dict(
        source=src, source_type="bookmaker", event_id=eid, match=f"{home} vs {away}", team_a=home, team_b=away,
        gender_hint="female" if WOMEN.search(f"{comp} {home} {away}") else gender_hint(home, away),
        competition=comp or None, start_utc=iso(dt.datetime.fromtimestamp(int(d["scheduled"]), tz=dt.timezone.utc)),
        in_play=False, fetched_at=fetched_at, fmt=_fmt(comp, home, away),
    )


def _cat(common: dict, name: str, player, team, line, over, under, mapped) -> dict:
    return {
        "match": common["match"], "home": common["team_a"], "away": common["team_b"], "start_utc": common["start_utc"],
        "competition": common["competition"], "fmt": common.get("fmt"), "source": common["source"], "kind": "bookmaker",
        "name": name, "player": player, "team": team, "line": line, "over": over, "under": under, "mapped": mapped,
    }


def _fancy(common: dict, key: str, team: str | None, line: float, over, under, **extra) -> dict:
    f = {"match": common["match"], "home": common["team_a"], "away": common["team_b"], "start_utc": common["start_utc"], "key": key,
         "scope": "team" if team else "match", "team": team, "line": line, "over": over, "under": under,
         "source": common["source"], "kind": "bookmaker"}
    f.update(extra)
    return f


def parse_event(markets: dict, players: dict[str, str], common: dict, side_of: dict[str, int] | None = None) -> tuple[list[dict], list[dict], list[dict], Counter]:
    """(player rows, fancy lines, catalogue, left_out) of one event's markets; ``players`` maps a player id to his name and ``side_of`` to 0 / 1, the side (first or
    second team listed) he plays for: a top-batter / top-bowler market is read only when every one of its players is on the side the market names."""
    rows, fancy, cat, left = [], [], [], Counter()
    src, eid = common["source"], common["event_id"]
    multi = multi_day(common.get("competition"))
    base = {k: v for k, v in common.items() if k != "fmt"}
    teams = (common["team_a"], common["team_b"])

    def player_rows(mt, player, line, over, under, raw, *, milestone=None):
        gk = f"{src}:{eid}:{mt}:{player}:{line}"
        for side, price in (("over", over), ("under", under)):
            sel = (f"{player} {milestone}+ {'yes' if side == 'over' else 'no'}" if milestone else f"{player} {side} {line}")
            rows.append(row(**base, market_type=mt, market_raw=raw, group_key=gk, selection=sel, player=player, line=line, side=side,
                            back=price, **({"ms_scope": "match"} if milestone else {})))

    for mid, by_spec in (markets or {}).items():
        if mid in TOP_SIDE:
            mt, i = TOP_SIDE[mid]
            named = [(players.get(pid), _price(o), pid) for pid, o in ((by_spec or {}).get("") or {}).items()]
            if not named or any(n is None or p is None or (side_of or {}).get(pid) != i for n, p, pid in named) or len(named) < 3:
                left[f"M{mid}"] += 1
                continue
            gk = f"{src}:{eid}:{mt}:{teams[i]}"
            for n, p, _pid in named:
                cat.append(_cat(common, f"M{mid} {mt}", n, teams[i], None, p, None, mt))
                if not multi:
                    rows.append(row(**base, market_type=mt, market_raw=f"M{mid} {mt}", group_key=gk, selection=n, player=n, team=teams[i], back=p))
            continue
        for sp, outs in (by_spec or {}).items():
            s = spec(sp)
            inn = s.get("inningnr")
            line = _num(s.get("total"))
            ov, un = _price(outs.get(OVER)), _price(outs.get(UNDER))
            pid = s.get("player")
            name = players.get(pid) if pid else None
            if mid in PLAYER_OU:
                mt = PLAYER_OU[mid]
                if not name or line is None or ov is None or un is None or inn not in (None, "1"):
                    left[f"M{mid}"] += 1
                    continue
                cat.append(_cat(common, f"M{mid} {mt}", name, None, line, ov, un, mt))
                if not multi:
                    player_rows(mt, name, line, ov, un, f"M{mid} {mt}")
            elif mid == MILESTONE:
                n = _num(s.get("milestone"))
                yes, no = _price(outs.get(YES)), _price(outs.get(NO))
                if not name or n is None or yes is None or no is None or inn not in (None, "1"):
                    left[f"M{mid}"] += 1
                    continue
                cat.append(_cat(common, f"M{mid} to score {int(n)}", name, None, n - 0.5, yes, no, "batter_milestone"))
                if not multi:
                    player_rows("batter_milestone", name, n - 0.5, yes, no, f"To score {int(n)} - {name}", milestone=int(n))
            elif mid in MATCH_FANCY and not multi and line is not None and ov is not None and un is not None:
                key = MATCH_FANCY[mid]
                cat.append(_cat(common, f"M{mid} {key}", None, None, line, ov, un, key))
                fancy.append(_fancy(common, key, None, line, ov, un))
            elif (mid in SIDE_OVERS or (mid in SIDE_OVER and _num(s.get("overnr")) == 1)) and not multi and inn == "1" and line is not None \
                    and ov is not None and un is not None and _num(s.get("overnr")) in range(1, 51):
                n, team = int(_num(s["overnr"])), teams[SIDE_OVERS.get(mid, SIDE_OVER.get(mid))]
                cat.append(_cat(common, f"M{mid} overs 0-{n}", None, team, line, ov, un, f"overs_{n}"))
                fancy.append(_fancy(common, f"overs_{n}", team, line, ov, un, bat_first=True))
            elif line is not None and ov is not None and un is not None:
                cat.append(_cat(common, f"M{mid} {sp}", name, None, line, ov, un, None))
                left[f"M{mid}"] += 1
            else:
                left[f"M{mid}"] += 1
    return rows, fancy, cat, left


def get(pace: Pace, url: str, tries: int = 2):
    """One call, tried again once on a 5xx: through the relay one request in a few meets a blocked egress address (HTTP 503 "access blocked") and the next one does not."""
    for i in range(tries):
        try:
            return pace.get(url)
        except urllib.error.HTTPError as e:
            if e.code < 500 or i == tries - 1:
                raise


def list_events(api: str, brand: str, pace: Pace) -> tuple[dict[str, dict], dict]:
    """({event id: event stub}, tournaments) from the manifest and its version files."""
    man = get(pace, f"{api}/v4/prematch/brand/{brand}/{LANG}/0")
    events, tournaments = {}, {}
    for v in list(man.get("top_events_versions") or []) + list(man.get("rest_events_versions") or []):
        try:
            part = get(pace, f"{api}/v4/prematch/brand/{brand}/{LANG}/{v}")
        except urllib.error.HTTPError as e:
            if e.code == 429:
                raise
            continue  # a version file that stays blocked loses only its events; the others still list
        tournaments.update(part.get("tournaments") or {})
        for eid, ev in (part.get("events") or {}).items():
            if (ev.get("desc") or {}).get("sport") == CRICKET:
                events[eid] = ev
    return events, tournaments


def fetch(fetched_at: str):
    s = settings()
    if not s:
        raise Skip("FEEDJ_API / FEEDJ_BRAND / FEEDJ_ORIGIN / FEEDJ_NAME not set")
    api, brand, origin = s["API"], s["BRAND"], s["ORIGIN"]
    pace = Pace(config.get("FEEDJ_SPACING_SECS"), lambda u: request(u, origin))
    deadline = time.monotonic() + config.get("FEEDJ_BUDGET_SECS")
    now = parse_ts(fetched_at)
    horizon = now + dt.timedelta(hours=config.get("FEEDJ_HORIZON_HOURS"))
    info: dict = {"events": 0, "rows": 0, "fancy": 0, "catalogue": 0, "left_out": Counter()}
    rows: list[dict] = []
    fancy_rows: list[dict] = []
    catalogue: list[dict] = []
    try:
        listed, tournaments = list_events(api, brand, pace)
    except urllib.error.HTTPError as e:
        raise Skip(f"Feed J listing HTTP {e.code}") from e
    info["listed"] = len(listed)
    upcoming = []
    for eid, ev in listed.items():
        c = ev_common(eid, ev, tournaments, SOURCE, fetched_at)
        st = parse_ts(c["start_utc"]) if c else None
        if c and st and now < st <= horizon and not multi_day(c.get("competition")):
            upcoming.append((st, eid, ev))
    upcoming.sort(key=lambda x: (not (x[2].get("desc") or {}).get("player_props"), x[0]))  # player-props matches first
    cap = config.get("FEEDJ_MAX_EVENTS")
    for _st, eid, ev in (upcoming[:cap] if cap > 0 else upcoming):
        if time.monotonic() > deadline:
            info["stopped"] = "time budget"
            break
        try:
            full = get(pace, f"{api}/v4/prematch/brand/{brand}/event/{LANG}/{eid}")
            markets = ((full.get("events") or {}).get(eid) or {}).get("markets") or {}
            players: dict[str, str] = {}
            side_of: dict[str, int] = {}
            if (ev.get("desc") or {}).get("player_props"):
                desc = get(pace, f"{api}/v3/descriptions/brand/{brand}/event/{eid}/{LANG}")
                players = {p["id"]: str(p.get("name") or "").strip() for p in desc.get("players") or [] if p.get("id")}
                ids = [str(c.get("id")) for c in (ev.get("desc") or {}).get("competitors") or []]
                side_of = {p["id"]: ids.index(str(p.get("competitor_id"))) for p in desc.get("players") or [] if str(p.get("competitor_id")) in ids}
        except urllib.error.HTTPError as e:
            if e.code == 429:
                info["stopped"] = "HTTP 429"
                break
            continue
        common = ev_common(eid, ev, tournaments, SOURCE, fetched_at)
        r, fx, cat, left = parse_event(markets, players, common, side_of)
        if not (r or fx or cat):
            continue
        rows += r
        fancy_rows += fx
        catalogue += cat
        info["events"] += 1
        info["rows"] += len(r)
        info["fancy"] += len(fx)
        info["catalogue"] += len(cat)
        info["left_out"].update(left)
    return rows, {"books": {s["NAME"]: {**info, "left_out": dict(info["left_out"])}}, "fancy": fancy_rows, "catalogue": catalogue}


if __name__ == "__main__":
    from ..util import now_utc

    try:
        out_rows, raw = fetch(iso(now_utc()))
    except Skip as e:
        print(f"feedj skipped: {e}")
        raise SystemExit(1) from None
    book = next(iter((raw.get("books") or {}).values()), {})
    print(f"feedj ok listed={book.get('listed')} events={book.get('events')} rows={len(out_rows)} fancy={book.get('fancy')} "
          f"catalogue={book.get('catalogue')} stopped={book.get('stopped')}")
