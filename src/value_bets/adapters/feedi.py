"""Feed I: player and match prices from a public, login-free sportsbook (guest LineFeed / LiveFeed JSON).

The book and its host are deployment configuration, never code (docs/OPERATIONS.md): ``FEEDI_URL`` is the sportsbook root and
``FEEDI_NAME`` is the name its prices are published under. Unset, the source is skipped. It never runs on a laptop:
``fetch`` raises ``Skip`` unless ``GITHUB_ACTIONS`` is set (tests use ``*.invalid`` hosts only).

Cloudflare's JS challenge blocks plain ``urllib`` and the Mumbai relay hops. Feed I talks to the book **directly** with
Chrome TLS impersonation (``curl_cffi``), which clears that gate; a session is warmed on the site root first. Polite:
``FEEDI_SPACING_SECS`` between pages, ``FEEDI_BUDGET_SECS`` / ``FEEDI_MAX_EVENTS`` caps.

Listing: ``GetSportsZip`` (cricket sport id) → ``GetChampZip`` per league. Markets: ``GetGameZip`` with
``GroupEvents=false`` so outcomes carry player names (``PL.N``). Market kinds are numeric ``G`` ids (mapped below).
Match winner (G=1) is never a row. In-play uses the same transport on LiveFeed (``inplay_extra``).
"""
from __future__ import annotations

import datetime as dt
import os
import re
import time
import urllib.error
import urllib.parse
from collections import Counter, defaultdict

from cricket_data.hosts import host

from .. import config
from ..util import decimal_ok, http_json, iso, parse_ts
from .base import Pace, gender_hint, row
from .feedf import person

NAME = "feedi"
AUTO = True
SOURCE = "feedi_d"
CRIC_SPORT = 66  # cricket on this feed (not the family's older 85 id)
SKIP_COMP = re.compile(r"virtual|simulated|electronic|\bsrl\b|long term|futures|esports|card cricket", re.I)
WOMEN = re.compile(r"women|wbbl|\(w\)", re.I)
MULTI_DAY = re.compile(r"\btests?\b|ashes|shield|first.class|championship|ranji", re.I)
TEST = re.compile(r"\btests?\b|ashes", re.I)

# Ungrouped LineFeed market groups (G) → our market_type / fancy key. Probed 2026-11-15 on cricket Stats.
PLAYER_OU_G = {
    2506: "batter_runs",
    9181: "batter_sixes",
    9182: "batter_fours",
    3555: "bowler_wickets",
}
MILESTONE_G = {2316: "batter_milestone"}  # P is N in "to score N"; T-low = yes, T-high = no
TOP_G = {
    1006: "top_batter_match",
    1007: "top_bowler_match",
    2808: "top_batter_match",
    2520: "top_bowler_match",
}
# Groups whose over is the HIGHER selection id (the rest: lower T = over). Checked 2026-11-17 against a second book on 31
# bowler-wickets lines: 30 came out swapped with the default order (Over 1.5 wickets at 1.167 for a part-timer).
OVER_HIGH_T_G = {3555}
# Match-level O/U without a player (G 2508, 2502, 2504, 10605). They are NOT the match total: they are mixed per-innings,
# per-over and milestone ladders (0.5 / 8.5 / 14.5 / 49.5 / 100 / 199.5 ... in one group), so they stay in the catalogue
# and never become a fancy row until each group is identified from the feed.
FANCY_G = {2508, 2502, 2504, 10605}
WINNER_G = {1}

LIVE_SKIP = re.compile(
    r"^(match odds|match winner|draw no bet|double chance|team to lead|2-way match|to win the match|match betting)",
    re.I,
)
MAX_LIVE_EVENTS = 14
MAX_LIVE_LINES = 120
LIVE_BUDGET_SECS = 40.0

_session = None  # curl_cffi Session, warmed once per process


class Skip(Exception):
    pass


def settings() -> dict[str, str]:
    url = os.environ.get("FEEDI_URL", "").strip().rstrip("/")
    name = os.environ.get("FEEDI_NAME", "").strip()
    return {"URL": url, "NAME": name} if url.startswith("http") and name else {}


