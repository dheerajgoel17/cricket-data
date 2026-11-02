"""When a Test that has a result stops being listed.

A Test is carried for 6 days from its first morning so that one at stumps or on a rain day (no result yet) stays up. Once it has a result it should go a day after
it ended. The archive file of a match (``value_bets/archive``, see ``value_bets.archive``) says when: ``settled_at`` is the hourly run that first saw the result
(``settle``), so it can be up to an hour late (the pipeline runs hourly). A Test is over by the start of its fifth day, so the end is never
taken later than that; a file that has the whole match's result from before ``settled_at`` was recorded is taken to have ended then. The data the site shows is
published from here (the book file's carry, the schedule's rows), not decided again in the browser, because an app in the wild cannot be updated at will.

Stdlib only: ``value_bets`` (the carry) and ``cricket_site.build`` (the schedule) both read it.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

OVER_BY = timedelta(days=4)  # a Test is over by the start of its fifth day: the end when the real one was not recorded
RESULT_KEEP = timedelta(hours=24)  # a Test with a result is listed this long after it ended
LOOKBACK = timedelta(days=8)  # a Test is carried 6 days: its archive file is dated the first morning
TEST_WINDOW = timedelta(days=6)  # a Test is priced day by day: books restamp it each morning, so any start within this of the first morning is the same match


def parse(s) -> datetime | None:
    """An ISO timestamp (a trailing Z is fine) as an aware UTC datetime, or None."""
    if not s:
        return None
    try:
        t = datetime.fromisoformat(str(s).strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=timezone.utc)


def end_of(d: dict) -> datetime | None:
    """When the match of this archive file ended, or None while it has no result. ``settled_at`` (never later than the start of day 5), else the start of day 5 for a
    file that holds the whole match's result (one with no ``inn``: a Test's innings results are stored while it is still being played, so they say nothing)."""
    start = parse(d.get("start_utc"))
    if not start:
        return None
    over_by = start + OVER_BY
    at = parse(d.get("settled_at"))
    if at:
        return min(at, over_by)
    return over_by if any(not r.get("inn") for r in d.get("results") or []) else None


def ended(root: Path, now: datetime) -> list[tuple[str, datetime, datetime]]:
    """(match, start, end) for each Test in the archive that has a result and began within ``LOOKBACK`` of ``now``. A file that cannot be read is skipped (never touched)."""
    since = (now - LOOKBACK).date().isoformat()
    out = []
    for month in sorted({(now - LOOKBACK).strftime("%Y-%m"), now.strftime("%Y-%m")}):
        for path in sorted((root / month).glob("*.json")) if (root / month).is_dir() else []:
            if path.name[:10] < since:
                continue
            try:
                d = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            if not isinstance(d, dict) or not any(x.get("fmt") == "Test" for x in d.get("lines") or [] if isinstance(x, dict)):
                continue
            end, start = end_of(d), parse(d.get("start_utc"))
            if end and start:
                out.append((str(d.get("match") or ""), start, end))
    return out


def gone(end: datetime, now: datetime) -> bool:
    """Is a Test that ended at ``end`` past the day it is listed after its result?"""
    return now >= end + RESULT_KEEP
