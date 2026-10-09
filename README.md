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

**Ask in plain English** (needs a Claude API key): `cricket-data ask "who won the toss in the last 5 India v West Indies T20Is?"`. See [Ask](docs/ASK.md).

More: [Getting started](docs/GETTING_STARTED.md) · [Contributing](CONTRIBUTING.md)

## Support

This project is free and ad-free. If it's useful to you, you can support it:

<p align="center">
  <a href="https://buymeacoffee.com/meghnaad">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy me a coffee" width="217" />
  </a>
</p>

Questions: dheerajgoeldsuperdude@gmail.com
