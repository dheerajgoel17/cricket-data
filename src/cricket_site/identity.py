"""Who is who: playing names and fixtures, written as identity.json and synced to Postgres.

Hand-checked rows live in ``data/mappings/player_aliases.csv``. The builder copies them (plus names
already linked in provisional matches) into ``site/public/data/identity.json``. ``assets_sync``
upserts the same rows to Supabase and merges any names added in the DB, so a scorecard alias is live
on the next hourly deploy without guessing at click time. Ids first; names only as the fallback.
"""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

from .crex_assets import fold
from .parse import FORMAT_NAMES

FMTS = set(FORMAT_NAMES) | {"O40", "FC"}


def team_key(n: str) -> str:
    s = re.sub(r"\(w\)|women'?s?", "", (n or "").lower())
    return re.sub(r"[^a-z0-9]", "", s)


def _team_fold(n: str) -> str:
    return fold(re.sub(r"\(w\)|\bwomen\b", "", n or "", flags=re.I))


def _g(v) -> int | None:
    if v in (0, 1, "0", "1"):
        return int(v)
    if v in ("male", "female"):
        return 0 if v == "male" else 1
    return None


def _row(raw: str, pid: str, gender, team: str, source: str) -> dict | None:
    raw, pid = (raw or "").strip(), (pid or "").strip()
    if not raw or not pid:
        return None
    return {"f": fold(raw), "r": raw, "id": pid, "g": _g(gender), "t": _team_fold(team), "src": source}


def from_csv(data_dir: Path, pstat: dict | None = None) -> list[dict]:
    p = data_dir / "mappings" / "player_aliases.csv"
    out, seen = [], set()
    if not p.exists():
        return out
    with p.open(encoding="utf-8", newline="") as fh:
        for r in csv.DictReader(fh):
            pid = (r.get("player_id") or "").strip()
            g = (pstat or {}).get(pid, {}).get("g")
            row = _row(r.get("raw_name", ""), pid, g, r.get("team") or "", "csv")
            if not row:
                continue
            k = (row["f"], row["t"], row["id"])
            if k not in seen:
                seen.add(k)
                out.append(row)
    return out


def from_aliases(aliases: dict, names: dict[str, str], pstat: dict) -> list[dict]:
    """Provisional / CSV names already attached to a Cricsheet id, minus the canonical registry name."""
    out, seen = [], set()
    for pid, nms in (aliases or {}).items():
        g = (pstat or {}).get(pid, {}).get("g")
        canon = fold(names.get(pid, ""))
        for nm in nms:
            row = _row(nm, pid, g, "", "alias")
            if not row or row["f"] == canon:
                continue
            k = (row["f"], row["t"], row["id"])
            if k not in seen:
                seen.add(k)
                out.append(row)
    return out


def from_crex(index: dict | None, pstat: dict | None = None) -> list[dict]:
    """CREX sitemap names that already matched a Cricsheet id (scorecards use these, not 'AC Jayangani')."""
    out, seen = [], set()
    for _cid, nm, pid in (index or {}).get("players") or []:
        if not pid:
            continue
        g = (pstat or {}).get(pid, {}).get("g")
        row = _row(nm, pid, g, "", "crex")
        if not row:
            continue
        k = (row["f"], row["t"], row["id"])
        if k not in seen:
            seen.add(k)
            out.append(row)
    return out


def from_fixtures(fx: list[dict]) -> list[dict]:
    out = []
    for f in fx or []:
        fmt = f.get("fmt") or ""
        if fmt not in FMTS or not f.get("id") or not f.get("start"):
            continue
        start = f["start"]
        if start.endswith("Z") and start.count(":") == 1:  # 2026-11-05T06:00Z
            start = start[:-1] + ":00Z"
        out.append({"id": f["id"], "a": f["a"], "b": f["b"], "ak": team_key(f["a"]), "bk": team_key(f["b"]),
                    "fmt": fmt, "g": f.get("gender") or "male", "start": start, "src": f.get("source") or "crex"})
    return out


def merge_players(*groups: list[dict]) -> list[dict]:
    """CSV wins on the same folded+team+id; later groups fill gaps. Ambiguous folds (two ids, no team) are kept
    but lookups require gender/team to pick one."""
    by: dict[tuple, dict] = {}
    rank = {"csv": 0, "crex": 1, "alias": 2, "db": 3}
    for group in groups:
        for r in group:
            k = (r["f"], r["t"], r["id"])
            if k not in by or rank.get(r.get("src"), 9) < rank.get(by[k].get("src"), 9):
                by[k] = r
    return sorted(by.values(), key=lambda r: (r["id"], r["f"], r["t"]))


def dump(players: list[dict], fixtures: list[dict]) -> dict:
    return {"p": players, "fx": fixtures}


def write(path: Path, players: list[dict], fixtures: list[dict]) -> dict:
    doc = dump(players, fixtures)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    return doc


def db_players(rows: list[dict]) -> list[dict]:
    """identity.json player rows -> player_names upsert payload."""
    return [{"folded": r["f"], "raw": r["r"], "cricsheet_id": r["id"], "gender": r.get("g"),
             "team": r.get("t") or "", "source": r.get("src") or "csv"} for r in rows]


def db_fixtures(rows: list[dict]) -> list[dict]:
    return [{"id": r["id"], "team_a": r["a"], "team_b": r["b"], "a_key": r["ak"], "b_key": r["bk"],
             "fmt": r["fmt"], "gender": r["g"], "start_utc": r["start"], "source": r.get("src") or "crex"} for r in rows]


def from_db_players(rows: list[dict]) -> list[dict]:
    out = []
    for r in rows or []:
        row = _row(r.get("raw") or r.get("folded", ""), r.get("cricsheet_id", ""), r.get("gender"), r.get("team") or "", r.get("source") or "db")
        if row:
            out.append(row)
    return out
