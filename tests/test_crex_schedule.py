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


def test_a_finished_match_is_completed_with_its_result_line():
    r = cs.parse_schedule(page([item(status=2, result="IND Won by 6 wickets")]))[0]
    assert r["status"] == "Completed" and r["result"] == "IND Won by 6 wickets"
    assert cs.parse_schedule(page([item(status=1)]))[0]["result"] == ""