def published() -> dict[str, str]:
    s = settings()
    return {SOURCE: s["NAME"]} if s else {}


def lab(url: str) -> bool:
    h = urllib.parse.urlparse(url).hostname or ""
    return h.endswith(".invalid") or h in ("localhost", "127.0.0.1")


def on_runner() -> bool:
    return os.environ.get("GITHUB_ACTIONS") == "true"


def _cffi():
    try:
        from curl_cffi import requests as cffi_requests
    except ImportError as e:
        raise Skip("curl_cffi not installed (pip install -e '.[value-bets]')") from e
    return cffi_requests


def _session_for(base: str):
    """Warmed Chrome-impersonating session for ``base`` (clears Cloudflare; cookies kept)."""
    global _session
    cffi_requests = _cffi()
    if _session is None or getattr(_session, "_feedi_base", None) != base:
        sess = cffi_requests.Session(impersonate="chrome131")
        try:
            sess.get(f"{base}/en", timeout=30, headers={"Accept": "text/html"})
        except Exception:
            pass
        sess._feedi_base = base  # type: ignore[attr-defined]
        _session = sess
    return _session


def request(url: str):
    """GET JSON from the book with Chrome TLS impersonation. Lab hosts use plain http_json. No laptop → real book."""
    if lab(url):
        return http_json(url, retries=0)[0]
    if not on_runner():
        raise Skip("Feed I does not run on a local machine")
    base = f"{urllib.parse.urlparse(url).scheme}://{urllib.parse.urlparse(url).hostname}"
    sess = _session_for(base)
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Origin": base,
        "Referer": f"{base}/en/line/cricket",
    }
    r = sess.get(url, headers=headers, timeout=45)
    if r.status_code >= 400:
        raise urllib.error.HTTPError(url, r.status_code, (r.text or "")[:240], r.headers, None)
    try:
        return r.json()
    except Exception as e:
        raise Skip(f"Feed I non-JSON response ({r.status_code})") from e


def flip(name: str) -> str:
    last, comma, first = (name or "").partition(", ")
    return person(last, first) if comma else (name or "").strip()


def _fmt(competition: str, home: str, away: str) -> str | None:
    t = f"{competition} {home} {away}".lower()
    if re.search(r"\bt10\b", t) or ("10 over" in t and "t20" not in t):
        return "T10"
    if "the hundred" in t or "100 balls" in t or "100-ball" in t:
        return "Hundred"
    if TEST.search(t):
        return "Test"
    if "t20" in t or "twenty20" in t or "big bash" in t or "wbbl" in t:
        return "T20"
    if "odi" in t or "one day" in t or "one-day" in t or "50 over" in t or "list a" in t:
        return "ODI"
    return None


def _qs(**extra) -> str:
    d = {"lng": "en", **extra}
    return urllib.parse.urlencode({k: v for k, v in d.items() if v is not None and v != ""})


def linefeed(base: str, path: str, **extra) -> str:
    return f"{base}/service-api/LineFeed/{path}?{_qs(**extra)}"


def livefeed(base: str, path: str, **extra) -> str:
    return f"{base}/service-api/LiveFeed/{path}?{_qs(**extra)}"


def _coef(o: dict) -> float | None:
    try:
        p = float(o.get("C") if o.get("C") is not None else o.get("CV") or o.get("coef"))
    except (TypeError, ValueError):
        return None
    return decimal_ok(p)


def _param(o: dict) -> float | None:
    if o.get("P") is None or o.get("P") == "":
        return None
    try:
        return float(o["P"])
    except (TypeError, ValueError):
        return None


def _player(o: dict) -> str | None:
    pl = o.get("PL") or {}
    n = (pl.get("N") or o.get("PN") or "").strip()
    return flip(n) if n else None


def _sides(value: dict) -> tuple[str | None, str | None]:
    home = str(value.get("O1E") or value.get("O1") or "").strip() or None
    away = str(value.get("O2E") or value.get("O2") or "").strip() or None
    return home, away


def _competition(value: dict) -> str:
    return str(value.get("LE") or value.get("L") or value.get("SN") or "").strip()


