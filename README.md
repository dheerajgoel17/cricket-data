<p align="center"><img src="mobile/assets/images/icon.png" alt="Fancy.cash app icon" width="88" /></p>

<h1 align="center">Fancy.cash</h1>

<p align="center">Live cricket scores, player form, ground stats, and historical match data.</p>

<p align="center">
  <a href="#download">Download Android APK</a> ·
  <a href="https://fancy.cash">Open the website</a> ·
  <a href="#features">Features</a> ·
  <a href="#quick-start">Developer quick start</a>
</p>

## Download

Get the latest Android APK from [GitHub Releases](https://github.com/dheerajgoel17/cricket-data/releases/latest). On your phone, open the release, download the `.apk` under **Assets**, and open it to install. Android may ask you to allow installs from your browser.

You can also use [Fancy.cash on the web](https://fancy.cash). See the [mobile app guide](docs/MOBILE.md) for local iOS and Android builds.

## Features

- **Live cricket** — scores, innings summaries, and upcoming fixtures.
- **Player form** — recent results, historical hit rates, and comparisons by opponent and venue.
- **Ground pages** — match history, live fixtures, and historical market distributions with format filters.
- **Cricket dataset** — downloadable match and player records, with a command-line tool for analysis.

## Cricket dataset

A free cricket dataset. Matches and per-player performance for **23,000+ matches since 2001**:
men's and women's, internationals and leagues. Updated daily, including the latest games.

Match files under `data/` are [CC BY-SA 4.0](DATA_LICENSE.md). The software is source-available ([LICENSE](LICENSE)): read it, run it for yourself, send patches. A competing hosted props or fancy-markets service is not a permitted purpose.

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

This project is free. If it's useful to you, you can support it:

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
