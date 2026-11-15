"""Feed I: player and match prices from a public, login-free sportsbook (guest LineFeed / LiveFeed JSON).

The book and its host are deployment configuration, never code (docs/OPERATIONS.md): ``FEEDI_URL`` is the sportsbook root and
``FEEDI_NAME`` is the name its prices are published under. Optional ``FEEDI_PARTNER`` is the partner id its guest calls send.
Unset URL/NAME, the source is skipped. It never runs on a laptop: ``fetch`` raises ``Skip`` unless ``GITHUB_ACTIONS`` is set
(tests use ``*.invalid`` hosts only). On GitHub it always goes through the Cloudflare Worker relay (``FEEDH_RELAY`` /
``FEEDH_RELAY_KEY``, or Feed G's pair); there is no direct call. Polite: one sports listing, then every in-horizon game
``FEEDI_SPACING_SECS`` apart, one attempt each; a 429 ends the run and ``FEEDI_BUDGET_SECS`` stops new pages.

Guest paths are ``/service-api/LineFeed/...`` (pre-match) and ``/service-api/LiveFeed/...`` (in-play). Rows are the player
markets the other books already map when the book's English market names match: player runs / sixes / fours / wickets
over/unders, "to score N", player performance (fantasy points: 1/20/10/25), and match / team totals as ``fancy``. Match
winner / 1x2 is never a row. A Test's unscoped player line is catalogue-only unless an innings is named.

In-play lines for started matches are read by ``inplay_extra`` (never filed in ``book_lines.json`` or the archive). Markets
the book only lists once a match has started stay on that path.
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

NAME = "feedi"
AUTO = True
SOURCE = "feedi_d"
CRIC_SPORT = 85  # this feed family's cricket sport id
SKIP_COMP = re.compile(r"virtual|simulated|electronic|\bsrl\b|long term|futures", re.I)
WOMEN = re.compile(r"women|wbbl|\(w\)", re.I)
MULTI_DAY = re.compile(r"\btests?\b|ashes|shield|first.class|championship|ranji", re.I)
TEST = re.compile(r"\btests?\b|ashes", re.I)
INNINGS = re.compile(r"\b(1st|2nd|first|second)\s+innings?\b", re.I)
COMBO = re.compile(r"\band\b|\+", re.I)
INN_WORD = r"(?:in\s+)?(?P<n>1st|2nd|first|second)\s+innings?"
INNINGS_LEAD = re.compile(rf"^\s*{INN_WORD}\s*[-:]\s*", re.I)
INNINGS_TAIL = re.compile(rf"\s*[-:(]?\s*{INN_WORD}\)?\s*$", re.I)
INNINGS_NO = {"1st": 1, "first": 1, "2nd": 2, "second": 2}
WINNER = re.compile(
    r"^(1x2|match odds|match winner|draw no bet|double chance|to win the match|match betting|winner|result)\b",
    re.I,
)

# Player O/U — English market titles this family uses (probe may add more; keep catalogue of unknowns).
BATSMAN_RUNS = re.compile(
    r"^(?:(?:total\s+)?(?:player|batsman|batter)\s+(?:total\s+)?runs|runs\s+by\s+batsman|"
    r"individual\s+(?:batsman|batter|player)\s+runs)(?:\s*[-:]\s*|\s+)(?P<p>.+)$",
    re.I,
)
BATSMAN_SIXES = re.compile(
    r"^(?:(?:total\s+)?(?:player|batsman|batter)\s+(?:total\s+)?sixes|sixes\s+by\s+batsman)"
    r"(?:\s*[-:]\s*|\s+)(?P<p>.+)$",
    re.I,
)
BATSMAN_FOURS = re.compile(
    r"^(?:(?:total\s+)?(?:player|batsman|batter)\s+(?:total\s+)?fours|fours\s+by\s+batsman)"
    r"(?:\s*[-:]\s*|\s+)(?P<p>.+)$",
    re.I,
)
BOWLER_WICKETS = re.compile(
    r"^(?:(?:total\s+)?(?:player|bowler)\s+(?:total\s+)?wickets|wickets\s+by\s+bowler)"
    r"(?:\s*[-:]\s*|\s+)(?P<p>.+)$",
    re.I,
)
PERFORMANCE = re.compile(
    r"^(?:player\s+performance|fantasy\s+points|player\s+points)(?:\s*[-:]\s*|\s+)(?P<p>.+)$",
    re.I,
)
# Subgame form: market is just "Total" / "Total runs" under a player-named subgame.
SUB_RUNS = re.compile(r"^(?:total(?:\s+runs)?|runs)$", re.I)
SUB_SIXES = re.compile(r"^(?:total\s+)?sixes$", re.I)
SUB_FOURS = re.compile(r"^(?:total\s+)?fours$", re.I)
SUB_WICKETS = re.compile(r"^(?:total\s+)?wickets$", re.I)
SUB_POINTS = re.compile(r"^(?:player\s+performance|fantasy\s+points|points)$", re.I)
TO_SCORE = re.compile(
    r"^(?:to\s+score\s+(?P<n>\d+)|(?P<p2>.+?)\s+to\s+score\s+(?P<n2>\d+)|"
    r"will\s+(?P<p3>.+?)\s+score\s+(?P<n3>\d+))\s*(?:runs)?(?:\s*[-:]\s*(?P<p>.+))?$",
    re.I,
)
PLAYER_OU = (
    (BATSMAN_RUNS, "batter_runs"),
    (BATSMAN_SIXES, "batter_sixes"),
    (BATSMAN_FOURS, "batter_fours"),
    (BOWLER_WICKETS, "bowler_wickets"),
    (PERFORMANCE, "player_points"),
)
SUB_OU = (
    (SUB_RUNS, "batter_runs"),
    (SUB_SIXES, "batter_sixes"),
    (SUB_FOURS, "batter_fours"),
    (SUB_WICKETS, "bowler_wickets"),
    (SUB_POINTS, "player_points"),
)

TEAM_TOTAL = re.compile(r"^(?:total\s+(?:runs\s+)?(?:\([^)]*\)\s*)?|team\s+total(?:\s+runs)?)\s*[-:]\s*(?P<team>.+)$", re.I)
TEAM_FOURS = re.compile(r"^(?:total\s+fours)\s*[-:]\s*(?P<team>.+)$", re.I)
TEAM_SIXES = re.compile(r"^(?:total\s+sixes)\s*[-:]\s*(?P<team>.+)$", re.I)
MATCH_FOURS = re.compile(r"^(?:total\s+fours|match\s+fours)$", re.I)
MATCH_SIXES = re.compile(r"^(?:total\s+sixes|match\s+sixes)$", re.I)
MATCH_RUNS = re.compile(r"^(?:(?:match\s+)?total\s+runs|total)$", re.I)
FIRST_INNINGS = re.compile(r"^(?:first\s+innings\s+total(?:\s+runs)?|1st\s+innings\s+total(?:\s+runs)?)$", re.I)
AFTER_N = re.compile(
    r"^(?:total\s+runs\s+after\s+(?P<n>\d+)\s+overs|runs\s+in\s+(?:the\s+)?first\s+(?P<n2>\d+)\s+overs)"
    r"(?:\s*[-:]\s*(?P<team>.+))?$",
    re.I,
)
TOP_SCORE = re.compile(r"^(?:top\s+(?:batter|batsman)\s+total|highest\s+(?:individual\s+)?score)$", re.I)
HIGHEST_OVER = re.compile(r"^(?:(?:total\s+in\s+)?(?:the\s+)?highest\s+scoring\s+over|highest\s+over)$", re.I)
TEAM_HIGHEST = re.compile(
    r"^(?:(?:total\s+in\s+)?(?:the\s+)?highest\s+scoring\s+over)\s*[-:]\s*(?P<team>.+)$", re.I
)
TOP_TEAM = re.compile(r"^top\s+(?P<who>batsman|batter|bowler)\s*[-:]\s*(?P<team>.+)$", re.I)
TOP_MATCH = re.compile(r"^top\s+(?P<who>batsman|batter|bowler)$", re.I)
TOP_MT = {
    "batsman": ("top_batter_team", "top_batter_match"),
    "batter": ("top_batter_team", "top_batter_match"),
    "bowler": ("top_bowler_team", "top_bowler_match"),
}
OU_SIDE = re.compile(r"^(over|under|yes|no)\b", re.I)


class Skip(Exception):
    pass


def settings() -> dict[str, str]:
    """The deployment's FEEDI_URL and FEEDI_NAME; empty if the source is not configured."""
    url = os.environ.get("FEEDI_URL", "").strip().rstrip("/")
    name = os.environ.get("FEEDI_NAME", "").strip()
    return {"URL": url, "NAME": name} if url.startswith("http") and name else {}


