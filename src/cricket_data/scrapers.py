"""Pluggable cricket data scrapers with multi-source conflict resolution.

This module provides a pluggable architecture for scraping cricket match data
from any public website. Scrapers implement the CricketScraper protocol and
register themselves with the ScraperRegistry for automatic discovery.

Built-in sources:
- ESPNcricinfo: Public JSON API
- Cricbuzz: Mobile API (placeholder)
- CREX: Live scores JSON API

To add a new source:
1. Implement the CricketScraper protocol (name, fetch_recent_match_ids, fetch_match)
2. Register it: ScraperRegistry.register(YourScraper)
3. It will automatically participate in multi-source conflict resolution

All scrapers respect robots.txt and rate limits via PoliteFetcher.
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Protocol
from urllib.parse import urljoin

from .crex_browser import BrowserError, CREXBrowser
from .crex_lookup import fetch_record, parse_match_page
from .crex_sitemap import MatchEntry
from .models import MatchRecord, PlayerPerf
from .permanent_matches import classify_match_status, fetch_cricsheet_missing_matches
from .polite import PoliteFetcher, RobotsDisallowed


class ScraperError(Exception):
    """A scraper failed to fetch or parse a match."""


def _norm(s: str) -> str:
    """Normalize team/player names for comparison."""
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _match_key(rec: MatchRecord) -> tuple[str, str, str]:
    """Stable key for comparing matches across sources: (date, team_a, team_b)."""
    teams = tuple(sorted([_norm(rec.team_a), _norm(rec.team_b)]))
    return (rec.date, teams[0], teams[1])


# Pluggable scraper architecture

class CricketScraper(Protocol):
    """Protocol (interface) that all cricket scrapers must implement.
    
    A scraper is any object with these three attributes/methods:
    - name: str - Unique identifier for this scraper
    - fetch_recent_match_ids(days: int) -> list[str] - Get IDs of recent matches
    - fetch_match(match_id: str) -> MatchRecord | None - Fetch a single match
    
    The scraper should handle its own rate limiting and robots.txt compliance,
    typically by using a PoliteFetcher instance.
    """
    
    name: str
    
    def fetch_recent_match_ids(self, days: int = 7) -> list[str]:
        """Return match IDs for matches completed in the last N days.
        
        Raises:
            ScraperError: If fetching the match list fails
            RobotsDisallowed: If robots.txt forbids access
        """
        ...
    
    def fetch_match(self, match_id: str) -> MatchRecord | None:
        """Fetch and parse a single match by ID.
        
        Returns None if the match cannot be fetched or parsed.
        
        Raises:
            ScraperError: If fetching fails
            RobotsDisallowed: If robots.txt forbids access
        """
        ...


class ScraperRegistry:
    """Registry for pluggable cricket scrapers.
    
    All registered scrapers are automatically used by MultiSourceScraper for
    conflict resolution. Scrapers can be added at module load time or runtime.
    
    Usage:
        # Register a scraper
        ScraperRegistry.register(MyCustomScraper)
        
        # Get all registered scrapers
        scrapers = ScraperRegistry.get_all()
        
        # Clear registry (useful for testing)
        ScraperRegistry.clear()
    """
    
    _scrapers: list[type] = []
    _instances: dict[str, Any] = {}
    
    @classmethod
    def register(cls, scraper_class: type) -> None:
        """Register a scraper class.
        
        The scraper will be instantiated lazily when first accessed.
        Duplicate registrations are ignored.
        """
        if scraper_class not in cls._scrapers:
            cls._scrapers.append(scraper_class)
    
    @classmethod
    def get_all(cls, fetcher: PoliteFetcher | None = None) -> list[Any]:
        """Get instances of all registered scrapers.
        
        Args:
            fetcher: Optional shared PoliteFetcher instance. If not provided,
                    each scraper will create its own.
        
        Returns:
            List of scraper instances ready to use.
        """
        instances = []
        for scraper_class in cls._scrapers:
            name = getattr(scraper_class, "name", scraper_class.__name__)
            
            # Cache instances to reuse them
            if name not in cls._instances:
                try:
                    # Try to instantiate with fetcher
                    cls._instances[name] = scraper_class(fetcher=fetcher)
                except TypeError:
                    # Fallback: no fetcher argument
                    cls._instances[name] = scraper_class()
            
            instances.append(cls._instances[name])
        
        return instances
    
    @classmethod
    def clear(cls) -> None:
        """Clear the registry (useful for testing)."""
        cls._scrapers.clear()
        cls._instances.clear()
    
    @classmethod
    def get_by_name(cls, name: str, fetcher: PoliteFetcher | None = None) -> Any | None:
        """Get a specific scraper by name."""
        for instance in cls.get_all(fetcher):
            if instance.name == name:
                return instance
        return None


class ESPNcricinfoScraper:
    """Scrape ESPNcricinfo match data from their public JSON feed.
    
    ESPNcricinfo exposes a public JSON API for completed matches.
    Endpoints:
    - /ci/engine/match/index.json?view=live - Recent match list
    - /ci/engine/match/<match_id>.json - Match details
    """
    
    name = "espncricinfo"
    base_url = "https://www.espncricinfo.com"
    
    def __init__(self, fetcher: PoliteFetcher | None = None):
        self.fetcher = fetcher or PoliteFetcher(min_interval=5.0)
    
    def fetch_recent_match_ids(self, days: int = 7) -> list[str]:
        """Get match IDs for recently completed matches."""
        try:
            url = urljoin(self.base_url, "/ci/engine/match/index.json?view=live")
            data = self.fetcher.get(url)
            doc = json.loads(data)
            
            match_ids = []
            cutoff = date.today() - timedelta(days=days)
            
            # Extract match IDs from the response
            for match in doc.get("matches", []):
                match_date_str = match.get("start_date_raw", "")
                try:
                    match_date = datetime.strptime(match_date_str[:10], "%Y-%m-%d").date()
                    if match_date >= cutoff and match.get("match_status") == "Complete":
                        match_ids.append(str(match["object_id"]))
                except (ValueError, KeyError):
                    continue
            
            return match_ids
        except (RobotsDisallowed, Exception) as exc:
            raise ScraperError(f"Failed to fetch recent match list: {exc}") from exc
    
    def fetch_match(self, match_id: str) -> MatchRecord | None:
        """Fetch a single match by ID."""
        try:
            url = urljoin(self.base_url, f"/ci/engine/match/{match_id}.json")
            data = self.fetcher.get(url)
            doc = json.loads(data)
            return self._parse_match(match_id, doc)
        except RobotsDisallowed:
            raise
        except Exception as exc:
            raise ScraperError(f"Failed to fetch match {match_id}: {exc}") from exc
    
    def _parse_match(self, match_id: str, doc: dict[str, Any]) -> MatchRecord:
        """Parse ESPNcricinfo JSON into MatchRecord."""
        match = doc.get("match", {})
        info = match.get("info", {})
        teams_info = match.get("teams", [])
        
        teams = [t.get("team", {}).get("name", "") for t in teams_info]
        team_a = teams[0] if len(teams) > 0 else ""
        team_b = teams[1] if len(teams) > 1 else ""
        
        # Parse date
        start_date = info.get("start_date_raw", "")
        match_date = start_date[:10] if start_date else date.today().isoformat()
        
        # Parse result
        result_info = match.get("result", {})
        winner = result_info.get("winner", "")
        result = result_info.get("result_type", "")
        result_margin = result_info.get("result_text", "")
        
        # Parse match details
        match_type = info.get("match_type_class", "")
        team_type = info.get("team_type_name", "")
        gender = info.get("gender", "male")
        event = info.get("series", {}).get("name", "")
        venue = info.get("venue", {}).get("name", "")
        
        # Parse toss
        toss = match.get("toss", {})
        toss_winner = toss.get("winner", "")
        toss_decision = toss.get("decision", "")
        
        # Build player performances
        players = self._parse_players(match, match_id, match_date, team_a, team_b)
        
        return MatchRecord(
            match_id=f"espn-{match_id}",
            date=match_date,
            match_type=match_type,
            team_type=team_type,
            gender=gender,
            event=event,
            venue=venue,
            team_a=team_a,
            team_b=team_b,
            toss_winner=toss_winner,
            toss_decision=toss_decision,
            winner=winner,
            result=result,
            result_margin=result_margin,
            source=self.name,
            players=players,
        )
    
    def _parse_players(self, match: dict, match_id: str, match_date: str,
                      team_a: str, team_b: str) -> list[PlayerPerf]:
        """Extract player statistics from match data."""
        players = []
        
        # Parse innings to get batting stats
        for innings in match.get("innings", []):
            batting_team = innings.get("batting_team", "")
            bowling_team = innings.get("bowling_team", "")
            
            # Batting stats
            for bat in innings.get("batsmen", []):
                player_name = bat.get("batsman", {}).get("known_as", "")
                if not player_name:
                    continue
                    
                player = PlayerPerf(
                    match_id=f"espn-{match_id}",
                    date=match_date,
                    player=player_name,
                    team=batting_team,
                    opponent=bowling_team,
                    player_id=str(bat.get("batsman", {}).get("object_id", "")),
                    runs=bat.get("runs", 0),
                    balls=bat.get("balls_faced", 0),
                    fours=bat.get("fours", 0),
                    sixes=bat.get("sixes", 0),
                )
                players.append(player)
            
            # Bowling stats
            for bowl in innings.get("bowlers", []):
                player_name = bowl.get("bowler", {}).get("known_as", "")
                if not player_name:
                    continue
                
                # Find if this player already exists
                existing = next((p for p in players if p.player == player_name), None)
                if existing:
                    existing.wickets = bowl.get("wickets", 0)
                    existing.balls_bowled = bowl.get("overs", 0) * 6  # Convert overs to balls
                    existing.runs_conceded = bowl.get("runs", 0)
                else:
                    player = PlayerPerf(
                        match_id=f"espn-{match_id}",
                        date=match_date,
                        player=player_name,
                        team=bowling_team,
                        opponent=batting_team,
                        player_id=str(bowl.get("bowler", {}).get("object_id", "")),
                        wickets=bowl.get("wickets", 0),
                        balls_bowled=bowl.get("overs", 0) * 6,
                        runs_conceded=bowl.get("runs", 0),
                    )
                    players.append(player)
        
        # Parse fielding stats (catches, stumpings)
        for wicket in match.get("wickets", []):
            fielders = wicket.get("fielders", [])
            dismissal = wicket.get("dismissal", "")
            
            for fielder in fielders:
                fielder_name = fielder.get("known_as", "")
                if not fielder_name:
                    continue
                
                existing = next((p for p in players if p.player == fielder_name), None)
                if dismissal in ["caught", "caught and bowled"]:
                    if existing:
                        existing.catches += 1
                    else:
                        # Create minimal player entry for fielder
                        team = fielder.get("team", "")
                        opp = team_a if team == team_b else team_b
                        players.append(PlayerPerf(
                            match_id=f"espn-{match_id}",
                            date=match_date,
                            player=fielder_name,
                            team=team,
                            opponent=opp,
                            catches=1,
                        ))
                elif dismissal == "stumped":
                    if existing:
                        existing.stumpings += 1
        
        return players


class CricbuzzScraper:
    """Scrape Cricbuzz match data.
    
    Cricbuzz has a mobile API that may be accessible. This implementation
    provides the interface structure for future development.
    
    To implement:
    1. Identify Cricbuzz's API endpoints (check developer tools in browser)
    2. Verify their terms of service allow automated access
    3. Parse their JSON/HTML response format
    """
    
    name = "cricbuzz"
    base_url = "https://www.cricbuzz.com"
    
    def __init__(self, fetcher: PoliteFetcher | None = None):
        self.fetcher = fetcher or PoliteFetcher(min_interval=5.0)
    
    def fetch_recent_match_ids(self, days: int = 7) -> list[str]:
        """Get match IDs for recently completed matches.
        
        Placeholder - needs implementation once Cricbuzz API structure is known.
        """
        # TODO: Implement once API structure is documented/discovered
        return []
    
    def fetch_match(self, match_id: str) -> MatchRecord | None:
        """Fetch a single match by ID.
        
        Placeholder - needs implementation.
        """
        # TODO: Implement Cricbuzz match fetching
        return None


class CREXScraper:
    """Scrape CREX (crex.com) with the shared headless-Chromium session.

    CREX pages render with JavaScript, so ``CREXBrowser`` (Playwright, sync API) loads them. The
    browser is shared with the backfill (``use_browser``) so Playwright is started once per
    process. Match facts come from the page's own schema.org ``SportsEvent`` block (start date,
    both team names, venue) and its headline (result), never from guessing at CSS classes.
    """

    name = "crex"
    base_url = "https://crex.com"

    def __init__(self, fetcher: PoliteFetcher | None = None, browser: CREXBrowser | None = None):
        self.fetcher = fetcher or PoliteFetcher(min_interval=5.0)
        self.browser = browser
        self._owns_browser = False
        self.skip_ids: set[str] = set()  # slugs already saved: finished results never change

    def use_browser(self, browser: CREXBrowser) -> None:
        self.close()
        self.browser, self._owns_browser = browser, False

    def _get_browser(self) -> CREXBrowser:
        if self.browser is None:
            self.browser, self._owns_browser = CREXBrowser(fetcher=self.fetcher), True
        return self.browser

    def close(self) -> None:
        """Stop the browser if this scraper started it (a shared one is closed by its owner)."""
        if self.browser is not None and self._owns_browser:
            self.browser.close()
        if self._owns_browser:
            self.browser = None

    def fetch_recent_match_ids(self, days: int = 7) -> list[str]:
        """Completed matches listed on the CREX home page (slugs under /cricket-live-score/)."""
        try:
            _, links = self._get_browser().links(self.base_url, "/cricket-live-score/")
        except (BrowserError, RobotsDisallowed) as exc:
            raise ScraperError(f"CREX home page unavailable: {exc}") from exc
        ids: list[str] = []
        for link in links:
            href = link["href"]
            if not href.startswith("/cricket-live-score/"):
                continue
            if re.search(r"\b(won|tied|no result|abandoned|drawn)\b", link["text"], re.I):
                slug = href.rstrip("/").split("/")[-1]
                if slug not in ids and slug not in self.skip_ids:
                    ids.append(slug)
        return ids

    def fetch_match(self, match_id: str) -> MatchRecord | None:
        """Render one match page and build its record; None if the page is not a finished match."""
        url = f"{self.base_url}/cricket-live-score/{match_id}"
        try:
            page = self._get_browser().render(url, wait_selector="script#sports-event-schema")
        except (BrowserError, RobotsDisallowed) as exc:
            print(f"CREX fetch_match failed for {match_id}: {exc}")
            return None
        facts = parse_match_page(page.html, page.text, page.title, url) if page.status < 400 else None
        if facts is None or facts.start_date is None or not facts.finished:
            return None
        entry = MatchEntry(url=url, match_id=match_id, lastmod=facts.start.isoformat())
        return fetch_record(self._get_browser(), entry, facts, facts.start_date.isoformat(), status="provisional")


class MultiSourceScraper:
    """Aggregate multiple scrapers with conflict resolution.
    
    Automatically uses all scrapers registered with ScraperRegistry. When sources
    disagree on match details (winner, scores, etc.), uses majority voting to
    resolve conflicts. All decisions are logged.
    
    More sources = better conflict resolution. When 3+ sources are available,
    majority voting becomes more robust.
    """
    
    def __init__(self, scrapers: list | None = None, fetcher: PoliteFetcher | None = None):
        """Initialize with scrapers.
        
        Args:
            scrapers: Optional list of scraper instances. If None, uses all
                     registered scrapers from ScraperRegistry.
            fetcher: Optional shared PoliteFetcher for rate limiting across sources.
        """
        if scrapers is not None:
            self.scrapers = scrapers
        else:
            # Auto-discover all registered scrapers
            self.scrapers = ScraperRegistry.get_all(fetcher=fetcher)
        
        self.conflict_log: list[dict[str, Any]] = []
        self.failures: list[tuple[str, str, str]] = []  # Track failures per source
    
    def fetch(self, since: date) -> list[MatchRecord]:
        """Fetch matches from all sources and resolve conflicts.
        
        Sources fail independently - if one source breaks, others continue.
        Failures are tracked in self.failures for reporting.
        
        Empty results (no matches found) are tracked separately from failures.
        """
        all_matches: dict[tuple, list[MatchRecord]] = defaultdict(list)
        self.failures: list[tuple[str, str, str]] = []  # (source, error_type, message)
        self.sources_checked: dict[str, int] = {}  # source -> match count
        
        # Collect matches from all sources
        for scraper in self.scrapers:
            source_name = getattr(scraper, 'name', scraper.__class__.__name__)
            
            try:
                # Get recent match IDs
                match_ids = scraper.fetch_recent_match_ids(days=(date.today() - since).days)
                self.sources_checked[source_name] = len(match_ids)
                
                if len(match_ids) == 0:
                    # No matches found - track but don't fail
                    # This is normal if there are no recent matches
                    continue
                
                matches_fetched = 0
                for match_id in match_ids:
                    try:
                        match = scraper.fetch_match(match_id)
                        if match:
                            key = _match_key(match)
                            all_matches[key].append(match)
                            matches_fetched += 1
                    except (ScraperError, RobotsDisallowed) as exc:
                        # Individual match failures shouldn't stop the source
                        self.failures.append((source_name, type(exc).__name__, str(exc)))
                        continue
                    except Exception as exc:
                        # Unexpected errors - log but continue
                        self.failures.append((source_name, "UnexpectedError", str(exc)))
                        continue
                
                # If source claimed matches but fetched none, that's suspicious
                if len(match_ids) > 0 and matches_fetched == 0:
                    self.failures.append((
                        source_name,
                        "NoMatchesFetched",
                        f"Found {len(match_ids)} match IDs but couldn't fetch any matches"
                    ))
            
            except (ScraperError, RobotsDisallowed) as exc:
                # If a source is completely unavailable, log and continue with others
                self.failures.append((source_name, type(exc).__name__, str(exc)))
                self.sources_checked[source_name] = 0
                continue
            except Exception as exc:
                # Unexpected errors at source level
                self.failures.append((source_name, "UnexpectedError", str(exc)))
                self.sources_checked[source_name] = 0
                continue
        
        # Resolve conflicts and return deduplicated matches
        resolved = []
        for _key, matches in all_matches.items():
            if len(matches) == 1:
                resolved.append(matches[0])
            else:
                resolved_match = self._resolve_conflict(matches)
                resolved.append(resolved_match)
        
        return resolved
    
    def _resolve_conflict(self, matches: list[MatchRecord]) -> MatchRecord:
        """Resolve conflicts between multiple versions of the same match.
        
        Strategy:
        1. Winner: majority vote
        2. Scores: median or most common value
        3. Players: merge all unique players, taking majority values
        4. Log the conflict and resolution
        """
        if len(matches) == 1:
            return matches[0]
        
        # Use the first match as base
        base = matches[0]
        sources = [m.source for m in matches]
        
        # Resolve winner by majority vote
        winners = [_norm(m.winner) for m in matches if m.winner]
        winner_counts = Counter(winners)
        resolved_winner = winner_counts.most_common(1)[0][0] if winner_counts else ""
        
        # Check for disagreements
        disagreements = []
        if len(set(winners)) > 1:
            disagreements.append({
                "field": "winner",
                "values": dict(winner_counts),
                "resolved": resolved_winner,
            })
        
        # Resolve result margin
        margins = [m.result_margin for m in matches if m.result_margin]
        margin_counts = Counter(margins)
        resolved_margin = margin_counts.most_common(1)[0][0] if margin_counts else ""
        
        # Merge player data
        player_map: dict[str, list[PlayerPerf]] = defaultdict(list)
        for match in matches:
            for player in match.players:
                player_map[_norm(player.player)].append(player)
        
        resolved_players = []
        for _player_key, player_versions in player_map.items():
            # Take most common name form
            names = [p.player for p in player_versions]
            resolved_name = Counter(names).most_common(1)[0][0]
            
            # Average numeric stats across sources
            runs = [p.runs for p in player_versions]
            wickets = [p.wickets for p in player_versions]
            catches = [p.catches for p in player_versions]
            
            # Check for stat disagreements
            if len(set(runs)) > 1 or len(set(wickets)) > 1:
                disagreements.append({
                    "field": f"player_{resolved_name}",
                    "values": {
                        "runs": dict(Counter(runs)),
                        "wickets": dict(Counter(wickets)),
                    },
                    "resolved": {
                        "runs": Counter(runs).most_common(1)[0][0],
                        "wickets": Counter(wickets).most_common(1)[0][0],
                    },
                })
            
            resolved_players.append(PlayerPerf(
                match_id=base.match_id,
                date=base.date,
                player=resolved_name,
                team=player_versions[0].team,
                opponent=player_versions[0].opponent,
                player_id=player_versions[0].player_id,
                runs=Counter(runs).most_common(1)[0][0],
                balls=Counter([p.balls for p in player_versions]).most_common(1)[0][0],
                fours=Counter([p.fours for p in player_versions]).most_common(1)[0][0],
                sixes=Counter([p.sixes for p in player_versions]).most_common(1)[0][0],
                wickets=Counter(wickets).most_common(1)[0][0],
                balls_bowled=Counter([p.balls_bowled for p in player_versions]).most_common(1)[0][0],
                runs_conceded=Counter([p.runs_conceded for p in player_versions]).most_common(1)[0][0],
                catches=Counter(catches).most_common(1)[0][0],
                stumpings=Counter([p.stumpings for p in player_versions]).most_common(1)[0][0],
                run_outs=Counter([p.run_outs for p in player_versions]).most_common(1)[0][0],
            ))
        
        # Log conflicts
        if disagreements:
            self.conflict_log.append({
                "date": base.date,
                "teams": f"{base.team_a} vs {base.team_b}",
                "sources": sources,
                "disagreements": disagreements,
            })
        
        # Build resolved match (prefer first match's winner from sources)
        # Find the match with the resolved winner
        resolved_match = next((m for m in matches if _norm(m.winner) == resolved_winner), base)
        resolved_match.players = resolved_players
        resolved_match.result_margin = resolved_margin
        resolved_match.source = f"multi({','.join(sources)})"
        
        return resolved_match
    
    def get_conflict_log(self) -> list[dict[str, Any]]:
        """Get log of all conflicts and resolutions."""
        return self.conflict_log.copy()


class ScraperSource:
    """Source implementation that uses MultiSourceScraper for the pluggable system.
    
    Classifies matches based on their permanence:
    - provisional: Normal lag (delete after Cricsheet arrives)
    - cricsheet_missing: On Cricsheet's missing list (keep permanently)
    - cricsheet_withheld: Afghanistan men's team or APL (keep permanently)
    """
    
    name = "scraper"
    
    def __init__(self, browser: CREXBrowser | None = None, known_ids: set[str] | None = None):
        self.scraper = MultiSourceScraper()
        self._missing_matches_cache = None
        if browser is not None:  # share one Playwright session with the backfill
            for sc in self.scraper.scrapers:
                if hasattr(sc, "use_browser"):
                    sc.use_browser(browser)
        for sc in self.scraper.scrapers:
            if known_ids and hasattr(sc, "skip_ids"):
                sc.skip_ids = set(known_ids)

    def close(self) -> None:
        for sc in self.scraper.scrapers:
            if hasattr(sc, "close"):
                sc.close()
    
    def fetch(self, since: date) -> list[MatchRecord]:
        """Fetch matches from all configured scrapers and classify them."""
        matches = self.scraper.fetch(since)
        
        # Fetch missing matches list once for all matches
        if self._missing_matches_cache is None:
            self._missing_matches_cache = fetch_cricsheet_missing_matches()
        
        # Classify and mark each match
        for match in matches:
            # Classify based on Cricsheet missing list or Afghanistan status
            status = classify_match_status(match, self._missing_matches_cache)
            match.status = status.value
            
            # Ensure match ID format
            if not match.match_id.startswith(("espn-", "cb-", "crex-", "prov-")):
                match.match_id = f"scraped-{match.date}-{_norm(match.team_a)}-{_norm(match.team_b)}"
        
        return matches


# Register all built-in scrapers
# These are automatically available to MultiSourceScraper
ScraperRegistry.register(ESPNcricinfoScraper)
ScraperRegistry.register(CREXScraper)
ScraperRegistry.register(CricbuzzScraper)  # Placeholder, returns empty results


# Free API scrapers - only register if API key available
def register_free_api_scrapers():
    """Register free API scrapers if keys are available."""
    import os
    
    # CricketData.org (CricAPI) - Free tier: 100 requests/day
    if os.getenv("CRICKETDATA_API_KEY"):
        try:
            from .free_apis import CricketDataOrgScraper
            ScraperRegistry.register(lambda: CricketDataOrgScraper(os.getenv("CRICKETDATA_API_KEY")))
        except ImportError:
            pass
    
    # RapidAPI Cricket (if free tier exists)
    if os.getenv("RAPIDAPI_CRICKET_KEY"):
        try:
            from .free_apis import RapidAPICricketScraper
            ScraperRegistry.register(lambda: RapidAPICricketScraper(os.getenv("RAPIDAPI_CRICKET_KEY")))
        except ImportError:
            pass


# Auto-register API scrapers if keys present
register_free_api_scrapers()
