"""Free cricket API scrapers (require signup for free API keys).

These scrapers use free API tiers from cricket data providers.
No credit card required, just sign up for a free account.
"""
from __future__ import annotations

import json
import os
from datetime import date, timedelta
from urllib.parse import urljoin

from .models import MatchRecord, PlayerPerf
from .polite import PoliteFetcher
from .scrapers import ScraperError


class CricketDataOrgScraper:
    """Scrape using CricketData.org (formerly CricAPI) free tier.
    
    Free tier: 100 requests/day, no credit card required.
    Signup: https://cricketdata.org/
    
    Set environment variable: CRICKETDATA_API_KEY
    """
    
    name = "cricketdata-org"
    base_url = "https://api.cricapi.com/v1"
    
    def __init__(self, api_key: str, fetcher: PoliteFetcher | None = None):
        self.api_key = api_key
        self.fetcher = fetcher or PoliteFetcher(min_interval=5.0)
    
    def fetch_recent_match_ids(self, days: int = 7) -> list[str]:
        """Get recently completed matches."""
        try:
            # Current matches endpoint (includes recent completed)
            url = f"{self.base_url}/currentMatches?apikey={self.api_key}&offset=0"
            data = self.fetcher.get(url)
            doc = json.loads(data)
            
            if doc.get("status") != "success":
                raise ScraperError(f"API error: {doc.get('status')}")
            
            match_ids = []
            cutoff = date.today() - timedelta(days=days)
            
            for match in doc.get("data", []):
                # Check if match is completed
                match_status = match.get("matchEnded", False)
                match_date_str = match.get("dateTimeGMT", "")
                
                if not match_status:
                    continue
                
                try:
                    # Parse date
                    if match_date_str:
                        match_date = date.fromisoformat(match_date_str[:10])
                        if match_date >= cutoff:
                            match_ids.append(match.get("id", ""))
                except (ValueError, KeyError):
                    continue
            
            return [mid for mid in match_ids if mid]
        
        except Exception as exc:
            raise ScraperError(f"CricketData.org API failed: {exc}")
    
    def fetch_match(self, match_id: str) -> MatchRecord | None:
        """Fetch match details."""
        try:
            url = f"{self.base_url}/match_info?apikey={self.api_key}&id={match_id}"
            data = self.fetcher.get(url)
            doc = json.loads(data)
            
            if doc.get("status") != "success":
                return None
            
            match_data = doc.get("data", {})
            
            # Extract teams
            teams = match_data.get("teams", [])
            team_a = teams[0] if len(teams) > 0 else ""
            team_b = teams[1] if len(teams) > 1 else ""
            
            # Extract result
            match_status = match_data.get("status", "")
            winner = ""
            result_margin = ""
            
            # Parse result from status text
            if " won " in match_status:
                winner = match_status.split(" won ")[0].strip()
                result_margin = match_status
            
            # Date
            match_date = match_data.get("dateTimeGMT", date.today().isoformat())[:10]
            
            return MatchRecord(
                match_id=f"cricketdata-{match_id}",
                date=match_date,
                match_type=match_data.get("matchType", ""),
                team_type="international",  # Assume international
                gender="male",  # Would need to determine
                event=match_data.get("series", ""),
                venue=match_data.get("venue", ""),
                team_a=team_a,
                team_b=team_b,
                winner=winner,
                result="win" if winner else "",
                result_margin=result_margin,
                source=self.name,
                players=[],  # Score endpoint would have player details
            )
        
        except Exception:
            return None


class RapidAPICricketScraper:
    """Scrape using RapidAPI Cricket API (if free tier available).
    
    Check https://rapidapi.com/hub for cricket APIs with free tiers.
    Most require signup but no credit card for basic tier.
    
    Set environment variable: RAPIDAPI_CRICKET_KEY
    """
    
    name = "rapidapi-cricket"
    base_url = "https://cricket-live-data.p.rapidapi.com"
    
    def __init__(self, api_key: str, fetcher: PoliteFetcher | None = None):
        self.api_key = api_key
        self.fetcher = fetcher or PoliteFetcher(min_interval=5.0)
    
    def fetch_recent_match_ids(self, days: int = 7) -> list[str]:
        """Get recently completed matches."""
        try:
            # This is a placeholder - actual endpoint depends on which RapidAPI you use
            # Example: cricket-live-data API
            url = f"{self.base_url}/fixtures"
            
            # RapidAPI requires special headers
            import urllib.request
            req = urllib.request.Request(url)
            req.add_header("X-RapidAPI-Key", self.api_key)
            req.add_header("X-RapidAPI-Host", "cricket-live-data.p.rapidapi.com")
            
            with urllib.request.urlopen(req, timeout=30) as response:
                data = response.read().decode('utf-8')
            
            doc = json.loads(data)
            
            # Extract match IDs (structure varies by API)
            match_ids = []
            for match in doc.get("results", []):
                if match.get("status") == "completed":
                    match_ids.append(str(match.get("id", "")))
            
            return [mid for mid in match_ids if mid]
        
        except Exception as exc:
            raise ScraperError(f"RapidAPI Cricket failed: {exc}")
    
    def fetch_match(self, match_id: str) -> MatchRecord | None:
        """Fetch match details."""
        # Placeholder - implement based on actual RapidAPI endpoint
        return None
