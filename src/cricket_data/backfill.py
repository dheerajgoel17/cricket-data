"""Incremental backfill of matches Cricsheet will never have, from CREX.

Two kinds of task live in one persistent queue (``data/state/backfill_queue.json``):

* ``cricsheet_missing``: every match on https://cricsheet.org/missing/;
* ``cricsheet_withheld``: Afghanistan men's matches, enumerated from CREX's own sitemap.

Each run takes a small batch, looks every task up with ``crex_lookup.find_match`` (strict date /
team / format confirmation on the rendered page) and saves what it finds. The outcome of a task is
always one of:

* ``done``: the match was found, confirmed and **written to disk**;
* ``not_found``: CREX was checked (candidates rendered and rejected, or none plausible in the
  sitemap) and the reason is recorded; it is never retried;
* ``already_in_cricsheet``: Cricsheet now has the match, nothing to scrape;
* ``failed``: network/render trouble; retried up to ``max_retries`` times, then parked.
"""
from __future__ import annotations

import json
import re
import time
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Literal

from .crex_lookup import (
    NATIONS,
    LookupResult,
    code_is,
    confirm,
    fetch_record,
    find_match,
    parse_match_page,
)
from .crex_sitemap import CREXSitemapIndex, MatchEntry
from .permanent_matches import MissingMatch, fetch_cricsheet_missing_matches

Category = Literal["cricsheet_missing", "cricsheet_withheld"]

# Competition slugs CREX would use for the Afghanistan Premier League (none exist in its sitemap today).
WITHHELD_COMPETITION_PATTERN = re.compile(r"afghanistan-premier-league")


@dataclass
class BackfillTask:
    """A single match to backfill."""
    date: str
    team_a: str
    team_b: str
    match_type: str
    gender: str
    category: Category
    attempts: int = 0
    last_attempt: str | None = None
    last_error: str | None = None
    crex_url: str | None = None  # known CREX page (Afghanistan tasks come from the sitemap)
    rejected_ids: list[str] = field(default_factory=list)  # candidate pages already ruled out

    def key(self) -> str:
        return f"{self.date}-{self.team_a}-{self.team_b}"


def _task_from_json(d: dict) -> BackfillTask:
    known = BackfillTask.__dataclass_fields__
    return BackfillTask(**{k: v for k, v in d.items() if k in known})


