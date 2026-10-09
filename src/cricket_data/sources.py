"""Pluggable extra sources for matches Cricsheet has not published yet.

A source is any object with `name` and `fetch(since: date) -> Iterable[MatchRecord]`.
Built-in: the *inbox*, which reads JSON files you drop into <data>/provisional/inbox/.
Add your own with CRICKET_DATA_SOURCES="my_pkg.my_module:MySource,other:Thing".
No scraper ships with this project; use only sources you have the right to use.
"""
from __future__ import annotations

import importlib
import json
import os
from collections.abc import Iterable
from datetime import date
from pathlib import Path
from typing import Protocol

from .models import MatchRecord, PlayerPerf


class Source(Protocol):
    name: str

    def fetch(self, since: date) -> Iterable[MatchRecord]: ...


class InboxSource:
    """Reads *.json files (see docs/PROVISIONAL.md for the schema) from the inbox dir."""

    name = "inbox"

    def __init__(self, inbox: str | Path):
        self.inbox = Path(inbox)

    def fetch(self, since: date) -> Iterable[MatchRecord]:
        for p in sorted(self.inbox.glob("*.json")):
            d = json.loads(p.read_text(encoding="utf-8"))
            players = [PlayerPerf(match_id="", date=d["date"], **pl) for pl in d.pop("players", [])]
            rec = MatchRecord(source=d.pop("source", "inbox"), players=players, match_id="", **d)
            if rec.date >= since.isoformat():
                yield rec


    def cleanup(self, landed) -> int:
        """Delete inbox files whose match is already canonical. `landed(rec)` -> bool."""
        n = 0
        for p in sorted(self.inbox.glob("*.json")):
            d = json.loads(p.read_text(encoding="utf-8"))
            d.pop("players", None)
            if landed(MatchRecord(match_id="", **{k: v for k, v in d.items() if k != "source"})):
                p.unlink()
                n += 1
        return n


def load_extra_sources() -> list[Source]:
    out: list[Source] = []
    for spec in filter(None, (s.strip() for s in os.environ.get("CRICKET_DATA_SOURCES", "").split(","))):
        mod, _, cls = spec.partition(":")
        out.append(getattr(importlib.import_module(mod), cls)())
    return out
