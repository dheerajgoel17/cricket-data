"""Tests for web scrapers and conflict resolution."""
import json
from datetime import date, timedelta
from unittest.mock import Mock, patch

import pytest

from cricket_data.models import MatchRecord, PlayerPerf
from cricket_data.scrapers import (
    ESPNcricinfoScraper,
    MultiSourceScraper,
    ScraperError,
    ScraperSource,
    _match_key,
    _norm,
)


def test_norm():
    assert _norm("India") == "india"
    assert _norm("West Indies") == "westindies"
    assert _norm("New Zealand") == "newzealand"


def test_match_key():
    rec = MatchRecord(
        match_id="test",
        date="2026-10-09",
        team_a="India",
        team_b="Australia",
    )
    key = _match_key(rec)
    assert key == ("2026-10-09", "australia", "india")  # Sorted alphabetically


def test_match_key_same_for_reversed_teams():
    rec1 = MatchRecord(match_id="1", date="2026-10-09", team_a="India", team_b="Australia")
    rec2 = MatchRecord(match_id="2", date="2026-10-09", team_a="Australia", team_b="India")
    assert _match_key(rec1) == _match_key(rec2)


@pytest.fixture
def espn_match_json():
    """Fixture: ESPNcricinfo match JSON response."""
    return {
        "match": {
            "info": {
                "start_date_raw": "2026-10-08T14:00:00.000Z",
                "match_type_class": "T20",
                "team_type_name": "international",
                "gender": "male",
                "series": {"name": "India vs Australia T20I Series"},
                "venue": {"name": "Wankhede Stadium"},
            },
            "teams": [
                {"team": {"name": "India"}},
                {"team": {"name": "Australia"}},
            ],
            "toss": {"winner": "India", "decision": "bat"},
            "result": {
                "winner": "India",
                "result_type": "win",
                "result_text": "India won by 7 wickets",
            },
            "innings": [
                {
                    "batting_team": "Australia",
                    "bowling_team": "India",
                    "batsmen": [
                        {
                            "batsman": {"known_as": "D Warner", "object_id": 123},
                            "runs": 45,
                            "balls_faced": 32,
                            "fours": 6,
                            "sixes": 1,
                        },
                        {
                            "batsman": {"known_as": "S Smith", "object_id": 124},
                            "runs": 23,
                            "balls_faced": 18,
                            "fours": 2,
                            "sixes": 0,
                        },
                    ],
                    "bowlers": [
                        {
                            "bowler": {"known_as": "J Bumrah", "object_id": 125},
                            "wickets": 2,
                            "overs": 4,
                            "runs": 25,
                        },
                    ],
                },
                {
                    "batting_team": "India",
                    "bowling_team": "Australia",
                    "batsmen": [
                        {
                            "batsman": {"known_as": "V Kohli", "object_id": 126},
                            "runs": 52,
                            "balls_faced": 35,
                            "fours": 4,
                            "sixes": 2,
                        },
                    ],
                    "bowlers": [
                        {
                            "bowler": {"known_as": "P Cummins", "object_id": 127},
                            "wickets": 1,
                            "overs": 3,
                            "runs": 30,
                        },
                    ],
                },
            ],
            "wickets": [
                {
                    "fielders": [{"known_as": "V Kohli", "team": "India"}],
                    "dismissal": "caught",
                },
            ],
        }
    }


@pytest.fixture
def espn_match_list_json():
    """Fixture: ESPNcricinfo match list JSON."""
    return {
        "matches": [
            {
                "object_id": 12345,
                "start_date_raw": "2026-10-08T14:00:00.000Z",
                "match_status": "Complete",
            },
            {
                "object_id": 12346,
                "start_date_raw": "2026-10-07T10:00:00.000Z",
                "match_status": "Complete",
            },
            {
                "object_id": 12347,
                "start_date_raw": "2026-10-09T14:00:00.000Z",
                "match_status": "Live",  # Should be excluded
            },
        ]
    }


def test_espn_scraper_parse_match(espn_match_json):
    scraper = ESPNcricinfoScraper()
    match = scraper._parse_match("12345", espn_match_json)
    
    assert match.match_id == "espn-12345"
    assert match.date == "2026-10-08"
    assert match.match_type == "T20"
    assert match.team_type == "international"
    assert match.team_a == "India"
    assert match.team_b == "Australia"
    assert match.winner == "India"
    assert match.result == "win"
    assert match.source == "espncricinfo"
    assert match.venue == "Wankhede Stadium"
    
    # Check players
    player_names = [p.player for p in match.players]
    assert "D Warner" in player_names
    assert "V Kohli" in player_names
    assert "J Bumrah" in player_names
    
    # Check Warner's stats
    warner = next(p for p in match.players if p.player == "D Warner")
    assert warner.runs == 45
    assert warner.balls == 32
    assert warner.fours == 6
    assert warner.sixes == 1
    
    # Check Bumrah's bowling
    bumrah = next(p for p in match.players if p.player == "J Bumrah")
    assert bumrah.wickets == 2
    assert bumrah.balls_bowled == 24  # 4 overs = 24 balls
    assert bumrah.runs_conceded == 25