def _start(value: dict) -> str | None:
    s = value.get("S") or value.get("start")
    if s is None:
        return None
    if isinstance(s, (int, float)):
        return iso(dt.datetime.fromtimestamp(int(s), tz=dt.timezone.utc))
    return iso(parse_ts(s))


def _ou_pairs(outcomes: list[dict]) -> list[tuple[str | None, float | None, float, float]]:
    """Group ungrouped outcomes into (player, line, over, under) using T-order (lower T = over)."""
    bags: dict[tuple, list[dict]] = defaultdict(list)
    for o in outcomes:
        bags[(_player(o), _param(o), o.get("G"))].append(o)
    out = []
    for (player, line, _g), rows in bags.items():
        rows = sorted(rows, key=lambda x: (x.get("T") is None, x.get("T") or 0))
        if len(rows) < 2:
            continue
        lo, hi = rows[0], rows[1]
        if _g in OVER_HIGH_T_G:
            lo, hi = hi, lo
        ov, un = _coef(lo), _coef(hi)
        if ov is None or un is None or line is None:
            continue
        out.append((player, line, ov, un))
    return out


def _cat(common: dict, name: str, player, team, line, over, under, mapped) -> dict:
    return {
        "match": common["match"], "home": common["team_a"], "away": common["team_b"],
        "start_utc": common["start_utc"], "competition": common["competition"], "fmt": common.get("fmt"),
        "source": common["source"], "kind": "bookmaker", "name": name, "player": player, "team": team,
        "line": line, "over": over, "under": under, "mapped": mapped,
    }


def outcomes_of(value: dict) -> list[dict]:
    """Flat outcome list: prefer ungrouped ``E`` (has ``PL``); else flatten grouped ``GE``."""
    if isinstance(value.get("E"), list) and value["E"] and isinstance(value["E"][0], dict):
        return [o for o in value["E"] if isinstance(o, dict)]
    out = []
    for g in value.get("GE") or []:
        for bucket in g.get("E") or []:
            if isinstance(bucket, list):
                out.extend(x for x in bucket if isinstance(x, dict))
            elif isinstance(bucket, dict):
                out.append(bucket)
    return out


