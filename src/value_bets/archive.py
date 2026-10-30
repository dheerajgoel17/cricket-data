"""Permanent archive of what the books priced for every match: ``value_bets/archive/YYYY-MM/<fixture id>.json``, one file per match, never deleted.

``book_lines.json`` carries a match for a day and a half after it starts and is then let go. The archive keeps the match's props for good, so a link to
the fixture keeps showing them, and the files are the start of a historical record. A file only grows: a later pull adds the lines it did not have, and
changes the price of a line already there only inside the last ``CLOSE`` before the start (the closing prices), so an hourly run does not rewrite every
file. Feed H also files ``catalogue``: every open market of a fetched match (mapped or not) as compact rows of name, player, line and both decimal
prices, so a later mapping can be pointed at a market we already stored. An empty catalogue is not written, so older files are not rewritten just to
add the key. The file name is the fixture id the site uses (``start date`` + team slugs, from the schedule when it lists the match).

Once a match is over its file also gets ``results``: ``[{pid, stat, value}]``, what each priced player actually did, as the site's live route settled it
(``settle``). They are only ever added, never changed, so an old fixture page needs neither the live feed nor any name matching to show how its lines went.

A Test's first-innings line (``inn``: 1, see ``booklines``) is a line of its own: the same player, stat and number as a match-total line is a different bet, so ``inn`` is
part of the key of a line and of its result (``{pid, stat, inn, value}``). A line or result with no ``inn`` is the whole match's, which is every one filed before the
field existed, and those files read and sort exactly as they did.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import re
import time
import urllib.request
from pathlib import Path

from cricket_site.wrap import unwrap as unwrap_data

from . import config
from .booklines import public
from .util import parse_ts

CLOSE = dt.timedelta(hours=3)  # prices are refreshed inside this window before the start: the last pull is the closing price
SAME = 14 * 3600  # seconds: books and the schedule disagree on kick-off by hours
KINDS = ("events", "lines", "fancy", "catalogue")
SHARED = ("match", "competition", "start_utc")  # carried once per file, not on every line


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")


def fixture_id(start: str, a: str, b: str) -> str:
    """The site's fixture id (``cricket_site.build.build_fixtures``): the start date and the two team names."""
    return f"{start[:10]}-{_slug(a)}-v-{_slug(b)}"


SAME_SIDE = {"aucklandaces": "auckland", "canterburykings": "canterbury", "wellingtonfirebirds": "wellington", "otagovolts": "otago", "northerndistricts": "northernbrave"}


def team_key(n: str) -> str:
    """The site's ``teamKey``: case, "(W)" / "Women" / a trailing W, and punctuation ignored, and a side the books and the schedule name differently is one key (``SAME_SIDE`` in site/src/engine/util.js)."""
    k = re.sub(r"[^a-z0-9]", "", re.sub(r"\(w\)|women'?s?|\sw$", "", str(n or "").lower()))
    return SAME_SIDE.get(k, k)


def _sides(x: dict) -> tuple[str, str]:
    if x.get("home") and x.get("away"):
        return x["home"], x["away"]
    p = re.split(r"\s+vs\s+", str(x.get("match") or ""), maxsplit=1, flags=re.I)
    return (p[0], p[1]) if len(p) == 2 else ("", "")


def group(book: dict) -> list[dict]:
    """A pull's events, lines and fancy lines gathered per match: the same two sides, starts within 14 hours."""
    out: list[dict] = []
    for kind in KINDS:
        for x in book.get(kind, []):
            a, b = _sides(x)
            st = parse_ts(x.get("start_utc"))
            if not (a and b and st):
                continue
            k = frozenset((team_key(a), team_key(b)))
            g = next((g for g in out if g["k"] == k and abs((g["start"] - st).total_seconds()) < SAME), None)
            if g is None:
                g = {"k": k, "start": st, "match": x.get("match") or f"{a} vs {b}", "start_utc": x["start_utc"], "competition": x.get("competition"),
                     **{kind: [] for kind in KINDS}}
                out.append(g)
            elif not g["competition"] and x.get("competition"):
                g["competition"] = x["competition"]
            g[kind].append(x)
    return out


def _fixture(g: dict, fx_of: dict, schedule: list[dict]) -> dict | None:
    """The schedule row of this match: as the pipeline resolved it (names and aliases), else by the two team names and the start."""
    for kind in KINDS:
        for x in g[kind]:
            if (f := fx_of.get((x.get("match"), x.get("start_utc")))):
                return f
    for f in schedule:
        st = parse_ts(f.get("start_utc"))
        if {team_key(f.get("team_a")), team_key(f.get("team_b"))} == g["k"] and st and abs((st - g["start"]).total_seconds()) < (6 * 86400 if f.get("format") == "Test" else 12 * 3600):  # a Test is priced day by day
            return f
    return None


