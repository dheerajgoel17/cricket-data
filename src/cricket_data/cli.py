"""Command line: `cricket-data update | backfill | fixtures | query | stats | link-players | freshness | export-sqlite`."""
from __future__ import annotations

import argparse
import csv
import io
import sqlite3
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

from . import __version__
from .cricsheet import download, iter_zip
from .hosts import host
from .models import MATCH_FIELDS, PLAYER_FIELDS
from .polite import PoliteFetcher
from .provisional import find_canonical, load_provisional, reconcile, write_provisional
from .registry import freshness, iter_combined, link_players
from .scraper_monitor import ScraperFailure, ScraperRunReport, save_report
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


def _run_backfill(a: argparse.Namespace, store: Store, browser) -> None:
    """One backfill batch: top up the queue, look matches up on Source A, save what is confirmed."""
    import json as json_mod

    from .backfill import enumerate_afghanistan_matches, initialize_backfill_queue, process_backfill_batch
    from .crex_sitemap import CREXSitemapIndex

    queue_path = store.root / "state" / "backfill_queue.json"
    queue = initialize_backfill_queue(queue_path)
    index = CREXSitemapIndex(cache_path=Path(".cache") / "crex_index.json")
    index.load()
    afg = enumerate_afghanistan_matches(queue, index)
    print(f"afghanistan: {afg['seen']} men's matches in Source A sitemap, {afg['queued']} newly queued")
    queue.batch_size = a.backfill_batch_size
    if a.backfill_priority:
        n = queue.prioritize(a.backfill_priority.split(","))
        print(f"backfill: {n} task(s) moved to the front of the queue")
    stats = process_backfill_batch(queue, index, browser, store, verbose=True, save=lambda: queue.save(queue_path))
    queue.save(queue_path)
    qs = queue.stats()
    print(f"backfill: {stats['succeeded']} saved, {stats['not_found']} not found, {stats['failed']} failed, "
          f"{stats['already_in_cricsheet']} already in Base; queue {qs}")
    out = store.root / "state" / "last_backfill.json"
    out.write_text(json_mod.dumps({
        "ran_at": datetime.now().isoformat(timespec="seconds"), "batch": {k: v for k, v in stats.items()},
        "afghanistan_enumeration": afg, "queue": qs}, indent=1, sort_keys=True) + "\n", encoding="utf-8")


def cmd_update(a: argparse.Namespace) -> int:
    from .crex_browser import CREXBrowser
    browser = CREXBrowser()  # starts Chromium lazily; closed once, here
    try:
        return _cmd_update(a, browser)
    finally:
        browser.close()