@dataclass
class BackfillQueue:
    """Persistent queue. Saved to data/state/backfill_queue.json and carried between runs."""
    pending: list[BackfillTask] = field(default_factory=list)
    in_progress: list[BackfillTask] = field(default_factory=list)
    done: list[dict] = field(default_factory=list)  # {key, match_id, crex_url, saved_at}
    failed: list[BackfillTask] = field(default_factory=list)
    not_found: list[dict] = field(default_factory=list)  # {key, reason, checked, checked_at}
    already_in_cricsheet: list[dict] = field(default_factory=list)
    afghanistan_enumerated_at: str | None = None
    max_retries: int = 3
    batch_size: int = 5
    delay_between_requests: float = 5.0

    # ---- persistence ----------------------------------------------------------------------------
    @classmethod
    def load(cls, path: Path) -> BackfillQueue:
        if not path.exists():
            return cls()
        data = json.loads(path.read_text(encoding="utf-8"))
        q = cls(
            pending=[_task_from_json(t) for t in data.get("pending", [])],
            in_progress=[_task_from_json(t) for t in data.get("in_progress", [])],
            failed=[_task_from_json(t) for t in data.get("failed", [])],
            # older state files stored bare key strings; those carry no evidence, keep them as keys only
            done=[d if isinstance(d, dict) else {"key": d} for d in data.get("done", [])],
            # ...and not_found keys written by the old lookup were never verified: drop them so the
            # missing list re-queues those matches for a real lookup
            not_found=[d for d in data.get("not_found", []) if isinstance(d, dict)],
            already_in_cricsheet=data.get("already_in_cricsheet", []),
            afghanistan_enumerated_at=data.get("afghanistan_enumerated_at"),
            max_retries=data.get("max_retries", 3),
            batch_size=data.get("batch_size", 5),
            delay_between_requests=data.get("delay_between_requests", 5.0),
        )
        q._drop_unsourced_withheld()
        q._dedupe()
        return q

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "pending": [asdict(t) for t in self.pending],
            "in_progress": [asdict(t) for t in self.in_progress],
            "done": self.done,
            "failed": [asdict(t) for t in self.failed],
            "not_found": self.not_found,
            "already_in_cricsheet": self.already_in_cricsheet,
            "afghanistan_enumerated_at": self.afghanistan_enumerated_at,
            "max_retries": self.max_retries,
            "batch_size": self.batch_size,
            "delay_between_requests": self.delay_between_requests,
        }
        path.write_text(json.dumps(data, indent=1, sort_keys=True) + "\n", encoding="utf-8")

    def _drop_unsourced_withheld(self) -> None:
        """Withheld tasks must come from the CREX sitemap (they carry a crex_url); older hand-typed
        ones do not and are discarded so they get re-derived."""
        self.pending = [t for t in self.pending if not (t.category == "cricsheet_withheld" and not t.crex_url)]
        self.in_progress = [t for t in self.in_progress if not (t.category == "cricsheet_withheld" and not t.crex_url)]
        self.failed = [t for t in self.failed if not (t.category == "cricsheet_withheld" and not t.crex_url)]

    def _dedupe(self) -> None:
        seen: set[str] = set()
        for bucket in (self.pending, self.in_progress, self.failed):
            keep = []
            for t in bucket:
                if t.key() in seen:
                    continue
                seen.add(t.key())
                keep.append(t)
            bucket[:] = keep

    # ---- membership -----------------------------------------------------------------------------
    def known_keys(self) -> set[str]:
        keys = {t.key() for t in self.pending + self.in_progress + self.failed}
        for bucket in (self.done, self.not_found, self.already_in_cricsheet):
            keys.update(d["key"] for d in bucket)
        return keys

    def initialize_from_missing_list(self, missing: list[MissingMatch]) -> int:
        known = self.known_keys()
        added = 0
        for m in missing:
            task = BackfillTask(date=m.date, team_a=m.team_a, team_b=m.team_b, match_type=m.match_type,
                                gender=m.gender, category="cricsheet_missing")
            if task.key() not in known:
                known.add(task.key())
                self.pending.append(task)
                added += 1
        self._sort()
        return added

    def add_task(self, task: BackfillTask) -> bool:
        if task.key() in self.known_keys():
            return False
        self.pending.append(task)
        self._sort()
        return True

    def _sort(self) -> None:
        self.pending.sort(key=lambda t: t.date, reverse=True)  # newest first

    def prioritize(self, prefixes: list[str]) -> int:
        """Move pending tasks whose key starts with any prefix to the front (manual runs)."""
        prefixes = [p for p in (x.strip() for x in prefixes) if p]
        first = [t for t in self.pending if any(t.key().startswith(p) for p in prefixes)]
        self.pending = first + [t for t in self.pending if t not in first]
        return len(first)

    # ---- state transitions ----------------------------------------------------------------------
    def next_task(self) -> BackfillTask | None:
        if self.in_progress:  # leftover from an interrupted run
            self.pending.extend(self.in_progress)
            self.in_progress.clear()
            self._sort()
        while self.pending:
            task = self.pending.pop(0)
            if task.attempts >= self.max_retries:
                self.failed.append(task)
                continue
            self.in_progress.append(task)
            return task
        return None

    def _release(self, task: BackfillTask) -> None:
        if task in self.in_progress:
            self.in_progress.remove(task)

    def mark_done(self, task: BackfillTask, match_id: str, crex_url: str) -> None:
        self._release(task)
        self.done.append({"key": task.key(), "match_id": match_id, "crex_url": crex_url,
                          "saved_at": datetime.now().isoformat(timespec="seconds")})

    def mark_not_found(self, task: BackfillTask, reason: str, checked: list[str] | None = None) -> None:
        self._release(task)
        self.not_found.append({"key": task.key(), "reason": reason, "checked": checked or [],
                               "checked_at": datetime.now().isoformat(timespec="seconds")})

    def mark_already_in_cricsheet(self, task: BackfillTask, canonical_id: str) -> None:
        self._release(task)
        self.already_in_cricsheet.append({"key": task.key(), "canonical_id": canonical_id})

    def mark_failed(self, task: BackfillTask, error: str, rejected: list[str] | None = None) -> None:
        self._release(task)
        task.attempts += 1
        task.last_attempt = datetime.now().isoformat(timespec="seconds")
        task.last_error = error[:300]
        for r in rejected or []:
            if r not in task.rejected_ids:
                task.rejected_ids.append(r)
        (self.pending if task.attempts < self.max_retries else self.failed).append(task)

    def stats(self) -> dict[str, int]:
        s = {"pending": len(self.pending), "in_progress": len(self.in_progress), "done": len(self.done),
             "failed": len(self.failed), "not_found": len(self.not_found),
             "already_in_cricsheet": len(self.already_in_cricsheet)}
        s["total"] = sum(s.values())
        return s


