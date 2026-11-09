"""Feed I: player and match prices from a public, login-free sportsbook (guest pages, one host).

The book and its host are deployment configuration, never code (docs/OPERATIONS.md): ``FEEDI_URL`` is the site root and
``FEEDI_NAME`` is the name its prices are published under. Unset, the source is skipped. It never runs on a laptop: ``fetch`` raises
``Skip`` unless ``GITHUB_ACTIONS`` is set (tests use ``*.invalid`` hosts only). On GitHub it goes through the Cloudflare Worker relay
(``FEEDI_RELAY`` / ``FEEDI_RELAY_KEY``, else the Vercel Mumbai hop's ``FEEDG_RELAY`` pair, else Feed H's Worker pair); there is no direct call. The book's JSON is XOR-wrapped and its calls need the
session cookie from the HTML shell, so the hop forwards that cookie plus the session headers (``relay/browser.js``). Polite: one shell,
one listing, then each in-horizon game, ``FEEDI_SPACING_SECS`` apart, one attempt each; a 429 ends the run and ``FEEDI_BUDGET_SECS``
stops new pages.

Rows are the player markets the other books already map: "<player> - Runs / Fours / Sixes / Wickets - (N)", "<player> - To Score N"
yes/nos, and Top Batter / Top Bowler (match and per side). Match fours / sixes / run-outs and a side's runs / fours / sixes come back
as ``fancy`` lines. A Test's innings-scoped line is published with ``inn`` and left out of the value-bet pricing. Head-to-head is never
a row. Every open market of a fetched match is also a compact ``catalogue`` row.

The hourly pull lists every day in the horizon (the book's events call takes a date) so a fixture later in the week is not missed, and
it still files only matches that have not started. A started match is read by ``inplay`` for the minute snapshot instead: player innings
runs and a side's innings total, merged into the in-play row and never written to ``book_lines`` or the archive.
"""
from __future__ import annotations

import base64
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter

from cricket_data.hosts import host

from .. import config
from ..util import decimal_ok, iso, parse_ts
from .base import Pace, gender_hint, row

NAME = "feedi"
AUTO = True  # on whenever FEEDI_URL and FEEDI_NAME are set; no need to list it in CV_SOURCES
SOURCE = "feedi_d"
SPORT_PATH = 215  # cricket on this book's sport tree (the page the prices are listed under)
LOCALE = "en-in"
SKIP_PATH = re.compile(r"virtual|simulated|electronic|\bsrl\b", re.I)
INTL = re.compile(r"\binternational\b|\bworld cup\b|\btest\b|\bone.day\b|\btwenty20\b|\bt20\b", re.I)
TEST = re.compile(r"\btests?\b|ashes", re.I)
WOMEN = re.compile(r"women|wbbl|\(w\)", re.I)
KEEP_GROUP = re.compile(r"popular|innings|players|4'?s|six|wicket", re.I)
SKIP_GROUP = re.compile(r"boost|lucky|outright|special", re.I)
BRAND_RE = re.compile(r"brandId\s*:\s*(\d+)")
CFG_RE = re.compile(r"cfgA\\*\"?\s*:\s*\\*\"([A-Za-z0-9+/=]{4,})")
CSRF_RE = re.compile(r"(?:^|[;,\s])csrf=([^;,\s]+)")
LINE_RE = re.compile(r"\((?P<n>\d+(?:\.\d+)?)\)\s*$")
PLAYER_STAT = (
    (re.compile(r"^(?P<p>.+?) - Runs - \((?P<n>\d+(?:\.\d+)?)\)\s*$", re.I), "batter_runs"),
    (re.compile(r"^(?P<p>.+?) - Fours - \((?P<n>\d+(?:\.\d+)?)\)\s*$", re.I), "batter_fours"),
    (re.compile(r"^(?P<p>.+?) - Sixes - \((?P<n>\d+(?:\.\d+)?)\)\s*$", re.I), "batter_sixes"),
    (re.compile(r"^(?P<p>.+?) - Wickets - \((?P<n>\d+(?:\.\d+)?)\)\s*$", re.I), "bowler_wickets"),
)
TO_SCORE = re.compile(r"^(?P<p>.+?) - To Score (?P<n>\d+)\s*$", re.I)
TOP_TEAM = re.compile(r"^(?P<team>.+?) - Top (?P<who>Batter|Bowler)\s*$", re.I)
TOP_MATCH = re.compile(r"^Top (?P<who>Batsman|Bowler)\s*$", re.I)
MATCH_KEY = (
    (re.compile(r"^Match Fours\b", re.I), "match_fours"),
    (re.compile(r"^Match Sixes\b", re.I), "match_sixes"),
    (re.compile(r"^Match (?:Total )?Runs\b", re.I), "match_runs"),
    (re.compile(r"^Match Run[- ]?Outs\b", re.I), "match_runouts"),
)
TEAM_KEY = (
    (re.compile(r"^(?P<team>.+?) - Runs - \(", re.I), "team_total_runs"),
    (re.compile(r"^(?P<team>.+?) - Fours - \(", re.I), "team_total_fours"),
    (re.compile(r"^(?P<team>.+?) - Sixes - \(", re.I), "team_total_sixes"),
)
TOP_MT = {"Batter": ("top_batter_team", "top_batter_match"), "Bowler": ("top_bowler_team", "top_bowler_match"),
          "Batsman": ("top_batter_team", "top_batter_match")}


