"""Bookmaker / exchange player lines for the site: every two-sided over/under price on a runs, sixes, fours or wickets line.

The pipeline already holds these rows (to price value bets) and used to discard them. ``book_lines`` keeps the ones whose
player was matched to the Base registry, so the site can show the market's line and decimal odds on that player's page
and use the market line as the default. Prices are decimal back prices only; no stake advice is made here.

A line is the whole match's unless it carries ``inn``: 1 or 2, the player's own side's first or second innings, which only a Test has. A Test's first-innings line is
a different bet from its match total (a book's 26.5 for the first innings and 72.5 for the match are two lines of one player), so ``inn`` is part of the line's key here,
in the archive and in the site's chart. A line with no ``inn`` is the whole match, which is how every line filed before the field existed reads.
"""
from __future__ import annotations

import datetime as dt
import json
from collections import defaultdict

from cricket_site import testend

from .adapters import feede, feedf, feedg, feedh, feedk
from .util import parse_ts

STAT ={"batter_runs": "runs", "batter_sixes": "sixes", "batter_fours": "fours", "bowler_wickets": "wickets", "player_points": "points"}
PROP_MARKETS = set(STAT) | {"top_batter_team", "top_batter_match", "top_bowler_team", "top_bowler_match", "batter_milestone", "bowler_milestone"}
PUBLIC_SOURCE = {"moviodds_bet365": "bet365"}
MATCH_TOTAL_SOURCES = ("moviodds_bet365",)  # see pipeline.MATCH_TOTAL_SOURCES: the one source that quotes a Test player's whole-match total  # published under the book's own name; the key names the feed it came through


def public_names() -> dict[str, str]:
    """Source key -> published name: the fixed ones, and the books Feed K, Feed E, Feed F, Feed G and Feed H are configured with (named in the environment, not here)."""
    return {**PUBLIC_SOURCE, **feedk.published(), **feede.published(), **feedf.published(), **feedg.published(), **feedh.published()}


def public(doc: dict) -> dict:
    """The document with every source key under its published name (rows carried over from an older pull included)."""
    s = json.dumps(doc)
    for key, name in sorted(public_names().items(), key=lambda kv: -len(kv[0])):  # longest first: one key may start another
        s = s.replace(key, json.dumps(name)[1:-1])
    return json.loads(s)
FMT = {"T20": "T20", "ODI": "ODI", "MULTI": "Test"}  # the pipeline calls a multi-day match MULTI; the site calls it Test


def prop_events(rows: list[dict]) -> list[dict]:
    """Every pre-match event on which any book prices a player prop (over/unders, top batter/bowler, milestones), not only the
    two-sided lines ``book_lines`` keeps. The site uses it to show which fixtures have props right now. Sorted by start time."""
    evs: dict[str, dict] = {}
    names = public_names()
    for r in rows:
        if r.get("market_type") not in PROP_MARKETS or r.get("in_play") or not r.get("back") or not r.get("event_key"):
            continue
        e = evs.setdefault(r["event_key"], {"match": r.get("match"), "competition": r.get("competition"), "start_utc": r.get("start_utc"),
                                            "markets": set(), "sources": set(), "n": 0})
        e["markets"].add(r["market_type"])
        e["sources"].add(names.get(r.get("source"), r.get("source")))
        e["n"] += 1
    out = [{**e, "markets": sorted(e["markets"]), "sources": sorted(x for x in e["sources"] if x)} for e in evs.values()]
    return sorted(out, key=lambda e: (e["start_utc"] or "", e["match"] or ""))


def book_lines(rows: list[dict], generated_at: str, fancy: list[dict] | None = None) -> dict:
    """rows: pipeline rows after player resolution. Returns {"generated_at_utc", "lines": [...], "events": [...], "fancy": [...]}; lines are sorted by start time, player, stat, line."""
    groups: dict[tuple, dict] = {}
    names = public_names()
    for r in rows:
        stat = STAT.get(r.get("market_type"))
        pid, line, side, back = r.get("player_id"), r.get("line"), r.get("side"), r.get("back")
        if not stat or not pid or line is None or side not in ("over", "under") or not back or r.get("in_play"):
            continue
        fmt = FMT.get(r.get("fmt") or "")
        inn = r.get("inn") or 0
        if fmt is None or (inn and fmt != "Test"):  # only a Test has an innings of its own to price
            continue
        key = (r["event_key"], pid, stat, inn, float(line))
        g = groups.setdefault(key, {
            "pid": pid, "player": r.get("player_hist_name") or r.get("player"), "book_name": r.get("player"), "team": r.get("player_team"), "fmt": fmt, "stat": stat,
            "line": float(line), **({"inn": inn} if inn else {}), "match": r.get("match"), "competition": r.get("competition"), "start_utc": r.get("start_utc"), "_books": defaultdict(dict)})
        g["_books"][(r["source"], r.get("source_type"))][side] = round(float(back), 3)
    lines = []
    for g in groups.values():
        books = [{"source": names.get(s, s), "kind": k, "over": sides.get("over"), "under": sides.get("under")}
                 for (s, k), sides in sorted(g.pop("_books").items(), key=lambda kv: kv[0])
                 ]  # an exchange's Yes (over) and No (under) sit on their own lines: each is a line of its own, with the other side empty
        if books:
            lines.append({**g, "books": books})
    lines.sort(key=lambda x: (x["start_utc"] or "", x["player"] or "", x["stat"], x.get("inn", 0), x["line"]))
    return {"generated_at_utc": generated_at, "lines": lines, "events": prop_events(rows), "fancy": fancy or []}