def published() -> dict[str, str]:
    """{source key: the name it is published under}: ``booklines.public`` swaps the first for the second."""
    s = settings()
    return {SOURCE: s["NAME"]} if s else {}


def partner() -> str:
    """Optional partner id the guest calls send (deployment secret ``FEEDI_PARTNER``)."""
    return os.environ.get("FEEDI_PARTNER", "").strip()


def relay() -> tuple[str, str] | None:
    """Primary hop: FEEDH_RELAY / FEEDH_RELAY_KEY, else Feed G's pair."""
    addr = os.environ.get("FEEDH_RELAY", "").strip() or os.environ.get("FEEDG_RELAY", "").strip()
    key = os.environ.get("FEEDH_RELAY_KEY", "").strip() or os.environ.get("FEEDG_RELAY_KEY", "").strip()
    return (addr, key) if addr.startswith("https://") and key else None


def relay_targets() -> list[tuple[str, str]]:
    """Worker first, then Feed G's Vercel bom1 and optional alt — same dual-hop as Feed G on a Cloudflare challenge."""
    out: list[tuple[str, str]] = []
    seen: set[str] = set()

    def add(addr: str, key: str):
        addr, key = addr.strip(), key.strip()
        if addr.startswith("https://") and key and addr not in seen:
            seen.add(addr)
            out.append((addr, key))

    if primary := relay():
        add(*primary)
    add(os.environ.get("FEEDG_RELAY", ""), os.environ.get("FEEDG_RELAY_KEY", ""))
    add(
        os.environ.get("FEEDG_RELAY_ALT", ""),
        os.environ.get("FEEDG_RELAY_ALT_KEY", "") or os.environ.get("FEEDG_RELAY_KEY", "") or (out[0][1] if out else ""),
    )
    return out