class Skip(Exception):
    pass


LAST_STEP = ""


def settings() -> dict[str, str]:
    """The deployment's FEEDI_URL and FEEDI_NAME; empty if the source is not configured."""
    url, name = os.environ.get("FEEDI_URL", "").strip().rstrip("/"), os.environ.get("FEEDI_NAME", "").strip()
    return {"URL": url, "NAME": name} if url.startswith("http") and name else {}


def published() -> dict[str, str]:
    """{source key: the name it is published under}: ``booklines.public`` swaps the first for the second."""
    s = settings()
    return {SOURCE: s["NAME"]} if s else {}


def relay() -> tuple[str, str] | None:
    """(relay address, key): Feed I's own pair (FEEDI_RELAY / FEEDI_RELAY_KEY), else the Vercel Mumbai hop's (FEEDG_RELAY), else the Cloudflare Worker's (FEEDH_RELAY). Each is taken as a pair, never an address from one and a key from another.
    The Worker's egress gets a Cloudflare 403 on this book's first page (checked 2026-11-09 from a runner); the Vercel hop gets through, so it comes before the Worker."""
    for prefix in ("FEEDI", "FEEDG", "FEEDH"):
        addr, key = os.environ.get(f"{prefix}_RELAY", "").strip(), os.environ.get(f"{prefix}_RELAY_KEY", "").strip()
        if addr.startswith("https://") and key:
            return addr, key
    return None


def lab(url: str) -> bool:
    """Placeholder hosts used only in tests (never a real book)."""
    h = urllib.parse.urlparse(url).hostname or ""
    return h.endswith(".invalid") or h in ("localhost", "127.0.0.1")


def on_runner() -> bool:
    """True only in GitHub Actions. A laptop must never call the book, even through the relay."""
    return os.environ.get("GITHUB_ACTIONS") == "true"


def java_hash(text: str) -> int:
    """The book's session header is Java's String hash of the csrf cookie, added to the unix time."""
    h = 0
    for ch in text:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return h - 0x100000000 if h >= 0x80000000 else h


def unwrap(body: bytes, headers: dict, key: bytes) -> bytes:
    """Plain JSON, or the XOR body the shell's ``cfgA`` key opens. A body that is already JSON is left as it is."""
    if not body:
        return body
    enc = ""
    for k, v in (headers or {}).items():
        if k.lower() == "x-content-encoding":
            enc = str(v).lower()
    if enc != "xor" and body[:1] in (b"{", b"["):
        return body
    if enc != "xor" and not key:
        return body
    try:
        raw = base64.b64decode(body, validate=False)
    except Exception:
        return body
    if not key:
        return body
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(raw))


def _price(o: dict) -> float | None:
    if not isinstance(o, dict) or o.get("hidden") or o.get("wdrn"):
        return None
    if o.get("prd") not in (None, ""):
        return decimal_ok(o.get("prd"))
    p = o.get("pr")
    if isinstance(p, str) and "/" in p:
        a, _, b = p.partition("/")
        try:
            return decimal_ok(1 + float(a) / float(b))
        except (TypeError, ValueError, ZeroDivisionError):
            return None
    return decimal_ok(p)


def _line_of(market: dict, outcome: dict | None = None) -> float | None:
    if outcome and outcome.get("extra1") not in (None, ""):
        try:
            return float(outcome["extra1"])
        except (TypeError, ValueError):
            pass
    m = LINE_RE.search((market.get("des") or "").strip())
    return float(m.group("n")) if m else None


def _side(o: dict) -> str | None:
    dim = (o.get("keyDimension") or "").upper()
    des = (o.get("des") or "").strip().lower()
    if dim == "OVER" or des.startswith("over"):
        return "over"
    if dim == "UNDER" or des.startswith("under"):
        return "under"
    if dim == "YES" or des == "yes":
        return "over"
    if dim == "NO" or des == "no":
        return "under"
    return None


def _ou(market: dict) -> tuple[float, dict[str, float]] | None:
    """-> (line, {"over": price, "under": price}) of a two-sided line, else None."""
    line, sides = None, {}
    for o in market.get("outcomes") or []:
        if not isinstance(o, dict):
            return None
        side, p = _side(o), _price(o)
        if side not in ("over", "under") or p is None:
            continue
        ln = _line_of(market, o)
        if ln is None or (line is not None and ln != line):
            return None
        line, sides[side] = ln, p
    return (line, sides) if line is not None and len(sides) == 2 else None


