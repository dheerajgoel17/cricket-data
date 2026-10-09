"""Command line: `cricket-data update | backfill | query | stats | export-sqlite`."""
from __future__ import annotations

import argparse
import csv
import sqlite3
import sys
from datetime import date, timedelta
from pathlib import Path

from . import __version__
from .cricsheet import download, iter_zip
from .models import MATCH_FIELDS, PLAYER_FIELDS
from .provisional import find_canonical, load_provisional, reconcile, write_provisional
from .scrapers import ScraperSource
from .sources import InboxSource, load_extra_sources
from .store import Store

DEFAULT_DATA = "data"


def _write_scraper_report(store: Store, conflicts: list) -> None:
    """Write scraper conflict report to a CSV file."""
    import json as json_mod
    report_path = store.root / "scraper_report.csv"
    new = not report_path.exists()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with report_path.open("a", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["timestamp", "date", "teams", "sources", "disagreements"], lineterminator="\n")
        if new:
            w.writeheader()
        for conflict in conflicts:
            w.writerow({
                "timestamp": date.today().isoformat(),
                "date": conflict["date"],
                "teams": conflict["teams"],
                "sources": ",".join(conflict["sources"]),
                "disagreements": json_mod.dumps(conflict["disagreements"]),
            })


def _ingest_zip(store: Store, zip_path: Path) -> dict[str, int]:
    return store.upsert(iter_zip(zip_path))


def cmd_update(a: argparse.Namespace) -> int:
    store = Store(a.data_dir)
    if a.zip:
        stats = _ingest_zip(store, Path(a.zip))
    else:
        z = download(a.dataset)
        try:
            stats = _ingest_zip(store, z)
        finally:
            z.unlink(missing_ok=True)  # never keep the archive: saves space
    print(f"cricsheet: {stats}")

    since = date.today() - timedelta(days=a.provisional_days)
    sources = [InboxSource(store.root / "provisional" / "inbox"), *load_extra_sources()]
    
    # Add web scraper if enabled
    if a.enable_scraper:
        sources.append(ScraperSource())
    
    added = 0
    scraper_conflicts = []
    for src in sources:
        try:
            for rec in src.fetch(since):
                if find_canonical(store, rec) is None:  # skip anything Cricsheet already has
                    write_provisional(store, rec)
                    added += 1
            
            # Capture conflict log from scraper
            if isinstance(src, ScraperSource) and src.scraper.conflict_log:
                scraper_conflicts.extend(src.scraper.get_conflict_log())
        except Exception as exc:  # one broken source must not stop the daily run
            print(f"warning: source {src.name} failed: {exc}", file=sys.stderr)
    print(f"provisional: {added} written")
    
    # Report scraper conflicts
    if scraper_conflicts:
        print(f"scraper conflicts: {len(scraper_conflicts)} resolved", file=sys.stderr)
        _write_scraper_report(store, scraper_conflicts)

    inbox = InboxSource(store.root / "provisional" / "inbox")
    removed = inbox.cleanup(lambda rec: find_canonical(store, rec) is not None)
    if removed:
        print(f"inbox: {removed} landed file(s) deleted")
    rstats = reconcile(store)
    print(f"reconcile: {rstats}")
    if rstats["mismatched"]:
        print("warning: provisional data disagreed with Cricsheet; see reconcile_log.csv", file=sys.stderr)
    return 0


def cmd_backfill(a: argparse.Namespace) -> int:
    a.dataset = a.dataset or "all_json.zip"
    a.provisional_days = 30
    return cmd_update(a)


def cmd_stats(a: argparse.Namespace) -> int:
    store = Store(a.data_dir)
    months = store.months("matches")
    n = sum(len(store.read("matches", m)) for m in months)
    prov = load_provisional(store)
    print(f"matches: {n}  partitions: {len(months)}  range: {months[0] if months else '-'}..{months[-1] if months else '-'}")
    print(f"provisional pending: {len(prov)}")
    return 0


