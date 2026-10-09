"""Full scorecard -> per-player rows in the same columns as the Cricsheet player table.

CREX renders ``<match>/match-scorecard`` on the server and embeds the scorecard as page data
(``getSC4``), so the whole card (both innings) is available without clicking through tabs.

Row layout, verified against Cricsheet records (stumpings, catches, run-outs):

* batting row  ``id.runs.balls.fours.sixes.fowScore.fowBalls.code.<bowler>.<fielder>`` (a batter who
  did not bat is just ``id``; a not-out batter stops after the sixes);
* bowling row  ``id.runs_conceded.balls_bowled.maidens.wickets``;
* dismissal ``code``: 1 bowled, 2 caught, 3 caught and bowled, 4 run out, 5 lbw, 8 stumped
  (other codes, e.g. retired or hit wicket, give nobody a fielding credit).

Player ids are CREX's own, so ``player_id`` stays blank until Cricsheet publishes the match.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from .models import PlayerPerf

SC4 = "https://api.goscorer.com/api/v3/getSC4"
_STATE = re.compile(r'<script id="[^"]*state[^"]*"[^>]*>(.*?)</script>', re.S)
_MM = re.compile(r"&q;mm&q;:&q;([A-Za-z0-9]+)\^")
_YEAR_TAIL = re.compile(r"\s*(?:19|20)\d{2}(?:[-/]\d{2,4})?\s*$")

BOWLED, CAUGHT, CAUGHT_BOWLED, RUN_OUT, LBW, STUMPED = 1, 2, 3, 4, 5, 8


def unescape_state(s: str) -> str:
    """CREX escapes its embedded JSON (``&q;`` for a quote, ...)."""
    return s.replace("&q;", '"').replace("&a;", "&").replace("&s;", "'").replace("&l;", "<").replace("&g;", ">")


@dataclass
class Batter:
    pid: str
    runs: int = 0
    balls: int = 0
    fours: int = 0
    sixes: int = 0
    code: int = 0  # dismissal code, 0 = not out / did not bat
    bowler: str = ""
    fielders: list[str] = field(default_factory=list)


@dataclass
class Bowler:
    pid: str
    runs: int = 0
    balls: int = 0
    wickets: int = 0


@dataclass
class Innings:
    batting_team: str  # team id
    batters: list[Batter]
    bowlers: list[Bowler]


@dataclass
class Scorecard:
    teams: dict[str, str]  # team id -> name
    names: dict[str, str]  # player id -> name
    innings: list[Innings]
    series_name: str = ""


def _i(x: str) -> int:
    return int(x) if x.isdigit() else 0


def _batter(row: str) -> Batter:
    f = row.split("/")[0].split(".")
    b = Batter(pid=f[0])
    if len(f) >= 5:
        b.runs, b.balls, b.fours, b.sixes = _i(f[1]), _i(f[2]), _i(f[3]), _i(f[4])
    if len(f) >= 8:
        b.code = _i(f[7])
        rest = [x for x in f[8:] if x]
        if b.code == RUN_OUT:
            b.fielders = rest
        elif b.code in (CAUGHT, STUMPED):
            b.bowler = rest[0] if rest else ""
            b.fielders = rest[1:2]
        else:
            b.bowler = rest[0] if rest else ""
    return b


def _bowler(row: str) -> Bowler:
    f = row.split("/")[0].split(".")
    return Bowler(pid=f[0], runs=_i(f[1]) if len(f) > 1 else 0, balls=_i(f[2]) if len(f) > 2 else 0,
                  wickets=_i(f[4]) if len(f) > 4 else 0)


def parse_state(html: str) -> dict | None:
    m = _STATE.search(html or "")
    if not m:
        return None
    try:
        return json.loads(unescape_state(m.group(1)))
    except ValueError:
        return None


def _maps(state: dict) -> tuple[dict[str, str], dict[str, str], str]:
    names: dict[str, str] = {}
    teams: dict[str, str] = {}
    series = ""
    for v in state.values():
        if not isinstance(v, dict):
            continue
        for p in v.get("p", []) if isinstance(v.get("p"), list) else []:
            if isinstance(p, dict) and "f_key" in p and "n" in p:
                names[p["f_key"]] = p["n"]
        for t in v.get("t", []) if isinstance(v.get("t"), list) else []:
            if isinstance(t, dict) and "f_key" in t and "n" in t:
                teams[t["f_key"]] = t["n"]
        for s in v.get("s", []) if isinstance(v.get("s"), list) else []:
            if isinstance(s, dict) and s.get("n") and not series:
                series = s["n"]
    return names, teams, series


def parse_scorecard(html: str) -> Scorecard | None:
    state = parse_state(html)
    if not state or not isinstance(state.get(SC4), list) or not state[SC4]:
        return None
    names, teams, series = _maps(state)
    innings = [Innings(batting_team=i.get("c", ""), batters=[_batter(r) for r in i.get("b", [])],
                       bowlers=[_bowler(r) for r in i.get("a", [])]) for i in state[SC4]]
    return Scorecard(teams=teams, names=names, innings=innings, series_name=series)


def player_of_match(html: str, names: dict[str, str]) -> str:
    """Name of the player of the match from the summary page's embedded data ('' if absent)."""
    m = _MM.search(html or "")
    return names.get(m.group(1), "") if m else ""


