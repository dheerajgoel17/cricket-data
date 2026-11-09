"""In-play lines from the books that list a match once it has started (Feed K and Feed E), in the shape the in-play snapshot keeps.

Read once a minute by `scripts/inplay_extra.py`; nothing here is filed in the pre-match book or the archive. Each match is `{home, away, league, kickoff, lines}`, and each line carries `book`, the
name that book is published under (from the environment, never code):
  {"kind": "team_runs", "team", "inn", "line", "over", "under"}   a side's innings total
  {"kind": "player_runs", "player", "line", "over", "under"}       a batter's runs in his innings
  {"kind": "ou", "market", "line", "over", "under"}                any other over / under line (runs in the first N overs, in an over, at the fall of a wicket ...)
  {"kind": "pick", "market", "outcomes": [{"label", "price"}]}      everything else with prices (next batter out, odd / even, method of dismissal ...)
Match winner style markets (match odds, draw no bet, double chance) are not props or fancy and are left out. A price is decimal, back only. A source that fails costs only itself.
"""
from __future__ import annotations

import datetime as dt
import re
import sys
import time
import urllib.parse

from . import config
from .adapters import feede, feedk
from .adapters.base import Pace
from .util import http_json, iso, parse_ts

MAX_EVENTS = 8      # started matches read per book
MAX_LINES = 120     # lines kept per match
BUDGET_SECS = 40.0  # one source's read stops after this long so the minute's run still ends in time
SKIP_MARKET = re.compile(r"^(match odds|match winner|draw no bet|double chance|team to lead|2-way match|to win the match|match betting)", re.I)
OVER_UNDER = re.compile(r"^(?P<side>over|under)\s*(?P<line>\d+(?:\.\d+)?)?$", re.I)
K_TEAM_TOTAL = re.compile(r"^Total Runs - (?P<side>Home|Away) Team, Innings (?P<inn>\d)$")
K_SIDE = re.compile(r"\b(Home|Away) Team\b")
E_TEAM_TOTAL = re.compile(r"^(?P<team>.+?) Over/Under (?P<line>\d+(?:\.\d+)?) Runs(?: (?P<inn>1st|2nd|3rd|4th) innings)?$")
E_PLAYER = re.compile(r"^(?P<p>.+?) - Over/Under (?P<line>\d+(?:\.\d+)?) Runs(?: (?P<inn>1st|2nd) innings)?$")
E_LINE = re.compile(r"\s*\bOver/Under (?P<line>\d+(?:\.\d+)?)\b")
INNINGS = {"1st": 1, "2nd": 2, "3rd": 3, "4th": 4}


def _round(x: float | None) -> float | None:
    return None if x is None else round(x, 3)


def _ou(kind: str, line: float, sides: dict[str, float], book: str, **extra) -> dict:
    return {"kind": kind, **extra, "line": line, "over": _round(sides.get("over")), "under": _round(sides.get("under")), "book": book}


def _pick(market: str, outcomes: list[tuple[str, float]], book: str) -> dict | None:
    outs = [{"label": lab, "price": _round(p)} for lab, p in outcomes[:12] if lab and p]
    return {"kind": "pick", "market": market, "outcomes": outs, "book": book} if outs else None


# ----------------------------------------------------------------------------------------------------------------------------------- Feed K
def k_lines(ev: dict, offers: list[dict], book: str) -> list[dict]:
    """The in-play lines of one started Feed K event from its bet offers."""
    home, away = ev.get("homeName") or "", ev.get("awayName") or ""
    out: list[dict] = []
    for offer in offers:
        label = feedk._label(offer)
        if not label or SKIP_MARKET.match(label):
            continue
        outs = [(o, feedk._price(o)) for o in offer.get("outcomes") or []]
        outs = [(o, p) for o, p in outs if p is not None]
        if not outs:
            continue
        sides: dict[str, float] = {}
        line = None
        for o, p in outs:
            m = OVER_UNDER.match((o.get("englishLabel") or o.get("label") or "").strip())
            if not m:
                sides = {}
                break
            ln = float(m["line"]) if m["line"] else (float(o["line"]) / 1000.0 if o.get("line") not in (None, "") else None)
            if ln is None or (line is not None and ln != line):
                sides = {}
                break
            line = ln
            sides[m["side"].lower()] = p
        if sides and line is not None:
            tt = K_TEAM_TOTAL.match(label)
            player = next((o.get("participant") for o, _ in outs if o.get("participant")), None)
            if tt:
                out.append(_ou("team_runs", line, sides, book, team=home if tt["side"] == "Home" else away, inn=int(tt["inn"])))
            elif player and "total runs" in label.lower():
                out.append(_ou("player_runs", line, sides, book, player=player))
            else:
                name = K_SIDE.sub(lambda m: home if m.group(1) == "Home" else away, label)
                out.append(_ou("ou", line, sides, book, market=f"{name} - {player}" if player else name))
            continue
        name = K_SIDE.sub(lambda m: home if m.group(1) == "Home" else away, label)
        pick = _pick(name, [((o.get("participant") or o.get("englishLabel") or o.get("label") or "").strip(), p) for o, p in outs], book)
        if pick:
            out.append(pick)
    return out[:MAX_LINES]


