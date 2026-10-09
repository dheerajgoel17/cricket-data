"""Detect and classify matches that should be kept permanently.

Two categories of permanent matches:
1. Cricsheet missing-matches list: Matches Cricsheet cannot obtain
2. Withheld Afghanistan matches: Afghanistan men's team and APL (since Nov 2024)

These matches are scraped from CREX and kept as permanent source of truth,
not deleted after reconciliation. If Cricsheet later provides data, we reconcile
and prefer Cricsheet.
"""
from __future__ import annotations

import re
from html.parser import HTMLParser
from typing import NamedTuple

from .models import MatchRecord, MatchStatus
from .polite import PoliteFetcher


class MissingMatch(NamedTuple):
    """A match from Cricsheet's missing-matches list."""
    date: str  # ISO format YYYY-MM-DD
    team_a: str
    team_b: str
    match_type: str  # Test, ODI, T20I (int'l) or T20, List A, FC (domestic)
    gender: str  # male, female


class MissingMatchesParser(HTMLParser):
    """Parse Cricsheet's missing-matches HTML page into structured data.
    
    Handles two main sections:
    1. "By match type" - Internationals (Test, ODI, T20I)  
    2. "By competition" - Domestic leagues (BBL, Syed Mushtaq Ali, etc.)
    """
    
    def __init__(self):
        super().__init__()
        self.matches: list[MissingMatch] = []
        self._current_match_type = ""
        self._current_competition = ""
        self._current_gender = ""
        self._current_date = ""
        self._in_dt = False
        self._in_dd = False
        self._in_h4 = False
        self._in_h5 = False
        self._in_h6 = False
        self._data = ""
        self._in_by_match_type_section = False
        self._in_by_competition_section = False
    
    def handle_starttag(self, tag: str, attrs):
        if tag == "dt":
            self._in_dt = True
            self._data = ""
        elif tag == "dd":
            self._in_dd = True
            self._data = ""
        elif tag == "h4":
            self._in_h4 = True
            self._data = ""
        elif tag == "h5":
            self._in_h5 = True
            self._data = ""
        elif tag == "h6":
            self._in_h6 = True
            self._data = ""
    
    def handle_endtag(self, tag: str):
        if tag == "dt":
            self._in_dt = False
            self._current_date = self._data.strip()
        elif tag == "dd":
            self._in_dd = False
            text = self._data.strip()
            if " vs " in text:
                teams = text.split(" vs ")
                if len(teams) == 2 and self._current_date and self._current_gender:
                    # Determine match type based on section or current match type
                    if self._current_match_type:
                        # We have a match type from h5 tag
                        match_type = self._current_match_type
                    elif self._in_by_competition_section and self._current_competition:
                        # Domestic league - infer type from competition name
                        comp_lower = self._current_competition.lower()
                        # Known T20 competitions
                        if any(t20_comp in comp_lower for t20_comp in [
                            "t20", "twenty", "big bash", "bbl", "blast", "cpl", 
                            "super smash", "psl", "ipl", "mushtaq ali", "sma"
                        ]):
                            match_type = "T20"
                        # Known first-class competitions
                        elif any(fc_comp in comp_lower for fc_comp in [
                            "championship", "shield", "plunket", "ranji", "duleep"
                        ]):
                            match_type = "FC"
                        else:
                            # Default to List A for other domestic competitions
                            match_type = "List A"
                    else:
                        match_type = ""
                    
                    if match_type:
                        self.matches.append(MissingMatch(
                            date=self._current_date,
                            team_a=teams[0].strip(),
                            team_b=teams[1].strip(),
                            match_type=match_type,
                            gender=self._current_gender
                        ))
        elif tag == "h4":
            self._in_h4 = False
            text = self._data.strip().lower()
            # Track which main section we're in
            if "by match type" in text:
                self._in_by_match_type_section = True
                self._in_by_competition_section = False
                self._current_competition = ""
            elif "by competition" in text:
                self._in_by_match_type_section = False
                self._in_by_competition_section = True
                self._current_match_type = ""
        elif tag == "h5":
            self._in_h5 = False
            text = self._data.strip().lower()
            
            # Try to extract match type from h5, regardless of section
            if "test" in text and "match" in text:
                self._current_match_type = "Test"
            elif "odi" in text or ("one" in text and "day" in text):
                self._current_match_type = "ODI"
            elif "t20i" in text or ("t20" in text and "international" in text):
                self._current_match_type = "T20I"
            else:
                # If not a match type, might be a competition name
                if self._in_by_competition_section:
                    self._current_competition = self._data.strip()
                    self._current_match_type = ""
                else:
                    self._current_match_type = ""
        elif tag == "h6":
            self._in_h6 = False
            text = self._data.strip().lower()
            if "female" in text or "women" in text:
                self._current_gender = "female"
            elif "male" in text or "men" in text:
                self._current_gender = "male"
    
    def handle_data(self, data: str):
        if self._in_dt or self._in_dd or self._in_h4 or self._in_h5 or self._in_h6:
            self._data += data


