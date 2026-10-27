"""Permanent archive of what the books priced for every match: ``value_bets/archive/YYYY-MM/<fixture id>.json``, one file per match, never deleted.

``book_lines.json`` carries a match for a day and a half after it starts and is then let go. The archive keeps the match's props for good, so a link to
the fixture keeps showing them, and the files are the start of a historical record. A file only grows: a later pull adds the lines it did not have, and
changes the price of a line already there only inside the last ``CLOSE`` before the start (the closing prices), so an hourly run does not rewrite every
file. The file name is the fixture id the site uses (``start date`` + team slugs, from the schedule when it lists the match).
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import re
from pathlib import Path

from . import config
from .booklines import public
from .util import parse_ts

CLOSE = dt.timedelta(hours=3)  # prices are refreshed inside this window before the start: the last pull is the closing price
SAME = 14 * 3600  # seconds: books and the schedule disagree on kick-off by hours
KINDS = ("events", "lines", "fancy")
SHARED = ("match", "competition", "start_utc")  # carried once per file, not on every line


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")


def fixture_id(start: str, a: str, b: str) -> str:
    """The site's fixture id (``cricket_site.build.build_fixtures``): the start date and the two team names."""
    return f"{start[:10]}-{_slug(a)}-v-{_slug(b)}"


def team_key(n: str) -> str:
    """The site's ``teamKey``: case, "(W)" / "Women" and punctuation ignored."""
    return re.sub(r"[^a-z0-9]", "", re.sub(r"\(w\)|women'?s?", "", str(n or "").lower()))


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
                     "events": [], "lines": [], "fancy": []}
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
        if {team_key(f.get("team_a")), team_key(f.get("team_b"))} == g["k"] and st and abs((st - g["start"]).total_seconds()) < 12 * 3600:
            return f
    return None


def _fixture_record(f: dict, fid: str) -> dict:
    return {"id": fid, "start": f["start_utc"], "fmt": f.get("format", ""), "gender": f.get("gender", ""), "a": f["team_a"], "b": f["team_b"],
            "venue": f.get("venue", ""), "series": f.get("series", "")}


def _slim(line: dict) -> dict:
    return {k: v for k, v in line.items() if k not in SHARED}


KEY = {
    "lines": lambda x: (x["pid"], x["stat"], x["line"]),
    "events": lambda x: (x.get("match"), x.get("start_utc")),
    "fancy": lambda x: (x.get("key"), x.get("scope"), x.get("team") or "", x.get("line"), x.get("source"), x.get("kind")),
}
ORDER = {
    "lines": lambda x: (x.get("player") or "", x["stat"], x["line"]),
    "events": lambda x: (x.get("match") or "", x.get("start_utc") or ""),
    "fancy": lambda x: (x.get("key") or "", x.get("scope") or "", x.get("team") or "", x.get("line") or 0, x.get("source") or ""),
}


def _combine(kind: str, old: dict, new: dict, refresh: bool) -> dict:
    """The same line / event / fancy line seen again: what the old one had stays; the new prices replace the old only when ``refresh``."""
    if kind == "lines":
        books = {(b["source"], b["kind"]): b for b in old["books"]}
        for b in new["books"]:
            if refresh or (b["source"], b["kind"]) not in books:
                books[(b["source"], b["kind"])] = b
        return {**(new if refresh else old), "books": [books[k] for k in sorted(books)]}
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
               **{k: _merge(k, (old or {}).get(k, []), [_slim(x) if k == "lines" else x for x in g[k]], refresh) for k in KINDS}}
        if old is not None and {k: v for k, v in new.items() if k != "updated"} == {k: v for k, v in old.items() if k != "updated"}:
            continue
        new["updated"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(public(new), separators=(",", ":")), encoding="utf-8")
        tmp.replace(path)
        written.append(fid)
    return written, bad


def main(argv: list[str] | None = None) -> int:
    """Archive the matches in a book file as they are (the one-off start of the archive, or a rebuild from an old copy of the file)."""
    ap = argparse.ArgumentParser(description=main.__doc__)
    ap.add_argument("--book", default=str(config.OUT / "book_lines.json"))
    ap.add_argument("--schedule", default=str(config.DATA_REPO / "data" / "fixtures" / "upcoming.csv"))
    a = ap.parse_args(argv)
    sched = []
    if Path(a.schedule).exists():
        with open(a.schedule, encoding="utf-8", newline="") as fh:
            sched = list(csv.DictReader(fh))
    wrote, bad = update(config.ARCHIVE, json.loads(Path(a.book).read_text(encoding="utf-8")), dt.datetime.now(dt.timezone.utc), None, sched, force=True)
    print(json.dumps({"written": wrote, "unreadable": bad}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