def _named(market: dict) -> list[tuple[str, float]]:
    out = []
    for o in market.get("outcomes") or []:
        if not isinstance(o, dict):
            continue
        n, p = (o.get("des") or "").strip(), _price(o)
        if n and p is not None and _side(o) is None:
            out.append((n, p))
    return out


def _fmt(competition: str, home: str, away: str) -> str | None:
    t = f"{competition} {home} {away}".lower()
    if re.search(r"\bt10\b", t):
        return "T10"
    if "the hundred" in t or "100-ball" in t:
        return "Hundred"
    if TEST.search(t):
        return "Test"
    if "t20" in t or "twenty20" in t or "twenty 20" in t:
        return "T20"
    if "odi" in t or "one day" in t or "one-day" in t or "50 over" in t:
        return "ODI"
    return None


def _inn(period: str, fmt: str | None) -> int | None:
    """1 or 2 for a Test innings. A limited-overs '1st innings' is the match (one innings a side)."""
    p = (period or "").lower()
    if "2nd" in p or "second" in p:
        n = 2
    elif "1st" in p or "first" in p:
        n = 1
    else:
        return None
    return n if fmt == "Test" else None


def _team(name: str, home: str, away: str) -> bool:
    return (name or "").strip().casefold() in {home.casefold(), away.casefold()}


def _cat(common: dict, name: str, player, team, line, over, under, mapped) -> dict:
    return {"match": common["match"], "home": common["team_a"], "away": common["team_b"], "start_utc": common["start_utc"],
            "competition": common["competition"], "fmt": common.get("fmt"), "source": common["source"], "kind": "bookmaker",
            "name": name, "player": player, "team": team, "line": line, "over": over, "under": under, "mapped": mapped}


def _sport_id(doc) -> int | None:
    found: list[int] = []

    def walk(node):
        if isinstance(node, dict):
            sid = node.get("sportId")
            if isinstance(sid, int) and sid != SPORT_PATH:
                found.append(sid)
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(doc)
    return found[0] if found else None


def parse_shell(html: str) -> dict:
    """Brand id and the XOR key printed in the page shell. Empty when the page has neither."""
    brand = BRAND_RE.search(html or "")
    cfg = CFG_RE.search(html or "")
    key = b""
    if cfg:
        try:
            key = base64.b64decode(cfg.group(1))
        except Exception:
            key = b""
    return {"brand": brand.group(1) if brand else "", "key": key}


