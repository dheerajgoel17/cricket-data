# Provisional data (matches Cricsheet has not published yet)

Cricsheet usually publishes a match some days after it is played. To cover the gap you can supply
*provisional* matches. They are tagged `status=provisional`, **verified** against Cricsheet when it
publishes the same match, logged in `data/reconcile_log.csv`, and then **deleted** to save space.

## How a match is recognised as "landed"
Same two teams, and a Cricsheet match dated within one day of the provisional date.

## Option 1: the inbox (no code)
Put a JSON file in `data/provisional/inbox/`:
```json
{
  "date": "2026-10-09",
  "match_type": "T20",
  "team_type": "international",
  "gender": "male",
  "team_a": "India",
  "team_b": "West Indies",
  "winner": "India",
  "result_margin": "7 wickets",
  "players": [
    {"player": "S Gill", "team": "India", "opponent": "West Indies", "runs": 52, "balls": 30, "wickets": 0}
  ]
}
```
`player` fields: `player`, `team`, `opponent`, `player_id`, `runs`, `balls`, `fours`, `sixes`, `wickets`,
`balls_bowled`, `runs_conceded`, `catches`, `stumpings`, `run_outs`. All numbers default to 0.

## Option 2: a custom source (code)
```bash
CRICKET_DATA_SOURCES="my_pkg.module:MySource" cricket-data update
```
`MySource` needs a `name` and `fetch(since: date) -> Iterable[MatchRecord]`; see `examples/example_source.py`.
A failing source never stops the daily run.

## Please only use sources you have the right to use
No scraper ships with this project. Many sites forbid scraping in their terms.

## What reconciliation checks
Winner agreement, and for each provisional player with runs/wickets/catches: runs and wickets must equal
Cricsheet's. Disagreements are flagged in `reconcile_log.csv` (`winner_ok`, `player_mismatches`), and the run prints a
warning. Provisional matches older than 45 days with no canonical match are reported as stale.