def lab(url: str) -> bool:
    h = urllib.parse.urlparse(url).hostname or ""
    return h.endswith(".invalid") or h in ("localhost", "127.0.0.1")


def on_runner() -> bool:
    return os.environ.get("GITHUB_ACTIONS") == "true"


def _http_body(err: urllib.error.HTTPError) -> str:
    try:
        text = (err.read() or b"").decode("utf-8", "replace").strip()
    except Exception:
        return ""
    low = text[:400].lower()
    if "host not allowed" in low:
        return text.split("\n", 1)[0][:240]
    if "<!doctype html" in low or "just a moment" in low or "cf-browser-verification" in low or "cdn-cgi/challenge" in low:
        return "cloudflare challenge from the book (tried Mumbai hops)"
    return text[:240]


def _is_challenge(detail: str) -> bool:
    return "cloudflare challenge" in (detail or "").lower()


def _relay_headers(url: str, key: str) -> dict[str, str]:
    host_name = urllib.parse.urlparse(url).hostname or ""
    origin = f"https://{host_name}" if host_name else ""
    return {
        "x-relay-key": key,
        "x-relay-origin": origin,
        "x-relay-referer": f"{origin}/",
    }


def request(url: str):
    """One GET through free Mumbai hops (Worker, then Vercel bom1 / alt). Direct only for test hosts. A laptop never reaches a real book."""
    if not on_runner() and not lab(url):
        raise Skip("Feed I does not run on a local machine")
    targets = relay_targets()
    if not targets:
        if lab(url):
            return http_json(url, retries=0)[0]
        raise Skip("FEEDH_RELAY not set (never call the book directly)")
    last: urllib.error.HTTPError | None = None
    for i, (addr, key) in enumerate(targets):
        try:
            return http_json(
                f"{addr}?u={urllib.parse.quote(url, safe='')}",
                headers=_relay_headers(url, key),
                retries=0,
            )[0]
        except urllib.error.HTTPError as e:
            detail = _http_body(e)
            last = urllib.error.HTTPError(e.url, e.code, detail or e.reason, e.hdrs, None)
            if i + 1 < len(targets) and (_is_challenge(detail) or e.code in (403, 503)):
                continue
            raise last from e
    if last is None:
        raise Skip("FEEDH_RELAY not set (never call the book directly)")
    raise last


