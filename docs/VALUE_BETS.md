# Value bets (player props) — `src/value_bets/`

A free, read-only pipeline that compares public cricket prop prices with a model built on this repo's
per-player history and writes value bets as decimal odds, with every time in IST. **Not betting advice.** Most edges the model
finds are information it lacks, such as XIs, batting order, pitch or injuries.

## What runs where
| | |
|---|---|
| workflow | `.github/workflows/value-bets.yml`, hourly `30 3-17 * * *` UTC = 09:00–23:00 IST, plus `workflow_dispatch` |
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

Raw URL once merged: `https://raw.githubusercontent.com/dheerajgoel17/cricket-data/main/value_bets/out/new_alerts.json`

**Odds snapshots** (every normalised pull plus raw responses, gzip) are **not committed**. They are uploaded as the workflow
artifact `odds-snapshots-<run_id>` and kept 30 days, which keeps `main` small. Caches (`*.pkl`) are rebuilt each run in about 25 s.

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

See `value_bets/out/backtest_props.md` for the current numbers.