def parse_game(value: dict, src: str, fetched_at: str, *, in_play: bool = False) -> tuple[list[dict], list[dict], list[dict], Counter]:
    """(player rows, fancy, catalogue, left_out) from one GetGameZip Value."""
    home, away = _sides(value)
    if not home or not away:
        return [], [], [], Counter()
    competition = _competition(value)
    if SKIP_COMP.search(f"{competition} {home} {away}"):
        return [], [], [], Counter()
    start = _start(value)
    female = "female" if WOMEN.search(f"{competition} {home} {away}") else gender_hint(home, away)
    multi = bool(MULTI_DAY.search(competition))
    fmt = _fmt(competition, home, away)
    eid = str(value.get("I") or value.get("CI") or "")
    common = dict(
        source=src, source_type="bookmaker", event_id=eid, match=f"{home} vs {away}",
        team_a=home, team_b=away, gender_hint=female, competition=competition or None,
        start_utc=start, in_play=bool(in_play), fetched_at=fetched_at, fmt=fmt,
    )
    rows, fancy, catalogue, left = [], [], [], Counter()
    by_g: dict[int, list[dict]] = defaultdict(list)
    for o in outcomes_of(value):
        g = o.get("G")
        if g is None:
            continue
        by_g[int(g)].append(o)

    def add_player_ou(mt: str, player: str, line: float, ov: float, un: float, raw: str):
        catalogue.append(_cat(common, raw, player, None, line, ov, un, mt))
        if in_play or mapped_skip_multiday(mt, multi):
            return
        gk = f"{src}:{eid}:{mt}:{player}:{line}"
        for side, price in (("over", ov), ("under", un)):
            rows.append(row(**{k: v for k, v in common.items() if k != "fmt"}, market_type=mt, market_raw=raw,
                            group_key=gk, selection=f"{player} {side} {line}", player=player,
                            line=line, side=side, back=price))

    def mapped_skip_multiday(mt: str, multi_day: bool) -> bool:
        return bool(multi_day and mt.startswith("batter_") and mt != "batter_milestone")

    for g, outs in by_g.items():
        if g in WINNER_G:
            continue
        if g in PLAYER_OU_G:
            mt = PLAYER_OU_G[g]
            for player, line, ov, un in _ou_pairs(outs):
                if not player or line is None:
                    left[f"G{g}"] += 1
                    continue
                add_player_ou(mt, player, line, ov, un, f"G{g} {mt}")
            continue
        if g in MILESTONE_G:
            mt = MILESTONE_G[g]
            for player, n, ov, un in _ou_pairs(outs):
                if not player or n is None:
                    continue
                line = float(n) - 0.5
                catalogue.append(_cat(common, f"G{g} to score {int(n)}", player, None, line, ov, un, mt))
                if in_play:
                    continue
                gk = f"{src}:{eid}:{mt}:{player}:{line}"
                for side, price, sel in (
                    ("over", ov, f"{player} {int(n)}+ yes"),
                    ("under", un, f"{player} {int(n)}+ no"),
                ):
                    rows.append(row(**{k: v for k, v in common.items() if k != "fmt"}, market_type=mt,
                                    market_raw=f"To score {int(n)} - {player}", group_key=gk,
                                    selection=sel, player=player, line=line, side=side, back=price,
                                    ms_scope="match"))
            continue
        if g in TOP_G:
            mt = TOP_G[g]
            for o in outs:
                player, price = _player(o), _coef(o)
                if not player or price is None:
                    continue
                catalogue.append(_cat(common, f"G{g} {mt}", player, None, None, price, None, mt))
                if not in_play:
                    rows.append(row(**{k: v for k, v in common.items() if k != "fmt"}, market_type=mt,
                                    market_raw=f"G{g}", group_key=f"{src}:{eid}:{mt}",
                                    selection=player, player=player, back=price))
            continue
        if g in FANCY_G:
            for player, line, ov, un in _ou_pairs(outs):
                if line is None:
                    continue
                catalogue.append(_cat(common, f"G{g} total {line}", player, None, line, ov, un, None))
            continue
        # Unknown G: catalogue samples only
        for player, line, ov, un in _ou_pairs(outs)[:5]:
            catalogue.append(_cat(common, f"G{g}", player, None, line, ov, un, None))
            left[f"G{g}"] += 1

    return rows, fancy, catalogue, left


def _game_ids_from_champ(payload) -> list[int]:
    val = (payload or {}).get("Value") if isinstance(payload, dict) else None
    if not isinstance(val, dict):
        return []
    out = []
    for g in val.get("G") or []:
        if not isinstance(g, dict):
            continue
        eid = g.get("I")
        if eid and not SKIP_COMP.search(str(g.get("TG") or "")):
            out.append(int(eid))
    return out


def _cricket_league_ids(payload) -> list[tuple[int, str]]:
    val = (payload or {}).get("Value") if isinstance(payload, dict) else None
    if not isinstance(val, list):
        return []
    out = []
    for block in val:
        if not isinstance(block, dict) or block.get("I") != CRIC_SPORT:
            continue
        for L in block.get("L") or []:
            li, name = L.get("LI"), str(L.get("L") or L.get("LE") or "")
            if li and not SKIP_COMP.search(name):
                out.append((int(li), name))
    return out


def _pull_game(base: str, pace: Pace, eid: int) -> dict | None:
    got = pace.get(linefeed(
        base, "GetGameZip", id=str(eid), isSubGames="true", GroupEvents="false", countevents="500",
    ))
    value = (got or {}).get("Value") if isinstance(got, dict) else None
    return value if isinstance(value, dict) else None