def flip(name: str) -> str:
    """\"Last, First\" as the history stores it (\"First Last\"); a name with no comma is left alone."""
    last, comma, first = (name or "").partition(", ")
    return person(last, first) if comma else (name or "").strip()


def strip_innings(name: str) -> tuple[str, int | None]:
    inn = None
    for rx in (INNINGS_LEAD, INNINGS_TAIL):
        m = rx.search(name)
        if m:
            inn = inn or INNINGS_NO[m["n"].lower()]
            name = rx.sub("", name, count=1)
    return name.strip(), inn


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
    d = {"lng": "en", "gr": "70", "mode": "4", **extra}
    p = partner()
    if p:
        d["partner"] = p
    return urllib.parse.urlencode({k: v for k, v in d.items() if v is not None and v != ""})


def linefeed(base: str, path: str, **extra) -> str:
    return f"{base}/service-api/LineFeed/{path}?{_qs(**extra)}"


def livefeed(base: str, path: str, **extra) -> str:
    return f"{base}/service-api/LiveFeed/{path}?{_qs(**extra)}"


def _coef(o: dict) -> float | None:
    try:
        p = float(o.get("C") if o.get("C") is not None else o.get("coef") or o.get("price"))
    except (TypeError, ValueError):
        return None
    return decimal_ok(p)


def _param(o: dict) -> float | None:
    for k in ("P", "p", "line", "param"):
        if o.get(k) is None or o.get(k) == "":
            continue
        try:
            return float(o[k])
        except (TypeError, ValueError):
            continue
    return None


def _outcome_label(o: dict) -> str:
    return str(o.get("N") or o.get("name") or o.get("l") or "").strip()


def _ou_from_outcomes(outcomes: list[dict]) -> tuple[float, dict[str, float]] | None:
    """-> (line, {over, under}) from LineFeed outcome rows (T=1/2 or Over/Under labels)."""
    line, sides = None, {}
    for o in outcomes:
        p = _coef(o)
        if p is None:
            continue
        lab = _outcome_label(o).lower()
        t = o.get("T")
        side = None
        if lab.startswith("over") or lab == "yes" or t in (1, "1", 7, "7"):
            side = "over"
        elif lab.startswith("under") or lab == "no" or t in (2, "2", 8, "8"):
            side = "under"
        elif OU_SIDE.match(lab):
            side = "over" if OU_SIDE.match(lab).group(1).lower() in ("over", "yes") else "under"
        if not side:
            return None
        ln = _param(o)
        if ln is None and OU_SIDE.match(_outcome_label(o)):
            m = re.search(r"(\d+(?:\.\d+)?)", _outcome_label(o))
            ln = float(m.group(1)) if m else None
        if ln is None:
            return None
        if line is not None and ln != line:
            return None
        line, sides[side] = ln, p
    return (line, sides) if line is not None and "over" in sides and "under" in sides else None


def _named_from_outcomes(outcomes: list[dict]) -> list[tuple[str, float]]:
    out = []
    for o in outcomes:
        n, p = _outcome_label(o), _coef(o)
        if n and p is not None and not OU_SIDE.match(n):
            out.append((n, p))
    return out


def _flatten_ge(ge) -> list[tuple[str, list[dict]]]:
    """[(market_name, outcomes)] from a LineFeed GE block (grouped or flat)."""
    out = []
    for g in ge or []:
        name = str(g.get("N") or g.get("name") or g.get("GN") or "").strip()
        if not name and g.get("G") is not None:
            name = f"G{g.get('G')}"
        raw_e = g.get("E") or []
        # E is often a list of lists of outcomes (one list per line).
        if raw_e and isinstance(raw_e[0], list):
            for bucket in raw_e:
                outs = [x for x in bucket if isinstance(x, dict)]
                if outs:
                    out.append((name, outs))
        else:
            outs = [x for x in raw_e if isinstance(x, dict)]
            if outs:
                out.append((name, outs))
    return out


def iter_game_blocks(value: dict) -> list[tuple[str | None, dict]]:
    """[(player_or_None, game_dict)] for the main game and each subgame (player props)."""
    if not isinstance(value, dict):
        return []
    blocks = [(None, value)]
    for sg in value.get("SG") or value.get("subGames") or []:
        if not isinstance(sg, dict):
            continue
        pname = str(sg.get("PN") or sg.get("N") or sg.get("TG") or sg.get("O1E") or sg.get("O1") or "").strip() or None
        blocks.append((pname, sg))
    return blocks


