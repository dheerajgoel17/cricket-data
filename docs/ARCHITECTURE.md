# Architecture

```
Cricsheet zip (recently_added_30 daily, all_json weekly)
        |  download -> parse -> delete zip
        v
 data/matches + data/players   (month-partitioned gzip CSV, deterministic)
        ^                                     |
        | find canonical match               v
 data/provisional/*.json  <---- reconcile: verify, log, DELETE once landed
        ^                ^
        |                |
 inbox/*.json    web scraper (optional, ESPNcricinfo + multi-source conflict resolution)
        |                |
 CRICKET_DATA_SOURCES plugins (optional, user-supplied)
```
- `cricsheet.py` downloader (retries, zip validation) and ball-by-ball parser.
- `store.py` month-partitioned store; byte-identical output when nothing changed.
- `provisional.py` provisional writer and reconciliation.
- `scrapers.py` web scrapers with multi-source conflict resolution (ESPNcricinfo, Cricbuzz placeholder).
- `sources.py` the pluggable source interface and the inbox source.
- `cli.py` commands: `update`, `backfill`, `stats`, `query`, `export-sqlite`.

Resilience: the daily run re-reads 30 days, so a missed day heals itself; the weekly run re-reads everything.
A failing extra source is logged and skipped; a failed run opens a GitHub issue.
Workflows: `daily-update.yml` (Cricsheet + scraper), `scraper-update.yml` (scraper every 6 hours), `weekly-heal.yml`, `ci.yml`.

See [SCRAPER.md](SCRAPER.md) for web scraper details and conflict resolution.