def parse_event(detail: dict, markets: list[dict], src: str, fetched_at: str) -> tuple[list[dict], list[dict], list[dict], Counter]:
    """(player rows, fancy lines, catalogue rows, names left out of rows) of one pre-match cricket event."""
    if detail.get("in_play") or (detail.get("event_type") or "GAME").upper() not in ("GAME", ""):
        return [], [], [], Counter()
    home, away = (detail.get("home_name") or "").strip(), (detail.get("away_name") or "").strip()
    if not home or not away:
        return [], [], [], Counter()
    competition = detail.get("competition_title") or (detail.get("event_path_tree") or {}).get("description") or ""
    dims = " ".join(str(v) for v in (detail.get("dimensions") or {}).values())
    blob = f"{competition} {home} {away} {detail.get('description') or ''} {dims}"
    if SKIP_PATH.search(blob):
        return [], [], [], Counter()
    start = iso(parse_ts(detail.get("start_time") or detail.get("event_date")))
    fmt = _fmt(competition, home, away)
    female = "female" if WOMEN.search(blob) else gender_hint(home, away)
    common = dict(source=src, source_type="bookmaker", event_id=str(detail.get("id")), match=f"{home} vs {away}",
                  team_a=home, team_b=away, gender_hint=female, competition=competition, start_utc=start,
                  in_play=False, fetched_at=fetched_at, fmt=fmt)
    rows, fancy, catalogue, left = [], [], [], Counter()

    def add_ou(name, player, team, mapped, mt=None, fancy_key=None, scope="match", inn=None, ms_scope=None, line=None):
        got = _ou(m)
        if not got:
            left[name] += 1
            catalogue.append(_cat(common, name, player, team, line, None, None, None))
            return
        ln, px = got
        if line is not None:
            ln = line
        ov, un = round(px["over"], 3), round(px["under"], 3)
        catalogue.append(_cat(common, name, player, team, ln, ov, un, mapped))
        if mapped is None:
            return
        if fancy_key:
            fancy.append({"match": common["match"], "home": home, "away": away, "start_utc": start, "fmt": fmt,
                          "competition": competition, "key": fancy_key, "scope": scope, "team": team, "line": ln,
                          "over": ov, "under": un, "source": src, "kind": "bookmaker", **({"inn": inn} if inn else {})})
            return
        gk = f"{src}:{detail.get('id')}:{m.get('id')}"
        for side, price in (("over", ov), ("under", un)):
            rows.append(row(**{k: v for k, v in common.items() if k != "fmt"}, market_type=mt, market_raw=name, group_key=gk,
                            selection=f"{player} {side} {ln}" if player else name, player=player, team=team, line=ln,
                            side=side, back=price, inn=inn, ms_scope=ms_scope))

    seen = set()
    for m in markets or []:
        if not isinstance(m, dict):
            continue
        mid = m.get("id")
        if mid in seen:
            continue
        if mid:
            seen.add(mid)
        name = (m.get("des") or "").strip()
        if not name or (m.get("st") not in (None, 1, "1")):
            if name:
                left[name] += 1
            continue
        period = m.get("p") or ""
        inn = _inn(period, fmt)
        if any(rx.match(name) for rx, _ in MATCH_KEY):
            key = next(k for rx, k in MATCH_KEY if rx.match(name))
            add_ou(name, None, None, key, fancy_key=key, inn=inn)
            continue
        if (mm := TO_SCORE.match(name)):
            player, line = mm["p"].strip(), int(mm["n"]) - 0.5
            add_ou(name, player, None, "batter_milestone", mt="batter_milestone", ms_scope="match", line=line, inn=inn)
            for r in rows[-2:]:
                if r.get("market_type") == "batter_milestone" and r.get("player") == player:
                    r["line"], r["ms_scope"] = line, "match"
                    r["selection"] = f"{player} {int(line + 0.5)}+ {'yes' if r['side'] == 'over' else 'no'}"
                    if inn:
                        r["inn"] = inn
            continue
        if (mm := TOP_TEAM.match(name)) and _team(mm["team"], home, away):
            mt = TOP_MT[mm["who"].title()][0]
            named, gk = _named(m), f"{src}:{detail.get('id')}:{m.get('id')}"
            if not named:
                left[name] += 1
                continue
            for n, p in named:
                catalogue.append(_cat(common, name, n, mm["team"], None, round(p, 3), None, mt))
                rows.append(row(**{k: v for k, v in common.items() if k != "fmt"}, market_type=mt, market_raw=name, group_key=gk,
                                selection=n, player=n, team=mm["team"], back=round(p, 3), inn=inn))
            continue
        if (mm := TOP_MATCH.match(name)):
            mt = TOP_MT[mm["who"].title()][1]
            named, gk = _named(m), f"{src}:{detail.get('id')}:{m.get('id')}"
            if not named:
                left[name] += 1
                continue
            for n, p in named:
                catalogue.append(_cat(common, name, n, None, None, round(p, 3), None, mt))
                rows.append(row(**{k: v for k, v in common.items() if k != "fmt"}, market_type=mt, market_raw=name, group_key=gk,
                                selection=n, player=n, back=round(p, 3), inn=inn))
            continue
        team_hit = False
        for rx, key in TEAM_KEY:
            mm = rx.match(name)
            if mm and _team(mm["team"], home, away):
                add_ou(name, None, mm["team"].strip(), key, fancy_key=key, scope="team", inn=inn)
                team_hit = True
                break
        if team_hit:
            continue
        player_hit = False
        for rx, mt in PLAYER_STAT:
            mm = rx.match(name)
            if mm and not _team(mm["p"], home, away):
                add_ou(name, mm["p"].strip(), None, mt, mt=mt, inn=inn)
                player_hit = True
                break
        if player_hit:
            continue
        got = _ou(m)
        if got:
            ln, px = got
            catalogue.append(_cat(common, name, None, None, ln, round(px["over"], 3), round(px["under"], 3), None))
        else:
            named = _named(m)
            if named:
                for n, p in named:
                    catalogue.append(_cat(common, name, n, None, None, round(p, 3), None, None))
            else:
                left[name] += 1
                catalogue.append(_cat(common, name, None, None, None, None, None, None))
    return rows, fancy, catalogue, left


