"""Cricsheet (https://cricsheet.org) downloader and ball-by-ball JSON parser."""
from __future__ import annotations

import json
import os
import tempfile
import time
import urllib.request
import zipfile
from collections import defaultdict
from collections.abc import Iterator
from pathlib import Path

from .models import MatchRecord, PlayerPerf

BASE_URL = "https://cricsheet.org/downloads/"
USER_AGENT = "cricket-data/0.1 (open-source dataset updater)"
BOWLER_WICKETS = {"bowled", "caught", "caught and bowled", "lbw", "stumped", "hit wicket"}


def download(dataset: str, retries: int = 3, backoff: float = 30.0) -> Path:
    """Download a Cricsheet zip to a temp file and return its path (caller deletes it)."""
    url = dataset if dataset.startswith("http") else BASE_URL + dataset
    last: Exception | None = None
    for attempt in range(1, retries + 1):
        fd, tmp = tempfile.mkstemp(suffix=".zip", prefix="cricsheet-")
        os.close(fd)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=120) as r, open(tmp, "wb") as out:
                while chunk := r.read(1 << 20):
                    out.write(chunk)
            with zipfile.ZipFile(tmp) as z:
                if z.testzip() is not None:
                    raise zipfile.BadZipFile("corrupt member")
            return Path(tmp)
        except Exception as exc:  # network, HTTP, bad zip: retry
            last = exc
            Path(tmp).unlink(missing_ok=True)
            if attempt < retries:
                time.sleep(backoff * attempt)
    raise RuntimeError(f"Cricsheet download failed for {url}: {last}")


def parse_match(match_id: str, doc: dict) -> MatchRecord:
    info = doc.get("info", {})
    teams = info.get("teams", []) or []
    people = (info.get("registry") or {}).get("people", {})
    team_of = {p: t for t, ps in (info.get("players") or {}).items() for p in ps}
    date = (info.get("dates") or [""])[0]
    outcome = info.get("outcome") or {}
    by = outcome.get("by") or {}
    toss = info.get("toss") or {}
    rec = MatchRecord(
        match_id=match_id, date=date,
        match_type=info.get("match_type", ""), team_type=info.get("team_type", ""),
        gender=info.get("gender", ""), event=(info.get("event") or {}).get("name", ""),
        venue=info.get("venue", ""),
        team_a=teams[0] if teams else "", team_b=teams[1] if len(teams) > 1 else "",
        toss_winner=toss.get("winner", ""), toss_decision=toss.get("decision", ""),
        winner=outcome.get("winner", ""),
        result=outcome.get("result") or ("win" if outcome.get("winner") else ""),
        result_margin=" ".join(f"{v} {k}" for k, v in by.items()),
        player_of_match=";".join(info.get("player_of_match") or []),
        source="cricsheet",
    )
    s: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for p in team_of:  # every named player gets a row, even with zero involvement
        s[p]
    for inn in doc.get("innings", []):
        for over in inn.get("overs", []):
            for d in over.get("deliveries", []):
                bat, bowl = d["batter"], d["bowler"]
                runs = d["runs"]
                extras = d.get("extras", {})
                s[bat]["runs"] += runs.get("batter", 0)
                if "wides" not in extras:
                    s[bat]["balls"] += 1
                if runs.get("batter") == 4 and not runs.get("non_boundary"):
                    s[bat]["fours"] += 1
                elif runs.get("batter") == 6:
                    s[bat]["sixes"] += 1
                if "wides" not in extras and "noballs" not in extras:
                    s[bowl]["balls_bowled"] += 1
                s[bowl]["runs_conceded"] += (
                    runs.get("total", 0) - extras.get("byes", 0) - extras.get("legbyes", 0)
                )
                for w in d.get("wickets", []):
                    kind = w.get("kind", "")
                    if kind in BOWLER_WICKETS:
                        s[bowl]["wickets"] += 1
                    fielders = [f["name"] for f in (w.get("fielders") or []) if f.get("name")]
                    if kind == "caught and bowled" and not fielders:
                        fielders = [bowl]
                    for name in fielders:
                        if kind in ("caught", "caught and bowled"):
                            s[name]["catches"] += 1
                        elif kind == "stumped":
                            s[name]["stumpings"] += 1
                        elif kind == "run out":
                            s[name]["run_outs"] += 1
    for player, st in s.items():
        team = team_of.get(player, "")
        opp = next((t for t in teams if t != team), "")
        rec.players.append(PlayerPerf(
            match_id=match_id, date=date, player=player, team=team, opponent=opp,
            player_id=people.get(player, ""), **dict(st),
        ))
    return rec


def iter_zip(path: str | Path) -> Iterator[MatchRecord]:
    with zipfile.ZipFile(path) as z:
        for name in sorted(z.namelist()):
            if not name.endswith(".json"):
                continue
            try:
                doc = json.loads(z.read(name))
            except json.JSONDecodeError:
                continue
            yield parse_match(Path(name).stem, doc)