def event_name(series_name: str) -> str:
    """'West Indies tour of India 2026' -> 'West Indies tour of India' (Cricsheet omits the year)."""
    return _YEAR_TAIL.sub("", series_name or "").strip()


def player_rows(sc: Scorecard, match_id: str, date: str) -> list[PlayerPerf]:
    """One row per player of the match (everyone who batted, did not bat, or bowled)."""
    team_ids = list(dict.fromkeys(i.batting_team for i in sc.innings if i.batting_team))
    other = {t: next((o for o in team_ids if o != t), "") for t in team_ids}
    rows: dict[str, PlayerPerf] = {}
    team_of: dict[str, str] = {}

    def row(pid: str, team_id: str) -> PlayerPerf:
        if pid not in rows:
            t = sc.teams.get(team_id, "")
            opp = sc.teams.get(other.get(team_id, ""), "")
            rows[pid] = PlayerPerf(match_id=match_id, date=date, player=sc.names.get(pid, pid), team=t, opponent=opp)
            team_of[pid] = team_id
        return rows[pid]

    for inn in sc.innings:
        bat_team, bowl_team = inn.batting_team, other.get(inn.batting_team, "")
        for b in inn.batters:
            r = row(b.pid, bat_team)  # a player bats in two innings of a multi-day match: add them up
            r.runs += b.runs
            r.balls += b.balls
            r.fours += b.fours
            r.sixes += b.sixes
        for bw in inn.bowlers:
            r = row(bw.pid, bowl_team)
            r.balls_bowled += bw.balls
            r.runs_conceded += bw.runs
            r.wickets += bw.wickets
    for inn in sc.innings:  # fielding credits (a substitute fielder gets a row of their own)
        bowl_team = other.get(inn.batting_team, "")

        def fielder(pid: str) -> PlayerPerf | None:
            if pid in rows:
                return rows[pid]
            if pid not in sc.names:
                return None  # unknown substitute: no name to record
            rows[pid] = PlayerPerf(match_id=match_id, date=date, player=sc.names[pid])  # substitute: no team, as in Cricsheet
            return rows[pid]

        for b in inn.batters:
            if b.code == CAUGHT and b.fielders and (f := fielder(b.fielders[0])):
                f.catches += 1
            elif b.code == CAUGHT_BOWLED and (f := fielder(b.bowler)):
                f.catches += 1
            elif b.code == STUMPED and b.fielders and (f := fielder(b.fielders[0])):
                f.stumpings += 1
            elif b.code == RUN_OUT:
                for pid in b.fielders:
                    if f := fielder(pid):
                        f.run_outs += 1
    return list(rows.values())