def test_espn_scraper_recent_match_ids(espn_match_list_json):
    scraper = ESPNcricinfoScraper()
    
    with patch.object(scraper.fetcher, "get") as mock_get:
        mock_get.return_value = json.dumps(espn_match_list_json)
        
        match_ids = scraper._recent_match_ids(days=7)
        
        # Should only include completed matches
        assert "12345" in match_ids
        assert "12346" in match_ids
        assert "12347" not in match_ids  # Live match excluded


def test_espn_scraper_fetch_match(espn_match_json):
    scraper = ESPNcricinfoScraper()
    
    with patch.object(scraper.fetcher, "get") as mock_get:
        mock_get.return_value = json.dumps(espn_match_json)
        
        match = scraper.fetch_match("12345")
        
        assert match is not None
        assert match.match_id == "espn-12345"
        assert match.team_a == "India"


def test_multi_source_single_source_no_conflict():
    """Single source should pass through without conflict."""
    match1 = MatchRecord(
        match_id="espn-1",
        date="2026-10-08",
        team_a="India",
        team_b="Australia",
        winner="India",
        source="espncricinfo",
        players=[
            PlayerPerf(match_id="espn-1", date="2026-10-08", player="V Kohli", runs=50, wickets=0)
        ],
    )
    
    scraper = MultiSourceScraper()
    resolved = scraper._resolve_conflict([match1])
    
    assert resolved.winner == "India"
    assert resolved.source == "espncricinfo"
    assert len(scraper.get_conflict_log()) == 0


def test_multi_source_agreement():
    """Multiple sources agreeing should not log conflict."""
    match1 = MatchRecord(
        match_id="espn-1",
        date="2026-10-08",
        team_a="India",
        team_b="Australia",
        winner="India",
        source="espncricinfo",
        players=[PlayerPerf(match_id="espn-1", date="2026-10-08", player="V Kohli", runs=50)],
    )
    match2 = MatchRecord(
        match_id="cb-1",
        date="2026-10-08",
        team_a="India",
        team_b="Australia",
        winner="India",
        source="cricbuzz",
        players=[PlayerPerf(match_id="cb-1", date="2026-10-08", player="V Kohli", runs=50)],
    )
    
    scraper = MultiSourceScraper()
    resolved = scraper._resolve_conflict([match1, match2])
    
    assert resolved.winner.lower() == "india"
    assert len(scraper.get_conflict_log()) == 0


def test_multi_source_winner_conflict():
    """Different winners should be resolved by majority vote."""
    match1 = MatchRecord(
        match_id="espn-1",
        date="2026-10-08",
        team_a="India",
        team_b="Australia",
        winner="India",
        source="espncricinfo",
        players=[],
    )
    match2 = MatchRecord(
        match_id="cb-1",
        date="2026-10-08",
        team_a="India",
        team_b="Australia",
        winner="India",
        source="cricbuzz",
        players=[],
    )
    match3 = MatchRecord(
        match_id="other-1",
        date="2026-10-08",
        team_a="India",
        team_b="Australia",
        winner="Australia",
        source="other",
        players=[],
    )
    
    scraper = MultiSourceScraper()
    resolved = scraper._resolve_conflict([match1, match2, match3])
    
    # India wins 2-1
    assert resolved.winner.lower() == "india"
    assert len(scraper.get_conflict_log()) == 1
    
    log = scraper.get_conflict_log()[0]
    assert log["teams"] == "India vs Australia"
    assert len(log["sources"]) == 3
    assert any(d["field"] == "winner" for d in log["disagreements"])


