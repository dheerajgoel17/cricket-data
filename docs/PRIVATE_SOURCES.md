# Writing a source for the very latest matches

Cricsheet is normally only **1-2 days** behind, so you rarely need this. If you want same-day results:

1. Pick a site whose **terms allow automated access**. Many cricket sites forbid it, some block bots outright.
   This project ships no site-specific scraper and will not accept one in a pull request.
2. Copy `examples/private_source_template.py` into your own (private) fork and fill in the two parse functions.
3. Use `PoliteFetcher` (`src/cricket_data/polite.py`). It reads robots.txt, refuses disallowed URLs (and refuses when
   robots.txt cannot be read), rate-limits and identifies itself. Do not bypass it.
4. Develop the parsers offline against saved pages and add tests.
5. Enable with `CRICKET_DATA_SOURCES="your_module:YourSource" cricket-data update`.

Whatever you fetch is stored as *provisional*, checked against Cricsheet when the match lands, and then deleted
([PROVISIONAL.md](PROVISIONAL.md)). If your source is wrong, the mismatch shows up in `data/reconcile_log.csv`.
