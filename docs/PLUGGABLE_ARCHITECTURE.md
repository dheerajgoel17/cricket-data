# Pluggable Scraper Architecture - Design Document

## Overview
The cricket data scraper now uses a fully pluggable architecture that allows any cricket score website to be added as a source without modifying existing code. This document explains the design decisions and architecture.

## Problem Statement
The original implementation hardcoded ESPNcricinfo and had a placeholder for Cricbuzz. Adding new sources required:
1. Modifying `MultiSourceScraper.__init__` 
2. Changing the scraper list in multiple places
3. No clear interface for what a scraper must implement

This didn't scale—each new source meant touching core code.

## Solution: Registry Pattern + Protocol

### 1. CricketScraper Protocol
Defines the interface all scrapers must implement:

```python
class CricketScraper(Protocol):
    name: str
    def fetch_recent_match_ids(self, days: int = 7) -> list[str]: ...
    def fetch_match(self, match_id: str) -> MatchRecord | None: ...
```

**Why Protocol?**
- Duck typing: Any class with these methods works
- No inheritance required (more flexible)
- Type checking support (mypy, pyright)
- Clear contract for implementers

**Why these methods?**
- `fetch_recent_match_ids`: Discovery (what matches are available?)
- `fetch_match`: Fetching (get details for one match)
- Separation allows for efficient bulk fetching

### 2. ScraperRegistry
Central registry for auto-discovery:

```python
class ScraperRegistry:
    _scrapers: list[type] = []
    _instances: dict[str, Any] = {}
    
    @classmethod
    def register(cls, scraper_class: type) -> None: ...
    
    @classmethod
    def get_all(cls, fetcher: PoliteFetcher | None = None) -> list[Any]: ...
```