def markets_of(value: dict) -> list[dict]:
    """Normalised markets: {name, player, outcomes, raw_name} for parse_game."""
    out = []
    for player, block in iter_game_blocks(value):
        for name, outcomes in _flatten_ge(block.get("GE") or block.get("markets") or []):
            out.append({"name": name, "player": player, "outcomes": outcomes, "raw_name": name})
    return out


def _sides(value: dict) -> tuple[str | None, str | None]:
    home = str(value.get("O1E") or value.get("O1") or value.get("home") or "").strip() or None
    away = str(value.get("O2E") or value.get("O2") or value.get("away") or "").strip() or None
    return home, away


def _competition(value: dict) -> str:
    return str(value.get("L") or value.get("LE") or value.get("league") or value.get("championship") or "").strip()


def _start(value: dict) -> str | None:
    s = value.get("S") or value.get("start") or value.get("kickoff")
    if s is None:
        return None
    if isinstance(s, (int, float)):
        return iso(dt.datetime.fromtimestamp(int(s), tz=dt.timezone.utc))
    return iso(parse_ts(s))


def _cat(common: dict, name: str, player, team, line, over, under, mapped) -> dict:
    return {
        "match": common["match"], "home": common["team_a"], "away": common["team_b"],
        "start_utc": common["start_utc"], "competition": common["competition"], "fmt": common.get("fmt"),
        "source": common["source"], "kind": "bookmaker", "name": name, "player": player, "team": team,
        "line": line, "over": over, "under": under, "mapped": mapped,
    }


