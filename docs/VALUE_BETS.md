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
* `smarkets`: public exchange API (top batsman/bowler, venue). `moviodds_bet365`: unofficial bet365 mirror (batter runs, sixes and fours
  O/U, bowler wickets O/U, 50/100 Yes/No, batter/bowler milestone ladders, top batter/bowler). Both are keyless.
* Match winner is **not** priced or alerted. Polymarket, Matchbook, The Odds API and Betfair only price match winner, so they are off.
  To turn them back on, set the repository variable `CV_SOURCES` (e.g. `smarkets,moviodds_bet365,betfair`) and the secrets
  `ODDS_API_KEY`, `BETFAIR_APP_KEY`, `BETFAIR_USERNAME`, `BETFAIR_PASSWORD`. A missing secret means that adapter reports "skipped".
* Any `CV_<SETTING>` env var overrides `src/value_bets/config.py` (e.g. `CV_MIN_EDGE=0.07`).

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
  (why line + rain-risk flag) and is not in the probability. Cricsheet has no start times, so day/night and dew-at-night could not be
  tested. The weekly refit re-runs this study and tops up the cache (`CV_WEATHER_FETCH=1`); a term that starts to help will be adopted
  automatically.
* Geocoding uses the venue's city with country hints from the match history (host country of tours/leagues); hits outside those
  countries, country-level centroids and a few checked mis-hits are left blank rather than guessed. 92 % of 2021+ T20/ODI matches (10,473 of 11,418; 402 of 487 venue spellings located)
  have weather; set `CV_WEATHER=0` to turn the live forecast off.

See `value_bets/out/backtest_props.md` for the current numbers.

## Book lines for the site
Every run also writes `value_bets/out/book_lines.json`: each two-sided over/under player line (runs, sixes, fours, wickets) with its decimal prices per source, for players matched to the Cricsheet registry (`src/value_bets/booklines.py`). The site shows them on the player page; they are prices as published, not a model output.
`book_lines.json` also carries `events` (every pre-match event with any player prop) and `fancy` (match-level over/under lines with both prices, read straight from the MoviOdds feed by `src/value_bets/fancy.py`: total match runs, sixes, fours, boundaries, first-innings score, highest over, top score, and a team's sixes / fours / boundaries). The site's Match Fancy tab shows them next to its own fair prices; they bypass the player-prop pipeline and are never alerted on.