def _expand_subgames(base: str, pace: Pace, value: dict, deadline: float) -> list[dict]:
    """Main game + Stats / other subgames (each fetched ungrouped for ``PL`` names)."""
    blocks = [value]
    for sg in value.get("SG") or value.get("BIG") or []:
        if time.monotonic() > deadline:
            break
        sid = sg.get("I") if isinstance(sg, dict) else None
        tg = str((sg or {}).get("TG") or "")
        if not sid or SKIP_COMP.search(tg):
            continue
        # Prefer Stats; still pull Alternative when present
        if tg and tg.lower() not in ("stats", "alternative outcomes", "accumulator outcomes", ""):
            if "stat" not in tg.lower():
                continue
        sub = _pull_game(base, pace, int(sid))
        if sub:
            blocks.append(sub)
    return blocks


def fetch(fetched_at: str):
    s = settings()
    if not s:
        raise Skip("FEEDI_URL / FEEDI_NAME not set")
    if not on_runner() and not lab(s["URL"]):
        raise Skip("Feed I does not run on a local machine")
    base = s["URL"] if lab(s["URL"]) else host("FEEDI_URL")
    pace = Pace(config.get("FEEDI_SPACING_SECS"), lambda u: request(u))
    deadline = time.monotonic() + config.get("FEEDI_BUDGET_SECS")
    now = parse_ts(fetched_at)
    horizon = now + dt.timedelta(hours=config.get("FEEDI_HORIZON_HOURS"))
    info: dict = {"events": 0, "rows": 0, "fancy": 0, "catalogue": 0, "left_out": Counter()}
    rows: list[dict] = []
    fancy_rows: list[dict] = []
    catalogue: list[dict] = []

    sports = pace.get(linefeed(base, "GetSportsZip", gr="70"))
    leagues = _cricket_league_ids(sports if isinstance(sports, dict) else {})
    info["listed"] = len(leagues)
    game_ids: list[int] = []
    for li, _name in leagues:
        if time.monotonic() > deadline:
            info["stopped"] = "time budget"
            break
        try:
            champ = pace.get(linefeed(base, "GetChampZip", champ=str(li), tf="2200000", tz="330"))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                info["stopped"] = "HTTP 429"
                break
            continue
        game_ids.extend(_game_ids_from_champ(champ))
    # de-dupe, cap
    seen = set()
    ordered = []
    for eid in game_ids:
        if eid not in seen:
            seen.add(eid)
            ordered.append(eid)
    cap = config.get("FEEDI_MAX_EVENTS")
    if cap > 0:
        ordered = ordered[:cap]

    for eid in ordered:
        if time.monotonic() > deadline:
            info["stopped"] = "time budget"
            break
        try:
            value = _pull_game(base, pace, eid)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                info["stopped"] = "HTTP 429"
                break
            continue
        if not value:
            continue
        st = parse_ts(_start(value) or "")
        if st and (st <= now or st > horizon):
            continue
        blocks = _expand_subgames(base, pace, value, deadline)
        ev_rows = ev_fx = ev_cat = 0
        left = Counter()
        for block in blocks:
            r, fx, cat, lo = parse_game(block, SOURCE, fetched_at, in_play=False)
            rows += r
            fancy_rows += fx
            catalogue += cat
            left.update(lo)
            ev_rows += len(r)
            ev_fx += len(fx)
            ev_cat += len(cat)
        if not ev_rows and not ev_fx and not ev_cat:
            continue
        info["events"] += 1
        info["rows"] += ev_rows
        info["fancy"] += ev_fx
        info["catalogue"] += ev_cat
        info["left_out"].update(left)

    return rows, {"books": {s["NAME"]: {**info, "left_out": dict(info["left_out"])}}, "fancy": fancy_rows, "catalogue": catalogue}


def _live_ou(kind: str, line: float, sides: dict[str, float], book: str, **extra) -> dict:
    return {
        "kind": kind, **extra, "line": line,
        "over": None if sides.get("over") is None else round(sides["over"], 3),
        "under": None if sides.get("under") is None else round(sides["under"], 3),
        "book": book,
    }


