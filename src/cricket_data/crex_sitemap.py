"""CREX sitemap index for efficient match lookups.

Uses CREX's published sitemaps to build a cached index of matches and series,
avoiding the need to scrape pages repeatedly.
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import NamedTuple

from .polite import PoliteFetcher


@dataclass
class MatchEntry:
    """A match from the sitemap."""
    url: str
    match_id: str  # e.g. ind-vs-wi-1st-t20-...-11AL
    lastmod: str | None = None
    
    def parse_slug(self) -> tuple[list[str], str | None]:
        """Parse team abbreviations and format from match slug.
        
        Returns (team_codes, format) where format is ODI/T20/Test/etc.
        Example: ind-vs-wi-1st-t20 → (['ind', 'wi'], 'T20')
        """
        slug = self.match_id.lower()
        
        # Extract teams from "team1-vs-team2" pattern
        teams = []
        vs_match = re.search(r'([a-z]{2,})-vs-([a-z]{2,})', slug)
        if vs_match:
            teams = [vs_match.group(1), vs_match.group(2)]
        
        # Extract format
        match_format = None
        if 't20' in slug:
            match_format = 'T20' if 'international' not in slug else 'T20I'
        elif 'odi' in slug:
            match_format = 'ODI'
        elif 'test' in slug:
            match_format = 'Test'
        
        return teams, match_format


@dataclass
class SeriesEntry:
    """A series from the sitemap."""
    url: str
    slug: str  # e.g. afghanistan-tour-of-india-2024-1H0
    lastmod: str | None = None
    
    def matches_url(self) -> str:
        """Get the /matches page URL for this series."""
        return f"https://crex.com/series/{self.slug}/matches"
    
    def involves_afghanistan(self) -> bool:
        """Check if series involves Afghanistan."""
        slug_lower = self.slug.lower()
        return ('afghanistan' in slug_lower or 
                'afg' in slug_lower or 
                'apl' in slug_lower or
                'afghan' in slug_lower)
    
    def is_domestic_indian(self) -> bool:
        """Check if series is Indian domestic competition."""
        slug_lower = self.slug.lower()
        domestic_comps = [
            'syed-mushtaq-ali', 'ranji', 'vijay-hazare', 
            'deodhar', 'duleep', 'ipl'
        ]
        return any(comp in slug_lower for comp in domestic_comps)


class CREXSitemapIndex:
    """Cached index of CREX matches and series from sitemaps.
    
    Fetches sitemaps once per run and caches them for fast lookups.
    """
    
    def __init__(self, fetcher: PoliteFetcher | None = None):
        self.fetcher = fetcher or PoliteFetcher(min_interval=5.0)
        self.matches: list[MatchEntry] = []
        self.series: list[SeriesEntry] = []
        self._loaded = False
    
    def load(self, force_refresh: bool = False) -> None:
        """Load sitemaps from CREX.
        
        Args:
            force_refresh: If True, re-fetch even if already loaded
        """
        if self._loaded and not force_refresh:
            return
        
        print("Loading CREX sitemaps...")
        
        # Fetch match sitemap
        try:
            matches_xml = self.fetcher.get("https://crex.com/crex_sitemap/cricket-live-score.xml")
            self.matches = self._parse_match_sitemap(matches_xml)
            print(f"  Loaded {len(self.matches)} match URLs")
        except Exception as exc:
            print(f"  Warning: Failed to load match sitemap: {exc}")
        
        # Fetch series sitemap
        try:
            series_xml = self.fetcher.get("https://crex.com/crex_sitemap/series.xml")
            self.series = self._parse_series_sitemap(series_xml)
            print(f"  Loaded {len(self.series)} series")
        except Exception as exc:
            print(f"  Warning: Failed to load series sitemap: {exc}")
        
        self._loaded = True
    
    def _parse_match_sitemap(self, xml_content: str) -> list[MatchEntry]:
        """Parse match sitemap XML."""
        matches = []
        try:
            root = ET.fromstring(xml_content)
            # Handle XML namespace
            ns = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
            
            for url_elem in root.findall('ns:url', ns):
                loc = url_elem.find('ns:loc', ns)
                lastmod = url_elem.find('ns:lastmod', ns)
                
                if loc is not None and loc.text:
                    url = loc.text
                    # Extract match ID from URL
                    # Format: https://crex.com/cricket-live-score/ind-vs-wi-1st-t20-...-11AL
                    if '/cricket-live-score/' in url:
                        match_id = url.split('/cricket-live-score/')[-1]
                        matches.append(MatchEntry(
                            url=url,
                            match_id=match_id,
                            lastmod=lastmod.text if lastmod is not None else None
                        ))
        except Exception as exc:
            print(f"  Error parsing match sitemap: {exc}")
        
        return matches
    
    def _parse_series_sitemap(self, xml_content: str) -> list[SeriesEntry]:
        """Parse series sitemap XML."""
        series_list = []
        try:
            root = ET.fromstring(xml_content)
            ns = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
            
            for url_elem in root.findall('ns:url', ns):
                loc = url_elem.find('ns:loc', ns)
                lastmod = url_elem.find('ns:lastmod', ns)
                
                if loc is not None and loc.text:
                    url = loc.text
                    # Extract slug from URL
                    # Format: https://crex.com/series/afghanistan-tour-of-india-2024-1H0
                    if '/series/' in url:
                        slug = url.split('/series/')[-1].rstrip('/')
                        series_list.append(SeriesEntry(
                            url=url,
                            slug=slug,
                            lastmod=lastmod.text if lastmod is not None else None
                        ))
        except Exception as exc:
            print(f"  Error parsing series sitemap: {exc}")
        
        return series_list
    
    def find_match_by_teams(self, team_a: str, team_b: str, 
                          match_type: str | None = None) -> list[MatchEntry]:
        """Find matches involving both teams.
        
        Args:
            team_a: First team (any variation)
            team_b: Second team (any variation)
            match_type: Optional format filter (T20, ODI, Test)
        
        Returns:
            List of matching MatchEntry objects
        """
        if not self._loaded:
            self.load()
        
        from .backfill import normalize_team_name
        
        team_a_vars = normalize_team_name(team_a)
        team_b_vars = normalize_team_name(team_b)
        
        matches = []
        for match in self.matches:
            teams, fmt = match.parse_slug()
            
            # Check if both teams appear
            team_a_match = any(var in teams for var in team_a_vars)
            team_b_match = any(var in teams for var in team_b_vars)
            
            if team_a_match and team_b_match:
                # Optional format filter
                if match_type and fmt and fmt != match_type:
                    continue
                matches.append(match)
        
        return matches
    
    def find_series_by_teams_or_competition(self, team_a: str | None = None,
                                          team_b: str | None = None,
                                          competition: str | None = None) -> list[SeriesEntry]:
        """Find series involving teams or competition name.
        
        Args:
            team_a: Optional team name
            team_b: Optional team name
            competition: Optional competition name (e.g. "syed mushtaq ali")
        
        Returns:
            List of matching SeriesEntry objects
        """
        if not self._loaded:
            self.load()
        
        from .backfill import normalize_team_name
        
        team_a_vars = normalize_team_name(team_a) if team_a else set()
        team_b_vars = normalize_team_name(team_b) if team_b else set()
        comp_lower = competition.lower() if competition else ""
        
        series_list = []
        for series in self.series:
            slug_lower = series.slug.lower()
            
            # Check teams
            if team_a_vars or team_b_vars:
                team_a_match = not team_a_vars or any(var in slug_lower for var in team_a_vars)
                team_b_match = not team_b_vars or any(var in slug_lower for var in team_b_vars)
                
                if team_a_match and team_b_match:
                    series_list.append(series)
            
            # Check competition
            if comp_lower and comp_lower in slug_lower:
                if series not in series_list:
                    series_list.append(series)
        
        return series_list
    
    def get_afghanistan_series(self) -> list[SeriesEntry]:
        """Get all series involving Afghanistan."""
        if not self._loaded:
            self.load()
        
        return [s for s in self.series if s.involves_afghanistan()]
    
    def get_domestic_indian_series(self, year: int | None = None) -> list[SeriesEntry]:
        """Get Indian domestic series, optionally filtered by year."""
        if not self._loaded:
            self.load()
        
        domestic = [s for s in self.series if s.is_domestic_indian()]
        
        if year:
            # Filter by year in slug
            domestic = [s for s in domestic if str(year) in s.slug]
        
        return domestic
