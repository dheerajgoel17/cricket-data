import inspect
import json
from datetime import datetime

from cricket_data import crex_schedule as cs


def page(items):
    state = json.dumps({cs.KEY: items}).replace('"', "&q;")
    return f'<html><script id="app-root-state" type="application/json">{state}</script></html>'


def item(**kw):
    base = {"t": 1792744200000, "team1": "India Women", "team2": "Zimbabwe Women", "g": 0, "formats": "ODI", "n": "Zimbabwe Women tour of India 2026",
            "venue": "Kotambi Stadium, Vadodara", "status": 0, "link": "/cricket-live-score/ind-w-vs-zim-w-1st-odi-x-1221"}
    base.update(kw)
    return base


def test_paged_schedule_reads_ten_days_ahead():
    sig = inspect.signature(cs.fetch_schedule_paged)
    assert sig.parameters["days"].default == 10
    assert sig.parameters["max_pages"].default == 24


def test_parse_schedule_maps_time_format_gender_and_status():
    rows = cs.parse_schedule(page([
        item(),
        item(t=1792731600000, team1="Afghanistan U19", team2="Bangladesh U19", g=1, formats="Youth ODI", status=1, link="/cricket-live-score/afg-u19-x-14SY"),
        item(t=1792825200000, team1="New Zealand", team2="India", g=1, formats="T20I", link="/cricket-live-score/nz-vs-ind-1st-t20i-x-14Z"),
    ]))
    assert [r["start_utc"] for r in rows] == ["2026-10-23T05:00Z", "2026-10-23T08:30Z", "2026-10-24T07:00Z"]  # sorted by start
    live, women, nz = rows
    assert live["status"] == "Live" and live["gender"] == "male" and live["format"] == "ODI"
    assert women["gender"] == "female" and women["format"] == "ODI" and women["team_a"] == "India Women"
    assert nz["format"] == "T20" and nz["url"] == "/cricket-live-score/nz-vs-ind-1st-t20i-x-14Z"
    assert women["match_id"] == "ind-w-vs-zim-w-1st-odi-x-1221"


def test_format_labels():
    f = cs.format_of
    assert [f("T20I"), f("T20"), f("ODI"), f("One Day"), f("List A"), f("Youth ODI"), f("Test"), f("First Class"), f("First Class Only"), f("")] == \
        ["T20", "T20", "ODI", "ODI", "ODI", "ODI", "Test", "FC", "FC", ""]
    assert f("T10") == "T10" and f("10 overs") == "T10" and f("T20") != "T10"
    assert f("60 overs") == "O60" and f("The Hundred") == "Hundred"


def test_garbage_pages_yield_nothing_instead_of_raising():
    assert cs.parse_schedule("<html>no state</html>") == []
    assert cs.parse_schedule('<script id="app-root-state">{not json}</script>') == []
    assert cs.parse_schedule(page([{"t": None, "team1": "A", "team2": "B"}, {"t": 1, "team1": "", "team2": "B"}])) == []


def test_merge_keeps_far_future_rows_but_lets_the_schedule_replace_the_near_term(tmp_path):
    import csv

    from cricket_data.cli import _merge_fixtures
    from cricket_data.fixtures import FIELDS

    def row(start, a, b):
        return {**{k: "" for k in FIELDS}, "start_utc": start, "match_id": f"{a}-{b}-{start}", "team_a": a, "team_b": b}

    old = [row("2026-10-25T05:00Z", "Old", "Cancelled"), row("2027-03-06T03:50Z", "Australia Women", "New Zealand Women")]
    path = tmp_path / "upcoming.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS, lineterminator="\n")
        w.writeheader()
        w.writerows(old)
    fresh = [row("2026-10-24T07:00Z", "New Zealand", "India"), row("2026-10-26T03:00Z", "A", "B")]
    merged = _merge_fixtures(fresh, path, datetime(2026, 10, 24, 12, 0))
    assert [r["team_a"] for r in merged] == ["New Zealand", "A", "Australia Women"]   # the old near-term game (25 Oct) is gone, the 2027 tour stays
    assert _merge_fixtures([], path) == []


def test_a_test_at_stumps_stays_live_and_home_rows_win_over_the_schedule_page():
    stumps = item(status=2, formats="Test", team1="South Africa", team2="Australia", result="",
                  link="/cricket-live-score/aus-vs-sa-3rd-test-x-10MS")
    assert cs.parse_schedule(page([stumps]))[0]["status"] == "Live"
    home = [cs.parse_schedule(page([stumps]))[0]]
    sched = [cs.parse_schedule(page([item(status=0, team1="Pakistan", team2="Sri Lanka",
                                           link="/cricket-live-score/pak-vs-sl-x-1")]))[0]]
    merged = cs.merge_rows(home, sched)
    assert [r["team_a"] for r in merged] == ["South Africa", "Pakistan"]
    dropped = cs.parse_schedule(page([stumps]))[0]
    again = {**dropped, "status": "Upcoming", "venue": ""}
    assert cs.merge_rows([again], [dropped])[0]["status"] == "Live"