def parse_game(value: dict, src: str, fetched_at: str, *, in_play: bool = False) -> tuple[list[dict], list[dict], list[dict], Counter]:
    """(player rows, fancy lines, catalogue rows, names left out) of one cricket game / live event."""
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
    eid = str(value.get("I") or value.get("id") or value.get("CI") or "")
    common = dict(
        source=src, source_type="bookmaker", event_id=eid, match=f"{home} vs {away}",
        team_a=home, team_b=away, gender_hint=female, competition=competition or None,
        start_utc=start, in_play=bool(in_play), fetched_at=fetched_at, fmt=fmt,
    )
    rows, fancy, catalogue, left = [], [], [], Counter()

    def add_ou(name, player, team, mapped, mt=None, fancy_key=None, scope="match", inn=None, ms_scope=None, outcomes=None, inn_hint=None):
        got = _ou_from_outcomes(outcomes or [])
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
            fancy.append({
                "match": common["match"], "home": home, "away": away, "start_utc": start, "fmt": fmt,
                "competition": competition, "key": fancy_key, "scope": scope, "team": team,
                "line": line, "over": ov, "under": un, "source": src, "kind": "bookmaker",
                **({"inn": inn} if inn else {}),
            })
            return
        if in_play:
            return  # in-play player O/U go through inplay_extra, not book_lines
        gk = f"{src}:{eid}:{name}:{player}:{line}"
        for side, price in (("over", ov), ("under", un)):
            rows.append(row(**{k: v for k, v in common.items() if k != "fmt"}, market_type=mt, market_raw=name,
                            group_key=gk, selection=f"{player} {side} {line}" if player else name,
                            player=player, team=team, line=line, side=side, back=price, inn=inn,
                            ms_scope=ms_scope, inn_hint=inn_hint))

    for mkt in markets_of(value):
        raw_name = (mkt.get("raw_name") or "").strip()
        name, inn_hint = strip_innings(raw_name)
        sub_player = flip(mkt["player"]) if mkt.get("player") else None
        if not name or WINNER.match(name):
            if name:
                catalogue.append(_cat(common, name, sub_player, None, None, None, None, None))
            continue
        outcomes = mkt.get("outcomes") or []

        # Subgame: short market name under a player
        if sub_player and not COMBO.search(sub_player):
            hit = False
            for rx, mt in SUB_OU:
                if rx.match(name):
                    if multi and not inn_hint and not INNINGS.search(raw_name):
                        add_ou(f"{name} - {sub_player}", sub_player, None, None, outcomes=outcomes, inn_hint=inn_hint)
                    else:
                        add_ou(f"{name} - {sub_player}", sub_player, None, mt, mt=mt, outcomes=outcomes, inn_hint=inn_hint,
                               inn=inn_hint)
                    hit = True
                    break
            if hit:
                continue

        player_ou = False
        for rx, mt in PLAYER_OU:
            mm = rx.match(name)
            if mm and not COMBO.search(mm["p"]):
                pl = flip(mm["p"])
                if multi and not inn_hint and not INNINGS.search(raw_name):
                    add_ou(name, pl, None, None, outcomes=outcomes, inn_hint=inn_hint)
                else:
                    add_ou(name, pl, None, mt, mt=mt, outcomes=outcomes, inn_hint=inn_hint, inn=inn_hint)
                player_ou = True
                break
        if player_ou:
            continue

        if mm := TO_SCORE.match(name):
            n = mm.group("n") or mm.group("n2") or mm.group("n3")
            pl = flip(mm.group("p") or mm.group("p2") or mm.group("p3") or sub_player or "")
            if n and pl and not COMBO.search(pl):
                line = int(n) - 0.5
                add_ou(name, pl, None, "batter_milestone", mt="batter_milestone", ms_scope="match",
                       outcomes=outcomes, inn_hint=inn_hint)
                for r in rows[-2:]:
                    if r.get("market_type") == "batter_milestone" and r.get("player") == pl:
                        r["line"], r["ms_scope"] = line, "match"
                        r["selection"] = f"{pl} {int(line + 0.5)}+ {'yes' if r['side'] == 'over' else 'no'}"
                continue

        if (mm := TOP_TEAM.match(name)) or (mm := TOP_MATCH.match(name)):
            who = mm["who"].lower()
            team_mt, match_mt = TOP_MT[who]
            team = mm.groupdict().get("team")
            mt = team_mt if team else match_mt
            for pname, price in _named_from_outcomes(outcomes):
                pl = flip(pname)
                catalogue.append(_cat(common, name, pl, team, None, price, None, mt))
                if not in_play:
                    rows.append(row(**{k: v for k, v in common.items() if k != "fmt"}, market_type=mt, market_raw=name,
                                    group_key=f"{src}:{eid}:{name}", selection=pl, player=pl, team=team,
                                    back=price, inn_hint=inn_hint))
            continue

        fancy_mapped = None
        fancy_key = scope = team = None
        inn = inn_hint
        if MATCH_RUNS.match(name) and not TEAM_TOTAL.match(name):
            fancy_mapped, fancy_key, scope = "match_runs", "match_runs", "match"
        elif mm := TEAM_TOTAL.match(name):
            fancy_mapped, fancy_key, scope, team = "team_total_runs", "team_total_runs", "team", mm["team"].strip()
        elif MATCH_FOURS.match(name):
            fancy_mapped, fancy_key, scope = "match_fours", "match_fours", "match"
        elif mm := TEAM_FOURS.match(name):
            fancy_mapped, fancy_key, scope, team = "team_total_fours", "team_total_fours", "team", mm["team"].strip()
        elif MATCH_SIXES.match(name):
            fancy_mapped, fancy_key, scope = "match_sixes", "match_sixes", "match"
        elif mm := TEAM_SIXES.match(name):
            fancy_mapped, fancy_key, scope, team = "team_total_sixes", "team_total_sixes", "team", mm["team"].strip()
        elif FIRST_INNINGS.match(name):
            fancy_mapped, fancy_key, scope, inn = "first_innings_runs", "first_innings_runs", "match", 1
        elif TOP_SCORE.match(name):
            fancy_mapped, fancy_key, scope = "top_score", "top_score", "match"
        elif mm := TEAM_HIGHEST.match(name):
            fancy_mapped, fancy_key, scope, team = "team_total_highest_over", "team_total_highest_over", "team", mm["team"].strip()
        elif HIGHEST_OVER.match(name):
            fancy_mapped, fancy_key, scope = "highest_over", "highest_over", "match"
        elif mm := AFTER_N.match(name):
            n = int(mm.group("n") or mm.group("n2"))
            team = (mm.group("team") or "").strip() or None
            fancy_mapped = fancy_key = f"overs_{n}"
            scope = "team" if team else "match"

        if fancy_mapped:
            add_ou(name, None, team, fancy_mapped, fancy_key=fancy_key, scope=scope, inn=inn,
                   outcomes=outcomes, inn_hint=inn_hint)
            continue

        # Unknown: catalogue only (Feed H pattern) so a later mapping can use archived names.
        got = _ou_from_outcomes(outcomes)
        if got:
            line, px = got
            catalogue.append(_cat(common, name, sub_player, None, line, round(px["over"], 3), round(px["under"], 3), None))
        else:
            named = _named_from_outcomes(outcomes)
            if named:
                catalogue.append(_cat(common, name, sub_player, None, None, named[0][1], None, None))
            else:
                left[name] += 1
                catalogue.append(_cat(common, name, sub_player, None, None, None, None, None))

    return rows, fancy, catalogue, left


