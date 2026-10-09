# Web Scraper for Recent Matches

The cricket data project includes an automated web scraper that fills the gap between live matches and Cricsheet's publication delay (typically 3-4 days). The scraper periodically fetches recently completed matches from public cricket websites, normalizes them to the project's format, and stores them as provisional data until Cricsheet publishes the official version.

## How It Works

### 1. Periodic Scraping
The scraper runs on a schedule (every 6 hours by default via GitHub Actions) to find recently completed matches that Cricsheet doesn't have yet.

### 2. Multi-Source Fetching
The scraper currently supports:
- **ESPNcricinfo**: Uses their public JSON API endpoints for match data
- **Cricbuzz**: Placeholder for future implementation (requires API documentation)
- More sources can be added by implementing the scraper interface

### 3. Conflict Resolution
When multiple sources report different details for the same match (e.g., different scores or winner), the scraper:
1. Collects all versions of the match from all available sources
2. Uses majority voting to resolve conflicts:
   - Winner: most common value across sources
   - Player statistics: most common value for each stat
3. Logs all conflicts and resolutions to `data/scraper_report.csv`

### 4. Provisional Storage
Scraped matches are stored as JSON files in `data/provisional/` with:
- `status=provisional` flag
- Source attribution (e.g., `espncricinfo`, `multi(espncricinfo,cricbuzz)`)
- Match key for later reconciliation

### 5. Automatic Reconciliation
When Cricsheet publishes the official match data, the daily update workflow:
1. Compares the scraped version with Cricsheet's version
2. Verifies key fields (winner, player stats)
3. Logs any discrepancies to `data/reconcile_log.csv`
4. **Deletes the provisional scraped copy** (Cricsheet is the source of truth)

## Usage

### Enable Scraper in CLI
```bash
# Manual scrape of last 7 days
cricket-data update --enable-scraper --provisional-days 7

# Without scraper (inbox and custom sources only)
cricket-data update
```

### Environment Variable
Set `CRICKET_DATA_ENABLE_SCRAPER=1` to enable by default:
```bash
export CRICKET_DATA_ENABLE_SCRAPER=1
cricket-data update
```

### Scheduled via GitHub Actions
Two workflows run automatically:
1. **Daily Update** (`daily-update.yml`): Runs once per day, updates Cricsheet + scrapes
2. **Scraper Update** (`scraper-update.yml`): Runs every 6 hours, scrapes only

Both workflows automatically commit new provisional data.

## Data Sources

### ESPNcricinfo
- **Base URL**: https://www.espncricinfo.com
- **Endpoints Used**:
  - `/ci/engine/match/index.json?view=live` - Recent match list
  - `/ci/engine/match/<match_id>.json` - Match details
- **Rate Limiting**: 5-second delay between requests
- **robots.txt Compliance**: Yes (checked before every request)

### Adding New Sources
Implement a scraper class with:
```python
class NewScraper:
    name = "newsource"
    
    def __init__(self, fetcher: PoliteFetcher | None = None):
        self.fetcher = fetcher or PoliteFetcher(min_interval=5.0)
    
    def _recent_match_ids(self, days: int = 7) -> list[str]:
        # Return list of match IDs from the last N days
        pass
    
    def fetch_match(self, match_id: str) -> MatchRecord | None:
        # Fetch and parse a single match
        pass
```

Add it to `MultiSourceScraper` in `scrapers.py`:
```python
self.scrapers = scrapers or [ESPNcricinfoScraper(), NewScraper()]
```

## Observability

### Scraper Report
Location: `data/scraper_report.csv`

Columns:
- `timestamp`: When the conflict was detected
- `date`: Match date
- `teams`: Teams involved
- `sources`: Comma-separated list of sources that disagreed
- `disagreements`: JSON object with field-level conflicts and resolutions

Example:
```csv
timestamp,date,teams,sources,disagreements
2026-10-09,2026-10-08,India vs Australia,"espncricinfo,cricbuzz","[{""field"":""winner"",""values"":{""india"":2,""australia"":1},""resolved"":""india""}]"
```

### Reconciliation Log
Location: `data/reconcile_log.csv`

Logs when provisional matches are verified against Cricsheet (see [PROVISIONAL.md](PROVISIONAL.md)).

### GitHub Actions Artifacts
Each scraper run uploads the scraper report as an artifact for review.

## Ethical & Legal Considerations

### Robots.txt Compliance
The scraper uses `PoliteFetcher` which:
- Checks `robots.txt` before every request
- Refuses to fetch URLs that are disallowed
- Treats unreachable `robots.txt` as "disallow all"

### Rate Limiting
- Minimum 5-second delay between requests to the same domain
- Configurable per-scraper via `PoliteFetcher(min_interval=...)`
- Respects HTTP 429 (Too Many Requests) responses

### Terms of Service
**Only use the scraper with websites whose terms allow automated access.**

ESPNcricinfo and similar sites may have terms restricting automated scraping. This implementation:
- Prefers structured JSON APIs over HTML parsing
- Identifies itself with a clear User-Agent
- Does not circumvent paywalls or authentication
- Is intended for personal, non-commercial dataset building

**You are responsible for ensuring your use complies with each site's terms.**

See [PRIVATE_SOURCES.md](PRIVATE_SOURCES.md) for more guidance.

## Conflict Resolution Examples

### Example 1: Winner Disagreement
```
Sources:
- espncricinfo: India won
- cricbuzz: India won
- other: Australia won

Resolution: India won (2-1 majority)
```