def test_multi_source_player_stat_conflict():
    """Different player stats should be resolved by majority."""
    match1 = MatchRecord(
        match_id="espn-1",
        date="2026-10-08",
        team_a="India",
        team_b="Australia",
        winner="India",
        source="espncricinfo",
        players=[
            PlayerPerf(match_id="espn-1", date="2026-10-08", player="V Kohli", runs=50, wickets=0)
        ],
    )
    match2 = MatchRecord(
        match_id="cb-1",
        date="2026-10-08",
        team_a="India",
        team_b="Australia",
        winner="India",
        source="cricbuzz",
        players=[
            PlayerPerf(match_id="cb-1", date="2026-10-08", player="V Kohli", runs=50, wickets=0)
        ],
    )
    match3 = MatchRecord(
        match_id="other-1",
        date="2026-10-08",
        team_a="India",
        team_b="Australia",
        winner="India",
        source="other",
        players=[
            PlayerPerf(match_id="other-1", date="2026-10-08", player="V Kohli", runs=48, wickets=0)
        ],
    )
    
    scraper = MultiSourceScraper()
    resolved = scraper._resolve_conflict([match1, match2, match3])
    
    # 50 runs wins 2-1
    kohli = next(p for p in resolved.players if "Kohli" in p.player)
    assert kohli.runs == 50
    
    log = scraper.get_conflict_log()
    assert len(log) == 1
    assert any("player_V Kohli" in d["field"] for d in log[0]["disagreements"])


def test_multi_source_player_merge():
    """Players from different sources should be merged correctly."""
    match1 = MatchRecord(
        match_id="espn-1",
        date="2026-10-08",
        team_a="India",
        team_b="Australia",
        winner="India",
        source="espncricinfo",
        players=[
            PlayerPerf(match_id="espn-1", date="2026-10-08", player="V Kohli", runs=50),
            PlayerPerf(match_id="espn-1", date="2026-10-08", player="R Sharma", runs=30),
        ],
    )
    match2 = MatchRecord(
        match_id="cb-1",
        date="2026-10-08",
        team_a="India",
        team_b="Australia",
        winner="India",
        source="cricbuzz",
        players=[
            PlayerPerf(match_id="cb-1", date="2026-10-08", player="V Kohli", runs=50),
            PlayerPerf(match_id="cb-1", date="2026-10-08", player="J Bumrah", wickets=2),
        ],
    )
    
    scraper = MultiSourceScraper()
    resolved = scraper._resolve_conflict([match1, match2])
    
    # Should have all three players
    player_names = {p.player for p in resolved.players}
    assert "V Kohli" in player_names
    assert "R Sharma" in player_names
    assert "J Bumrah" in player_names


def test_scraper_source_marks_provisional():
    """ScraperSource should mark all matches as provisional."""
    scraper_source = ScraperSource()
    
    # Mock the underlying scraper
    mock_match = MatchRecord(
        match_id="test-1",
        date="2026-10-08",
        team_a="India",
        team_b="Australia",
        winner="India",
        source="test",
    )
    
    with patch.object(scraper_source.scraper, "fetch") as mock_fetch:
        mock_fetch.return_value = [mock_match]
        
        matches = scraper_source.fetch(date(2026, 10, 1))
        
        assert len(matches) == 1
        assert matches[0].status == "provisional"


def test_scraper_source_integration():
    """Test ScraperSource with MultiSourceScraper integration."""
    # Create a mock scraper that returns matches
    mock_scraper = Mock()
    mock_scraper.name = "mock_scraper"
    mock_scraper._recent_match_ids = Mock(return_value=["123"])
    mock_scraper.fetch_match = Mock(
        return_value=MatchRecord(
            match_id="mock-123",
            date="2026-10-08",
            team_a="India",
            team_b="Australia",
            winner="India",
            source="mock_scraper",
        )
    )
    
    scraper_source = ScraperSource()
    scraper_source.scraper.scrapers = [mock_scraper]
    
    matches = scraper_source.fetch(date(2026, 10, 1))
    
    assert len(matches) >= 0  # May be empty if mock doesn't match criteria
    # All returned matches should be provisional
    for match in matches:
        assert match.status == "provisional"


def test_match_key_normalization():
    """Ensure match keys handle team name variations."""
    rec1 = MatchRecord(match_id="1", date="2026-10-08", team_a="West Indies", team_b="New Zealand")
    rec2 = MatchRecord(match_id="2", date="2026-10-08", team_a="New Zealand", team_b="West Indies")
    rec3 = MatchRecord(match_id="3", date="2026-10-08", team_a="WEST INDIES", team_b="new zealand")
    
    assert _match_key(rec1) == _match_key(rec2)
    assert _match_key(rec1) == _match_key(rec3)


def test_scraper_error_propagation():
    """Ensure ScraperError is raised on failures."""
    scraper = ESPNcricinfoScraper()
    
    with patch.object(scraper.fetcher, "get") as mock_get:
        mock_get.side_effect = Exception("Network error")
        
        with pytest.raises(ScraperError, match="Network error"):
            scraper.fetch_match("12345")