LIVE_KEEP = dt.timedelta(hours=40)  # buffer past the site's 24 h keep so a late pull still has the closing line
TEST_KEEP = dt.timedelta(days=6)  # a multi-day match carries on across days


def rescope_prev(prev: dict) -> dict:
    """The previous pull with a Test's earlier complete-match lines from books that do not quote the match total moved to their 1st-innings entry: earlier runs filed them untagged
    (`pipeline.scope_multiday_rows`), and carrying that over would keep the wrong scope for the rest of the match. bet365's own match totals stay. Nothing else changes."""
    total = {public_names().get(k, k) for k in MATCH_TOTAL_SOURCES}
    out, moved = [], []
    for x in prev.get("lines") or []:
        if x.get("fmt") != "Test" or x.get("inn") or x.get("stat") not in ("runs", "fours", "sixes", "wickets"):
            out.append(x)
            continue
        keep = [b for b in x.get("books") or [] if b.get("source") in total]
        other = [b for b in x.get("books") or [] if b.get("source") not in total]
        if keep:
            out.append({**x, "books": keep})
        if other:
            moved.append({**x, "inn": 1, "books": other})
    return {**prev, "lines": out + moved} if moved else prev


KINDS = ("events", "lines", "fancy")


def _rows_of(src: dict) -> list:
    return [x for kind in KINDS for x in src.get(kind) or []]


def _test_starts(*docs: dict) -> tuple[set, dict]:
    """(the names of the Tests in these documents, per Test pairing every (start, raw) seen): the next Test of a series (same pair) is a window of its own."""
    rows = [x for d in docs for x in _rows_of(d)]
    names = {x.get("match") for x in rows if x.get("fmt") == "Test"}
    starts: dict[str, list] = {}
    for m in names:
        for x in rows:
            st = parse_ts(x.get("start_utc")) if x.get("match") == m else None
            if st:
                starts.setdefault(m, []).append((st, x.get("start_utc")))
    return names, starts


def _first_start(row: dict, starts: dict) -> tuple | None:
    """(start, raw) of the first morning of the Test this row belongs to: the earliest start seen within ``TEST_WINDOW`` before the row's own. None for a match that is not a Test."""
    st = parse_ts(row.get("start_utc"))
    if st and row.get("match") in starts:
        return min((c for c in starts[row["match"]] if dt.timedelta(0) <= st - c[0] < testend.TEST_WINDOW), default=None)
    return None


def _line_key(x: dict):
    return (x.get("match"), x.get("pid") or x.get("player"), x.get("stat"), x.get("inn", 0), x.get("line"))


def _fancy_key(x: dict):
    return (x.get("match"), x.get("key"), x.get("scope"), x.get("team") or "", x.get("inn", 0), x.get("line"), x.get("source"), x.get("kind"))