**Design decisions:**
- **Class-level storage**: Registry is global, shared across all instances
- **Lazy instantiation**: Scrapers created on first access (saves resources)
- **Shared fetcher**: Optional shared `PoliteFetcher` for centralized rate limiting
- **Instance caching**: Reuse scraper instances (they're stateless except for config)

**Why not a config file?**
- Python code IS the config (imports, registration)
- No parsing needed
- Type checking works
- Easy for plugins: just import and register

### 3. MultiSourceScraper Auto-Discovery
```python
class MultiSourceScraper:
    def __init__(self, scrapers: list | None = None, fetcher: PoliteFetcher | None = None):
        if scrapers is not None:
            self.scrapers = scrapers  # Explicit list
        else:
            self.scrapers = ScraperRegistry.get_all(fetcher=fetcher)  # Auto-discover
```

**Flexibility:**
- Default: Use all registered scrapers
- Override: Provide explicit list (useful for testing or custom setups)
- Shared rate limiting: Optional `fetcher` applies to all scrapers

### 4. Built-in Scrapers
Registered at module load:

```python
# At end of scrapers.py
ScraperRegistry.register(ESPNcricinfoScraper)
ScraperRegistry.register(CREXScraper)
ScraperRegistry.register(CricbuzzScraper)
```

**Why at module level?**
- Auto-registration: Import `scrapers.py` and they're available
- No manual initialization needed
- Clear declaration of built-in sources

## Benefits

### For Users
1. **More sources = better data**: Conflict resolution improves with 3+ sources
2. **Graceful degradation**: If one source is down, others still work
3. **No configuration**: Just works out of the box

### For Contributors
1. **Add new source in one place**: Implement protocol, register, done
2. **No code changes elsewhere**: MultiSourceScraper auto-discovers
3. **Clear interface**: Protocol shows exactly what's needed
4. **Easy testing**: Clear registry, register mocks, test

### For Maintainers
1. **Open/closed principle**: Open for extension (new scrapers), closed for modification (core code)
2. **Single responsibility**: Registry manages scrapers, MultiSourceScraper manages fetching
3. **Testability**: Registry can be cleared/mocked for tests

## Implementation Details

### Scraper Lifecycle
1. **Registration** (module load): `ScraperRegistry.register(ScraperClass)`
2. **Instantiation** (first use): `ScraperRegistry.get_all()` creates instances
3. **Caching** (subsequent use): Reuse same instances
4. **Fetching** (each run): `MultiSourceScraper.fetch()` calls all scrapers

### Error Handling Philosophy
- **Individual match failures**: Don't stop the source (return None)
- **Source unavailable**: Don't stop other sources (return empty list)
- **Critical errors**: Raise ScraperError or RobotsDisallowed

This ensures maximum data availability even with partial failures.

### Rate Limiting Strategy
- **Per-scraper fetcher**: Each scraper has its own `PoliteFetcher` by default
- **Shared fetcher**: Optional, for global rate limiting across all sources
- **Per-domain tracking**: `PoliteFetcher` tracks delays per domain

### Robots.txt Compliance
- Every scraper should use `PoliteFetcher`
- Checks robots.txt before EVERY request
- Treats unreachable robots.txt as "disallow all"
- No way to bypass (enforced by PoliteFetcher)

## CREX Implementation

### Why CREX?
User requested a third source alongside ESPNcricinfo and Cricbuzz. CREX (crex.live) is a cricket live scores site.

### Implementation Strategy
**Best-effort auto-discovery:**
- Try multiple common API patterns: `/api/matches/recent`, `/matches/completed`, etc.
- If all fail, return empty (source unavailable)
- Graceful degradation: Don't crash if unreachable

**Why not require documented API?**
- Many cricket sites don't document their APIs
- Best-effort scraping is better than no scraping
- Users can still benefit if CREX works

**Ethical considerations:**
- Still respects robots.txt
- Still rate limits
- Fails gracefully if blocked
- Documentation warns about terms of service

### CREX Parsing
Uses flexible parsing that handles multiple JSON structures:
- Field name variations: `date` vs `start_date`, `teams` vs `team_a`/`team_b`
- Different nesting: `match.data` vs flat `match`
- Multiple formats: ISO dates, date-only strings

This maximizes compatibility with unknown API structures.

## Extensibility Examples

### Example 1: Add CricInfo Premium
```python
class CricInfoPremium:
    name = "cricinfo-premium"
    def __init__(self, api_key: str, fetcher=None):
        self.api_key = api_key
        self.fetcher = fetcher or PoliteFetcher()
    
    def fetch_recent_match_ids(self, days=7):
        # Use premium API with auth
        ...
    
    def fetch_match(self, match_id):
        # Fetch with auth
        ...

# Register with API key from env
import os
if os.getenv("CRICINFO_API_KEY"):
    ScraperRegistry.register(lambda: CricInfoPremium(os.getenv("CRICINFO_API_KEY")))
```

### Example 2: Plugin System
```python
# In user's custom module
from cricket_data.scrapers import ScraperRegistry

class MyCustomScraper:
    name = "my-scraper"
    # ... implement protocol ...

ScraperRegistry.register(MyCustomScraper)

# Now import this before using cricket-data
import my_custom_scraper  # Registers scraper
from cricket_data.scrapers import MultiSourceScraper

scraper = MultiSourceScraper()  # Auto-includes MyCustomScraper
```

### Example 3: Testing with Mocks
```python
def test_multi_source():
    ScraperRegistry.clear()  # Clean slate
    
    class MockScraper:
        name = "mock"
        def fetch_recent_match_ids(self, days=7):
            return ["1", "2"]
        def fetch_match(self, match_id):
            return MatchRecord(...)  # Test data
    
    ScraperRegistry.register(MockScraper)
    
    multi = MultiSourceScraper()
    matches = multi.fetch(date(2026, 10, 1))
    
    assert len(matches) == 2
    
    ScraperRegistry.clear()  # Clean up
```

## Comparison with Alternatives

### Alternative 1: Config File
```yaml
scrapers:
  - name: espncricinfo
    class: cricket_data.scrapers.ESPNcricinfoScraper
  - name: crex
    class: cricket_data.scrapers.CREXScraper
```

**Rejected because:**
- Requires parsing YAML
- No type checking
- Extra dependency (pyyaml)
- Less flexible (can't pass constructor args easily)

### Alternative 2: Entry Points
```python
# setup.py
entry_points={
    'cricket_data.scrapers': [
        'espncricinfo = cricket_data.scrapers:ESPNcricinfoScraper',
    ]
}
```

**Rejected because:**
- Requires package installation for plugins
- Complex for built-in scrapers
- Harder to test

### Alternative 3: Decorator
```python
@register_scraper
class ESPNcricinfoScraper:
    ...
```

**Rejected because:**
- Implicit (harder to find all scrapers)
- Decorator runs at class definition (timing issues)
- Harder to unregister for testing

## Testing Strategy

### Unit Tests
- Test each scraper in isolation
- Mock PoliteFetcher
- Test parsing with fixtures
- Test error handling

### Integration Tests
- Test ScraperRegistry
- Test MultiSourceScraper with multiple sources
- Test conflict resolution
- Test auto-discovery

### Test Isolation
- Clear registry before each test
- Restore original state after test
- Use explicit scraper lists when needed

## Future Enhancements

### Potential Additions
1. **Priority System**: Prefer certain sources over others
2. **Reliability Tracking**: Track which sources are most reliable
3. **Async Fetching**: Fetch from multiple sources in parallel
4. **Caching**: Cache recent match lists
5. **Source Health**: Monitor source uptime and adjust behavior

### Backwards Compatibility
The registry system is fully backwards compatible:
- Existing code works without changes
- Can still pass explicit scraper lists
- Plugin system is opt-in

## Conclusion

The pluggable architecture makes the scraper truly extensible:
- **Simple interface**: Implement 2 methods
- **Auto-discovery**: Register and forget
- **Better data**: More sources = better conflict resolution
- **Maintainable**: New sources don't touch core code

This design scales from 1 source to 100+ sources without code changes.
