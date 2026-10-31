# Value bets (player props) — `src/value_bets/`

A free, read-only pipeline that compares public cricket prop prices with a model built on this repo's
per-player history and writes value bets as decimal odds, with every time in IST. **Not betting advice.** Most edges the model
finds are information it lacks, such as XIs, batting order, pitch or injuries.

## What runs where
| | |
|---|---|
| workflow | `.github/workflows/value-bets.yml`, hourly `30 3-17 * * *` UTC = 09:00–23:00 IST, plus `workflow_dispatch`, plus a no-commit dry run on PRs that touch the pipeline |
| weekly refit | Sundays 07:00 UTC (or dispatch with `refit=true`): `python -m value_bets.backtest` re-runs the backtest and refits `value_bets/state/prop_model.json` |
| local run | `pip install -e ".[value-bets]" && python -m value_bets.pipeline` (from the repo root) |
| tests | `pytest -q tests/value_bets` (skipped automatically if the `value-bets` extra isn't installed) |

The workflow is independent of the data workflows. It has its own concurrency group, never touches `data/`, and commits with
`[skip ci]` and a rebase-retry push. `auto-merge-scraper-fixes.yml` only merges PRs labelled `scraper-fix` that touch nothing but
scraper files, so it never merges value-bet changes.

## Committed outputs (small)
| file | what |
|---|---|
| `value_bets/out/new_alerts.json` | `{"generated_at_ist", "alerts": [...]}`: bets not alerted before. Each alert has a stable `alert_id`, `alert_key`, `why`, odds, fair odds, edge, stake |
| `value_bets/out/alerts_history.jsonl` | one line per alert ever raised (last 3000), so a reader can dedupe on `alert_id` |
| `value_bets/out/value_bets_latest.json` / `.md` | full current run: sources, events in window, all value bets, filter counts, model-vs-market diagnostics |
| `value_bets/out/backtest_props.json` / `.md` | prop-model backtest (baseline vs new) |
| `value_bets/state/alerted.json` | dedupe state (re-alert only if edge grows ≥ 3 pp; pruned when the match starts) |
| `value_bets/state/prop_model.json` | fitted model coefficients |
| `value_bets/mappings/venue_geo.csv` | venue → lat/lon from the Open-Meteo geocoder (blank = not located or rejected) |
| `value_bets/mappings/venue_weather_daily.csv.gz` | Open-Meteo ERA5 daily weather per located venue × match day (2021+ T20/ODI), used by the backtest |

Raw URL once merged: `https://raw.githubusercontent.com/dheerajgoel17/cricket-data/main/value_bets/out/new_alerts.json`

**Odds snapshots** (every normalised pull plus raw responses, gzip) are **not committed**. They are uploaded as the workflow
artifact `odds-snapshots-<run_id>` and kept 90 days (the maximum), which keeps `main` small. Caches (`*.pkl`) are rebuilt each run in about 25 s.

## Sources
* `smarkets`: public exchange API (top batsman/bowler, venue). `moviodds_bet365`: unofficial Book A mirror (batter runs, sixes and fours
  O/U, bowler wickets O/U, 50/100 Yes/No, batter/bowler milestone ladders, top batter/bowler). Both are keyless.
* `feedk` (Feed K, `adapters/feedk.py`): a public, login-free sportsbook feed several operators share. It is on whenever the secrets `FEEDK_URL` and
  `FEEDK_BOOKS` are set (no need to list it in `CV_SOURCES`) and reports "skipped" otherwise. Each configured book is one source, published under the name
  given in `FEEDK_BOOKS`, so a line on the site shows every book's over/under next to the others. It reads player runs / sixes / fours / wickets O/U and the
  "to score a half-century / century / at least N runs" yes/nos. A Test's "Player's Total Runs - Innings 1" (and sixes / fours) is the player's own first innings, not the match total: it comes back as a row with `inn` set (see "Innings-scoped lines" below); a multi-day line with no innings in its name is skipped. A Test's "Total Runs - Home/Away Team, Innings N" comes back as a `fancy` line with `inn`. It is polite: one listing and
  at most `FEEDK_MAX_EVENTS` event pages per book per run, `FEEDK_SPACING_SECS` apart, and a 429 ends that book for the run.
* `feede` (Feed E, `adapters/feede.py`): another public, login-free sportsbook feed, one feed root per book, trading its own prices. On whenever the secret
  `FEEDE_BOOKS` (`id=Name@root`) is set. It reads "<player> - Over/Under N Runs" and "<player> To Score N" for the next `FEEDE_MAX_EVENTS` matches of
  each book, and returns the match sixes / fours totals as `fancy` lines (`fancy.adapter_fancy` merges them into `book_lines.json` for the Match Fancy tab,
  under the book's name). A multi-day match gives fancy lines and innings-scoped lines only: "<player> - Over/Under N Runs 1st innings" (a Test only; first-class matches have no history on the site to chart against) and "<team> Over/Under N Runs 1st innings", both with `inn`. Same politeness rules as Feed K.
* `feedf` (Feed F, `adapters/feedf.py`): an Indian exchange's open pages, no login (the "demo" login only shows the same data). Two feeds per match, found through its event list and menu (the menu links the exchange's event id to the sportsbook's match number): **premium** (decimal, two-way: "1st innings - <Last, First> total" over/unders and "to score N" yes/nos as player rows, "Total fours / sixes" and a side's total fours / sixes as `fancy` lines) and **fancy** (session markets). A session market quotes **Yes at Ly and No at Ln** with a rate each: Yes (back) at rate R pays R per 100 staked (decimal 1 + R / 100), No (lay) at rate R needs R staked to win 100 (decimal 1 + 100 / R); 100 is even money (2.00) either way: Yes wins at Ly or more, so it is "over Ly - 0.5"; No wins at Ln - 1 or fewer, so it is "under Ln - 0.5". The two lines are usually a gap apart, so each side is its own one-sided line (`over` or `under` null; `fancyByLine` and the Match Fancy tab handle that) and only a market with Ly == Ln is a two-way line. Player "<name> Run Adv" gives two player rows; match totals (fours, sixes, boundaries, wickets, fifties) and a side's full-innings runs are `fancy` lines. On whenever `FEEDF_NAME`, `FEEDF_API`, `FEEDF_PREMIUM`, `FEEDF_TENANT` are set. Player performance (fantasy points: 1 per run, 20 per wicket, 10 per catch, 25 per stumping; the premium one does not state its scoring) is read as `player_points` rows and published as the site's `points` stat; no model prices it, so it is never alerted. Left out: meter, khado, lucky-number, first-over and part-innings markets, winner, top batter.
* `feedh` (Feed H, `adapters/feedh.py`): a public, login-free sportsbook (guest JSON, no session). On whenever `FEEDH_URL` and `FEEDH_NAME` are set. Reads "Batsman Runs / Sixes / Fours - Last, First" and "Bowler Wickets - Last, First" O/U, "Player Performance - Last, First" (fantasy points, the site's 1/20/10/25 scoring), "To score N - Last, First" yes/nos, Top Batsman / Top Bowler (match and per side), and match / team totals of runs, fours and sixes as `fancy` lines. Published under `FEEDH_NAME`, so a line on the site shows this book next to the others; a match it prices before anyone else still appears (the fixture list is every pre-match event with a player prop). Every open market of a fetched match is also filed in the archive as `catalogue` (name, player, line, both decimal prices, and which mapping it used if any), including markets the site does not chart yet (over-by-over, combos, head-to-head), so the historical record of odds and lines is complete. A Test's unscoped player line is catalogue-only. Head-to-head is never a row. Never on a laptop (`GITHUB_ACTIONS` only). Always through the Cloudflare Worker relay (`FEEDH_RELAY` or Feed G's pair); there is no direct call. Listing rows that are competition nodes are fetched as paths (the book's event-id call is 400); a 400 on an event id is retried as a path. In-horizon games are fetched before competition trees, and international series before club cricket, so a page cap cannot skip a priced international for grade games. Matches starting within `FEEDH_HORIZON_HOURS` (10 days) are kept when the book has prices. Polite: one listing and every in-horizon page up to `FEEDH_MAX_EVENTS` (500), `FEEDH_SPACING_SECS` apart, until `FEEDH_BUDGET_SECS`.
* `feedg` (Feed G, `adapters/feedg.py`): session ("fancy") markets from another exchange on a shared white-label platform, open to guests: `GET event_list` (cricket, `fancy_active`), `POST event/<id>` (the market catalogue and the odds host) and `POST <odds host>/ws/getMarketDataNew` with the fancy market ids (pipe-separated rows read through the key map the catalogue gives). Same session reading as Feed F (`feedf.session`: Yes at Ly = over Ly - 0.5 at 1 + R / 100, No at Ln = under Ln - 0.5 at 1 + 100 / R). Published as "<name> Fancy". Reads player "<name> Runs Adv", "Total Match Fours / Sixes / Boundaries / Wkts / Fifties / 30s", top batsman runs, highest scoring over, a side's full-innings runs and "1st Inn Total Match Fours / Sixes <side>" (the side must bat first); the rule tags are Feed F's (assumed: the book's own rules are not read yet). On whenever `FEEDG_NAME` and `FEEDG_API` are set.
  Rules the book states (carried on each fancy line as `rules`, not yet applied by the settlement code, which keeps the exchange rules of PROJECT_GUIDE section 1): premium markets void unless 80% of the match is played and have no batting-order condition; fancy side lines count only the side batting first (`bat_first`) and void if even one ball is lost to weather or the match is abandoned; fancy player lines stand once the outcome is decided; fancy match totals are not voided by lost balls. **Fancy and player-performance markets close an hour before the scheduled start**, so the last fancy price in the archive is the one at T minus 1 hour (premium stays open until the start).
* What the sources price per innings (probed 2026-10-28 from a workflow run, never from a laptop): Feed K and Feed E price a Test's first-innings player runs lines pre-match (Feed E as a ladder of lines per player); the Book A mirror (Feed P) does not (its pre-match Test has the match-total player lines, the first-innings team score and "top 1st innings batter" only); its "<player> Innings Runs" lines exist in play only. In play, Feed K lists team innings totals only (no player lines), and Feed E lists a ladder around the current score. No source was seen pricing second-innings lines yet (see "In play" below).
* Match winner is **not** priced or alerted. Polymarket, Matchbook, The Odds API and Exchange B only price match winner, so they are off.
  To turn them back on, set the repository variable `CV_SOURCES` (e.g. `smarkets,moviodds_bet365,betfair`) and the secrets
  `ODDS_API_KEY`, `BETFAIR_APP_KEY`, `BETFAIR_USERNAME`, `BETFAIR_PASSWORD`. A missing secret means that adapter reports "skipped".
* Any `CV_<SETTING>` env var overrides `src/value_bets/config.py` (e.g. `CV_MIN_EDGE=0.07`).
* Odds are fetched for matches starting in the next **10 days** (`FEED*_HORIZON_HOURS`). Value-bet alerts use the next **7 days** (`WINDOW_HOURS`). A book row still joins its schedule parent by the two canonical team names and a kickoff within `MATCH_START_DELTA_HOURS` (12 h) of the schedule start — that delta is the join, not a display window.

## Model
* `context.py`: one chronological pass. Features for a match are read before that match is added, so nothing leaks. Recency-weighted
  form (half-life 540 d, same format and gender, other formats at ¼ weight). Role proxies: batting/bowling frequency, balls faced and
  overs per spell. Player-at-venue and player-vs-opposition splits are shrunk toward the player's own form (k = 6). Venue environment
  (k = 60). Opposition bowling and batting strength (half-life 365 d, k = 40). Team H2H batting context (k = 40). International flag.
* `propmodel.py`: a negative-binomial GLM per stat × format. Context terms are kept only if they improve 2023–24 validation log-loss
  (forward selection); 2025–26 is held out for the test.
* Milestone ladders are anchored on the same player's de-vigged O/U market. Top batter/bowler use a Monte Carlo that is then
  market-calibrated. Player of the match is not modelled.
* **No ball-level data is stored.** Only per-player match totals are kept, so there is no batting position and no batter-vs-bowler matchup.
* Fair p = 0.45·model + 0.55·market (0.35/0.65 for top markets). A bet needs edge ≥ 5 % and model/market within 0.15 (0.9 logit).
  Stake = quarter Kelly, capped at 2 %.
* **Sanity guards** (after all other filters): a bet is never alerted if the model on its own says it is not value
  (model p below 1 / odds after commission), so an edge can't come purely from the market-blend input. Edges above
  `MAX_EDGE` (30 %) are not alerted either; they are listed under `suspect_not_alerted` in `value_bets_latest.json` and under
  "Suspect edges" in the markdown, because on these markets an edge that size is almost always a pricing or mapping error.
* **Multi-day milestones:** "to score a Fifty/Hundred in the match" (Yes/No) is settled on a single innings, while the
  "Batter Milestones" ladder and "Batsman Match Runs" O/U use the player's match aggregate (both innings). The history stores one
  row per player per match, so in Tests the single-innings markets are re-typed `batter_innings_milestone`, kept apart from the
  ladder and not modelled or alerted. In T20/ODI (one innings) they are the same market and are combined.
* **Team top batter/bowler:** a bookmaker's team market is kept whole even when some names don't match the history (the team is
  taken from the rest of the market), and a bookmaker market whose implied probabilities sum to under 100 % (runners missing) is not
  de-vigged, since that would inflate every price.

## Weather (Open-Meteo, free, no key)
* **Live:** for each event with a known venue, `weather.py` pulls the Open-Meteo forecast for the match window (4 h T20, 8 h ODI).
  Every value bet carries `weather` (max hourly rain probability %, forecast mm, humidity %, cloud %) and `rain_risk`
  (`true` if rain probability ≥ `RAIN_PROB_WARN` = 50 % or ≥ `RAIN_MM_WARN` = 2 mm; `false` otherwise; `null` if the venue is
  unknown). A rain-risk bet also gets a `RAIN RISK` note (shortened match → lower counting stats; check void rules), and the
  `why` line mentions rain chance ≥ 40 %, humidity ≥ 75 % or cloud ≥ 70 %.
* **Backtest:** match-day ERA5 daily weather (rain mm, humidity, dew point, max temperature, max wind, cloud cover) was tested as extra
  NB-GLM terms on top of each selected model, on the same splits (train 2021–22, select on 2023–24, test 2025+). A term is adopted
  only if it gains ≥ 0.0003 validation log-loss **and** does not worsen the held-out test. Result: **no weather term was adopted**
  (best: `wx_rain` for T20 fours passed validation, then got worse on test, 0.4819 → 0.4820). Weather is therefore informational
  (why line + rain-risk flag) and is not in the probability. Base has no start times, so day/night and dew-at-night could not be
  tested. The weekly refit re-runs this study and tops up the cache (`CV_WEATHER_FETCH=1`); a term that starts to help will be adopted
  automatically.
* Geocoding uses the venue's city with country hints from the match history (host country of tours/leagues); hits outside those
  countries, country-level centroids and a few checked mis-hits are left blank rather than guessed. 92 % of 2021+ T20/ODI matches (10,473 of 11,418; 402 of 487 venue spellings located)
  have weather; set `CV_WEATHER=0` to turn the live forecast off.

See `value_bets/out/backtest_props.md` for the current numbers.

## Book lines for the site
Every run also writes `value_bets/out/book_lines.json`: each two-sided over/under player line (runs, sixes, fours, wickets) with its decimal prices per source, for players matched to the Base registry (`src/value_bets/booklines.py`). The site shows them on the player page; they are prices as published, not a model output.
A line is the whole match's unless it has `inn`: 1 or 2, the player's own side's first or second innings, which only a Test has (a first-innings line is a different bet from the match total even at the same number, so `inn` is part of the line's key everywhere: `booklines.book_lines`, the archive file, `settle`, the site's chart). A line with no `inn` is the whole match, which is every line published before the field existed; those lines and the archive files holding them read and sort exactly as they did. Innings-scoped lines are published and filed but never priced: `pipeline.whole_match` keeps them out of the value-bet pricing (the history has one row per player per match, both innings summed). Fancy lines carry `inn` the same way, and the Match Fancy tab shows only those without it.
`book_lines.json` also carries `events` (every pre-match event with any player prop) and `fancy` (match-level over/under lines with both prices, read straight from the Feed P feed by `src/value_bets/fancy.py`: total match runs, sixes, fours, boundaries, first-innings score, highest over, top score, and a team's sixes / fours / boundaries). Each fancy row carries `fmt` from the book's league name so a T20 in a Test series cannot price the Test. The site's Match Fancy tab shows them next to its own fair prices; they bypass the player-prop pipeline and are never alerted on.

## In play (not built)
**Decided 2026-10-28: pre-match lines only for now; in-play lines are a some-day item.** Not even the innings break or a Test's day gap is fetched today: once a match has started, no adapter reads anything new for it. If it is ever built, start with break and day-gap windows only: read the lines that appear before an innings or a day begins (the live scorecard says the innings is over and the next has not started), keep the last one once as that innings' closing line, and store nothing between balls. A T20 / ODI chaser's team total after the break is the existing `team_total_*` fancy key, so it needs no new scope (`inn` is a Test-only scope).

Every adapter and `booklines` / `fancy` drop in-play rows on purpose: the hourly run is far too slow for a price that moves every few seconds, and the archive, `settle` and the chart all assume a pre-match line (a closing price that is filed once). What the sources give once a match has started (probed 2026-10-28): the Book A mirror has "<player> Innings Runs" and "<team> 1st Inns Runs" over/unders, updated every few seconds; Feed K lists a started Test's team innings totals only; Feed E lists a ladder of "<player> - Over/Under N Runs 1st innings" lines around the current score. A second-innings team fours line was not seen in any of them (probe again when a Test is in its second innings). To build it: keep in-play prices out of `book_lines.json` and the archive (the archive keeps the closing pre-match line), fetch them from a ~15 s cached route next to `site/api/live.js` (that needs the feed hosts as environment variables on the site's host and a 15 s single-flight so each feed is asked a few times a minute), and let `inn` carry the scope as it does for the pre-match lines, so `settleLines` already knows what to read. Open choices: where the route runs, and whether an in-play history is worth keeping (a separate folder, never mixed into the pre-match files).

## Props archive (never deleted)
`book_lines.json` carries a match for 40 hours after it starts (6 days for a Test) and is then let go. A Test is one match: `carry_started` treats the same pair within those 6 days as one event, keeps the earliest `start_utc` (the first morning), and does not drop a first-innings line when a later day's pull only has the match total. `src/value_bets/archive.py` keeps what the books priced for every match for good: `value_bets/archive/YYYY-MM/<fixture id>.json`, one file per match, written by every run (the fixture id is the one the site gives the fixture, from the schedule row the pipeline resolved; a match the schedule never listed is filed under an id made from the books' names). A file only grows: a later pull adds the lines, books and markets it did not have, and replaces the price of a line already there only in the last 3 hours before the start (the closing price), so an hourly run does not rewrite every file. Nothing in the pipeline or the workflows deletes, trims or rewrites history in this folder, and a file that cannot be read is left alone. Lines are stored without the match, competition and start (they are in the file once). `book_name` (the name the books print, see the player-identity table in `PROJECT_GUIDE.md` 5.7) is added to an older line by a later pull and by `python -m value_bets.archive --backfill-book-names`, which fills it for lines filed before the field existed where the archive knows exactly one spelling for the player; it only ever adds a field. `python -m value_bets.archive` files the matches of a book file as they are (how the archive was started, or rebuilt from an old copy of the file). Feed H also files `catalogue`: every open market of a fetched match (mapped or not) as compact rows of name, player, line and both decimal prices, so a later mapping can be pointed at a market we already stored. An empty catalogue is not written, so older files are not rewritten just to add the key. Once a match is final the file also gets `results: [{pid, stat, value}]`, what each priced player did, as the site's live route settled it (`python -m value_bets.archive --results <site>/api/live`, a step of the hourly workflow; the route is read twice, a minute apart, and only values both reads agree on are written; a stored value is never changed, one that was missing can be added later). The hourly pull carries `results` along untouched. The site reads a file by fixture id from the repository's raw file URL when a fixture page's match is no longer in the schedule or its lines have left `book_lines.json` (`docs/SITE.md`).


### Player performance (`points`) across sources
One scoring for every book: **1 per run, 20 per wicket, 10 per catch, 25 per stumping** (`site/src/engine/rules.js`, `STATS.points`; `docs/PROJECT_GUIDE.md`). A source's own quotes are lines on that stat, so an adapter only maps its market to `market_type="player_points"` (rows with `player`, `line`, `side`, decimal `back`) and `booklines` publishes it as `points`; the engine's hit rates use the one scoring whatever the book. Feed F reads it from both its feeds, Feed K from "Player Performance", Feed H from "Player Performance - Last, First". Every run's log lists the performance-like market names the other sources offered and no adapter reads yet ("player performance markets not read yet": `pipeline.performance_markets`), so a source that has the market shows up in the next committed `value_bets/out/value_bets_latest.json`, and its adapter can then be pointed at it. Feed G (checked on 9 matches, 2026-10-28) has no such market.