def _listing_events(payload) -> list[dict]:
    """Flatten Get1x2_VZip / GetChampZip-style payloads into event stubs with I, O1, O2, S, L."""
    out = []
    if not isinstance(payload, dict):
        return out
    value = payload.get("Value")
    if isinstance(value, list):
        for block in value:
            if not isinstance(block, dict):
                continue
            league = str(block.get("L") or block.get("LE") or block.get("N") or "").strip()
            for ev in block.get("E") or block.get("G") or []:
                if isinstance(ev, dict) and (ev.get("I") or ev.get("CI")):
                    if league and not ev.get("L"):
                        ev = {**ev, "L": league}
                    out.append(ev)
            if block.get("I") and (block.get("O1") or block.get("O1E")):
                out.append(block)
    elif isinstance(value, dict):
        if value.get("I"):
            out.append(value)
        for ev in value.get("E") or []:
            if isinstance(ev, dict):
                out.append(ev)
    return out


def fetch(fetched_at: str):
    s = settings()
    if not s:
        raise Skip("FEEDI_URL / FEEDI_NAME not set")
    if not on_runner() and not lab(s["URL"]):
        raise Skip("Feed I does not run on a local machine")
    if not relay() and not lab(s["URL"]):
        raise Skip("FEEDH_RELAY not set (never call the book directly)")
    base = host("FEEDI_URL") if not lab(s["URL"]) else s["URL"]
    # tests pass FEEDI_URL as *.invalid; host() would require env — use settings URL for lab
    if lab(s["URL"]):
        base = s["URL"]
    pace = Pace(config.get("FEEDI_SPACING_SECS"), lambda u: request(u))
    deadline = time.monotonic() + config.get("FEEDI_BUDGET_SECS")
    now, horizon = parse_ts(fetched_at), parse_ts(fetched_at) + dt.timedelta(hours=config.get("FEEDI_HORIZON_HOURS"))
    info: dict = {"events": 0, "rows": 0, "fancy": 0, "catalogue": 0, "left_out": Counter()}
    rows: list[dict] = []
    fancy_rows: list[dict] = []
    catalogue: list[dict] = []

    listing = pace.get(linefeed(base, "Get1x2_VZip", sports=str(CRIC_SPORT), count="100", tf="2200000", tz="330"))
    stubs = _listing_events(listing if isinstance(listing, dict) else {})
    info["listed"] = len(stubs)
    games = []
    for ev in stubs:
        if SKIP_COMP.search(_competition(ev)):
            continue
        st = _start(ev)
        ts = parse_ts(st) if st else None
        if not ts or ts <= now or ts > horizon:
            continue
        eid = ev.get("I") or ev.get("CI")
        if eid:
            games.append(int(eid))
    cap = config.get("FEEDI_MAX_EVENTS")
    if cap > 0:
        games = games[:cap]

    for eid in games:
        if time.monotonic() > deadline:
            info["stopped"] = "time budget"
            break
        try:
            got = pace.get(linefeed(
                base, "GetGameZip", id=str(eid), isSubGames="true", GroupEvents="true",
                countevents="250", grMode="4",
            ))
        except urllib.error.HTTPError as e:
            if e.code == 429:
                info["stopped"] = "HTTP 429"
                break
            info["stopped"] = f"HTTP {e.code}"
            continue
        value = (got or {}).get("Value") if isinstance(got, dict) else None
        if not isinstance(value, dict):
            continue
        # Started / live games are not pre-match: leave them to inplay_extra.
        if value.get("S") and parse_ts(_start(value) or "") and parse_ts(_start(value)) <= now:
            continue
        if str(value.get("SS") or "").strip() and value.get("SC") not in (None, 0, "0"):
            # some feeds set a score string once live
            pass
        r, fx, cat, left = parse_game(value, SOURCE, fetched_at, in_play=False)
        if not r and not fx and not cat:
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