def _cmd_update(a: argparse.Namespace, browser) -> int:
    store = Store(a.data_dir)
    
    # Initialize scraper run report
    report = ScraperRunReport(started_at=datetime.now().isoformat())
    
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
        # matches already saved are not fetched again: a finished result never changes
        known = {p.stem.removeprefix("crex-") for p in (store.root / "provisional").glob("crex-*.json")}
        scraper_source = ScraperSource(browser=browser, known_ids=known)
        sources.append(scraper_source)
        
        # Track which scrapers were attempted
        report.sources_attempted = [s.name for s in scraper_source.scraper.scrapers]
    
    added = 0
    scraper_conflicts = []
    for src in sources:
        source_name = getattr(src, 'name', src.__class__.__name__)
        
        try:
            for rec in src.fetch(since):
                if find_canonical(store, rec) is None:  # skip anything Base already has
                    write_provisional(store, rec)
                    added += 1
            
            # Track successful scraper
            if isinstance(src, ScraperSource):
                # Mark sources that successfully returned data
                if added > 0:
                    for scraper in src.scraper.scrapers:
                        scraper_name = getattr(scraper, 'name', scraper.__class__.__name__)
                        report.mark_success(scraper_name, 0)  # Will be updated with actual count
                
                # Capture failures
                for source, error_type, error_msg in src.scraper.failures:
                    report.add_failure(ScraperFailure(
                        source=source,
                        error_type=error_type,
                        error_message=error_msg,
                        timestamp=datetime.now().isoformat(),
                    ))
                
                # Capture conflict log from scraper
                if src.scraper.conflict_log:
                    scraper_conflicts.extend(src.scraper.get_conflict_log())
        
        except Exception as exc:  # one broken source must not stop the daily run
            print(f"warning: source {source_name} failed: {exc}", file=sys.stderr)
            if a.enable_scraper and isinstance(src, ScraperSource):
                report.add_failure(ScraperFailure(
                    source=source_name,
                    error_type=type(exc).__name__,
                    error_message=str(exc),
                    timestamp=datetime.now().isoformat(),
                ))
    
    report.matches_scraped = added
    print(f"provisional: {added} written")
    
    # Report scraper conflicts
    if scraper_conflicts:
        report.conflicts_resolved = len(scraper_conflicts)
        print(f"scraper conflicts: {len(scraper_conflicts)} resolved", file=sys.stderr)
        _write_scraper_report(store, scraper_conflicts)

    inbox = InboxSource(store.root / "provisional" / "inbox")
    removed = inbox.cleanup(lambda rec: find_canonical(store, rec) is not None)
    if removed:
        print(f"inbox: {removed} landed file(s) deleted")
    rstats = reconcile(store)
    print(f"reconcile: {rstats}")
    print(f"link-players: {link_players(store)}")
    if rstats["mismatched"]:
        print("warning: provisional data disagreed with Base; see reconcile_log.csv", file=sys.stderr)
    
    # Process a backfill batch (after recent matches, low priority); shares the one browser session
    if a.enable_scraper and a.backfill_batch_size > 0:
        try:
            _run_backfill(a, store, browser)
        except Exception as exc:  # a broken backfill must not hide the recent-match results
            print(f"warning: backfill failed: {exc}", file=sys.stderr)
            report.add_failure(ScraperFailure(
                source="crex-backfill", error_type=type(exc).__name__, error_message=str(exc),
                timestamp=datetime.now().isoformat()))

    # Complete and save report
    report.completed_at = datetime.now().isoformat()
    save_report(report, store.root / "scraper_run_report.json")
    
    # Print summary
    if a.enable_scraper:
        print("\n" + report.summary())
        
        # Return error code if scrapers failed
        if report.sources_failed:
            print(f"\nWarning: {len(report.sources_failed)} source(s) failed", file=sys.stderr)
            return 1
    
    return 0


def cmd_crex_balls(a: argparse.Namespace) -> int:
    """Ball-by-ball for Source A matches into data/balls/ (only matches that reconcile with the scorecard)."""
    import json as json_mod

    from .crex_balls import collect
    from .crex_browser import CREXBrowser

    store = Store(a.data_dir)
    if a.prune:  # a match's provisional file is deleted once Base publishes it: its Source A deliveries go with it
        live = {json_mod.loads(f.read_text(encoding="utf-8"))["match_id"] for f in (store.root / "provisional").glob("crex-*.json")}
        print(f"crex-balls: pruned {store.prune_balls(live)} delivery row(s) of matches Base now has")
    base = f"{host('LIVE_SOURCE_BASE')}/cricket-live-score/"
    targets: list[tuple[str, str, str]] = []
    for u in a.url:
        targets.append((f"crex-{u.rstrip('/').rsplit('/', 1)[-1]}", a.date or "", u))
    if a.provisional_days:
        since = (date.today() - timedelta(days=a.provisional_days)).isoformat()
        have = set() if a.force else store.balls_match_ids()
        for f in sorted((store.root / "provisional").glob("crex-*.json"), reverse=True):
            d = json_mod.loads(f.read_text(encoding="utf-8"))
            if d.get("date", "") >= since and d["match_id"] not in have:
                targets.append((d["match_id"], d["date"], base + d["match_id"][len("crex-"):]))
    if a.limit:
        targets = targets[: a.limit]
    if any(not d for _, d, _ in targets):
        print("crex-balls: --url needs --date YYYY-MM-DD (the month file the deliveries go into)", file=sys.stderr)
        return 2
    print(f"crex-balls: {len(targets)} match(es) to scrape")
    with CREXBrowser(min_interval=a.min_interval) as browser:
        res = collect(browser, store, targets)
    print(f"crex-balls: {res['saved']} saved ({res['healed']} healed), {res['no_feed']} without a feed, {res['rejected']} rejected, "
          f"{res['failed']} failed, {res['warnings']} bowler warning(s)")
    for p in res["problems"]:
        print("  -", p)
    return 0


