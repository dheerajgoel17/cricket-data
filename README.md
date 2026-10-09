# Cricket Data

A free, open cricket dataset that updates itself. Matches and per-player performance (runs, wickets,
catches, stumpings and points) for **23,000+ matches since 2001**: men's and women's, internationals and leagues.

Everything is stored as plain CSV files in this repo.

## What you get

- **Matches and players** in `data/matches/` and `data/players/`, one file per month.
- **Updated daily**, with the latest games added in `data/provisional/` until the full record is available.
- **Gaps filled in**: matches missing from the main record, including Afghanistan men's matches, are added and kept.
- **No cost, no keys, no dependencies**: GitHub Actions and plain Python.

## Quick start

```bash
pip install -e .
cricket-data stats
cricket-data query "Kohli" --since 2026-01-01
cricket-data export-sqlite --out cricket.db
```

To run the live scraper yourself: `pip install playwright && python -m playwright install chromium`, then
`cricket-data update --enable-scraper`.

More: [Data dictionary](docs/DATA_DICTIONARY.md) · [Getting started](docs/GETTING_STARTED.md) ·
[Backfill](docs/BACKFILL.md) · [Contributing](CONTRIBUTING.md)

## Support

This project is free and ad-free. If it's useful to you, you can support it:

<p align="center">
  <a href="https://buymeacoffee.com/meghnaad">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy me a coffee" width="217" />
  </a>
</p>

## Licence

Code: MIT ([LICENSE](LICENSE)). Data: CC BY-SA 4.0, derived from Cricsheet ([DATA_LICENSE.md](DATA_LICENSE.md)).
Credit: [Cricsheet](https://cricsheet.org) (required by the data licence).

Questions: dheerajgoeldsuperdude@gmail.com