LIVE_SKIP = re.compile(
    r"^(match odds|match winner|draw no bet|double chance|team to lead|2-way match|to win the match|match betting)",
    re.I,
)
MAX_LIVE_EVENTS = 14
MAX_LIVE_LINES = 120
LIVE_BUDGET_SECS = 40.0


def _live_ou(kind: str, line: float, sides: dict[str, float], book: str, **extra) -> dict:
    return {
        "kind": kind, **extra, "line": line,
        "over": None if sides.get("over") is None else round(sides["over"], 3),
        "under": None if sides.get("under") is None else round(sides["under"], 3),
        "book": book,
    }


def _live_pick(market: str, outcomes: list[tuple[str, float]], book: str) -> dict | None:
    outs = [{"label": lab, "price": round(p, 3)} for lab, p in outcomes[:12] if lab and p]
    return {"kind": "pick", "market": market, "outcomes": outs, "book": book} if outs else None


def live_game_lines(value: dict, book: str) -> list[dict]:
    """In-play lines for one started game, in the shape ``inplay_extra`` keeps."""
    home, away = _sides(value)
    if not home or not away:
        return []
    out: list[dict] = []
    for mkt in markets_of(value):
        name = (mkt.get("name") or "").strip()
        if not name or LIVE_SKIP.match(name) or WINNER.match(name):
            continue
        outcomes = mkt.get("outcomes") or []
        sub = flip(mkt["player"]) if mkt.get("player") else None
        got = _ou_from_outcomes(outcomes)
        if got:
            line, sides = got
            label = f"{name} - {sub}" if sub and sub.lower() not in name.lower() else name
            br = BATSMAN_RUNS.match(name)
            if sub and SUB_RUNS.match(name):
                out.append(_live_ou("player_runs", line, sides, book, player=sub))
            elif br:
                out.append(_live_ou("player_runs", line, sides, book, player=flip(br["p"])))
            elif (mm := TEAM_TOTAL.match(name)) or re.search(r"innings", name, re.I):
                team = (mm["team"].strip() if mm else None) or None
                inn_m = INNINGS.search(name)
                inn = INNINGS_NO.get((inn_m.group(1).lower() if inn_m else ""), 1)
                out.append(_live_ou("team_runs", line, sides, book, team=team or home, inn=inn))
            else:
                out.append(_live_ou("ou", line, sides, book, market=label))
            continue
        named = _named_from_outcomes(outcomes)
        pick = _live_pick(name, named, book)
        if pick:
            out.append(pick)
    return out[:MAX_LIVE_LINES]


def live_matches(now: dt.datetime, wanted: list[tuple[str, str]] | None = None) -> list[dict]:
    """Started cricket matches this book lists, for ``inplay_extra``."""
    from ..inplay_extra import wanted_first

    s = settings()
    if not s:
        return []
    if not on_runner() and not lab(s["URL"]):
        return []
    if not relay() and not lab(s["URL"]):
        return []
    base = s["URL"] if lab(s["URL"]) else host("FEEDI_URL")
    pace = Pace(config.get("FEEDI_SPACING_SECS"), lambda u: request(u))
    deadline = time.monotonic() + LIVE_BUDGET_SECS
    book = s["NAME"]
    try:
        listing = pace.get(livefeed(base, "Get1x2_VZip", sports=str(CRIC_SPORT), count="50"))
    except Exception:
        return []
    stubs = _listing_events(listing if isinstance(listing, dict) else {})
    stubs = wanted_first(stubs, wanted or [], _sides)
    out = []
    for stub in stubs[:MAX_LIVE_EVENTS]:
        if time.monotonic() > deadline:
            break
        eid = stub.get("I") or stub.get("CI")
        if not eid:
            continue
        try:
            got = pace.get(livefeed(
                base, "GetGameZip", id=str(eid), isSubGames="true", GroupEvents="true",
                countevents="250", grMode="4",
            ))
        except Exception:
            break
        value = (got or {}).get("Value") if isinstance(got, dict) else None
        if not isinstance(value, dict):
            continue
        home, away = _sides(value)
        lines = live_game_lines(value, book)
        if home and away and lines:
            out.append({
                "home": home, "away": away, "league": _competition(value),
                "kickoff": _start(value), "lines": lines,
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