# ---- Afghanistan enumeration ---------------------------------------------------------------------
def _afg_side(entry: MatchEntry) -> tuple[str, str] | None:
    """(afghanistan_code, opponent_code) when this is a *men's senior* Afghanistan match."""
    if entry.is_women:
        return None
    a, b = entry.codes
    if code_is(a, "afg"):
        return a, b
    if code_is(b, "afg"):
        return b, a
    return None


def _nation_name(code: str) -> str | None:
    for base, name in NATIONS.items():
        if code_is(code, base):
            return name
    return None


def enumerate_afghanistan_matches(queue: BackfillQueue, index: CREXSitemapIndex,
                                  today: date | None = None) -> dict[str, int]:
    """Queue every finished Afghanistan men's match listed in CREX's match sitemap.

    Nothing is hard-coded: opponents, dates and URLs all come from the sitemap, and the page is
    re-confirmed when the task is processed. Matches whose opponent is not a known national side
    (``tbc`` placeholders, Afghanistan A / U19 sides) and matches not yet played are skipped.
    """
    today = today or date.today()
    index.load()
    stats = {"seen": 0, "queued": 0, "skipped_unplayed": 0, "skipped_unknown_opponent": 0}
    for e in index.matches:
        side = _afg_side(e)
        if side is None:
            continue
        stats["seen"] += 1
        d = e.start_date
        if d is None or d >= today:
            stats["skipped_unplayed"] += 1
            continue
        opp = _nation_name(side[1])
        if opp is None:
            stats["skipped_unknown_opponent"] += 1
            continue
        # the slug names the format ("1st-t20", "3rd-odi", "only-test"); when it does not, leave it
        # blank so the lookup does not guess (and then reject the right page for a guessed format)
        match_type = {"T20": "T20I", "ODI": "ODI", "Test": "Test"}.get(e.format_hint or "", "")
        task = BackfillTask(date=d.isoformat(), team_a="Afghanistan", team_b=opp, match_type=match_type,
                            gender="male", category="cricsheet_withheld", crex_url=e.url)
        stats["queued"] += int(queue.add_task(task))
    queue.afghanistan_enumerated_at = datetime.now().isoformat(timespec="seconds")
    return stats


def initialize_backfill_queue(queue_path: Path, verbose: bool = True) -> BackfillQueue:
    """Load the queue and top it up from Cricsheet's missing list (adds only new matches)."""
    queue = BackfillQueue.load(queue_path)
    if verbose:
        print("Fetching Cricsheet missing-matches list for backfill...")
    missing = fetch_cricsheet_missing_matches()
    if missing:
        added = queue.initialize_from_missing_list(missing)
        if verbose and added:
            print(f"Added {added} new missing match(es) to backfill queue")
    queue.save(queue_path)
    return queue