class Client:
    """One session: the shell's cookie, its XOR key, and the headers each later call sends."""

    def __init__(self, base: str, get):
        self.base, self._get = base.rstrip("/"), get
        self.cookies: dict[str, str] = {}
        self.key = b""
        self.brand = ""
        self.sport_id: int | None = None

    def _headers(self, accept: str) -> dict[str, str]:
        h = {"Accept": accept}
        csrf = self.cookies.get("csrf", "")
        if csrf:
            ts = str(int(time.time()))
            h["X-CSRF-Token"] = csrf
            h["x-ct"] = str(java_hash(csrf) + int(ts))
            h["x-ct-d"] = ts
        if self.cookies:
            h["Cookie"] = "; ".join(f"{k}={v}" for k, v in self.cookies.items())
        origin = urllib.parse.urlparse(self.base).scheme + "://" + (urllib.parse.urlparse(self.base).hostname or "")
        h["Origin"] = origin
        h["Referer"] = origin + "/"
        return h

    def _take_cookie(self, headers: dict):
        blob = " ".join(str(v) for k, v in (headers or {}).items() if k.lower() in ("set-cookie", "x-relay-set-cookie"))
        found = CSRF_RE.search(blob)
        if found:
            self.cookies["csrf"] = found.group(1)
        self.cookies.setdefault("price_format_id", "2")

    def call(self, path: str, accept: str = "application/json"):
        global LAST_STEP
        LAST_STEP = path.split("?", 1)[0].rsplit("/", 1)[-1][:40]
        body, headers = self._get(self.base + path, self._headers(accept))
        self._take_cookie(headers or {})
        raw = body if isinstance(body, bytes) else (body.encode() if isinstance(body, str) else b"")
        if isinstance(body, (dict, list)):
            return body
        plain = unwrap(raw, headers or {}, self.key)
        text = plain.decode("utf-8", "replace")
        if os.environ.get("FEEDI_DEBUG") and ("/bv_api/events/" in path or "coupon_groups" in path) and not getattr(self, "_shown", {}).get(path.split("/")[2] if False else "x"):
            self._shown = {"x": 1}
            print(f"DBG raw {path.split('?')[0].rsplit('/', 2)[0][-40:]} len_raw={len(raw)} len_text={len(text)} head={text[:400]!r}", file=sys.stderr)
        if text[:1] in "[{":
            return json.loads(text)
        return text

    def open(self):
        html = self.call(f"/{LOCALE}/sports/{SPORT_PATH}", accept="text/html")
        if not isinstance(html, str):
            html = ""
        shell = parse_shell(html)
        self.brand, self.key = shell["brand"], shell["key"]
        if not self.brand or not self.key:
            raise Skip("page shell had no brand or key")
        doc = self.call(f"/api/sports/{SPORT_PATH}?l={LOCALE}")
        self.sport_id = _sport_id(doc) if isinstance(doc, (dict, list)) else None
        if not self.sport_id:
            raise Skip("sport id missing")


def _http(url: str, headers: dict):
    """One GET. Direct only for test hosts; a real book goes through the relay. Returns (body, headers)."""
    if not on_runner() and not lab(url):
        raise Skip("Feed I does not run on a local machine")
    rl = relay()
    if rl is None and not lab(url):
        raise Skip("FEEDI_RELAY not set (never call the book directly)")
    req_headers = dict(headers or {})
    target = url
    if rl is not None and not lab(url):
        target = f"{rl[0]}?u={urllib.parse.quote(url, safe='')}"
        req_headers = {
            "x-relay-key": rl[1],
            "x-relay-origin": headers.get("Origin", ""),
            "x-relay-referer": headers.get("Referer", ""),
            "x-relay-cookie": headers.get("Cookie", ""),
            "x-relay-csrf": headers.get("X-CSRF-Token", ""),
            "x-relay-ct": headers.get("x-ct", ""),
            "x-relay-ct-d": headers.get("x-ct-d", ""),
            "x-relay-accept": headers.get("Accept", ""),
            "x-relay-dest": "document" if str(headers.get("Accept", "")).startswith("text/html") else "",
            "x-relay-mode": "navigate" if str(headers.get("Accept", "")).startswith("text/html") else "",
            "x-relay-site": "none" if str(headers.get("Accept", "")).startswith("text/html") else "",
        }
    req = urllib.request.Request(target, headers={k: v for k, v in req_headers.items() if v}, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=config.get("HTTP_TIMEOUT")) as r:
            return r.read(), {k.lower(): v for k, v in r.headers.items()}
    except urllib.error.HTTPError as e:
        # The body says which side refused. Keep a short tag only: the body can name the host.
        try:
            text = (e.read() or b"").decode("utf-8", "replace")[:120].lower()
        except Exception:
            text = ""
        up = e.hdrs.get("x-relay-upstream-status") if e.hdrs is not None else ""
        if "not allowed" in text:
            tag = "relay-allow"
        elif text.strip() == "forbidden":
            tag = "relay-key"
        elif any(s in text for s in ("1010", "cloudflare", "just a moment", "attention required")):
            tag = "cf-challenge"
        elif up:
            tag = "upstream"
        else:
            tag = "relay"
        raise urllib.error.HTTPError(e.url, e.code, tag, e.hdrs, None) from None


def _groups(doc) -> list[dict]:
    if isinstance(doc, dict):
        doc = doc.get("groups") or []
    out = []
    for g in doc or []:
        if not isinstance(g, dict):
            continue
        name = g.get("name") or ""
        if not g.get("id") or SKIP_GROUP.search(name) or not KEEP_GROUP.search(name):
            continue
        out.append(g)
    return out


def horizon_dates(now: dt.datetime, hours: float) -> list[str]:
    """Each calendar day from `now` through the end of the horizon, as YYYY-MM-DD. The book's listing is one day at a time."""
    if now.tzinfo is None:
        now = now.replace(tzinfo=dt.timezone.utc)
    d, end = now.date(), (now + dt.timedelta(hours=hours)).date()
    out = []
    while d <= end:
        out.append(d.isoformat())
        d += dt.timedelta(days=1)
    return out


def _events_path(day: str | None = None) -> str:
    path = f"/api/sportsbook/event_paths/{SPORT_PATH}/events?c={LOCALE}"
    return f"{path}&date={day}" if day else path


