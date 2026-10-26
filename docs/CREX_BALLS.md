# CREX ball-by-ball (`data/balls/`)

Cricsheet's ball-by-ball is missing things the site needs (and arrives days late), while CREX has every delivery. `cricket-data crex-balls` scrapes CREX's commentary feed into one row per delivery, so the site can move off Cricsheet gradually, match by match, for as long as the numbers agree.

```bash
python -m playwright install --with-deps chromium     # once
cricket-data crex-balls --provisional-days 4 --limit 12                    # newest provisional matches without deliveries
cricket-data crex-balls --url <crex match page> --date 2026-10-13          # one match
cricket-data crex-balls --provisional-days 30 --force                      # re-scrape and replace
```

## How it works
1. `CREXBrowser.capture` opens the match **summary page** (allowed by crex.com's robots.txt) in headless Chromium and scrolls to the bottom repeatedly. The page loads its commentary with `getBallFeeds` (newest first, next chunk requested with `lastDocId`); we read the bodies of those responses. A full T20 is ~40 chunks, ~1.5 minutes. We never call the backend ourselves, so the only URLs we request are page URLs, at the browser's own pace (`--min-interval`, default 1.5 s between scrolls).
2. `crex_balls.parse_balls` turns the events into deliveries. The ball **code** is the source of truth (`0-6`, `W`, `1W` run-out after a run, `WD`/`2wd`, `1lb`, `4b`, `2nb` = 2 off the bat + the no-ball). The feed's running score is stamped a ball late now and then, so it is not used. With the scorecard's batting order the non-striker is exact.
3. `reconcile` compares every batter's runs/balls/4s/6s, the wicket count and every bowler's balls/runs with CREX's own scorecard (`getSC4`). **A match is stored only if no batter or innings check fails**; bowler differences (CREX's feed and card sometimes disagree by a ball or run) are counted as warnings. Rejected, feed-less and failed matches are listed at the end of the run and never written.

## Coverage (checked October 2026)
Not every match has a feed: it exists where CREX's scorers cover ball by ball (ICC men's internationals, most leagues, many men's domestic games). Women's bilaterals and some small events had **no** ball feed (`no_feed` in the run summary). Expect gaps and measure coverage before relying on a competition.

## Schema: `data/balls/YYYY-MM.csv.gz`
| Column | Meaning |
|---|---|
| match_id, date | the provisional match id (`crex-<slug>`) and its date; the month file is the match date's month |
| match_key | CREX's short match id (`13W5`) |
| innings | 1-based; Tests have up to 4 |
| seq | order within the innings, every delivery (wides and no-balls included) |
| over, ball, legal | 0-based over; legal balls in the over **including this one**; `legal=0` for wides/no-balls |
| batting_team, striker, non_striker, bowler | **CREX ids** (`player_id` mapping to Cricsheet ids comes with `link-players`); `batting_team` is CREX's team key |
| bat_runs, extra_type, extra_runs, total | `extra_type` is `wd`, `nb`, `lb`, `b` or `pen`; `total = bat_runs + extra_runs` (a no-ball is 1 extra plus the bat runs) |
| wicket, dismissed, dismissal | `dismissal`: caught, bowled, lbw, stumped, run out, caught and bowled, hit wicket |
| score, text | CREX's running score stamp (may lag a ball) and the start of the commentary |

Rules to remember when this feeds markets: wides do not count as balls faced, no-balls do; byes/leg-byes are not the bowler's runs; run-out runs count to the batter.

## Not done yet (next steps)
* Map CREX ids to Cricsheet player ids (names + `link-players`) and teams, so the rows join to `players/`.
* Convert deliveries into the shape `cricket_site.parse` reads (or teach it this table), then extras/overs/partnership markets can run from CREX for matches Cricsheet lacks, and later replace it where CREX is proven equal.
* A scheduled workflow (`.github/workflows/`) to run `crex-balls --provisional-days 3` after each scraper run, plus a `--workers` option for backfill once the per-match cost is acceptable to CREX.
* Tests / first innings, follow-ons, retired and substitute batters need more sample matches before they are trusted.