def _fixture_record(f: dict, fid: str) -> dict:
    return {"id": fid, "start": f["start_utc"], "fmt": f.get("format", ""), "gender": f.get("gender", ""), "a": f["team_a"], "b": f["team_b"],
            "venue": f.get("venue", ""), "series": f.get("series", "")}


def _slim(line: dict) -> dict:
    return {k: v for k, v in line.items() if k not in SHARED}


KEY = {
    "lines": lambda x: (x["pid"], x["stat"], x.get("inn", 0), x["line"]),
    "events": lambda x: (x.get("match"), x.get("start_utc")),
    "fancy": lambda x: (x.get("key"), x.get("scope"), x.get("team") or "", x.get("inn", 0), x.get("line"), x.get("source"), x.get("kind")),
    "catalogue": lambda x: (x.get("name"), x.get("player") or "", x.get("team") or "", x.get("line") or 0, x.get("source") or ""),
}
ORDER = {
    "lines": lambda x: (x.get("player") or "", x["stat"], x.get("inn", 0), x["line"]),
    "events": lambda x: (x.get("match") or "", x.get("start_utc") or ""),
    "fancy": lambda x: (x.get("key") or "", x.get("scope") or "", x.get("team") or "", x.get("inn", 0), x.get("line") or 0, x.get("source") or ""),
    "catalogue": lambda x: (x.get("name") or "", x.get("player") or "", x.get("team") or "", x.get("line") or 0, x.get("source") or ""),
}


def _combine(kind: str, old: dict, new: dict, refresh: bool) -> dict:
    """The same line / event / fancy line seen again: what the old one had stays; the new prices replace the old only when ``refresh``."""
    if kind == "lines":
        books = {(b["source"], b["kind"]): b for b in old["books"]}
        for b in new["books"]:
            if refresh or (b["source"], b["kind"]) not in books:
                books[(b["source"], b["kind"])] = b
        return {**({**old, **new} if refresh else {**new, **old}), "books": [books[k] for k in sorted(books)]}  # a field the old line lacked (``book_name``) is added, never taken away
    if kind == "events":
        return {**(new if refresh else old), "markets": sorted({*old.get("markets", []), *new.get("markets", [])}),
                "sources": sorted({*old.get("sources", []), *new.get("sources", [])}), "n": max(old.get("n", 0), new.get("n", 0))}
    return new if refresh else old


def _merge(kind: str, old: list[dict], new: list[dict], refresh: bool) -> list[dict]:
    items = {KEY[kind](x): x for x in old}
    for x in new:
        k = KEY[kind](x)
        items[k] = _combine(kind, items[k], x, refresh) if k in items else x
    return sorted(items.values(), key=ORDER[kind])


def _read(path: Path) -> dict | None:
    """The file, or None if there is none. An unreadable one raises: it is left as it is, never overwritten."""
    if not path.exists():
        return None
    d = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(d, dict):
        raise ValueError("not a match file")
    return d


def update(root: Path, book: dict, now: dt.datetime, fx_of: dict | None = None, schedule: list[dict] | None = None, force: bool = False) -> tuple[list[str], list[str]]:
    """Archive one pull of ``book_lines`` (before ``carry_started`` adds the old rows back). Returns (ids written, ids left alone because unreadable).

    ``fx_of`` maps (match, start_utc) to the schedule row the pipeline resolved; ``schedule`` is the fallback. ``force`` refreshes prices whatever the time."""
    written, bad = [], []
    for g in group(book):
        f = _fixture(g, fx_of or {}, schedule or [])
        a, b = (f["team_a"], f["team_b"]) if f else _sides({"match": g["match"]})
        fid = fixture_id(f["start_utc"] if f else g["start_utc"], a, b)
        path = root / fid[:7] / f"{fid}.json"
        try:
            old = _read(path)
        except (ValueError, OSError):
            bad.append(fid)
            continue
        refresh = force or g["start"] - CLOSE <= now
        new = {"id": fid, "match": (old or g)["match"], "competition": (old or {}).get("competition") or g["competition"], "start_utc": (old or g)["start_utc"],
               "fixture": _fixture_record(f, fid) if f else (old or {}).get("fixture"),
               "first_seen": (old or {}).get("first_seen") or now.strftime("%Y-%m-%dT%H:%M:%SZ"),
               **{k: _merge(k, (old or {}).get(k, []), [_slim(x) if k == "lines" else x for x in g[k]], refresh) for k in KINDS},
               **({"results": old["results"]} if (old or {}).get("results") else {})}  # stored by ``settle``, never touched here
        if not new.get("catalogue") and not (old or {}).get("catalogue"):
            new.pop("catalogue", None)  # do not rewrite every older file just to add an empty key
        if old is not None and {k: v for k, v in new.items() if k != "updated"} == {k: v for k, v in old.items() if k != "updated"}:
            continue
        new["updated"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(public(new), separators=(",", ":")), encoding="utf-8")
        tmp.replace(path)
        written.append(fid)
    return written, bad


