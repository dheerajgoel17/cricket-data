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

from .adapters import feede, feedf, feedg, feedh, feedi, feedk
from .util import parse_ts

STAT ={"batter_runs": "runs", "batter_sixes": "sixes", "batter_fours": "fours", "bowler_wickets": "wickets", "player_points": "points"}
PROP_MARKETS = set(STAT) | {"top_batter_team", "top_batter_match", "top_bowler_team", "top_bowler_match", "batter_milestone", "bowler_milestone"}
PUBLIC_SOURCE = {"moviodds_bet365": "bet365"}  # published under the book's own name; the key names the feed it came through


def public_names() -> dict[str, str]:
    """Source key -> published name: the fixed ones, and the books Feed K, Feed E, Feed F, Feed G, Feed H and Feed I are configured with (named in the environment, not here)."""
    return {**PUBLIC_SOURCE, **feedk.published(), **feede.published(), **feedf.published(), **feedg.published(),
            **feedh.published(), **feedi.published()}


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
    kinds = ("events", "lines", "fancy")

    def rows_of(src: dict) -> list:
        return [x for kind in kinds for x in src.get(kind) or []]

    test_names = {x.get("match") for x in rows_of(prev) + rows_of(book) if x.get("fmt") == "Test"}
    starts: dict[str, list] = {}  # per Test pairing, every (start, raw) seen: the next Test of a series (same pair) is a window of its own
    for m in test_names:
        for x in rows_of(prev) + rows_of(book):
            st = parse_ts(x.get("start_utc")) if x.get("match") == m else None
            if st:
                starts.setdefault(m, []).append((st, x.get("start_utc")))

    def restamp(row: dict) -> dict:
        row = dict(row)
        st = parse_ts(row.get("start_utc"))
        if st and row.get("match") in starts:
            first = min((c for c in starts[row["match"]] if dt.timedelta(0) <= st - c[0] < testend.TEST_WINDOW), default=None)
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

    def line_key(x: dict):
        return (x.get("match"), x.get("pid") or x.get("player"), x.get("stat"), x.get("inn", 0), x.get("line"))

    def fancy_key(x: dict):
        return (x.get("match"), x.get("key"), x.get("scope"), x.get("team") or "", x.get("inn", 0), x.get("line"), x.get("source"), x.get("kind"))

    def row_key(kind: str, x: dict):
        if kind == "lines":
            return line_key(x)
        if kind == "fancy":
            return fancy_key(x)
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
