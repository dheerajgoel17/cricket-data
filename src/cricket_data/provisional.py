"""Provisional (not yet in Cricsheet) matches, and reconciliation when they land.

A provisional match is one JSON file under <data>/provisional/. There are three statuses:

1. **provisional**: Normal lag between live match and Cricsheet release.
   When Cricsheet publishes the match, reconcile compares, logs, and DELETES the file.

2. **cricsheet_missing**: Match is on Cricsheet's missing-matches list.
   Keep permanently as source of truth. If Cricsheet later provides it, reconcile
   and prefer Cricsheet (then delete the scraped version).

3. **cricsheet_withheld**: Afghanistan men's team or APL matches withheld by Cricsheet.
   Keep permanently. If Cricsheet ever restores them, reconcile and prefer Cricsheet.

Permanent matches (statuses 2 and 3) are never deleted unless Cricsheet provides them.
"""
from __future__ import annotations

import csv
import json
import re
from datetime import date, timedelta
from pathlib import Path

from .models import MatchRecord, PlayerPerf, MatchStatus
from .store import Store

LOG_FIELDS = ["checked_on", "provisional_id", "canonical_id", "date", "status", "winner_ok", "players_compared", "player_mismatches", "action"]
STALE_DAYS = 45


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def slug(rec: MatchRecord) -> str:
    teams = "-".join(sorted([_norm(rec.team_a), _norm(rec.team_b)]))
    return f"prov-{rec.date}-{teams}"


def _dir(store: Store) -> Path:
    return store.root / "provisional"


def write_provisional(store: Store, rec: MatchRecord) -> Path:
    rec.status = "provisional"
    rec.match_id = rec.match_id or slug(rec)
    for pl in rec.players:
        pl.match_id, pl.date = rec.match_id, rec.date
    path = _dir(store) / f"{rec.match_id}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = {**rec.row(), "players": [p.row() for p in rec.players]}
    path.write_text(json.dumps(doc, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return path


def load_provisional(store: Store) -> list[tuple[Path, MatchRecord]]:
    out = []
    for p in sorted(_dir(store).glob("*.json")):
        d = json.loads(p.read_text(encoding="utf-8"))
        players = [PlayerPerf(**{k: (int(v) if k in _INTS and v != "" else v)
                                 for k, v in pl.items() if k != "points"}) for pl in d.pop("players", [])]
        out.append((p, MatchRecord(**{k: v for k, v in d.items() if k != "players"}, players=players)))
    return out


_INTS = {"runs", "balls", "fours", "sixes", "wickets", "balls_bowled", "runs_conceded",
         "catches", "stumpings", "run_outs"}


def _same_fixture(a: MatchRecord | dict, b: MatchRecord | dict) -> bool:
    def teams(x):
        g = (lambda k: x[k]) if isinstance(x, dict) else (lambda k: getattr(x, k))
        return {_norm(g("team_a")), _norm(g("team_b"))}
    return teams(a) == teams(b)


def find_canonical(store: Store, prov: MatchRecord) -> dict[str, str] | None:
    try:
        d = date.fromisoformat(prov.date)
    except ValueError:
        return None
    window = {(d + timedelta(days=i)).isoformat() for i in (-1, 0, 1)}
    for month in {w[:7] for w in window}:
        for row in store.read("matches", month):
            if row["date"] in window and row["status"] == "canonical" and _same_fixture(row, prov):
                return row
    return None


def reconcile(store: Store, today: date | None = None) -> dict[str, int]:
    """Verify provisional matches against canonical ones and delete those that landed.
    
    Respects match status:
    - provisional: Delete after Cricsheet arrival
    - cricsheet_missing: Keep permanently unless Cricsheet provides it
    - cricsheet_withheld: Keep permanently unless Cricsheet restores it
    
    Returns stats dict with counts by action taken.
    """
    today = today or date.today()
    stats = {"landed": 0, "mismatched": 0, "pending": 0, "stale": 0, "permanent_kept": 0}
    log_path = store.root / "reconcile_log.csv"
    
    for path, prov in load_provisional(store):
        # Determine match status
        status = prov.status or "provisional"
        is_permanent = status in (MatchStatus.CRICSHEET_MISSING.value, MatchStatus.CRICSHEET_WITHHELD.value)
        
        canon = find_canonical(store, prov)
        if canon is None:
            stats["pending"] += 1
            if is_permanent:
                stats["permanent_kept"] += 1
            try:
                if (today - date.fromisoformat(prov.date)).days > STALE_DAYS:
                    stats["stale"] += 1
            except ValueError:
                pass
            continue
        
        # Found canonical version - compare and decide
        month = canon["date"][:7]
        cplayers = {r["player"]: r for r in store.read("players", month) if r["match_id"] == canon["match_id"]}
        compared = mism = 0
        for p in prov.players:
            c = cplayers.get(p.player)
            if c is None or not p.runs and not p.wickets and not p.catches:
                continue
            compared += 1
            if (int(c["runs"]), int(c["wickets"])) != (p.runs, p.wickets):
                mism += 1
        winner_ok = not prov.winner or _norm(prov.winner) == _norm(canon["winner"])
        
        # Log the reconciliation
        new = not log_path.exists()
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Determine action based on status
        if is_permanent:
            # Permanent match: Cricsheet has now provided it
            # Prefer Cricsheet and delete scraped version
            action = "replaced_by_cricsheet"
            should_delete = True
        else:
            # Provisional match: normal case, delete after landing
            action = "landed_deleted"
            should_delete = True
        
        with log_path.open("a", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=LOG_FIELDS, lineterminator="\n")
            if new:
                w.writeheader()
            w.writerow({
                "checked_on": today.isoformat(),
                "provisional_id": prov.match_id,
                "canonical_id": canon["match_id"],
                "date": canon["date"],
                "status": status,
                "winner_ok": str(winner_ok).lower(),
                "players_compared": compared,
                "player_mismatches": mism,
                "action": action
            })
        
        stats["landed"] += 1
        stats["mismatched"] += int(not winner_ok or mism > 0)
        
        if should_delete:
            path.unlink()  # canonical copy exists: free the space
    
    return stats