def book_names(root: Path, *books: dict) -> dict[str, str]:
    """{player id: the name the books use} for every player the archive and the given book files know by exactly one such name (two spellings: left out)."""
    seen: dict[str, set[str]] = {}
    docs = [*books]
    for f in sorted(root.glob("*/*.json")):
        try:
            docs.append(_read(f) or {})
        except (ValueError, OSError):
            pass
    for d in docs:
        for ln in d.get("lines", []):
            if ln.get("pid") and ln.get("book_name"):
                seen.setdefault(ln["pid"], set()).add(ln["book_name"])
    return {p: next(iter(n)) for p, n in seen.items() if len(n) == 1}


def backfill(root: Path, *books: dict) -> list[str]:
    """Add ``book_name`` to archived lines that were filed before the field existed, from the name the books use for that player on other lines.
    Only ever adds a field: no line, price or file is removed or changed. Returns the ids of the files that gained names."""
    names = book_names(root, *books)
    changed = []
    for f in sorted(root.glob("*/*.json")):
        try:
            d = _read(f)
        except (ValueError, OSError):
            continue  # an unreadable file is left alone
        todo = [ln for ln in (d or {}).get("lines", []) if not ln.get("book_name") and ln.get("pid") in names]
        if not todo:
            continue
        for ln in todo:
            ln["book_name"] = names[ln["pid"]]
        tmp = f.with_suffix(".tmp")
        tmp.write_text(json.dumps(public(d), separators=(",", ":")), encoding="utf-8")
        tmp.replace(f)
        changed.append(d["id"])
    return changed


def match_results(m: dict) -> dict[tuple[str, str, int], int | float]:
    """{(pid, stat, inn): value} (``inn`` 0 for the whole match) for the lines of a live match that are settled for good: the site's live route marks each priced line with
    its value and state, and a ``final`` state in a ``final`` match is a result. So is a ``final`` innings line (``inn`` set) in a match still being played: the innings is
    over once the side's next one has begun, and what a batter made in it cannot change. A player ruled out of the XI has no value; one whose lines disagree on it (never
    expected) is left out."""
    seen: dict[tuple[str, str, int], set] = {}
    for x in m.get("lines") or []:
        inn = x.get("inn") or 0
        if (m.get("status") == "final" or inn) and x.get("state") == "final" and x.get("value") is not None and not x.get("notInXI") and x.get("pid") and x.get("stat"):
            seen.setdefault((x["pid"], x["stat"], inn), set()).add(x["value"])
    return {k: next(iter(v)) for k, v in seen.items() if len(v) == 1}


def _same_match(d: dict, keys: frozenset, start: dt.datetime) -> bool:
    """Is this archive file the match between these two sides (``team_key``s) that started at ``start``?"""
    st = parse_ts(d.get("start_utc"))
    if not st or abs((st - start).total_seconds()) >= SAME:
        return False
    f = d.get("fixture") or {}
    return keys in (frozenset(team_key(x) for x in _sides({"match": d.get("match")})), frozenset((team_key(f.get("a")), team_key(f.get("b")))))