def _pull(pace, deadline: float, path: str, info: dict | None = None):
    if time.monotonic() > deadline:
        if info is not None:
            info["stopped"] = "time budget"
        return None
    try:
        return pace.get(path)
    except urllib.error.HTTPError as e:
        if info is not None and e.code == 429:
            info["stopped"] = "HTTP 429"
        return None


def _event_nodes(doc) -> list[dict]:
    """Event dicts from a listing or the live board. Nested sport blocks are walked one level."""
    blocks = []
    if isinstance(doc, list):
        blocks = doc
    elif isinstance(doc, dict):
        for key in ("events", "matches"):
            if isinstance(doc.get(key), list):
                blocks.extend(doc[key])
        for key in ("sports", "competitions", "event_paths"):
            for block in doc.get(key) or []:
                if isinstance(block, dict) and isinstance(block.get("events"), list):
                    blocks.extend(block["events"])
    out, seen = [], set()
    for ev in blocks:
        if not isinstance(ev, dict) or not ev.get("id") or ev["id"] in seen:
            continue
        seen.add(ev["id"])
        out.append(ev)
    return out


def _period_inn(period: str) -> int | None:
    """1..4 from a period label. Unlike `_inn`, a limited-overs innings still counts: the live panel asks for it."""
    p = (period or "").lower()
    for n, words in ((4, ("4th", "fourth")), (3, ("3rd", "third")), (2, ("2nd", "second")), (1, ("1st", "first"))):
        if any(w in p for w in words):
            return n
    return None


def live_lines(detail: dict, markets: list[dict], book: str) -> dict | None:
    """One started match as the in-play row reads it: player innings runs and a side's innings total, both prices, with the book's name."""
    if (detail.get("event_type") or "GAME").upper() not in ("GAME", ""):
        return None
    home, away = (detail.get("home_name") or "").strip(), (detail.get("away_name") or "").strip()
    if not home or not away:
        parts = re.split(r"\s+v(?:s\.?)?\s+", detail.get("description") or "", maxsplit=1, flags=re.I)
        if len(parts) == 2:
            home, away = parts[0].strip(), parts[1].strip()
    if not home or not away:
        return None
    competition = detail.get("competition_title") or (detail.get("event_path_tree") or {}).get("description") or ""
    blob = f"{competition} {home} {away} {detail.get('description') or ''}"
    if SKIP_PATH.search(blob):
        return None
    lines = []
    for m in markets or []:
        if not isinstance(m, dict) or m.get("st") not in (None, 1, "1"):
            continue
        name = (m.get("des") or "").strip()
        got = _ou(m)
        if not name or not got:
            continue
        ln, px = got
        side = {"line": ln, "over": round(px["over"], 3), "under": round(px["under"], 3), "book": book}
        mm = PLAYER_STAT[0][0].match(name)
        if mm and not _team(mm["p"], home, away):
            lines.append({"kind": "player_runs", "player": mm["p"].strip(), **side})
            continue
        mm = TEAM_KEY[0][0].match(name)
        if mm and _team(mm["team"], home, away):
            lines.append({"kind": "team_runs", "team": mm["team"].strip(), "inn": _period_inn(m.get("p") or "") or 1, **side})
    if not lines:
        return None
    return {"home": home, "away": away, "league": competition,
            "kickoff": iso(parse_ts(detail.get("start_time") or detail.get("event_date"))), "lines": lines}


def _markets(doc) -> list[dict]:
    if isinstance(doc, dict):
        doc = doc.get("coupons") or doc.get("markets") or []
    out = []
    for c in doc or []:
        if isinstance(c, dict) and c.get("markets"):
            out.extend(x for x in c["markets"] if isinstance(x, dict))
        elif isinstance(c, dict) and c.get("des"):
            out.append(c)
    return out