### Example 2: Player Stats Disagreement
```
Sources:
- espncricinfo: V Kohli scored 50 runs
- cricbuzz: V Kohli scored 50 runs
- other: V Kohli scored 48 runs

Resolution: 50 runs (2-1 majority)
```

### Example 3: Unresolvable Conflict (Tie)
```
Sources:
- espncricinfo: India won
- cricbuzz: Australia won

Resolution: Falls back to first source (espncricinfo)
Logged as conflict with no clear majority
```

## Testing

Run scraper tests:
```bash
pytest tests/test_scrapers.py -v
```

Tests cover:
- Match key generation and normalization
- ESPNcricinfo JSON parsing
- Multi-source conflict resolution
- Player stat merging
- Provisional marking

All tests use fixtures and mocks—no live network calls.

## Manual Testing

### Test with Mock Data
```python
from cricket_data.scrapers import ScraperSource
from datetime import date, timedelta

source = ScraperSource()
matches = source.fetch(since=date.today() - timedelta(days=7))

for match in matches:
    print(f"{match.date}: {match.team_a} vs {match.team_b} - {match.winner}")
```

### Dry Run (No Commit)
```bash
# Clone the repo to a test directory
git clone <repo-url> test-scraper
cd test-scraper

# Run scraper
cricket-data update --enable-scraper --provisional-days 3

# Check provisional data
ls -la data/provisional/

# Check for conflicts
cat data/scraper_report.csv
```

## Troubleshooting

### No Matches Scraped
**Possible causes:**
1. No recently completed matches in the past N days
2. All recent matches already in Cricsheet
3. Scraper blocked by `robots.txt`
4. Network errors (check logs)

**Solution:** Run with `--provisional-days 14` to widen the window.

### Scraper Fails with RobotsDisallowed
**Cause:** The target website's `robots.txt` disallows automated access.

**Solution:** 
- Respect the site's policy—do not circumvent it
- Use a different source
- Wait for Cricsheet to publish the match

### High Conflict Rate
**Cause:** Sources frequently disagree on match details.

**Solution:**
- Review `scraper_report.csv` to identify patterns
- Consider dropping unreliable sources
- Investigate if sources use different scoring conventions

### Scraper Workflow Failing
**Check:**
1. GitHub Actions logs for error messages
2. Whether the site changed its API structure
3. Network connectivity issues
4. Rate limiting (reduce scraper frequency)

## Configuration

### Scraper Interval
Edit `.github/workflows/scraper-update.yml`:
```yaml
schedule:
  - cron: "0 */6 * * *"  # Every 6 hours
  # Change to "0 */12 * * *" for every 12 hours
```

### Provisional Retention Window
Edit `.github/workflows/scraper-update.yml`:
```yaml
- name: Scrape recent matches
  run: cricket-data update --enable-scraper --provisional-days 7
  # Change 7 to desired number of days
```

### Rate Limiting
Edit `scrapers.py`:
```python
scraper = ESPNcricinfoScraper(
    fetcher=PoliteFetcher(min_interval=10.0)  # 10 seconds between requests
)
```

## Limitations

### Current Limitations
1. **ESPNcricinfo only**: Cricbuzz scraper is not yet implemented
2. **No ball-by-ball data**: Scrapers fetch summary stats only (Cricsheet has full ball-by-ball)
3. **Limited match types**: Currently focuses on international and major league matches
4. **No in-progress matches**: Only completed matches are scraped

### Future Enhancements
- [ ] Cricbuzz scraper implementation
- [ ] Ball-by-ball scraping (where available)
- [ ] In-progress match updates
- [ ] More granular fielding stats
- [ ] Support for domestic leagues
- [ ] Fallback to HTML parsing when JSON APIs unavailable

## Architecture

```
┌─────────────────────────────────────────────────┐
│         GitHub Actions Schedule                 │
│  (every 6 hours: scraper-update.yml)           │
└────────────────┬────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────┐
│         cricket-data update --enable-scraper    │
└────────────────┬────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────┐
│            MultiSourceScraper                   │
│  ┌─────────────────────────────────────────┐   │
│  │  ESPNcricinfoScraper                    │   │
│  │  - Fetch match list                     │   │
│  │  - Fetch match details (JSON API)       │   │
│  │  - Parse into MatchRecord               │   │
│  └─────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────┐   │
│  │  CricbuzzScraper (placeholder)          │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Conflict Resolution:                          │
│  - Group matches by (date, teams)              │
│  - If multiple sources: majority vote          │
│  - Log conflicts → scraper_report.csv          │
└────────────────┬────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────┐
│         Provisional Storage                     │
│  data/provisional/scraped-<key>.json           │
│  - status=provisional                          │
│  - source=espncricinfo or multi(...)           │
└────────────────┬────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────┐
│         Reconciliation (daily)                  │
│  - Cricsheet publishes official match          │
│  - Compare with provisional version            │
│  - Log to reconcile_log.csv                    │
│  - DELETE provisional copy                     │
└─────────────────────────────────────────────────┘
```

## Contributing

To add a new scraper:
1. Implement the scraper class in `scrapers.py`
2. Add tests in `tests/test_scrapers.py`
3. Update this documentation
4. Verify robots.txt compliance
5. Document the source's API structure and any quirks

See [CONTRIBUTING.md](../CONTRIBUTING.md) for general guidelines.