def cmd_query(a: argparse.Namespace) -> int:
    store = Store(a.data_dir)
    q = a.player.lower()
    rows = [r for r in store.iter_all("players")
            if q in r["player"].lower() and (not a.since or r["date"] >= a.since)
            and (not a.until or r["date"] <= a.until)]
    matches = {r["match_id"]: r for r in store.iter_all("matches")}
    if a.format:
        rows = [r for r in rows if matches.get(r["match_id"], {}).get("match_type") == a.format]
    rows.sort(key=lambda r: r["date"])
    w = csv.writer(sys.stdout, lineterminator="\n")
    w.writerow(["date", "type", "player", "team", "vs", "runs", "balls", "wkts", "catches", "stumpings", "points"])
    for r in rows[-a.limit:]:
        w.writerow([r["date"], matches.get(r["match_id"], {}).get("match_type", ""), r["player"],
                    r["team"], r["opponent"], r["runs"], r["balls"], r["wickets"],
                    r["catches"], r["stumpings"], r["points"]])
    return 0


def cmd_export_sqlite(a: argparse.Namespace) -> int:
    store = Store(a.data_dir)
    out = Path(a.out)
    out.unlink(missing_ok=True)
    db = sqlite3.connect(out)
    for table, fields in (("matches", MATCH_FIELDS), ("players", PLAYER_FIELDS)):
        db.execute(f"CREATE TABLE {table} ({', '.join(fields)})")
        ph = ",".join("?" * len(fields))
        db.executemany(f"INSERT INTO {table} VALUES ({ph})",
                       ([r[f] for f in fields] for r in store.iter_all(table)))
    for _, rec in load_provisional(store):
        db.execute(f"INSERT INTO matches VALUES ({','.join('?' * len(MATCH_FIELDS))})",
                   [rec.row()[f] for f in MATCH_FIELDS])
        db.executemany(f"INSERT INTO players VALUES ({','.join('?' * len(PLAYER_FIELDS))})",
                       ([p.row()[f] for f in PLAYER_FIELDS] for p in rec.players))
    db.execute("CREATE INDEX idx_players_name ON players(player)")
    db.execute("CREATE INDEX idx_matches_date ON matches(date)")
    db.commit()
    db.close()
    print(f"wrote {out}")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="cricket-data", description=__doc__)
    ap.add_argument("--version", action="version", version=__version__)
    ap.add_argument("--data-dir", default=DEFAULT_DATA)
    sub = ap.add_subparsers(dest="cmd", required=True)

    u = sub.add_parser("update", help="daily update: Cricsheet delta + extra sources + reconcile")
    u.add_argument("--dataset", default="recently_added_30_json.zip")
    u.add_argument("--zip", help="use a local zip instead of downloading")
    u.add_argument("--provisional-days", type=int, default=14)
    u.add_argument("--enable-scraper", action="store_true", help="enable web scraping from public sources")
    u.set_defaults(fn=cmd_update)

    b = sub.add_parser("backfill", help="load full history (all_json.zip)")
    b.add_argument("--dataset")
    b.add_argument("--zip")
    b.set_defaults(fn=cmd_backfill)

    s = sub.add_parser("stats", help="dataset summary")
    s.set_defaults(fn=cmd_stats)

    q = sub.add_parser("query", help="player performance lookup")
    q.add_argument("player")
    q.add_argument("--since")
    q.add_argument("--until")
    q.add_argument("--format", help="match_type, e.g. ODI, T20, Test")
    q.add_argument("--limit", type=int, default=50)
    q.set_defaults(fn=cmd_query)

    e = sub.add_parser("export-sqlite", help="write a SQLite file for SQL tools / IDEs")
    e.add_argument("--out", default="cricket.db")
    e.set_defaults(fn=cmd_export_sqlite)

    a = ap.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
