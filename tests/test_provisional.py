import csv
import json
from datetime import date

from conftest import make_match

from cricket_data.cli import main
from cricket_data.cricsheet import parse_match
from cricket_data.models import MatchRecord, PlayerPerf
from cricket_data.provisional import load_provisional, reconcile, write_provisional
from cricket_data.store import Store


def prov(winner="Australia", runs=30):
    return MatchRecord(match_id="", date="2026-09-30", team_a="Australia", team_b="South Africa",
                       winner=winner, source="test",
                       players=[PlayerPerf(match_id="", date="2026-09-30", player="M Renshaw", runs=runs)])


def test_pending_provisional_kept(tmp_path):
    s = Store(tmp_path)
    write_provisional(s, prov())
    assert reconcile(s, today=date(2026, 10, 1)) == {"landed": 0, "mismatched": 0, "pending": 1, "stale": 0, "permanent_kept": 0}
    assert len(load_provisional(s)) == 1


def test_landing_deletes_provisional_and_logs(tmp_path):
    s = Store(tmp_path)
    write_provisional(s, prov())
    s.upsert([parse_match("77", make_match(date="2026-10-01"))])  # canonical a day later: still matches
    st = reconcile(s, today=date(2026, 10, 2))
    assert st["landed"] == 1 and st["mismatched"] == 0
    assert load_provisional(s) == [] and not list((tmp_path / "provisional").glob("prov-*.json"))
    log = list(csv.DictReader(open(tmp_path / "reconcile_log.csv")))
    assert log[0]["canonical_id"] == "77" and log[0]["winner_ok"] == "true"


def test_mismatch_is_flagged(tmp_path):
    s = Store(tmp_path)
    write_provisional(s, prov(winner="South Africa", runs=5))
    s.upsert([parse_match("77", make_match())])
    st = reconcile(s, today=date(2026, 10, 2))
    assert st["landed"] == 1 and st["mismatched"] == 1


def test_stale_flagged(tmp_path):
    s = Store(tmp_path)
    write_provisional(s, prov())
    assert reconcile(s, today=date(2026, 12, 31))["stale"] == 1


def test_update_end_to_end_with_inbox(tmp_path, make_zip, monkeypatch):
    inbox = tmp_path / "provisional" / "inbox"
    inbox.mkdir(parents=True)
    (inbox / "x.json").write_text(json.dumps({
        "date": date.today().isoformat(), "team_a": "India", "team_b": "West Indies",
        "winner": "India", "players": [{"player": "S Gill", "runs": 50}]}))
    z = make_zip(make_match(date="2020-01-01"))
    assert main(["--data-dir", str(tmp_path), "update", "--zip", str(z)]) == 0
    assert len(load_provisional(Store(tmp_path))) == 1
    # Cricsheet publishes the match: next update must delete the provisional copy
    landed = make_match(date=date.today().isoformat(), teams=("India", "West Indies"), winner="India")
    z2 = make_zip(landed, name="n.zip")
    assert main(["--data-dir", str(tmp_path), "update", "--zip", str(z2)]) == 0
    assert load_provisional(Store(tmp_path)) == []
    assert not list(inbox.glob("*.json"))  # inbox file deleted once landed


def test_update_with_scraper_enabled(tmp_path, make_zip, monkeypatch):
    """Test that --enable-scraper flag works in the update command."""

    from cricket_data.scrapers import ScraperSource
    
    # Mock the ScraperSource to return a test match
    mock_match = MatchRecord(
        match_id="test-scraper",
        date=date.today().isoformat(),
        team_a="Test Team A",
        team_b="Test Team B",
        winner="Test Team A",
        source="test",
        status="provisional",
    )
    
    # Create a minimal Cricsheet zip
    z = make_zip(make_match(date="2020-01-01"))
    
    # Mock ScraperSource.fetch to return our test match
    original_fetch = ScraperSource.fetch
    
    def mock_fetch(self, since):
        return [mock_match]
    
    monkeypatch.setattr(ScraperSource, "fetch", mock_fetch)
    
    # Run update with scraper enabled
    assert main(["--data-dir", str(tmp_path), "update", "--zip", str(z), "--enable-scraper", "--backfill-batch-size", "0"]) == 0
    
    # Check that the scraped match was added
    store = Store(tmp_path)
    provisionals = load_provisional(store)
    assert len(provisionals) == 1
    assert provisionals[0][1].team_a == "Test Team A"
    
    # Restore original method
    monkeypatch.setattr(ScraperSource, "fetch", original_fetch)