def live_game_lines(value: dict, book: str) -> list[dict]:
    home, away = _sides(value)
    if not home or not away:
        return []
    out: list[dict] = []
    by_g: dict[int, list[dict]] = defaultdict(list)
    for o in outcomes_of(value):
        if o.get("G") is not None:
            by_g[int(o["G"])].append(o)
    for g, outs in by_g.items():
        if g in WINNER_G:
            continue
        if g in PLAYER_OU_G:
            mt = PLAYER_OU_G[g]
            for player, line, ov, un in _ou_pairs(outs):
                if not player or line is None:
                    continue
                if mt == "batter_runs":
                    out.append(_live_ou("player_runs", line, {"over": ov, "under": un}, book, player=player))
                else:
                    out.append(_live_ou("ou", line, {"over": ov, "under": un}, book, market=f"{mt} {player}"))
            continue
        if g in FANCY_G:
            for player, line, ov, un in _ou_pairs(outs):
                if line is None or player:
                    continue
                out.append(_live_ou("ou", line, {"over": ov, "under": un}, book, market=f"G{g}"))
    return out[:MAX_LIVE_LINES]


def live_matches(now: dt.datetime, wanted: list[tuple[str, str]] | None = None) -> list[dict]:
    from ..inplay_extra import wanted_first

    s = settings()
    if not s:
        return []
    if not on_runner() and not lab(s["URL"]):
        return []
    base = s["URL"] if lab(s["URL"]) else host("FEEDI_URL")
    pace = Pace(config.get("FEEDI_SPACING_SECS"), lambda u: request(u))
    deadline = time.monotonic() + LIVE_BUDGET_SECS
    book = s["NAME"]
    try:
        sports = pace.get(livefeed(base, "GetSportsZip", gr="70"))
    except Exception:
        return []
    leagues = _cricket_league_ids(sports if isinstance(sports, dict) else {})
    stubs = []
    for li, name in leagues:
        if time.monotonic() > deadline:
            break
        try:
            champ = pace.get(livefeed(base, "GetChampZip", champ=str(li), tf="2200000", tz="330"))
        except Exception:
            continue
        val = (champ or {}).get("Value") if isinstance(champ, dict) else None
        for g in (val or {}).get("G") or []:
            if isinstance(g, dict) and g.get("I"):
                stubs.append(g)
    stubs = wanted_first(stubs, wanted or [], _sides)
    out = []
    for stub in stubs[:MAX_LIVE_EVENTS]:
        if time.monotonic() > deadline:
            break
        try:
            value = pace.get(livefeed(
                base, "GetGameZip", id=str(stub["I"]), isSubGames="true", GroupEvents="false", countevents="500",
            ))
        except Exception:
            break
        value = (value or {}).get("Value") if isinstance(value, dict) else None
        if not isinstance(value, dict):
            continue
        blocks = [value]
        for sg in value.get("SG") or []:
            if time.monotonic() > deadline:
                break
            if isinstance(sg, dict) and sg.get("I") and "stat" in str(sg.get("TG") or "").lower():
                try:
                    sub = pace.get(livefeed(
                        base, "GetGameZip", id=str(sg["I"]), isSubGames="true", GroupEvents="false", countevents="500",
                    ))
                    sub = (sub or {}).get("Value") if isinstance(sub, dict) else None
                    if isinstance(sub, dict):
                        blocks.append(sub)
                except Exception:
                    break
        lines = []
        for block in blocks:
            lines.extend(live_game_lines(block, book))
        home, away = _sides(value)
        if home and away and lines:
            out.append({
                "home": home, "away": away, "league": _competition(value),
                "kickoff": _start(value), "lines": lines[:MAX_LIVE_LINES],
            })
    return out


if __name__ == "__main__":
    from ..util import now_utc

    stamp = iso(now_utc())
    try:
        rows, raw = fetch(stamp)
    except Skip as e:
        print(f"feedi skipped: {e}")
        raise SystemExit(1) from None
    except urllib.error.HTTPError as e:
        print(f"feedi HTTP {e.code}: {e.reason}")
        raise SystemExit(1) from None
    book = next(iter((raw.get("books") or {}).values()), {})
    print(
        "feedi ok"
        f" listed={book.get('listed')}"
        f" events={book.get('events')}"
        f" rows={len(rows)}"
        f" fancy={book.get('fancy')}"
        f" catalogue={book.get('catalogue')}"
        f" stopped={book.get('stopped')}"
    )