def settle(root: Path, bodies: list[dict], now: dt.datetime) -> tuple[list[str], list[str]]:
    """Store what finished matches decided: add ``results`` to the archive file of every match the live route (``/api/live``) reports as final.
    Takes the route's body read more than once, some time apart, and keeps only the values every read agrees on, so a card a few seconds behind the final ball is
    never written down. A file only gains results: a (player, stat, innings) already there is never changed, one that was missing is added later. Results are kept for lines
    the archive priced only. Returns (ids written, ids left alone because unreadable)."""
    written, bad = [], []
    if not bodies:
        return written, bad
    for m in bodies[0].get("matches") or []:
        got = match_results(m)
        for body in bodies[1:]:
            twin = next((x for x in body.get("matches") or [] if x.get("id") == m.get("id")), {})
            theirs = match_results(twin)
            got = {k: v for k, v in got.items() if k in theirs and theirs[k] == v}
        keys = frozenset(team_key(t.get("name")) for t in m.get("teams") or [])
        start = parse_ts(m.get("start"))
        if not got or len(keys) != 2 or not start:
            continue
        months = {(start + dt.timedelta(days=d)).strftime("%Y-%m") for d in (-1, 0, 1)}
        for path in sorted(p for mo in months for p in (root / mo).glob("*.json")):
            try:
                d = _read(path)
            except (ValueError, OSError):
                bad.append(path.stem)
                continue
            if not d or not _same_match(d, keys, start):
                continue
            priced = {(x["pid"], x["stat"], x.get("inn", 0)) for x in d.get("lines", [])}
            have = {(r["pid"], r["stat"], r.get("inn", 0)) for r in d.get("results", [])}
            add = [{"pid": p, "stat": s, **({"inn": i} if i else {}), "value": v} for (p, s, i), v in sorted(got.items()) if (p, s, i) in priced and (p, s, i) not in have]
            if not add:
                continue
            d["results"] = sorted([*d.get("results", []), *add], key=lambda r: (r["pid"], r["stat"], r.get("inn", 0)))
            d["updated"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
            tmp = path.with_suffix(".tmp")
            tmp.write_text(json.dumps(public(d), separators=(",", ":")), encoding="utf-8")
            tmp.replace(path)
            written.append(d["id"])
    return written, bad


def _plain(doc):
    """Unwrap a live body when DATA_WRAP_KEY is set; a still-wrapped dict has no matches list."""
    secret = os.environ.get("DATA_WRAP_KEY", "").strip()
    out = unwrap_data(doc, secret)
    if isinstance(out, dict) and out.get("v") == 1 and "ct" in out:
        raise ValueError("wrapped live body")
    return out


def _read_body(src: str) -> dict:
    """The live route's body from a URL or a file."""
    if re.match(r"https?://", src):
        req = urllib.request.Request(src, headers={"user-agent": "cricket-props-hub-archive/1", "accept": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return _plain(json.load(r))
    return _plain(json.loads(Path(src).read_text(encoding="utf-8")))


def main(argv: list[str] | None = None, sleep=time.sleep) -> int:
    """Archive the matches in a book file as they are (the one-off start of the archive, or a rebuild from an old copy of the file).
    With --backfill-book-names it only adds the books' names to archived lines that lack them. With --results URL_OR_FILE it adds the results of finished matches
    (read from the site's live route, twice, --again seconds apart) to their files."""
    ap = argparse.ArgumentParser(description=main.__doc__)
    ap.add_argument("--book", default=str(config.OUT / "book_lines.json"))
    ap.add_argument("--schedule", default=str(config.DATA_REPO / "data" / "fixtures" / "upcoming.csv"))
    ap.add_argument("--backfill-book-names", action="store_true")
    ap.add_argument("--results", metavar="URL_OR_FILE")
    ap.add_argument("--again", type=float, default=60.0, help="seconds between the two reads of the live route (--results)")
    a = ap.parse_args(argv)
    if a.results:
        try:
            first = _read_body(a.results)
            if any(match_results(m) for m in first.get("matches") or []):  # something is settled for good: read it again to be sure
                sleep(a.again if a.results.startswith("http") else 0)
                bodies = [first, _read_body(a.results)]
            else:
                bodies = []
        except (OSError, ValueError) as e:  # the route being down must not fail the hourly run: the next one tries again
            print(f"::warning::live route not read ({type(e).__name__}); no results stored")
            return 0
        wrote, bad = settle(config.ARCHIVE, bodies, dt.datetime.now(dt.timezone.utc))
        print(json.dumps({"results_written": wrote, "unreadable": bad}))
        return 0
    if a.backfill_book_names:
        book = json.loads(Path(a.book).read_text(encoding="utf-8")) if Path(a.book).exists() else {}
        print(json.dumps({"filled": backfill(config.ARCHIVE, book)}))
        return 0
    sched = []
    if Path(a.schedule).exists():
        with open(a.schedule, encoding="utf-8", newline="") as fh:
            sched = list(csv.DictReader(fh))
    wrote, bad = update(config.ARCHIVE, json.loads(Path(a.book).read_text(encoding="utf-8")), dt.datetime.now(dt.timezone.utc), None, sched, force=True)
    print(json.dumps({"written": wrote, "unreadable": bad}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