def cmd_health(a: argparse.Namespace) -> int:
    from .crex_browser import CREXBrowser
    from .health import run_checks, write_report
    from .polite import PoliteFetcher

    out = Path(a.out)
    with CREXBrowser() as browser:
        results = run_checks(browser, PoliteFetcher(min_interval=2.0, timeout=120.0), out)
    write_report(results, out)
    for r in results:
        print(f"{'ok  ' if r.ok else 'FAIL'} {r.name}: {r.detail}" + (f"  -> {r.hint}" if r.hint else ""))
    return 0 if all(r.ok for r in results) else 1


def cmd_backfill(a: argparse.Namespace) -> int:
    # Same pipeline as `update`, on the full archive. Its options come from _add_update_options,
    # so every attribute _cmd_update reads exists here too (a missing one crashed the weekly heal).
    return cmd_update(a)


def _merge_fixtures(fresh: list[dict], path: Path, now_dt: datetime | None = None) -> list[dict]:
    """The schedule page only reaches ~1-2 days ahead. Rows we already hold that start after its horizon (e.g. tours announced weeks
    ahead) are kept until they pass; anything inside the horizon is replaced by the page, so cancelled or moved games drop out."""
    if not path.exists() or not fresh:
        return fresh
    horizon = max(r["start_utc"] for r in fresh)
    now_dt = now_dt or datetime.now()
    now = now_dt.strftime("%Y-%m-%dT%H:%MZ")
    with path.open(encoding="utf-8", newline="") as fh:
        held = list(csv.DictReader(fh))
    old = [r for r in held if r["start_utc"] > max(horizon, now)]
    seen = {(r["start_utc"][:10], frozenset((r["team_a"], r["team_b"]))) for r in fresh}
    key = lambda r: (r["start_utc"][:10], frozenset((r["team_a"], r["team_b"])))  # noqa: E731
    keep = [r for r in old if key(r) not in seen]
    # A match that has started and is no longer on the page: limited-overs stay 3 days as Completed (the page drops a match soon after
    # the end). A Test/FC stays 6 days; without a result line it is still being played (stumps), so it stays Live.
    done = []
    for r in held:
        days = 6 if r.get("format") in ("Test", "FC") else 3
        since = (now_dt - timedelta(days=days)).strftime("%Y-%m-%dT%H:%MZ")
        if not (since < r["start_utc"] <= now) or key(r) in seen:
            continue
        result = (r.get("result") or "").strip()
        if r.get("format") in ("Test", "FC") and not result:
            done.append({**r, "status": "Live"})
        else:
            done.append({**r, "status": "Completed"})
    return sorted(fresh + keep + done, key=lambda r: (r["start_utc"], r["match_id"]))