# ---- processing ----------------------------------------------------------------------------------
def _lookup(task: BackfillTask, index: CREXSitemapIndex, browser) -> LookupResult:
    """Strictly look the task up on CREX (Afghanistan tasks start from their sitemap URL)."""
    if task.crex_url:
        slug = task.crex_url.rsplit("/cricket-live-score/", 1)[-1]
        entry = index.by_slug(slug)
        if entry is None:
            return LookupResult("not_found", reason=f"{slug} is no longer in the CREX sitemap")
        try:
            page = browser.render(entry.url, wait_selector="script#sports-event-schema")
        except Exception as exc:
            return LookupResult("inconclusive", reason=str(exc)[:300])
        facts = parse_match_page(page.html, page.text, page.title, entry.url) if page.status < 400 else None
        verdict = confirm(task, entry, facts)
        if verdict.ok:
            return LookupResult("found", entry, facts)
        return LookupResult("not_found", checked=[entry.crex_id], reason="; ".join(verdict.reasons))
    return find_match(task, index, browser, skip_ids=set(task.rejected_ids))


def _already_in_cricsheet(store, task: BackfillTask) -> str | None:
    from .models import MatchRecord
    from .provisional import find_canonical
    stub = MatchRecord(match_id="", date=task.date, team_a=task.team_a, team_b=task.team_b)
    try:
        canon = find_canonical(store, stub)
    except Exception:
        return None
    return canon["match_id"] if canon else None


def process_backfill_batch(
    queue: BackfillQueue,
    index: CREXSitemapIndex,
    browser,
    store,
    verbose: bool = True,
    save: Callable[[], None] | None = None,
    sleep: Callable[[float], None] = time.sleep,
    max_cheap: int = 400,
) -> dict:
    """Process up to ``queue.batch_size`` tasks that need a CREX page render.

    Tasks the sitemap alone can rule out (nothing plausible on that date) or that Cricsheet already
    has cost no page load and do not count towards the batch size (at most ``max_cheap`` per run).
    Returns counts plus ``saved``: one line per match actually written.
    """
    from .provisional import write_provisional

    stats = {"succeeded": 0, "failed": 0, "not_found": 0, "already_in_cricsheet": 0, "saved": []}
    rendered = cheap = 0
    first_render = True
    while rendered < queue.batch_size and cheap < max_cheap:
        task = queue.next_task()
        if task is None:
            break
        label = f"{task.date} {task.team_a} v {task.team_b} ({task.match_type})"
        canon = _already_in_cricsheet(store, task)
        if canon:
            queue.mark_already_in_cricsheet(task, canon)
            stats["already_in_cricsheet"] += 1
            cheap += 1
            if verbose:
                print(f"  {label}: already in Cricsheet as {canon}")
            continue

        if not first_render:
            sleep(queue.delay_between_requests)
        result = _lookup(task, index, browser)
        used_page = bool(result.checked) or result.status != "not_found" or bool(task.crex_url)
        if used_page:
            rendered += 1
            first_render = False
        else:
            cheap += 1

        if result.status == "found":
            rec = fetch_record(browser, result.entry, result.facts, task.date, task.match_type, task.category)
            write_provisional(store, rec)
            queue.mark_done(task, rec.match_id, result.entry.url)
            stats["succeeded"] += 1
            line = f"{task.date} {rec.team_a} v {rec.team_b}: {rec.result_margin or rec.result or 'no result recorded'}"
            stats["saved"].append({"date": task.date, "teams": f"{rec.team_a} v {rec.team_b}",
                                   "result": rec.result_margin or rec.result, "match_id": rec.match_id,
                                   "category": task.category, "url": result.entry.url})
            if verbose:
                print(f"  {label}: SAVED {line}")
        elif result.status == "not_found":
            queue.mark_not_found(task, result.reason, result.checked)
            stats["not_found"] += 1
            if verbose:
                print(f"  {label}: not found ({result.reason})")
        else:
            queue.mark_failed(task, result.reason, result.checked)
            stats["failed"] += 1
            if verbose:
                print(f"  {label}: inconclusive, will retry ({result.reason})")
        if save:
            save()
    return stats
