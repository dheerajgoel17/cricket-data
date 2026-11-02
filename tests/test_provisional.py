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


def test_a_failed_re_scrape_never_empties_a_stored_scorecard_nor_changes_a_permanent_status(tmp_path):
    s = Store(tmp_path)
    path = write_provisional(s, prov())
    write_provisional(s, MatchRecord(match_id=path.stem, date="2026-09-30", team_a="Australia", team_b="South Africa", winner="Australia", source="test"))  # page unreadable
    assert json.loads(path.read_text())["players"][0]["runs"] == "30"
    keep = prov()
    keep.match_id, keep.status = "crex-afg", "cricsheet_withheld"
    p2 = write_provisional(s, keep)
    again = prov()
    again.match_id = "crex-afg"
    write_provisional(s, again)
    assert json.loads(p2.read_text())["status"] == "cricsheet_withheld"


class _Pages:
    def __init__(self, html, status=200):
        self.html, self.status, self.urls = html, status, []

    def render(self, url, wait_selector=None, timeout_ms=0, force_browser=False, marker=None):
        from cricket_data.crex_browser import RenderedPage

        self.urls.append(url)
        return RenderedPage(url, self.status, self.html, "", "")


def _scorecard_fixture():
    from pathlib import Path

    from cricket_data.crex_scorecard import parse_scorecard

    html = (Path(__file__).parent / "fixtures" / "crex" / "ind_wi_1st_t20_2026_scorecard.html").read_text()
    sc = parse_scorecard(html)
    return html, [sc.teams[i.batting_team] for i in sc.innings]


def _saved(tmp_path, teams, mid, date, status="provisional", runs=(163, 171), innings=None):
    d = {"match_id": mid, "date": date, "team_a": teams[0], "team_b": teams[1], "status": status,
         "players": [{"team": teams[0], "runs": str(runs[0])}, {"team": teams[1], "runs": str(runs[1])}]}
    if innings:
        d["innings"] = innings
    path = tmp_path / "provisional" / f"{mid}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(d, indent=2, sort_keys=True) + "\n")
    return path


def test_refresh_innings_stores_the_stated_totals_of_every_saved_match_provisional_first_newest_first(tmp_path):
    from cricket_data.provisional import innings_gaps, refresh_innings

    html, teams = _scorecard_fixture()
    paths = {m: _saved(tmp_path, teams, f"crex-{m}", d, status=st) for m, d, st in
             (("old", "2026-10-01", "provisional"), ("new", "2026-10-30", "provisional"), ("perm", "2026-10-31", "cricsheet_withheld"))}
    done = _saved(tmp_path, teams, "crex-done", "2026-10-29", innings=[{"team": teams[0], "runs": 1, "wickets": 1, "balls": 6}])
    before = json.loads(paths["new"].read_text())
    assert [d["match_id"] for _, d in innings_gaps(Store(tmp_path))] == ["crex-new", "crex-old", "crex-perm"]  # provisional newest first, then the permanent class
    pages = _Pages(html)
    assert refresh_innings(Store(tmp_path), pages, "https://src.test/cricket-live-score/", limit=2) == {"saved": 2, "failed": 0, "left": 1}
    assert [u.rsplit("/", 2)[-2] for u in pages.urls] == ["new", "old"] and pages.urls[0].endswith("/new/match-scorecard")
    got = json.loads(paths["new"].read_text())
    assert got.pop("innings") == [{"team": teams[0], "runs": 171, "wickets": 10, "balls": 115}, {"team": teams[1], "runs": 172, "wickets": 2, "balls": 88}]
    assert got == before  # nothing else in the saved match changed
    assert "innings" not in json.loads(paths["perm"].read_text())
    assert refresh_innings(Store(tmp_path), _Pages(html), "https://src.test/cricket-live-score/", limit=5)["saved"] == 1  # the permanent match is reached too
    assert json.loads(paths["perm"].read_text())["status"] == "cricsheet_withheld" and len(json.loads(done.read_text())["innings"]) == 1


def test_refresh_innings_rejects_a_wrong_scorecard_and_gives_up_on_a_dead_page_after_three_tries(tmp_path):
    from cricket_data.provisional import REFRESH_TRIES, refresh_innings

    html, teams = _scorecard_fixture()
    store = Store(tmp_path)
    bad = _saved(tmp_path, teams, "crex-bad", "2026-10-30", runs=(999, 0))  # batters out-score the stated 171: not this match's card
    gone = _saved(tmp_path, teams, "crex-gone", "2026-10-29")
    assert refresh_innings(store, _Pages(html), "u/", limit=5) == {"saved": 1, "failed": 1, "left": 0}  # `gone` is fine, `bad` is refused
    assert "innings" not in json.loads(bad.read_text()) and "innings" in json.loads(gone.read_text())
    for _ in range(REFRESH_TRIES - 1):
        assert refresh_innings(store, _Pages("", status=404), "u/", limit=5)["failed"] == 1
    assert refresh_innings(store, _Pages(html), "u/", limit=5) == {"saved": 0, "failed": 0, "left": 0}  # tried three times: left alone


def test_refresh_innings_stops_starting_matches_when_its_time_is_up(tmp_path):
    from cricket_data.provisional import refresh_innings

    html, teams = _scorecard_fixture()
    for k in range(3):
        _saved(tmp_path, teams, f"crex-m{k}", f"2026-10-0{k + 1}")
    ticks = iter([0, 1, 2, 100, 200, 300])  # started at 0, the second match is still inside the 10 s budget, the third is not
    res = refresh_innings(Store(tmp_path), _Pages(html), "u/", limit=10, max_seconds=10, clock=lambda: next(ticks))
    assert res == {"saved": 2, "failed": 0, "left": 1}
