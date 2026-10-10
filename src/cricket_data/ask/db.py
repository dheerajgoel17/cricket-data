"""Indexed SQLite copy of the dataset for question answering.

Rebuilt only when the data files change (a fingerprint of names and sizes is kept in ``meta``).
The rebuild writes a temporary file and swaps it in, so a running server never sees a half-built DB.
"""
from __future__ import annotations

import hashlib
import os
import re
import sqlite3
from collections import defaultdict
from pathlib import Path

from ..models import MATCH_FIELDS, PLAYER_FIELDS
from ..provisional import load_provisional
from ..store import Store

DEFAULT_DB = Path(".cache") / "cricket.db"

VIEW_SQL = """
CREATE VIEW player_matches AS
SELECT p.match_id, p.date, p.player, p.player_id, p.team, p.opponent,
       p.runs, p.balls, p.fours, p.sixes, p.wickets, p.balls_bowled, p.runs_conceded,
       p.catches, p.stumpings, p.run_outs, p.points,
       m.match_type, m.team_type, m.gender, m.event, m.venue, m.toss_winner, m.toss_decision,
       m.winner, m.result, m.result_margin, m.player_of_match
FROM players p JOIN matches m ON m.match_id = p.match_id
"""


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", (s or "").lower())).strip()


def export_sqlite(store: Store, out: Path) -> None:
    """Write the matches and players tables (Cricsheet rows plus saved provisional matches)."""
    out.unlink(missing_ok=True)
    db = sqlite3.connect(out)
    for table, fields in (("matches", MATCH_FIELDS), ("players", PLAYER_FIELDS)):
        db.execute(f"CREATE TABLE {table} ({', '.join(fields)})")
        ph = ",".join("?" * len(fields))
        db.executemany(f"INSERT INTO {table} VALUES ({ph})", ([r[f] for f in fields] for r in store.iter_all(table)))
    for _, rec in load_provisional(store):
        db.execute(f"INSERT INTO matches VALUES ({','.join('?' * len(MATCH_FIELDS))})",
                   [rec.row()[f] for f in MATCH_FIELDS])
        db.executemany(f"INSERT INTO players VALUES ({','.join('?' * len(PLAYER_FIELDS))})",
                       ([p.row()[f] for f in PLAYER_FIELDS] for p in rec.players))
    db.execute("CREATE INDEX idx_players_name ON players(player)")
    db.execute("CREATE INDEX idx_matches_date ON matches(date)")
    db.commit()
    db.close()


def fingerprint(data_dir: Path) -> str:
    h = hashlib.sha1()
    for sub in ("matches", "players", "provisional"):
        for p in sorted((data_dir / sub).glob("*.*")):
            h.update(f"{sub}/{p.name}:{p.stat().st_size};".encode())
    return h.hexdigest()


def _add_names(db: sqlite3.Connection) -> None:
    db.execute("CREATE TABLE names (kind TEXT, name TEXT, norm TEXT, n INTEGER, last_date TEXT, info TEXT)")
    rows: list[tuple] = []
    for kind, col in (("venue", "venue"), ("event", "event")):
        for name, n, last in db.execute(
                f"SELECT {col}, COUNT(*), MAX(date) FROM matches WHERE {col} != '' GROUP BY {col}"):
            rows.append((kind, name, norm(name), n, last, ""))
    teams: dict[str, list] = {}
    for a, b, tt, d in db.execute("SELECT team_a, team_b, team_type, date FROM matches"):
        for t in (a, b):
            if t:
                e = teams.setdefault(t, [0, "", set()])
                e[0] += 1
                e[1] = max(e[1], d)
                e[2].add(tt)
    for t, (n, last, tts) in teams.items():
        rows.append(("team", t, norm(t), n, last, "/".join(sorted(tts))))
    per_player: dict[tuple, list] = defaultdict(list)
    for player, pid, team, c, last in db.execute(
            "SELECT player, player_id, team, COUNT(*), MAX(date) FROM players GROUP BY 1,2,3"):
        per_player[(player, pid)].append((c, team, last))
    for (player, pid), per_team in per_player.items():
        teams_txt = ", ".join(t for _, t, _ in sorted(per_team, reverse=True)[:3] if t)
        rows.append(("player", player, norm(player), sum(c for c, _, _ in per_team),
                     max(last for _, _, last in per_team), f"{pid}|{teams_txt}"))
    db.executemany("INSERT INTO names VALUES (?,?,?,?,?,?)", rows)
    db.execute("CREATE INDEX idx_names ON names(kind)")


def build_db(data_dir: str | Path, out: str | Path) -> Path:
    data_dir, out = Path(data_dir), Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".building")
    export_sqlite(Store(data_dir), tmp)
    db = sqlite3.connect(tmp)
    for stmt in ("CREATE INDEX idx_players_pid ON players(player_id)",
                 "CREATE INDEX idx_players_match ON players(match_id)",
                 "CREATE INDEX idx_matches_id ON matches(match_id)",
                 "CREATE INDEX idx_matches_venue ON matches(venue)",
                 "CREATE INDEX idx_matches_a ON matches(team_a)",
                 "CREATE INDEX idx_matches_b ON matches(team_b)",
                 "CREATE INDEX idx_players_team ON players(team)"):
        db.execute(stmt)
    db.execute(VIEW_SQL)
    _add_names(db)
    db.execute("CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT)")
    last = db.execute("SELECT MAX(date) FROM matches").fetchone()[0] or ""
    db.executemany("INSERT INTO meta VALUES (?,?)", [("fingerprint", fingerprint(data_dir)), ("last_match_date", last)])
    db.execute("ANALYZE")
    db.commit()
    db.close()
    os.replace(tmp, out)
    return out


def ensure_db(data_dir: str | Path = "data", db_path: str | Path | None = None) -> Path:
    """Return a ready DB, rebuilding it only if the data changed since it was built."""
    data_dir, db_path = Path(data_dir), Path(db_path or DEFAULT_DB)
    if db_path.exists():
        try:
            con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
            have = con.execute("SELECT v FROM meta WHERE k='fingerprint'").fetchone()
            con.close()
            if have and have[0] == fingerprint(data_dir):
                return db_path
        except sqlite3.Error:
            pass
    return build_db(data_dir, db_path)
