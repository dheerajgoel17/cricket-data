"""Tests for permanent match detection and classification."""

from cricket_data.models import MatchRecord, MatchStatus
from cricket_data.permanent_matches import (
    MissingMatch,
    MissingMatchesParser,
    classify_match_status,
    is_afghanistan_match,
)


def test_missing_matches_parser():
    """Test parsing Cricsheet's missing-matches HTML."""
    html = """
    <h5>Test Matches</h5>
    <h6>Female matches</h6>
    <dl>
      <dt>2002-01-14</dt>
      <dd>England vs India</dd>
      <dt>2002-03-19</dt>
      <dd>India vs South Africa</dd>
    </dl>
    <h6>Male matches</h6>
    <dl>
      <dt>2001-12-14</dt>
      <dd>Australia vs South Africa</dd>
    </dl>
    <h5>One Day Internationals</h5>
    <h6>Male matches</h6>
    <dl>
      <dt>2003-05-22</dt>
      <dd>Pakistan vs Zimbabwe</dd>
    </dl>
    """
    
    parser = MissingMatchesParser()
    parser.feed(html)
    
    assert len(parser.matches) == 4
    
    # Check first match
    match = parser.matches[0]
    assert match.date == "2002-01-14"
    assert match.team_a == "England"
    assert match.team_b == "India"
    assert match.match_type == "Test"
    assert match.gender == "female"
    
    # Check male test
    male_test = [m for m in parser.matches if m.date == "2001-12-14"][0]
    assert male_test.match_type == "Test"
    assert male_test.gender == "male"
    assert male_test.team_a == "Australia"
    
    # Check ODI
    odi = [m for m in parser.matches if m.date == "2003-05-22"][0]
    assert odi.match_type == "ODI"


def test_is_afghanistan_match_mens_team():
    """Afghanistan men's team matches should be withheld."""
    match = MatchRecord(
        match_id="test-1",
        date="2026-10-09",
        team_a="Afghanistan",
        team_b="Pakistan",
        gender="male",
        source="crex"
    )
    assert is_afghanistan_match(match) is True
    
    # Short code
    match.team_a = "AFG"
    match.team_b = "PAK"
    assert is_afghanistan_match(match) is True
    
    # Reversed teams
    match.team_a = "Pakistan"
    match.team_b = "Afghanistan"
    assert is_afghanistan_match(match) is True


def test_is_afghanistan_match_womens_team():
    """Afghanistan women's team is NOT withheld."""
    match = MatchRecord(
        match_id="test-1",
        date="2026-10-09",
        team_a="Afghanistan",
        team_b="Pakistan",
        gender="female",
        source="crex"
    )
    assert is_afghanistan_match(match) is False


def test_is_afghanistan_match_apl():
    """Afghanistan Premier League matches should be withheld."""
    match = MatchRecord(
        match_id="test-1",
        date="2026-10-09",
        team_a="Kabul Knights",
        team_b="Kandahar Kings",
        event="Afghanistan Premier League",
        gender="male",
        source="crex"
    )
    assert is_afghanistan_match(match) is True
    
    # Short form
    match.event = "APL 2024"
    assert is_afghanistan_match(match) is True


def test_is_afghanistan_match_non_afghanistan():
    """Non-Afghanistan matches should not be withheld."""
    match = MatchRecord(
        match_id="test-1",
        date="2026-10-09",
        team_a="India",
        team_b="Pakistan",
        gender="male",
        source="crex"
    )
    assert is_afghanistan_match(match) is False


def test_classify_match_status_provisional():
    """Normal matches should be classified as provisional."""
    match = MatchRecord(
        match_id="test-1",
        date="2026-10-09",
        team_a="India",
        team_b="West Indies",
        gender="male",
        source="crex"
    )
    
    # No missing matches list
    status = classify_match_status(match, missing_matches=[])
    assert status == MatchStatus.PROVISIONAL


def test_classify_match_status_afghanistan():
    """Afghanistan matches should be classified as withheld."""
    match = MatchRecord(
        match_id="test-1",
        date="2026-10-09",
        team_a="Afghanistan",
        team_b="Pakistan",
        gender="male",
        source="crex"
    )
    
    status = classify_match_status(match, missing_matches=[])
    assert status == MatchStatus.CRICSHEET_WITHHELD


def test_classify_match_status_missing():
    """Matches on Cricsheet's missing list should be classified as missing."""
    match = MatchRecord(
        match_id="test-1",
        date="2002-01-14",
        team_a="England",
        team_b="India",
        match_type="Test",
        gender="female",
        source="crex"
    )
    
    missing_matches = [
        MissingMatch(
            date="2002-01-14",
            team_a="England",
            team_b="India",
            match_type="Test",
            gender="female"
        )
    ]
    
    status = classify_match_status(match, missing_matches=missing_matches)
    assert status == MatchStatus.CRICSHEET_MISSING


def test_classify_match_status_missing_reversed_teams():
    """Missing matches should work regardless of team order."""
    match = MatchRecord(
        match_id="test-1",
        date="2002-01-14",
        team_a="India",  # Reversed
        team_b="England",
        match_type="Test",
        gender="female",
        source="crex"
    )
    
    missing_matches = [
        MissingMatch(
            date="2002-01-14",
            team_a="England",
            team_b="India",
            match_type="Test",
            gender="female"
        )
    ]
    
    status = classify_match_status(match, missing_matches=missing_matches)
    assert status == MatchStatus.CRICSHEET_MISSING


def test_classify_match_status_afghanistan_priority():
    """Afghanistan status takes priority over missing list."""
    match = MatchRecord(
        match_id="test-1",
        date="2023-10-15",
        team_a="Afghanistan",
        team_b="Pakistan",
        gender="male",
        source="crex"
    )
    
    # Even if also on missing list, should be withheld
    missing_matches = [
        MissingMatch(
            date="2023-10-15",
            team_a="Afghanistan",
            team_b="Pakistan",
            match_type="ODI",
            gender="male"
        )
    ]
    
    status = classify_match_status(match, missing_matches=missing_matches)
    assert status == MatchStatus.CRICSHEET_WITHHELD
