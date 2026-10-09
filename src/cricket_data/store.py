"""Month-partitioned, gzip-compressed CSV store.

Layout (relative to the data dir):
  matches/YYYY-MM.csv.gz   one row per match
  players/YYYY-MM.csv.gz   one row per player per match
Files are written deterministically (sorted rows, fixed gzip mtime) so an
unchanged partition is byte-identical and produces no git diff.
"""
from __future__ import annotations

import csv
import gzip
import io
from collections import defaultdict
from collections.abc import Iterable, Iterator
from pathlib import Path

from .models import MATCH_FIELDS, PLAYER_FIELDS, MatchRecord


def month_of(date: str) -> str:
    return date[:7] if len(date) >= 7 else "unknown"


class Store:
    def __init__(self, data_dir: str | Path):
        self.root = Path(data_dir)

    # ---- paths -------------------------------------------------------
    def path(self, kind: str, month: str) -> Path:
        return self.root / kind / f"{month}.csv.gz"

    def months(self, kind: str = "matches") -> list[str]:
        d = self.root / kind
        return sorted(p.name[: -len(".csv.gz")] for p in d.glob("*.csv.gz")) if d.exists() else []

    # ---- read --------------------------------------------------------
    def read(self, kind: str, month: str) -> list[dict[str, str]]:
        p = self.path(kind, month)
        if not p.exists():
            return []
        with gzip.open(p, "rt", encoding="utf-8", newline="") as fh:
            return list(csv.DictReader(fh))

    def iter_all(self, kind: str) -> Iterator[dict[str, str]]:
        for m in self.months(kind):
            yield from self.read(kind, m)

    # ---- write -------------------------------------------------------
    def _write(self, kind: str, month: str, rows: list[dict[str, str]], fields: list[str], key) -> bool:
        rows = sorted(rows, key=key)
        buf = io.StringIO(newline="")
        w = csv.DictWriter(buf, fieldnames=fields, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
        raw = buf.getvalue().encode("utf-8")
        p = self.path(kind, month)
        p.parent.mkdir(parents=True, exist_ok=True)
        out = io.BytesIO()
        with gzip.GzipFile(fileobj=out, mode="wb", mtime=0, compresslevel=9) as gz:
            gz.write(raw)
        data = out.getvalue()
        if p.exists() and p.read_bytes() == data:
            return False
        p.write_bytes(data)
        return True

    def upsert(self, records: Iterable[MatchRecord]) -> dict[str, int]:
        """Insert or replace matches (and their players). Returns counts."""
        by_month: dict[str, list[MatchRecord]] = defaultdict(list)
        for r in records:
            by_month[month_of(r.date)].append(r)
        stats = {"matches_new": 0, "matches_updated": 0, "partitions_changed": 0}
        for month, recs in by_month.items():
            matches = {r["match_id"]: r for r in self.read("matches", month)}
            players = {(r["match_id"], r["player"]): r for r in self.read("players", month)}
            for rec in recs:
                new_row = rec.row()
                if rec.match_id not in matches:
                    stats["matches_new"] += 1
                elif matches[rec.match_id] != new_row:
                    stats["matches_updated"] += 1
                matches[rec.match_id] = new_row
                for k in [k for k in players if k[0] == rec.match_id]:
                    del players[k]
                for p in rec.players:
                    players[(p.match_id, p.player)] = p.row()
            changed = self._write("matches", month, list(matches.values()), MATCH_FIELDS,
                                  lambda r: (r["date"], r["match_id"]))
            changed |= self._write("players", month, list(players.values()), PLAYER_FIELDS,
                                   lambda r: (r["date"], r["match_id"], r["player"]))
            stats["partitions_changed"] += int(changed)
        return stats
