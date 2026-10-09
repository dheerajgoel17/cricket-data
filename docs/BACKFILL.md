# CREX backfill

Fills in matches Cricsheet will never publish, from [CREX](https://crex.com), a few per run.
Everything here respects CREX's `robots.txt` (`Allow: /`, `/api/*` disallowed): we read its public
sitemaps and render ordinary match pages in headless Chromium, with delays and back-off.

## What gets queued

`data/state/backfill_queue.json` holds the queue. Two classes of task, both permanent
(`status` in the saved JSON):

| class | source of tasks | notes |
|---|---|---|
| `cricsheet_missing` | <https://cricsheet.org/missing/> (topped up every run) | domestic T20 / List A / FC matches keep their own type, never relabelled T20I/ODI |
| `cricsheet_withheld` | CREX's match sitemap: every finished men's `afg` match | opponents/dates/URLs all come from the sitemap, nothing hard-coded |

The Afghanistan Premier League has no entry in CREX's sitemaps (CREX lists the *Shpageeza Cricket
League* and *Kabul Premier League*, which are different tournaments), so nothing is queued for it.
`WITHHELD_COMPETITION_PATTERN` in `backfill.py` picks it up automatically if CREX ever adds it.

## How a match is found

1. `crex_sitemap.py` indexes `crex_sitemap/cricket-live-score.xml` (~18.5k matches) and
   `crex_sitemap/series.xml`. A match's sitemap `<lastmod>` is its start time, so a task's date
   (±1 day) gives a short candidate list with no page loads. The index is cached in
   `.cache/crex_index.json` for a day.
2. `crex_lookup.candidates_for` keeps candidates of the right gender and format whose slug codes
   could abbreviate the task's teams (`jhkd` ~ Jharkhand). This only ranks; it never accepts.
3. `crex_lookup.find_match` renders the best candidates (max 6 per attempt) and `confirm` accepts a
   page only if **date** (±1 day, and equal to the sitemap's), **both team names**, **format**
   (slug, competition or overs played), **gender** and *finished* status all agree.
4. Outcomes: `done` only after the match JSON is written to `data/provisional/`;
   `not_found` (with a recorded reason and the candidate ids rendered) only when nothing plausible
   exists in the sitemap or every candidate was rendered and rejected; `failed`/retry when the
   network or page rendering misbehaved; `already_in_cricsheet` if Cricsheet now has it.

Matches CREX does not cover (most pre-2023 and lower-tier domestic matches) end up in
`not_found` with their reason; they cost no page loads and do not count towards the batch size.

## Running it

```
cricket-data update --enable-scraper --backfill-batch-size 5
cricket-data update --enable-scraper --backfill-priority 2025-12-18-Jharkhand,2024-01-14-Afghanistan
```

`data/state/last_backfill.json` lists what the last run saved (date, teams, result, URL) and the
queue counts. In Actions the same JSON appears in the job summary.

One `CREXBrowser` (Playwright sync API) is created per process in `cli.cmd_update`, shared by the
recent-match scraper and the backfill, and closed once in a `finally`. Never start a second
`sync_playwright()` in the same process.

Locally, if Playwright's own Chromium is not installed, point `CRICKET_CHROMIUM_PATH` at any
Chromium binary.

## Schedule

`scraper-update.yml` runs every 30 minutes for newly finished matches (matches already saved are
skipped, and it only commits when something new was found) and once a day at 03:17 UTC with a
backfill batch of 30 plus the health check. The run report and `last_backfill.json` are
git-ignored so they never create commits; they appear in the job summary instead.

## Known limits

* CREX stamps start times in IST; a venue-local date can differ by a day, so `date` is the CREX
  date for withheld matches and the Cricsheet date for missing-list matches.
* Scraped records carry match-level data only (teams, venue, date, winner, result); player
  performances come from Cricsheet when it has the match.
