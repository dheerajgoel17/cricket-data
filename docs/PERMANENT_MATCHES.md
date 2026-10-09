# Permanent Match Storage

## Overview

Not all cricket matches make it into Cricsheet's canonical dataset. Some are missing due to data availability issues, and others are withheld for policy reasons. For these matches, we scrape from CREX and **keep them permanently** instead of deleting them after reconciliation.

## Three Match Statuses

### 1. `provisional` (Normal Lag)
**What**: Matches recently completed but not yet in Cricsheet  
**Duration**: Cricsheet typically publishes within 3-4 days  
**Action**: Delete after Cricsheet data arrives and is reconciled  
**Example**: India vs West Indies T20I from yesterday

### 2. `cricsheet_missing` (Permanent Gap)
**What**: Matches on [Cricsheet's missing-matches list](https://cricsheet.org/missing/)  
**Why**: Cricsheet cannot obtain data (licensing, availability issues)  
**Action**: Keep permanently as source of truth  
**Reconciliation**: If Cricsheet later provides the match, reconcile and prefer Cricsheet  
**Examples**:
- England vs India (Women's Test, 2002-01-14)
- Australia vs South Africa (Men's Test, 2001-12-14)
- Historical matches from early 2000s

### 3. `cricsheet_withheld` (Policy Hold)
**What**: Afghanistan men's team and Afghanistan Premier League matches  
**Why**: [Cricsheet withheld all Afghanistan matches since November 2024](https://cricsheet.org/article/explanation-for-withholding-of-afghanistani-matches/) (329 matches removed)  
**Action**: Keep permanently as source of truth  
**Reconciliation**: If Cricsheet ever restores them, reconcile and prefer Cricsheet  
**Examples**:
- Afghanistan vs Pakistan (any men's international)
- Kabul Knights vs Kandahar Kings (APL)
- Any match with team code "AFG" (men's only; women's team NOT withheld)

## How It Works

### 1. Classification
When matches are scraped from CREX, they are automatically classified:

```python
from cricket_data.permanent_matches import classify_match_status

status = classify_match_status(match, missing_matches_list)
# Returns: MatchStatus.PROVISIONAL | CRICSHEET_MISSING | CRICSHEET_WITHHELD
```

Priority order:
1. **Afghanistan check** (fastest; checks team names and event)
2. **Missing matches check** (fetches from Cricsheet, cached per run)
3. **Default**: provisional

### 2. Storage
All matches are written to `data/provisional/<match-id>.json` with their status:

```json
{
  "match_id": "crex-afg-vs-pak-...",
  "status": "cricsheet_withheld",
  "date": "2026-10-09",
  "team_a": "AFG",
  "team_b": "PAK",
  "winner": "Afghanistan",
  ...
}
```

### 3. Reconciliation
The reconcile step respects status:

```python
def reconcile(store):
    for provisional_match in load_provisional():
        canonical = find_canonical(provisional_match)
        
        if canonical is None:
            if is_permanent_status(provisional_match):
                # Keep as source of truth
                stats["permanent_kept"] += 1
            else:
                # Still waiting for Cricsheet
                stats["pending"] += 1
        else:
            # Cricsheet provided it
            compare_and_log(provisional_match, canonical)
            
            # Always delete when Cricsheet has it
            # (Cricsheet is preferred, even for permanent matches)
            delete(provisional_match)
            stats["landed"] += 1
```

### 4. Reconciliation Log
Enhanced with status and action columns:

```csv
checked_on,provisional_id,canonical_id,date,status,winner_ok,players_compared,player_mismatches,action
2026-10-09,crex-afg-vs-pak-...,cricsheet-123,2026-10-08,cricsheet_withheld,true,11,0,replaced_by_cricsheet
2026-10-09,crex-ind-vs-wi-...,cricsheet-456,2026-10-08,provisional,true,11,1,landed_deleted
```

## Missing Matches List

### Fetching
```python
from cricket_data.permanent_matches import fetch_cricsheet_missing_matches

missing = fetch_cricsheet_missing_matches()
# Returns list of MissingMatch(date, team_a, team_b, match_type, gender)
```

### Parsing
Uses `MissingMatchesParser` (HTMLParser subclass) to extract structured data from https://cricsheet.org/missing/

**Page structure**:
```html
<h5>Test Matches</h5>
<h6>Female matches</h6>
<dl>
  <dt>2002-01-14</dt>
  <dd>England vs India</dd>
</dl>
```

**Parsed to**:
```python
MissingMatch(
    date="2002-01-14",
    team_a="England",
    team_b="India",
    match_type="Test",
    gender="female"
)
```

### Caching
Missing matches list is fetched **once per scraper run** and reused for all match classifications (via `ScraperSource._missing_matches_cache`).

## Afghanistan Detection

### Rules
```python
def is_afghanistan_match(match):
    # Men's team (NOT women)
    if match.gender != "female":
        if "afghanistan" in team_names or "AFG" in teams:
            return True
    
    # Afghanistan Premier League
    if "afghanistan premier league" in event or "apl" in event:
        return True
    
    return False
```

### Why Afghanistan?
From [Cricsheet's announcement](https://cricsheet.org/article/explanation-for-withholding-of-afghanistani-matches/):
- **329 matches removed** (all Afghanistan men's internationals and APL)
- Includes historical matches going back years
- May be restored in the future
- Women's team matches are NOT withheld

## CLI Reporting

Example output:
```
provisional: 15 written
  - 12 provisional (normal lag)
  - 2 cricsheet_missing (permanent)
  - 1 cricsheet_withheld (Afghanistan)
reconcile: {'landed': 5, 'mismatched': 0, 'pending': 10, 'stale': 0, 'permanent_kept': 3}
```

**Stats explanation**:
- `landed`: Provisional matches that Cricsheet published (deleted)
- `pending`: Still waiting for Cricsheet
- `permanent_kept`: Missing/withheld matches kept as source of truth
- `stale`: Provisional matches older than 45 days (likely won't land)

## Backfilling

### Historical Missing Matches
Periodically backfill Cricsheet's missing list from CREX:
1. Fetch current missing-matches list
2. For each missing match, search CREX by date + teams
3. If found, scrape and store as `cricsheet_missing`

### Historical Afghanistan Matches
Scrape as far back as CREX allows:
1. Search CREX for "Afghanistan" matches (any date)
2. Scrape and store as `cricsheet_withheld`
3. CREX may have years of historical data

## Testing

### Unit Tests
```bash
pytest tests/test_permanent_matches.py -v
```

Covers:
- Missing matches HTML parsing
- Afghanistan match detection (men's team, women's team, APL)
- Status classification (provisional, missing, withheld)
- Priority order (Afghanistan > missing > provisional)
- Team order independence

### Integration Tests
```bash
pytest tests/test_scrapers.py -v
```

Includes end-to-end tests with:
- ScraperSource classification
- Multi-source resolution
- Reconciliation with permanent statuses

## Future Enhancements

1. **Automated backfilling**: Run daily job to backfill new entries from missing list
2. **Change detection**: Monitor Cricsheet's missing list for changes (additions/removals)
3. **Historical sweep**: One-time backfill of all historical Afghanistan matches
4. **Alert on restoration**: Notify when Cricsheet restores Afghanistan matches
5. **Additional categories**: Handle other permanent gaps (club leagues, historical periods)

## Files

### Core Modules
- `src/cricket_data/models.py` - `MatchStatus` enum
- `src/cricket_data/permanent_matches.py` - Classification logic
- `src/cricket_data/scrapers.py` - `ScraperSource` integration
- `src/cricket_data/provisional.py` - Reconciliation with status awareness

### Tests
- `tests/test_permanent_matches.py` - Unit tests
- `tests/test_scrapers.py` - Integration tests

### Data
- `data/provisional/*.json` - All matches (provisional + permanent)
- `data/reconcile_log.csv` - Enhanced with status and action columns
- `data/scraper_run_report.json` - Run statistics

## References
- [Cricsheet missing-matches list](https://cricsheet.org/missing/)
- [Afghanistan matches withheld announcement](https://cricsheet.org/article/explanation-for-withholding-of-afghanistani-matches/)
- [Cricsheet robots.txt](https://cricsheet.org/robots.txt) - Allows scraping (only `/data/` disallowed)
