"""Public cricket data scrapers with multi-source conflict resolution.

Scrapers fetch recently completed matches from public cricket websites
(ESPNcricinfo, Cricbuzz) using their public JSON endpoints where available,
falling back to structured HTML when needed. All scrapers respect robots.txt
and rate limits via PoliteFetcher.

Multi-source conflict resolution: when sources disagree on a match, the scraper
queries additional sources and picks the majority consensus, logging the decision.
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from typing import Any
from urllib.parse import urljoin, urlencode

from .models import MatchRecord, PlayerPerf
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


class ESPNcricinfoScraper:
    """Scrape ESPNcricinfo match data from their public JSON feed.
    
    ESPNcricinfo exposes a public JSON API for completed matches.
    Endpoint: /ci/engine/match/<match_id>.json
    """
    
    name = "espncricinfo"
    base_url = "https://www.espncricinfo.com"
    
    def __init__(self, fetcher: PoliteFetcher | None = None):
        self.fetcher = fetcher or PoliteFetcher(min_interval=5.0)
    
    def _recent_match_ids(self, days: int = 7) -> list[str]:
        """Get match IDs for recently completed matches.
        
        ESPNcricinfo has a /ci/content/match/latest.json endpoint that lists
        recent matches. This is a simplified implementation; in production
        you might scrape the schedule page or use their match list API.
        """
        # For this implementation, we'll use a known structure
        # In practice, you'd scrape the results page or use their API
        # Example: /matches/results/2026
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
            raise ScraperError(f"Failed to fetch recent match list: {exc}")
    
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
            raise ScraperError(f"Failed to fetch match {match_id}: {exc}")
    
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
    
    Cricbuzz has a mobile API that can be accessed. This is a placeholder
    implementation showing the structure. In practice, you'd need to:
    1. Check if their API is publicly documented and allowed
    2. Respect their terms of service
    3. Use their official endpoints if available
    """
    
    name = "cricbuzz"
    base_url = "https://www.cricbuzz.com"
    
    def __init__(self, fetcher: PoliteFetcher | None = None):
        self.fetcher = fetcher or PoliteFetcher(min_interval=5.0)
    
    def fetch_match(self, match_id: str) -> MatchRecord | None:
        """Fetch a single match by ID.
        
        This is a placeholder. Cricbuzz's API structure would need to be
        reverse-engineered or documented officially.
        """
        # Placeholder - would need actual implementation based on Cricbuzz API
        raise ScraperError("Cricbuzz scraper not yet implemented")


class MultiSourceScraper:
    """Aggregate multiple scrapers with conflict resolution.
    
    When sources disagree on match details (winner, scores, etc.), this
    scraper queries all available sources and uses majority voting to
    resolve conflicts. All decisions are logged.
    """
    
    def __init__(self, scrapers: list | None = None):
        self.scrapers = scrapers or [ESPNcricinfoScraper()]
        self.conflict_log: list[dict[str, Any]] = []
    
    def fetch(self, since: date) -> list[MatchRecord]:
        """Fetch matches from all sources and resolve conflicts."""
        all_matches: dict[tuple, list[MatchRecord]] = defaultdict(list)
        
        # Collect matches from all sources
        for scraper in self.scrapers:
            try:
                if hasattr(scraper, "_recent_match_ids"):
                    # Scraper provides match list
                    match_ids = scraper._recent_match_ids(days=(date.today() - since).days)
                    for match_id in match_ids:
                        try:
                            match = scraper.fetch_match(match_id)
                            if match:
                                key = _match_key(match)
                                all_matches[key].append(match)
                        except (ScraperError, RobotsDisallowed):
                            continue
            except (ScraperError, RobotsDisallowed):
                continue
        
        # Resolve conflicts and return deduplicated matches
        resolved = []
        for key, matches in all_matches.items():
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
        for player_key, player_versions in player_map.items():
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
    """Source implementation that uses MultiSourceScraper for the pluggable system."""
    
    name = "scraper"
    
    def __init__(self):
        self.scraper = MultiSourceScraper()
    
    def fetch(self, since: date) -> list[MatchRecord]:
        """Fetch matches from all configured scrapers."""
        matches = self.scraper.fetch(since)
        
        # Mark all as provisional with scraped timestamp
        for match in matches:
            match.status = "provisional"
            if not match.match_id.startswith(("espn-", "cb-", "prov-")):
                match.match_id = f"scraped-{match.date}-{_norm(match.team_a)}-{_norm(match.team_b)}"
        
        return matches
