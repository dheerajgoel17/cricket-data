# Web Scraper for Recent Matches

The cricket data project includes an automated web scraper that fills the gap between live matches and Cricsheet's publication delay (typically 3-4 days). The scraper periodically fetches recently completed matches from public cricket websites, normalizes them to the project's format, and stores them as provisional data until Cricsheet publishes the official version.

## How It Works

### 1. Periodic Scraping
The scraper runs on a schedule (every 6 hours by default via GitHub Actions) to find recently completed matches that Cricsheet doesn't have yet.

### 2. Multi-Source Fetching

The scraper uses a **pluggable architecture** via `ScraperRegistry`:

**Built-in sources:**
- **ESPNcricinfo**: Public JSON API (fully implemented)
- **CREX (crex.com)**: rendered pages + public sitemaps (see BACKFILL.md)
- **Cricbuzz**: Placeholder (awaiting API documentation)

**Add your own:** Any cricket score website can be added by implementing the `CricketScraper` protocol and registering with `ScraperRegistry`. See [Data Sources](#data-sources) section below.

All registered scrapers are automatically used for fetching and conflict resolution.

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

The scraper uses a **pluggable architecture** via `ScraperRegistry`. Any cricket score website can be added as a source by implementing the `CricketScraper` protocol.

### Built-in Sources

#### ESPNcricinfo
- **Status**: ✅ Implemented
- **Base URL**: https://www.espncricinfo.com
- **Endpoints Used**:
  - `/ci/engine/match/index.json?view=live` - Recent match list
  - `/ci/engine/match/<match_id>.json` - Match details
- **Rate Limiting**: 5-second delay between requests
- **robots.txt Compliance**: Yes (checked before every request)

#### CREX (crex.com)
- **Status**: ✅ Working (headless Chromium via Playwright; pages render with JavaScript)
- **Base URL**: https://crex.com
- **Recent matches**: home page links; facts come from each match page's `SportsEvent` JSON-LD
- **Historical matches**: sitemap index + strict confirmation, see [BACKFILL.md](BACKFILL.md)
- **Rate Limiting**: 5-second delay between requests, back-off on 429/5xx
- **robots.txt Compliance**: Yes (`/api/*` is never touched)

#### Cricbuzz
- **Status**: ⚠️ Placeholder
- **Base URL**: https://www.cricbuzz.com
- **Note**: Structure defined, returns empty results until API is documented
- **To complete**: Identify API endpoints and verify terms of service

### Pluggable Architecture

All scrapers are automatically discovered via `ScraperRegistry`. When you add a new scraper, it immediately participates in multi-source conflict resolution—no need to modify existing code.

```python
# Built-in scrapers are auto-registered at module load:
ScraperRegistry.register(ESPNcricinfoScraper)
ScraperRegistry.register(CREXScraper)
ScraperRegistry.register(CricbuzzScraper)

# MultiSourceScraper automatically uses all registered sources:
scraper = MultiSourceScraper()  # Uses all registered scrapers
matches = scraper.fetch(since=date(2026, 10, 1))
```

### Adding New Sources

To add support for any cricket score website:

#### 1. Implement the CricketScraper Protocol

Create a class with these three members:

```python
from cricket_data.scrapers import ScraperRegistry
from cricket_data.models import MatchRecord
from cricket_data.polite import PoliteFetcher

class YourScraper:
    """Scrape cricket data from your-site.com"""
    
    name = "yoursite"  # Unique identifier
    base_url = "https://your-site.com"
    
    def __init__(self, fetcher: PoliteFetcher | None = None):
        self.fetcher = fetcher or PoliteFetcher(min_interval=5.0)
    
    def fetch_recent_match_ids(self, days: int = 7) -> list[str]:
        """Return match IDs for matches completed in the last N days."""
        url = self.base_url + "/api/recent-matches"
        data = self.fetcher.get(url)  # Respects robots.txt and rate limits
        
        # Parse response and return match IDs
        matches = json.loads(data)
        return [str(m["id"]) for m in matches if m["status"] == "complete"]
    
    def fetch_match(self, match_id: str) -> MatchRecord | None:
        """Fetch and parse a single match."""
        url = f"{self.base_url}/api/match/{match_id}"
        data = self.fetcher.get(url)
        match_data = json.loads(data)
        
        # Parse into MatchRecord
        return MatchRecord(
            match_id=f"yoursite-{match_id}",
            date=match_data["date"],
            team_a=match_data["team_a"],
            team_b=match_data["team_b"],
            winner=match_data["winner"],
            source=self.name,
            # ... more fields
        )
```

#### 2. Register Your Scraper

```python
# Option A: Register at module level (recommended for built-in sources)
# Add to scrapers.py:
ScraperRegistry.register(YourScraper)

# Option B: Register at runtime (useful for plugins)
from cricket_data.scrapers import ScraperRegistry
ScraperRegistry.register(YourScraper)
```

#### 3. That's It!

Your scraper will automatically:
- Be used by `MultiSourceScraper` for fetching
- Participate in multi-source conflict resolution
- Respect robots.txt (via `PoliteFetcher`)
- Follow rate limits

No need to modify any other code—the registry system handles discovery.

### CricketScraper Protocol

Your scraper must implement:

```python
class CricketScraper(Protocol):
    """Interface for cricket scrapers."""
    
    name: str  # Unique identifier for this scraper
    
    def fetch_recent_match_ids(self, days: int = 7) -> list[str]:
        """Get match IDs for recently completed matches.
        
        Should return match IDs for matches completed in the last N days.
        Return empty list if no matches found or source unavailable.
        
        Raises:
            ScraperError: If fetching fails
            RobotsDisallowed: If robots.txt forbids access
        """
        ...
    
    def fetch_match(self, match_id: str) -> MatchRecord | None:
        """Fetch and parse a single match.
        
        Return None if the match cannot be fetched/parsed.
        Should NOT raise exceptions for individual match failures.
        
        Raises:
            ScraperError: If a critical error occurs
            RobotsDisallowed: If robots.txt forbids access
        """
        ...
```

### Registry Management

```python
from cricket_data.scrapers import ScraperRegistry

# Get all registered scrapers
scrapers = ScraperRegistry.get_all()
print(f"Found {len(scrapers)} scrapers")

# Get a specific scraper by name
espn = ScraperRegistry.get_by_name("espncricinfo")

# Clear registry (useful for testing)
ScraperRegistry.clear()

# Re-register
ScraperRegistry.register(ESPNcricinfoScraper)
```

### Example: Complete Custom Scraper

Here's a complete example scraper for a hypothetical site:

```python
import json
from datetime import date, timedelta
from cricket_data.scrapers import ScraperRegistry, ScraperError
from cricket_data.models import MatchRecord, PlayerPerf
from cricket_data.polite import PoliteFetcher, RobotsDisallowed

class CricketAPIOrg:
    """Scraper for cricket-api.org (hypothetical)."""
    
    name = "cricket-api-org"
    base_url = "https://cricket-api.org"
    
    def __init__(self, fetcher: PoliteFetcher | None = None):
        self.fetcher = fetcher or PoliteFetcher(min_interval=10.0)  # Slower rate
    
    def fetch_recent_match_ids(self, days: int = 7) -> list[str]:
        try:
            cutoff = (date.today() - timedelta(days=days)).isoformat()
            url = f"{self.base_url}/v1/matches?since={cutoff}&status=completed"
            
            if not self.fetcher.allowed(url):
                return []  # Blocked by robots.txt
            
            data = self.fetcher.get(url)
            matches = json.loads(data)["data"]
            
            return [str(m["match_id"]) for m in matches]
        
        except (RobotsDisallowed, json.JSONDecodeError, KeyError) as exc:
            # Log error but don't crash
            print(f"Warning: {self.name} failed: {exc}")
            return []
    
    def fetch_match(self, match_id: str) -> MatchRecord | None:
        try:
            url = f"{self.base_url}/v1/match/{match_id}"
            data = self.fetcher.get(url)
            match = json.loads(data)
            
            return MatchRecord(
                match_id=f"{self.name}-{match_id}",
                date=match["date"],
                team_a=match["teams"][0]["name"],
                team_b=match["teams"][1]["name"],
                winner=match["result"]["winner"],
                result_margin=match["result"]["margin"],
                venue=match["venue"]["name"],
                match_type=match["format"],
                source=self.name,
                players=[
                    PlayerPerf(
                        match_id=f"{self.name}-{match_id}",
                        date=match["date"],
                        player=p["name"],
                        runs=p["batting"]["runs"],
                        wickets=p["bowling"]["wickets"],
                    )
                    for p in match["players"]
                ],
            )
        
        except Exception as exc:
            print(f"Warning: Failed to parse match {match_id}: {exc}")
            return None

# Register it
ScraperRegistry.register(CricketAPIOrg)
```

Now `CricketAPIOrg` will be automatically used alongside ESPNcricinfo and CREX!

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

With multiple sources, the scraper uses **majority voting**. More sources = more robust resolution.

### Example 1: Winner Disagreement (3 sources)
```
Sources:
- espncricinfo: India won
- crex: India won  
- other: Australia won

Resolution: India won (2-1 majority)
Logged to scraper_report.csv
```

### Example 2: Player Stats Disagreement (3 sources)
```
Sources:
- espncricinfo: V Kohli scored 50 runs
- crex: V Kohli scored 50 runs
- other: V Kohli scored 48 runs

Resolution: 50 runs (2-1 majority)
```

### Example 3: Two Sources, Tie
```
Sources:
- espncricinfo: India won
- crex: Australia won

Resolution: Falls back to first source (espncricinfo)
Logged as conflict with no clear majority
```

### Example 4: Agreement (no conflict)
```
Sources:
- espncricinfo: India won by 7 wickets
- crex: India won by 7 wickets

Resolution: No conflict, India won
Not logged (sources agree)
```

### Why More Sources Matter

- **2 sources**: Ties are common, fall back to first source
- **3+ sources**: Clear majorities, better conflict detection
- **5+ sources**: Very robust, minority errors filtered out

The pluggable architecture makes it easy to add more sources as they become available.

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
│                    ↓                            │
│            ScraperRegistry                      │
│  ┌─────────────────────────────────────────┐   │
│  │  ESPNcricinfoScraper (registered)       │   │
│  │  - Fetch match list                     │   │
│  │  - Fetch match details (JSON API)       │   │
│  │  - Parse into MatchRecord               │   │
│  └─────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────┐   │
│  │  CREXScraper (registered)               │   │
│  │  - Auto-discover API patterns           │   │
│  │  - Graceful failure if unreachable      │   │
│  └─────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────┐   │
│  │  CricbuzzScraper (placeholder)          │   │
│  │  YourCustomScraper (if registered)      │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Conflict Resolution:                          │
│  - Group matches by (date, teams)              │
│  - If multiple sources: majority vote          │
│  - More sources = better resolution            │
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

### Key Design: Pluggable Registry

The scraper uses a **registry pattern** for extensibility:

1. **ScraperRegistry**: Central registry of all scrapers
2. **CricketScraper Protocol**: Interface all scrapers implement
3. **Auto-discovery**: `MultiSourceScraper` automatically uses all registered scrapers
4. **No code changes needed**: Just register your scraper and it works

This makes adding new sources trivial—implement the protocol, register, done.

## Contributing

To add a new scraper:
1. Implement the `CricketScraper` protocol in `scrapers.py`
2. Add comprehensive tests in `tests/test_scrapers.py`
3. Register with `ScraperRegistry.register(YourScraper)`
4. Update this documentation
5. Verify robots.txt compliance and rate limiting
6. Document the source's API structure and any quirks

The pluggable architecture makes contributions straightforward—no need to modify existing scrapers or the conflict resolution logic.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for general guidelines.