def test_a_match_that_has_dropped_off_the_page_is_kept_for_three_days_as_completed(tmp_path):
    import csv

    from cricket_data.cli import _merge_fixtures
    from cricket_data.fixtures import FIELDS

    def row(start, a, b, status="Upcoming"):
        return {**{k: "" for k in FIELDS}, "start_utc": start, "match_id": f"{a}-{b}", "team_a": a, "team_b": b, "status": status}

    path = tmp_path / "upcoming.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS, lineterminator="\n")
        w.writeheader()
        w.writerows([row("2026-10-27T07:00Z", "New Zealand", "India", "Live"), row("2026-10-22T07:00Z", "Long", "Ago"), row("2026-10-27T05:00Z", "Still", "Listed")])
    fresh = [row("2026-10-27T05:00Z", "Still", "Listed", "Live"), row("2026-10-28T08:30Z", "India Women", "Zimbabwe Women")]
    merged = _merge_fixtures(fresh, path, datetime(2026, 10, 27, 12, 0))
    assert [(r["team_a"], r["status"]) for r in merged] == [("Still", "Live"), ("New Zealand", "Completed"), ("India Women", "Upcoming")]  # 5 days ago is gone


def test_a_dropped_test_is_kept_live_for_six_days_without_a_result(tmp_path):
    import csv

    from cricket_data.cli import _merge_fixtures
    from cricket_data.fixtures import FIELDS

    def row(start, a, b, status="Upcoming", fmt="T20", result=""):
        return {**{k: "" for k in FIELDS}, "start_utc": start, "match_id": f"{a}-{b}", "team_a": a, "team_b": b,
                "status": status, "format": fmt, "result": result}

    path = tmp_path / "upcoming.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS, lineterminator="\n")
        w.writeheader()
        w.writerows([row("2026-10-27T08:30Z", "South Africa", "Australia", "Live", "Test"),
                     row("2026-10-22T07:00Z", "Old", "Test", "Live", "Test")])
    fresh = [row("2026-10-30T07:00Z", "India", "New Zealand")]
    merged = _merge_fixtures(fresh, path, datetime(2026, 10, 30, 12, 0))
    by = {r["team_a"]: r["status"] for r in merged}
    assert by["South Africa"] == "Live" and "Old" not in by  # day 4 of the Test is kept; 8 days ago is gone
    done = [row("2026-10-27T08:30Z", "South Africa", "Australia", "Live", "Test", "South Africa won by 5 wickets")]
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS, lineterminator="\n")
        w.writeheader()
        w.writerows(done)
    over = _merge_fixtures(fresh, path, datetime(2026, 10, 30, 12, 0))
    assert [r["status"] for r in over if r["team_a"] == "South Africa"] == ["Completed"]


def test_a_finished_match_is_completed_with_its_result_line():
    r = cs.parse_schedule(page([item(status=2, result="IND Won by 6 wickets")]))[0]
    assert r["status"] == "Completed" and r["result"] == "IND Won by 6 wickets"
    assert cs.parse_schedule(page([item(status=1)]))[0]["result"] == ""


def test_a_later_page_card_becomes_a_row_and_a_live_or_odd_card_is_skipped():
    from cricket_data.crex_schedule import row_from_card

    card = {"day": "Thu, 29 Oct 2026", "href": "/cricket-live-score/ind-w-vs-zim-w-3rd-odi-zimbabwe-women-tour-of-india-2026-match-updates-1223", "teams": ["India Women", "Zimbabwe Women"],
            "time": "2:00 PM", "fmt": "ODI", "meta": "3rd ODI, Zimbabwe Women tour of India 2026"}
    r = row_from_card(card)
    assert (r["start_utc"], r["format"], r["gender"], r["series"], r["status"], r["venue"]) == ("2026-10-29T14:00Z", "ODI", "female", "Zimbabwe Women tour of India 2026", "Upcoming", "")
    assert r["match_id"].endswith("match-updates-1223") and r["url"].startswith("/cricket-live-score/")
    assert row_from_card({**card, "time": ""}) is None  # a live card shows a score, not a start time
    assert row_from_card({**card, "teams": ["Only one"]}) is None
    assert row_from_card({**card, "meta": "1st Multi Day, Sheffield Shield", "fmt": "Multi Day", "teams": ["Tasmania", "New South Wales"], "href": "/cricket-live-score/tas-vs-nsw-x-1"})["format"] == "FC"


def test_a_row_with_no_venue_gets_the_held_one_else_its_match_page_and_a_failing_page_costs_nothing(monkeypatch):
    monkeypatch.setenv("LIVE_SOURCE_BASE", "https://example.test")
    ld = '<script type="application/ld+json" id="sports-event-schema">{"@type":"SportsEvent","name":"A v B","startDate":"2026-10-29T14:30:00+00:00","location":{"name":"Sharjah Cricket Stadium, Sharjah"},"competitor":[{"name":"A"},{"name":"B"}]}</script>'
    rows = [{"match_id": "held", "venue": "", "start_utc": "2026-10-29T10:00Z", "url": "/m/held"}, {"match_id": "page", "venue": "", "start_utc": "2026-10-29T14:30Z", "url": "/m/page"},
            {"match_id": "bad", "venue": "", "start_utc": "2026-10-30T14:30Z", "url": "/m/bad"}, {"match_id": "has", "venue": "Here", "start_utc": "2026-10-31T14:30Z", "url": "/m/has"}]

    class F:
        got: list[str] = []

        def get(self, url):
            self.got.append(url)
            if url.endswith("/bad"):
                raise OSError("down")
            return f"<html>{ld}</html>"

    f = F()
    assert cs.fill_venues(rows, [{"match_id": "held", "venue": "Kept Oval"}], f, cap=5) == 2
    assert [r["venue"] for r in rows] == ["Kept Oval", "Sharjah Cricket Stadium, Sharjah", "", "Here"]
    assert f.got == ["https://example.test/m/page", "https://example.test/m/bad"]  # the held one and the one with a venue are not fetched
