# When CREX changes and the scraper breaks

The scraper is built to say *where* it broke and to degrade rather than stop.

## What already happens automatically

* **Health check** (`cricket-data health`, first step of every scraper run) tests each assumption
  separately: sitemap XML shape/size, a never-changing finished match page (date, teams, winner),
  and the home-page match links. A failure names the layer, gives a fix hint, and saves the raw
  page CREX returned to `diagnostics/` (uploaded as the `scraper-report-<run>` artifact).
* **Sources fail independently**: one broken source never hides the others' results.
* **Stale index fallback**: if the sitemaps are unreachable, the last cached index is used.
* **Nothing is guessed**: a changed page makes the strict confirmation fail, so tasks are retried
  (`failed`) or recorded with a reason, never marked `done` without a saved file.
* **Issue**: on failure the workflow opens/updates a `scraper-broken` issue with the health
  report and a link to the run and its artifacts.

## Repair playbook (for a person or an agent)

1. Open the `scraper-broken` issue; download the run's `diagnostics/` artifact.
2. The failing layer says which function to change:
   `sitemap_*` -> `parse_*_sitemap` in `crex_sitemap.py`; `match_page` -> `parse_match_page` in
   `crex_lookup.py`; `homepage_links` -> `CREXScraper.fetch_recent_match_ids` in `scrapers.py`.
3. Save the new raw page as a trimmed fixture in `tests/fixtures/crex/` and add a test that fails
   on the old parser. Keep the strict date/teams/format confirmation in `crex_lookup.confirm`
   as it is; fix the parsing, not the checks.
4. `ruff check src tests && pytest -q` must pass; run `cricket-data health` locally.
5. Open a PR labelled `scraper-fix`. When CI is green and the diff only touches
   `src/cricket_data/{crex_*,scrapers,health,backfill}.py`, `tests/` or `docs/`,
   `auto-merge-scraper-fixes.yml` merges it and re-runs the scraper on the default branch.
   Anything else waits for a human.
6. Re-run "Scraper update" (workflow_dispatch) and close the issue once the health check is green.

Rules that never bend: respect `robots.txt` (never touch `/api/*`), no paid services or anti-bot
evasion, no skipping or deleting tests to get green.

## Automating step 1-5

Free options: run this playbook from an agent on a schedule (the paused
"cricket-data scraper auto-repair" routine) pointed at open `scraper-broken` issues. The
repository itself needs no API key or paid service for any of the steps above.
