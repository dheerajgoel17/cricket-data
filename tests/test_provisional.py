import csv
import json
from datetime import date

from conftest import make_match

from cricket_data.cli import _has_innings_summary, _known_ids, main
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
    # Base publishes the match: next update must delete the provisional copy
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
    
    # Create a minimal Base zip
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


def test_backfill_command_runs_end_to_end(tmp_path, make_zip):
    """`backfill` (the weekly re-sync) shares update's pipeline; it once crashed on a missing option."""
    z = make_zip(make_match(date="2020-01-01"))
    assert main(["--data-dir", str(tmp_path), "backfill", "--zip", str(z)]) == 0
    assert Store(tmp_path).months("matches")


def test_backfill_accepts_every_update_option(monkeypatch):
    """Every option `update` has, `backfill` has too, so _cmd_update never meets a missing attribute."""
    from cricket_data import cli

    seen = {}
    monkeypatch.setattr(cli, "cmd_update", lambda a: seen.setdefault("update", a) and 0)
    monkeypatch.setattr(cli, "cmd_backfill", lambda a: seen.setdefault("backfill", a) and 0)
    cli.main(["update", "--zip", "x.zip"])
    cli.main(["backfill", "--zip", "x.zip"])
    assert set(vars(seen["update"])) <= set(vars(seen["backfill"]))
    assert seen["backfill"].dataset == "all_json.zip" and seen["backfill"].provisional_days == 30


def test_the_innings_summary_is_stored_and_read_back(tmp_path):
    s = Store(tmp_path)
    rec = prov()
    rec.innings = [{"team": "Australia", "runs": 171, "wickets": 10, "balls": 115}, {"team": "South Africa", "runs": 172, "wickets": 2, "balls": 88}]
    path = write_provisional(s, rec)
    assert json.loads(path.read_text())["innings"][1]["balls"] == 88
    assert load_provisional(s)[0][1].innings == rec.innings
    assert "innings" not in prov().row()  # not a CSV column: the match table keeps its columns


def test_a_saved_scorecard_without_the_summary_is_fetched_again_and_a_failed_fetch_never_empties_it(tmp_path):
    s = Store(tmp_path)
    path = write_provisional(s, prov())
    assert not _has_innings_summary(path)  # an older file: scrape it once more to gain the summary
    # the re-scrape came back without players (page unreadable): the stored scorecard stays
    write_provisional(s, MatchRecord(match_id=path.stem, date="2026-09-30", team_a="Australia", team_b="South Africa", winner="Australia", source="test"))
    assert json.loads(path.read_text())["players"][0]["runs"] == "30"
    # a good re-scrape adds the summary
    again = prov()
    again.match_id = path.stem
    again.innings = [{"team": "Australia", "runs": 200, "wickets": 5, "balls": 120}]
    write_provisional(s, again)
    assert _has_innings_summary(path)
    # a permanent class is never re-scraped and keeps its status when it is
    keep = prov()
    keep.match_id, keep.status = "crex-afg", "cricsheet_withheld"
    p2 = write_provisional(s, keep)
    assert _has_innings_summary(p2)
    again2 = prov()
    again2.match_id = "crex-afg"
    write_provisional(s, again2)
    assert json.loads(p2.read_text())["status"] == "cricsheet_withheld"


def test_a_backlog_of_old_scorecards_is_fetched_again_a_few_per_run_newest_first(tmp_path):
    s = Store(tmp_path)
    for day in range(1, 21):  # 20 saved matches with no innings summary, one per day
        rec = prov()
        rec.match_id, rec.date = f"crex-m{day:02d}", f"2026-10-{day:02d}"
        write_provisional(s, rec)
    done = prov()
    done.match_id, done.date = "crex-done", "2026-10-25"
    done.innings = [{"team": "Australia", "runs": 1, "wickets": 1, "balls": 6}]
    write_provisional(s, done)
    known = _known_ids(tmp_path / "provisional", cap=5)
    again = {f"m{day:02d}" for day in range(1, 21)} - known
    assert again == {f"m{day:02d}" for day in range(16, 21)}  # the 5 newest; "done" already has its summary and stays known
    assert "done" in known