def fetch(fetched_at: str):
    s = settings()
    if not s:
        raise Skip("FEEDI_URL / FEEDI_NAME not set")
    if not on_runner() and not lab(s["URL"]):
        raise Skip("Feed I does not run on a local machine")
    if not relay() and not lab(s["URL"]):
        raise Skip("FEEDI_RELAY not set (never call the book directly)")
    base = host("FEEDI_URL")
    client = Client(base, _http)
    pace = Pace(config.get("FEEDI_SPACING_SECS"), lambda path, accept="application/json": client.call(path, accept))
    deadline = time.monotonic() + config.get("FEEDI_BUDGET_SECS")
    now, horizon = parse_ts(fetched_at), parse_ts(fetched_at) + dt.timedelta(hours=config.get("FEEDI_HORIZON_HOURS"))
    info: dict = {"events": 0, "rows": 0, "fancy": 0, "catalogue": 0, "left_out": Counter()}
    rows, fancy, catalogue = [], [], []
    client.open()
    seen, stubs = set(), []
    info["days"] = 0
    for day in [None, *horizon_dates(now, config.get("FEEDI_HORIZON_HOURS"))]:
        if info.get("stopped") in ("time budget", "HTTP 429"):
            break
        listing = _pull(pace, deadline, _events_path(day), info)
        if not isinstance(listing, list):
            if day is None and not info.get("stopped"):
                raise Skip("events listing was not a list")
            continue
        if day is not None:
            info["days"] += 1
        for ev in listing:
            if not isinstance(ev, dict) or not ev.get("id") or ev["id"] in seen:
                continue
            desc = ev.get("description") or ""
            if SKIP_PATH.search(desc):
                continue
            seen.add(ev["id"])
            stubs.append((0 if INTL.search(desc) else 1, ev))
    stubs.sort(key=lambda t: t[0])
    cap = config.get("FEEDI_MAX_EVENTS")
    if cap > 0:
        stubs = stubs[:cap]
    info["listed"] = len(stubs)

    for _, stub in stubs:
        if info.get("stopped") in ("time budget", "HTTP 429"):
            break
        detail = _pull(pace, deadline, f"/bv_api/events/{LOCALE}/{stub['id']}", info)
        if not isinstance(detail, dict) or not detail.get("id"):
            if dbg:
                shape = {k: (type(v).__name__ if not isinstance(v, (dict, list)) else f"{type(v).__name__}[{len(v)}]") for k, v in detail.items()} if isinstance(detail, dict) else None
                head = (detail[:1] if isinstance(detail, list) else str(detail)[:120] if isinstance(detail, str) else None)
                print(f"DBG detail skipped: type={type(detail).__name__} shape={shape} head={str(head)[:300]}", file=sys.stderr)
            if dbg and isinstance(detail, dict):
                for k, v in detail.items():
                    if isinstance(v, dict):
                        print(f"DBG   detail.{k} keys={sorted(v)[:25]}", file=sys.stderr)
            continue
        st = parse_ts(detail.get("start_time") or detail.get("event_date"))
        if not st or st <= now or st > horizon or detail.get("in_play"):
            continue
        groups = _pull(pace, deadline, f"/bv_event_level/{LOCALE}/{client.brand}/coupon_groups/{client.sport_id}?event_id={stub['id']}", info)
        if info.get("stopped") in ("time budget", "HTTP 429"):
            break
        if groups is None:
            continue
        markets = []
        for g in _groups(groups):
            got = _pull(pace, deadline, f"/bv_event_level/{LOCALE}/{client.brand}/coupons/{stub['id']}/{g['id']}?period_id=0", info)
            if info.get("stopped") in ("time budget", "HTTP 429"):
                break
            markets.extend(_markets(got))
        r, fx, cat, left = parse_event(detail, markets, SOURCE, fetched_at)
        if not r and not fx and not cat:
            continue
        rows += r
        fancy += fx
        catalogue += cat
        info["events"] += 1
        info["rows"] += len(r)
        info["fancy"] += len(fx)
        info["catalogue"] += len(cat)
        info["left_out"].update(left)
    return rows, {"books": {s["NAME"]: {**info, "left_out": dict(info["left_out"])}}, "fancy": fancy, "catalogue": catalogue}


def _session(budget_key: str):
    """Open one session, or raise Skip. Returns (settings, client, pace, deadline)."""
    s = settings()
    if not s:
        raise Skip("FEEDI_URL / FEEDI_NAME not set")
    if not on_runner() and not lab(s["URL"]):
        raise Skip("Feed I does not run on a local machine")
    if not relay() and not lab(s["URL"]):
        raise Skip("FEEDI_RELAY not set (never call the book directly)")
    client = Client(host("FEEDI_URL"), _http)
    pace = Pace(config.get("FEEDI_SPACING_SECS"), lambda path, accept="application/json": client.call(path, accept))
    client.open()
    return s, client, pace, time.monotonic() + config.get(budget_key)


def _coupons(pace, deadline, client, event_id, info, names) -> list[dict]:
    groups = _pull(pace, deadline, f"/bv_event_level/{LOCALE}/{client.brand}/coupon_groups/{client.sport_id}?event_id={event_id}", info)
    if os.environ.get("FEEDI_DEBUG"):
        print(f"DBG   groups raw={len(groups) if isinstance(groups, (list, dict)) else groups!r} kept={[g.get('name') for g in _groups(groups)][:12]} all={[g.get('name') for g in (groups.get('groups') if isinstance(groups, dict) else groups) or [] if isinstance(g, dict)][:25]}", file=sys.stderr)
    markets = []
    for g in _groups(groups):
        if names and not names.search(g.get("name") or ""):
            continue
        got = _pull(pace, deadline, f"/bv_event_level/{LOCALE}/{client.brand}/coupons/{event_id}/{g['id']}?period_id=0", info)
        if info.get("stopped") in ("time budget", "HTTP 429"):
            break
        markets.extend(_markets(got))
    return markets


