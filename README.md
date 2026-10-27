# Cricket Data

A free, open cricket dataset. Matches and per-player performance for **23,000+ matches since 2001**:
men's and women's, internationals and leagues. Updated daily, including the latest games.

## What's inside

- **Matches**: date, teams, venue, toss, winner, result and margin, player of the match.
- **Players**: runs, balls, fours, sixes, wickets, catches, stumpings, run-outs and performance points for every player in every match.
- CSV files (gzip) in `data/`, one per month. See the [data dictionary](docs/DATA_DICTIONARY.md).

## Quick start

```bash
pip install -e .
cricket-data stats
cricket-data query "Kohli" --since 2026-01-01
cricket-data export-sqlite --out cricket.db
```

More: [Getting started](docs/GETTING_STARTED.md) · [Contributing](CONTRIBUTING.md)

## Support

This project is free and ad-free. If it's useful to you, you can support it:

<p align="center">
  <a href="https://buymeacoffee.com/meghnaad">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy me a coffee" width="217" />
  </a>
</p>

Questions: dheerajgoeldsuperdude@gmail.com

## Value bets (optional)
An hourly player-prop value-bet finder runs on top of this dataset: see [docs/VALUE_BETS.md](docs/VALUE_BETS.md).

## Documentation
* [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md): architecture, data flow, rules, gotchas (start here)
* [docs/OPERATIONS.md](docs/OPERATIONS.md): accounts, secrets, runbooks, health checks
* [AGENTS.md](AGENTS.md): instructions for AI coding agents in any IDE
* Site: [docs/SITE.md](docs/SITE.md), [docs/SITE_MAP.md](docs/SITE_MAP.md) · Data: [docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md), [docs/PROVISIONAL.md](docs/PROVISIONAL.md), [docs/SCRAPER.md](docs/SCRAPER.md) · Value bets: [docs/VALUE_BETS.md](docs/VALUE_BETS.md)

## Stats site
A free player-props site (hit rates over any line, fair decimal odds, partnerships, fancy markets, ask-anything box) lives in [`site/`](site); see [docs/SITE.md](docs/SITE.md).

### Provisional matches and player IDs

`query` and the value-bets pipeline read provisional (scraped) matches together with the monthly
Base CSVs, dropping a provisional match once Base publishes the same fixture (+/-1 day).
Use `cricket-data query NAME --canonical-only` to ignore them. `cricket-data link-players` (also run by
`update`) fills `player_id` in provisional files with Base registry IDs ("Harry Brook" -> "HC Brook");
names it cannot match unambiguously go to `data/provisional_unmatched.csv` and can be fixed in
`data/mappings/player_aliases.csv`. `cricket-data freshness` exits 1 when the newest canonical match is more
than 3 days old; the daily update then opens a `data-stale` issue.