def cmd_fixtures(a: argparse.Namespace) -> int:
    from .crex_schedule import fetch_schedule
    from .fixtures import FIELDS

    out = Path(a.data_dir) / "fixtures" / "upcoming.csv"
    if a.sitemap:  # the old candidate-page crawl (kept for team-filtered runs)
        from .crex_sitemap import CREXSitemapIndex
        from .fixtures import collect, write_fixtures

        index = CREXSitemapIndex(cache_path=Path(".cache") / "crex_index.json")
        index.load()
        teams = [t.strip().lower() for t in a.team.split(",") if t.strip()]
        found = collect(index.matches, PoliteFetcher(min_interval=3.0), teams=teams, days=a.days, max_pages=a.max_pages)
        write_fixtures(out, found)
        rows = [f.row() for f in found]
    else:
        try:  # the first page only reaches ~1-2 days; the paged read goes 10 days ahead and must never cost us the plain one
            from .crex_schedule import fetch_schedule_paged
            rows = fetch_schedule_paged()
        except Exception as exc:  # noqa: BLE001
            print(f"paged schedule failed ({type(exc).__name__}: {exc}); using the first page only", file=sys.stderr)
            rows = []
        if not rows:
            rows = fetch_schedule()
        if not rows:  # a failed or empty fetch must never wipe the schedule we already have
            print("no fixtures parsed from the Source A schedule page; leaving the existing file alone", file=sys.stderr)
            return 1
        held = list(csv.DictReader(out.open(encoding="utf-8", newline=""))) if out.exists() else []
        try:
            from .crex_schedule import fill_venues
            fill_venues(rows, held, PoliteFetcher(min_interval=2.0))
        except Exception as exc:  # noqa: BLE001  a missing venue must never cost the schedule
            print(f"venues not filled ({type(exc).__name__}: {exc})", file=sys.stderr)
        rows = _merge_fixtures(rows, out)
        buf = io.StringIO(newline="")
        w = csv.DictWriter(buf, fieldnames=FIELDS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(buf.getvalue(), encoding="utf-8")
    print(f"{len(rows)} upcoming fixtures -> {out}")
    for r in rows[:20]:
        print(f"  {r['start_utc']}  {r['team_a']} v {r['team_b']}  ({r['format']}, {r['venue']})")
    return 0


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
    inc = not a.canonical_only
    rows = [r for r in iter_combined(store, "players", inc)
            if q in r["player"].lower() and (not a.since or r["date"] >= a.since)
            and (not a.until or r["date"] <= a.until)]
    matches = {r["match_id"]: r for r in iter_combined(store, "matches", inc)}
    if a.format:
        rows = [r for r in rows if matches.get(r["match_id"], {}).get("match_type") == a.format]
    rows.sort(key=lambda r: r["date"])
    w = csv.writer(sys.stdout, lineterminator="\n")
    w.writerow(["date", "type", "player", "player_id", "team", "vs", "runs", "balls", "wkts", "catches", "stumpings", "points"])
    for r in rows[-a.limit:]:
        w.writerow([r["date"], matches.get(r["match_id"], {}).get("match_type", ""), r["player"],
                    r["player_id"], r["team"], r["opponent"], r["runs"], r["balls"], r["wickets"],
                    r["catches"], r["stumpings"], r["points"]])
    return 0


def cmd_link_players(a: argparse.Namespace) -> int:
    st = link_players(Store(a.data_dir))
    print(f"link-players: {st}  (unmatched rows -> provisional_unmatched.csv)")
    return 0


def cmd_freshness(a: argparse.Namespace) -> int:
    f = freshness(Store(a.data_dir))
    print(f"newest canonical match: {f['newest_canonical'] or '-'} ({f['age_days']} days old); "
          f"provisional pending: {f['provisional_pending']}, newer than canonical: "
          f"{f['provisional_after_canonical']}, newest provisional: {f['newest_provisional'] or '-'}")
    if f["age_days"] is None or f["age_days"] > a.max_age_days:
        print(f"STALE: canonical data is older than {a.max_age_days} days", file=sys.stderr)
        return 1
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


def _add_update_options(p: argparse.ArgumentParser, *, dataset: str, provisional_days: int) -> None:
    """Options read by _cmd_update. Shared by `update` and `backfill` so they cannot drift apart."""
    p.add_argument("--dataset", default=dataset, help=f"Base zip to download (default: {dataset})")
    p.add_argument("--zip", help="use a local zip instead of downloading")
    p.add_argument("--provisional-days", type=int, default=provisional_days)
    p.add_argument("--enable-scraper", action="store_true", help="enable web scraping from public sources")
    p.add_argument("--backfill-batch-size", type=int, default=5,
                   help="number of historical missing matches to backfill per run (default: 5, 0 to disable)")
    p.add_argument("--backfill-priority", default="",
                   help="comma-separated task-key prefixes (e.g. 2025-12-18-Jharkhand) to backfill first this run")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="cricket-data", description=__doc__)
    ap.add_argument("--version", action="version", version=__version__)
    ap.add_argument("--data-dir", default=DEFAULT_DATA)
    sub = ap.add_subparsers(dest="cmd", required=True)

    u = sub.add_parser("update", help="daily update: Base delta + extra sources + reconcile")
    _add_update_options(u, dataset="recently_added_30_json.zip", provisional_days=14)
    u.set_defaults(fn=cmd_update)

    h = sub.add_parser("health", help="check the Source A scraper's assumptions; save raw pages on failure")
    h.add_argument("--out", default="diagnostics")
    h.set_defaults(fn=cmd_health)

    b = sub.add_parser("backfill", help="load full history (all_json.zip); used by the weekly re-sync")
    _add_update_options(b, dataset="all_json.zip", provisional_days=30)
    b.set_defaults(fn=cmd_backfill)

    f = sub.add_parser("fixtures", help="refresh upcoming fixtures / schedule (data/fixtures/upcoming.csv)")
    f.add_argument("--sitemap", action="store_true", help="use the older Source A sitemap crawl instead of the schedule page")
    f.add_argument("--team", default="", help="with --sitemap: comma-separated Source A team codes, e.g. aus-w,ban-w")
    f.add_argument("--days", type=int, default=30, help="only fixtures starting within this many days")
    f.add_argument("--max-pages", type=int, default=40, help="cap on match pages fetched per run")
    f.set_defaults(fn=cmd_fixtures)

    cb = sub.add_parser("crex-balls", help="scrape Source A ball-by-ball into data/balls/ (verified against the scorecard)")
    cb.add_argument("--url", action="append", default=[], help="a Source A match page URL (repeatable); needs --date")
    cb.add_argument("--date", default="", help="match date for --url, YYYY-MM-DD")
    cb.add_argument("--provisional-days", type=int, default=0,
                    help="also scrape Source A provisional matches from the last N days that have no deliveries yet")
    cb.add_argument("--limit", type=int, default=0, help="cap on matches per run (0 = no cap)")
    cb.add_argument("--min-interval", type=float, default=1.5, help="seconds between page loads / scrolls")
    cb.add_argument("--prune", action="store_true",
                    help="first delete deliveries of matches whose provisional file is gone (Base has published them)")
    cb.add_argument("--force", action="store_true", help="re-scrape matches that already have deliveries")
    cb.set_defaults(fn=cmd_crex_balls)

    s = sub.add_parser("stats", help="dataset summary")
    s.set_defaults(fn=cmd_stats)

    q = sub.add_parser("query", help="player performance lookup")
    q.add_argument("player")
    q.add_argument("--since")
    q.add_argument("--until")
    q.add_argument("--format", help="match_type, e.g. ODI, T20, Test")
    q.add_argument("--limit", type=int, default=50)
    q.add_argument("--canonical-only", action="store_true", help="ignore provisional (scraped) matches")
    q.set_defaults(fn=cmd_query)

    lp = sub.add_parser("link-players", help="fill Base player_id in provisional files; report unmatched")
    lp.set_defaults(fn=cmd_link_players)

    fr = sub.add_parser("freshness", help="exit 1 if the newest canonical match is too old")
    fr.add_argument("--max-age-days", type=int, default=3)
    fr.set_defaults(fn=cmd_freshness)

    e = sub.add_parser("export-sqlite", help="write a SQLite file for SQL tools / IDEs")
    e.add_argument("--out", default="cricket.db")
    e.set_defaults(fn=cmd_export_sqlite)

    a = ap.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