def inplay(fetched_at: str) -> list[dict]:
    """Started matches only, for the minute snapshot. Not filed in the hourly book. `fetched_at` keeps the call shaped like `fetch`."""
    del fetched_at
    s, client, pace, deadline = _session("FEEDI_INPLAY_BUDGET_SECS")
    info: dict = {}
    board = _pull(pace, deadline, f"/bv_in_play/v3/{LOCALE}/{client.brand}/mini_inplay?sport_id={client.sport_id}", info)
    nodes, assume = _event_nodes(board), True
    dbg = bool(os.environ.get("FEEDI_DEBUG"))
    if dbg:
        print(f"DBG board type={type(board).__name__} keys={sorted(board)[:12] if isinstance(board, dict) else len(board or [])} nodes={len(nodes)} stopped={info.get('stopped')}", file=sys.stderr)
    if dbg and isinstance(board, dict):
        sp = board.get("sports")
        print(f"DBG board total={board.get('total_number_of_events')} sports_type={type(sp).__name__} sports_len={len(sp) if hasattr(sp, '__len__') else None}", file=sys.stderr)
        first = (sp[0] if isinstance(sp, list) and sp else (next(iter(sp.values())) if isinstance(sp, dict) and sp else None))
        print(f"DBG board first sport keys={sorted(first)[:20] if isinstance(first, dict) else type(first).__name__}", file=sys.stderr)
        if isinstance(first, dict):
            for k, v in first.items():
                if isinstance(v, list) and v and isinstance(v[0], dict):
                    print(f"DBG   {k}: len={len(v)} first_keys={sorted(v[0])[:20]}", file=sys.stderr)
                elif isinstance(v, dict):
                    print(f"DBG   {k}: dict keys={sorted(v)[:15]}", file=sys.stderr)
        el = board.get("slider_elements")
        print(f"DBG board slider_elements type={type(el).__name__} len={len(el) if hasattr(el, '__len__') else None} first={ (sorted(el[0]) if isinstance(el, list) and el and isinstance(el[0], dict) else None) }", file=sys.stderr)
    if not nodes and not info.get("stopped"):
        nodes, assume = _event_nodes(_pull(pace, deadline, _events_path(), info)), False
        if dbg:
            print(f"DBG events-listing nodes={len(nodes)} sample_keys={sorted(nodes[0])[:25] if nodes else []}", file=sys.stderr)
            if nodes:
                n0 = nodes[0]
                print(f"DBG node0 full={json.dumps(n0)[:700]}", file=sys.stderr)
                print(f"DBG node0 desc={n0.get('description')!r} info={n0.get('eventInformation')!r}"[:600], file=sys.stderr)
                print(f"DBG node0 metadata={str(n0.get('metadata'))[:400]}", file=sys.stderr)
                live = [n for n in nodes if isinstance(n.get('eventInformation'), dict) and n['eventInformation'].get('in_play')]
                print(f"DBG nodes with eventInformation.in_play={len(live)}", file=sys.stderr)
    out = []
    cap = config.get("FEEDI_INPLAY_MAX")
    for node in nodes:
        if len(out) >= cap or info.get("stopped") in ("time budget", "HTTP 429"):
            break
        detail = node if node.get("home_name") else _pull(pace, deadline, f"/bv_api/events/{LOCALE}/{node['id']}", info)
        if dbg and (not isinstance(detail, dict) or not detail.get("id")):
            shape = {k: (type(v).__name__ if not isinstance(v, (dict, list)) else f"{type(v).__name__}[{len(v)}]") for k, v in detail.items()} if isinstance(detail, dict) else None
            print(f"DBG detail skipped node={node.get('id')} type={type(detail).__name__} shape={shape} stopped={info.get('stopped')}", file=sys.stderr)
        if not isinstance(detail, dict) or not detail.get("id"):
            continue
        if dbg and not (isinstance(detail, dict) and detail.get("id")):
            print(f"DBG detail odd type={type(detail).__name__} keys={sorted(detail)[:25] if isinstance(detail, dict) else None} node_id={node.get('id')}", file=sys.stderr)
        if dbg:
            print(f"DBG event id={detail.get('id')} in_play={detail.get('in_play')} type={detail.get('event_type')} desc={detail.get('description')!r} comp={detail.get('competition_title')!r} start={detail.get('start_time')}", file=sys.stderr)
        if not detail.get("in_play") and not assume:
            continue
        markets = _coupons(pace, deadline, client, detail["id"], info, re.compile(r"players|innings", re.I))
        if dbg:
            print(f"DBG   markets={len(markets)} des_sample={[ (m.get('des'), m.get('st'), m.get('p')) for m in markets[:8]]}", file=sys.stderr)
        match = live_lines(detail, markets, s["NAME"])
        if match:
            out.append(match)
    return out


if __name__ == "__main__":
    from ..util import now_utc

    stamp = iso(now_utc())
    try:
        got_rows, raw = fetch(stamp)
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
        f" rows={len(got_rows)}"
        f" fancy={book.get('fancy')}"
        f" catalogue={book.get('catalogue')}"
        f" stopped={book.get('stopped')}"
    )
