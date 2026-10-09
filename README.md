# Cricket Data

A free, open cricket dataset that updates itself. Matches and per-player performance (runs, wickets,
catches, stumpings and points) for **23,000+ matches since 2001**: men's and women's, internationals and leagues.

Built on [Cricsheet](https://cricsheet.org) ball-by-ball data, stored as plain CSV files in this repo.

## What you get

- **Matches and players** in `data/matches/` and `data/players/`, one file per month.
- **Updated daily** from Cricsheet.
- **Latest games before Cricsheet has them**: recent matches are fetched from [CREX](https://crex.com) into
  `data/provisional/` and replaced automatically once Cricsheet publishes.
- **Matches Cricsheet doesn't have**: games on Cricsheet's [missing list](https://cricsheet.org/missing/) and
  Afghanistan men's matches (withheld by Cricsheet) are filled in from CREX and kept.
- **No cost, no keys, no dependencies**: GitHub Actions and plain Python.

## Quick start

```bash
pip install -e .
cricket-data stats
cricket-data query "Kohli" --since 2026-01-01
cricket-data export-sqlite --out cricket.db
```

To run the CREX scraper yourself: `pip install playwright && python -m playwright install chromium`, then
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
Please credit **[Cricsheet](https://cricsheet.org)** when you use the data.

Questions: dheerajgoeldsuperdude@gmail.com