def k_matches(now: dt.datetime) -> list[dict]:
    from cricket_data.hosts import host

    base = host("FEEDK_URL")
    accounts = feedk.books()
    pace = Pace(config.get("FEEDK_SPACING_SECS"), lambda u: http_json(u, retries=0)[0])
    deadline = time.monotonic() + BUDGET_SECS
    out = []
    for aid, name in accounts.items():
        try:
            listing = pace.get(f"{base}/{aid}/listView/cricket.json?{feedk.QS}&useCombined=true&ncid={int(time.time() * 1000)}")
        except Exception as e:  # one book failing never costs the others
            print(f"inplay K {type(e).__name__}", file=sys.stderr)
            continue
        started = [e["event"] for e in listing.get("events") or [] if (e.get("event") or {}).get("state") == "STARTED"]
        for ev in started[:MAX_EVENTS]:
            if time.monotonic() > deadline:
                break
            try:
                j = pace.get(f"{base}/{aid}/betoffer/event/{ev['id']}.json?{feedk.QS}&includeParticipants=true&ncid={int(time.time() * 1000)}")
            except Exception as e:
                print(f"inplay K {type(e).__name__}", file=sys.stderr)
                break
            full = j.get("events", [ev])[0] if j.get("events") else ev
            lines = k_lines(full, j.get("betOffers") or [], name)
            if lines and full.get("homeName") and full.get("awayName"):
                comp = " / ".join(p.get("englishName") or p.get("name") or "" for p in (full.get("path") or [])[1:])
                out.append({"home": full["homeName"], "away": full["awayName"], "league": comp, "kickoff": iso(parse_ts(full["start"])) if full.get("start") else None, "lines": lines})
    return out


# ----------------------------------------------------------------------------------------------------------------------------------- Feed E
def e_lines(ev: dict, book: str) -> list[dict]:
    """The in-play lines of one started Feed E event with its markets."""
    out: list[dict] = []
    for m in (c["market"] for c in ev.get("children") or [] if "market" in c):
        name = (m.get("name") or "").strip()
        if m.get("marketStatusCode") != "A" or not name or SKIP_MARKET.match(name):
            continue
        outs = [(o, feede._price(o)) for o in feede._outcomes(m)]
        outs = [(o, p) for o, p in outs if p is not None]
        if not outs:
            continue
        px = {s: p for o, p in outs if (s := {"over": "over", "under": "under"}.get(re.split(r"[\s(-]+", (o.get("name") or "").strip().lower())[0]))}
        tpl = m.get("templateMarketName") or ""
        if px and E_LINE.search(name):
            pm, tm = E_PLAYER.match(name), E_TEAM_TOTAL.match(name)
            if pm and tpl == "Batsman Runs":
                out.append(_ou("player_runs", float(pm["line"]), px, book, player=pm["p"]))
            elif tm and tpl.endswith("Team Innings Runs"):
                out.append(_ou("team_runs", float(tm["line"]), px, book, team=tm["team"], inn=INNINGS.get(tm["inn"] or "", 1)))
            else:
                ln = float(E_LINE.search(name)["line"])
                out.append(_ou("ou", ln, px, book, market=E_LINE.sub("", name).strip()))
            continue
        pick = _pick(name, [((o.get("name") or "").strip(), p) for o, p in outs], book)
        if pick:
            out.append(pick)
    return out[:MAX_LINES]


def e_matches(now: dt.datetime) -> list[dict]:
    configured = feede.books()
    pace = Pace(config.get("FEEDE_SPACING_SECS"), lambda u: http_json(u, retries=0)[0])
    deadline = time.monotonic() + BUDGET_SECS
    out = []
    for bid, (name, root) in configured.items():
        flt = ["event.categoryCode:equals:CRICKET", "event.eventSortCode:equals:MTCH", "event.isStarted:isTrue", "event.siteChannels:contains:M"]
        try:
            listing = pace.get(f"{root}/Event?" + "&".join("simpleFilter=" + urllib.parse.quote(f, safe=":") for f in flt) + f"&{feede.QS}")
        except Exception as e:
            print(f"inplay E {type(e).__name__}", file=sys.stderr)
            continue
        evs = [c["event"] for c in (listing.get("SSResponse") or {}).get("children") or [] if "event" in c and c["event"].get("eventStatusCode") == "A" and " v " in (c["event"].get("name") or "")]
        for stub in evs[:MAX_EVENTS]:
            if time.monotonic() > deadline:
                break
            try:
                j = pace.get(f"{root}/EventToOutcomeForEvent/{stub['id']}?{feede.QS}")
            except Exception as e:
                print(f"inplay E {type(e).__name__}", file=sys.stderr)
                break
            full = next((c["event"] for c in (j.get("SSResponse") or {}).get("children") or [] if "event" in c), None)
            if not full:
                continue
            home, away = feede.split_name(full.get("name") or "")
            lines = e_lines(full, name)
            if home and away and lines:
                out.append({"home": home, "away": away, "league": full.get("typeName") or "", "kickoff": iso(parse_ts(full["startTime"])) if full.get("startTime") else None, "lines": lines})
    return out


def all_matches(now: dt.datetime) -> tuple[list[dict], dict[str, int]]:
    """Every started match these books list, and how many each source gave (a source that is not configured or fails gives 0)."""
    matches, counts = [], {}
    for key, fn in (("feedk", k_matches), ("feede", e_matches)):
        try:
            got = fn(now)
        except Exception as e:  # not configured, or down: this source gives nothing, the others carry on
            print(f"inplay {key} skipped: {type(e).__name__}", file=sys.stderr)
            got = []
        counts[key] = len(got)
        matches += got
    return matches, counts
