# Cricket Data

A free, self-updating, open cricket dataset. Every day it ingests [Cricsheet](https://cricsheet.org)
ball-by-ball data into compact CSVs of **matches** and **per-player performance** (runs, wickets, catches,
stumpings, "player performance" points), covering **23,000+ matches** from 2001 to today (men's and women's,
internationals and leagues).

- **Always fresh**: daily run re-reads the last 30 days; a weekly run re-reads everything to heal gaps.
- **Provisional data for the latest games**: optionally supply matches Cricsheet hasn't published yet, or enable
  the built-in **web scraper** to automatically fetch recent matches from public cricket sites. They are
  verified against Cricsheet when it lands, then **deleted automatically** (see [docs/PROVISIONAL.md](docs/PROVISIONAL.md)
  and [docs/SCRAPER.md](docs/SCRAPER.md)).
- **Zero cost, zero secrets**: GitHub Actions + plain files. See [docs/ZERO_COST.md](docs/ZERO_COST.md).
- **No dependencies**: pure Python standard library.

## Quick start
```bash
pip install -e ".[dev]"
cricket-data stats
cricket-data query "Renshaw" --since 2026-09-01

# Enable web scraper for recent matches
cricket-data update --enable-scraper

cricket-data export-sqlite --out cricket.db
```
More: [Getting started (any IDE)](docs/GETTING_STARTED.md) | [Data dictionary](docs/DATA_DICTIONARY.md) |
[Architecture](docs/ARCHITECTURE.md) | [Web Scraper](docs/SCRAPER.md) | [Contributing](CONTRIBUTING.md)

## Licence
Code: MIT ([LICENSE](LICENSE)). Data: CC BY-SA 4.0, derived from Cricsheet ([DATA_LICENSE.md](DATA_LICENSE.md)).
Please credit **Cricsheet** (<https://cricsheet.org>) when you use the data.
Maintainer contact: dheerajgoeldsuperdude@gmail.com.