def fetch_cricsheet_missing_matches(fetcher: PoliteFetcher | None = None) -> list[MissingMatch]:
    """Fetch and parse Cricsheet's missing-matches list.
    
    Returns:
        List of missing matches with date, teams, match type, and gender
    """
    if fetcher is None:
        fetcher = PoliteFetcher(min_interval=5.0)
    
    url = "https://cricsheet.org/missing/"
    
    # Check robots.txt
    if not fetcher.allowed(url):
        return []
    
    try:
        html = fetcher.get(url)
        parser = MissingMatchesParser()
        parser.feed(html)
        return parser.matches
    except Exception as exc:
        print(f"Failed to fetch Cricsheet missing matches: {exc}")
        return []


def is_afghanistan_match(match: MatchRecord) -> bool:
    """Check if match involves Afghanistan men's team or APL.
    
    Cricsheet withheld all Afghanistan men's matches and Afghanistan Premier League
    matches since November 2024 (329 matches removed). These should be scraped
    and kept permanently.
    
    Returns:
        True if match should be classified as cricsheet_withheld
    """
    # Normalize team names for comparison
    team_a = match.team_a.lower()
    team_b = match.team_b.lower()
    event = match.event.lower()
    
    # Check for Afghanistan men's team
    # Note: Women's team is NOT withheld
    if match.gender != "female":
        if "afghanistan" in team_a or "afghanistan" in team_b:
            return True
        if team_a == "afg" or team_b == "afg":
            return True
    
    # Check for Afghanistan Premier League
    if re.search(r"\bafghanistan premier league\b|\bapl\b", event):
        return True
    
    return False


def classify_match_status(
    match: MatchRecord,
    missing_matches: list[MissingMatch] | None = None
) -> MatchStatus:
    """Classify a scraped match to determine how it should be stored.
    
    Args:
        match: The scraped match record
        missing_matches: Optional cached list from fetch_cricsheet_missing_matches
    
    Returns:
        MatchStatus indicating how to handle this match
    """
    # Check Afghanistan first (faster than fetching missing matches)
    if is_afghanistan_match(match):
        return MatchStatus.CRICSHEET_WITHHELD
    
    # Check if on Cricsheet's missing list
    if missing_matches is None:
        missing_matches = fetch_cricsheet_missing_matches()
    
    # Normalize for comparison
    match_date = match.date
    match_team_a = match.team_a.strip()
    match_team_b = match.team_b.strip()
    
    for missing in missing_matches:
        if missing.date == match_date:
            # Check if teams match (either order)
            if ((missing.team_a == match_team_a and missing.team_b == match_team_b) or
                (missing.team_a == match_team_b and missing.team_b == match_team_a)):
                return MatchStatus.CRICSHEET_MISSING
    
    # Default: provisional (normal lag case)
    return MatchStatus.PROVISIONAL