def hold_started(book: dict, prev: dict | None, now: dt.datetime) -> tuple[dict, dict]:
    """The pull without the lines and fancy lines of a match that has started and that the previous published file did not have: ``(book, {"lines": n, "fancy": n})`` with the counts held back.

    The file is pre-match prices only, and statistics and settlement read it that way. A book stops listing a match at the first ball, but a **Test** is listed again between days
    under the next morning's start, with every price conditional on the score so far: a batter on 57 at stumps is priced 95.5 for his innings, and the pull files that as a 1st-innings
    line beside his real pre-match 31.5. Nothing in the row says it is in play (the book calls the event not started), so the rule is about when the line first shows: once the match has
    begun, whatever was not in the file before is not a pre-match line and is not added. What the file already had is untouched (closing prices still refresh, a book that stops quoting
    is carried by ``carry_started``). A Test has begun when the first morning of its window (restamped days included, ``TEST_WINDOW``) has passed; any other match when the row's own
    start has. Applies to every league and format. Events are not prices and are left alone. With no previous file there is nothing to tell new from old, so nothing is held back.
    """
    none = {"lines": 0, "fancy": 0}
    if not prev or not (prev.get("lines") or prev.get("fancy")):
        return book, none
    prev = rescope_prev(prev)
    _, starts = _test_starts(prev, book)
    known = {"lines": {_line_key(x) for x in prev.get("lines") or []}, "fancy": {_fancy_key(x) for x in prev.get("fancy") or []}}
    keyed = {"lines": _line_key, "fancy": _fancy_key}

    def begun(row: dict) -> bool:
        first = _first_start(row, starts)
        st = first[0] if first else parse_ts(row.get("start_utc"))
        return bool(st) and st <= now

    out, held = dict(book), dict(none)
    for kind, key in keyed.items():
        keep = [x for x in book.get(kind) or [] if key(x) in known[kind] or not begun(x)]
        held[kind] = len(book.get(kind) or []) - len(keep)
        out[kind] = keep
    return out, held


def carry_started(book: dict, prev: dict | None, now: dt.datetime, ended: list | None = None) -> dict:
    """Keep matches that have started in the published file. Books stop pricing a match at the first ball, so the next pull would drop it and
    the site would lose the match mid-play (the live board, "so far" numbers and the lines they are read against). A match that began recently
    and has no rows of a kind in this pull keeps the previous pull's rows of that kind: the last pre-match prices. Upcoming matches are never
    revived, and a match is let go after ``LIVE_KEEP`` (``TEST_KEEP`` for a multi-day one). A Test that has a result goes ``RESULT_KEEP`` after it ended instead of
    after ``TEST_KEEP``; ``ended`` is ``cricket_site.testend.ended`` (match, start, end) from the archive, and a Test with no result yet (stumps, a rain day) keeps its 6 days.

    A Test is one match: books restamp ``start_utc`` each morning, so rows of the same pair within ``TEST_KEEP`` keep the earliest start
    (the first morning) and merge by player / stat / inn / line. A first-innings line is not dropped when a later day's pull only has the match total.

    Player lines (limited-overs too) merge by player / stat / inn / line: books drop off at different times, so a post-start pull that still has
    one book must not wipe another book's closing line for the same match. Fancy rows merge by market / team / line / source the same way.
    Events still key by match (and start for limited overs). When the same player line is in both pulls, sources the new pull lacks are kept
    from the previous one (closing prices); prices the new pull still has win.
    """
    if not prev:
        return book
    prev = rescope_prev(prev)
    kinds = KINDS
    test_names, starts = _test_starts(prev, book)

    def restamp(row: dict) -> dict:
        row = dict(row)
        first = _first_start(row, starts)
        if first:
            row["start_utc"] = first[1]
        return row

    def is_test(row: dict) -> bool:
        return row.get("fmt") == "Test" or row.get("match") in test_names

    def alive(row: dict) -> bool:
        st = parse_ts(row.get("start_utc"))
        if not st or st > now:
            return False
        if not is_test(row):
            return now < st + LIVE_KEEP
        over = [end for m, start, end in ended or [] if m == row.get("match") and abs(start - st) < testend.TEST_WINDOW]  # the Test's result, if the archive has one
        return now < st + TEST_KEEP and not (over and testend.gone(min(over), now))

    def order(x: dict):
        line = x.get("line")
        return (x.get("start_utc") or "", x.get("match") or "", x.get("player") or "", x.get("stat") or x.get("key") or "", x.get("team") or "", x.get("inn", 0),
                line if isinstance(line, (int, float)) else 0.0)

    def row_key(kind: str, x: dict):
        if kind == "lines":
            return _line_key(x)
        if kind == "fancy":
            return _fancy_key(x)
        return x.get("match") if is_test(x) else (x.get("match"), x.get("start_utc"))

    def merge_books(cur: dict, old: dict) -> dict:
        books = {(b.get("source"), b.get("kind")): b for b in cur.get("books") or []}
        for b in old.get("books") or []:
            k = (b.get("source"), b.get("kind"))
            if k not in books:
                books[k] = b
        return {**cur, "books": [books[k] for k in sorted(books)]}

    out = dict(book)
    for kind in kinds:
        by: dict = {}
        for x in book.get(kind) or []:
            y = restamp(x)
            by[row_key(kind, y)] = y
        for x in prev.get(kind) or []:
            y = restamp(x)
            if not alive(y):
                continue
            k = row_key(kind, y)
            if k not in by:
                by[k] = y
            elif kind == "lines":
                by[k] = merge_books(by[k], y)
        out[kind] = sorted(by.values(), key=order)
    return public(out)
