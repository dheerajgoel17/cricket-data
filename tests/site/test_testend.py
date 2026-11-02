import json
from datetime import datetime, timedelta, timezone

from cricket_site import testend as T


def utc(*a):
    return datetime(*a, tzinfo=timezone.utc)


START = "2026-10-28T09:00:00Z"   # a Test's first morning


def test_a_test_ends_when_the_run_that_first_saw_its_result_says_but_never_after_the_start_of_day_5():
    assert T.end_of({"start_utc": START, "settled_at": "2026-10-31T10:00:00Z"}) == utc(2026, 10, 31, 10)
    assert T.end_of({"start_utc": START, "settled_at": "2026-11-03T12:00:00Z"}) == utc(2026, 11, 1, 9)    # first seen over days late (the run was down): day 5 starts 4 days in


def test_a_file_with_the_whole_matchs_result_but_no_settled_at_is_taken_to_end_at_the_start_of_day_5():
    assert T.end_of({"start_utc": START, "results": [{"pid": "a", "stat": "runs", "value": 31}]}) == utc(2026, 11, 1, 9)


def test_innings_results_and_no_results_say_nothing_about_the_match_being_over():
    assert T.end_of({"start_utc": START}) is None
    assert T.end_of({"start_utc": START, "results": [{"pid": "a", "stat": "runs", "inn": 1, "value": 31}]}) is None   # a 1st innings is settled while the Test goes on
    assert T.end_of({"start_utc": "soon", "settled_at": "2026-10-31T10:00:00Z"}) is None


def test_a_test_is_listed_for_24_hours_after_it_ended():
    end = utc(2026, 10, 31, 10)
    assert not T.gone(end, utc(2026, 11, 1, 9, 59))
    assert T.gone(end, utc(2026, 11, 1, 10, 0))


def write(root, name, **d):
    (root / name[:7]).mkdir(parents=True, exist_ok=True)
    (root / name[:7] / f"{name}.json").write_text(d.pop("raw", None) or json.dumps(d))


def test_ended_lists_the_tests_of_the_last_days_that_have_a_result_and_skips_everything_else(tmp_path):
    now = utc(2026, 11, 2, 8)
    test = {"match": "South Africa vs Australia", "start_utc": START, "lines": [{"fmt": "Test"}]}
    write(tmp_path, "2026-10-28-sa-v-aus", **test, settled_at="2026-10-31T10:00:00Z")
    write(tmp_path, "2026-10-28-ban-v-wi", **{**test, "match": "Bangladesh vs West Indies"}, results=[{"pid": "a", "stat": "runs", "value": 3}])    # whole-match result, no settled_at
    write(tmp_path, "2026-10-29-in-play", **{**test, "match": "India vs England"})                                          # no result yet
    write(tmp_path, "2026-10-30-odi", match="Oman vs Nepal", start_utc="2026-10-30T09:00:00Z", lines=[{"fmt": "ODI"}], settled_at="2026-10-30T15:00:00Z")   # not a Test
    write(tmp_path, "2026-10-20-old", **test, settled_at="2026-10-22T10:00:00Z")                                                 # begun more than 8 days ago
    write(tmp_path, "2026-10-31-broken", raw="{")
    got = {m: (s, e) for m, s, e in T.ended(tmp_path, now)}
    assert got == {"South Africa vs Australia": (utc(2026, 10, 28, 9), utc(2026, 10, 31, 10)), "Bangladesh vs West Indies": (utc(2026, 10, 28, 9), utc(2026, 11, 1, 9))}
    assert T.ended(tmp_path / "nowhere", now) == []
    assert (tmp_path / "2026-10" / "2026-10-31-broken.json").read_text() == "{", "an unreadable file is left as it is"


def test_the_month_before_is_read_too(tmp_path):
    write(tmp_path, "2026-10-30-sa-v-aus", match="A vs B", start_utc="2026-10-30T09:00:00Z", lines=[{"fmt": "Test"}], settled_at="2026-11-01T10:00:00Z")
    assert [m for m, _, _ in T.ended(tmp_path, utc(2026, 11, 3, 8))] == ["A vs B"]
    assert utc(2026, 11, 3, 8) - T.LOOKBACK < utc(2026, 10, 30, 9) + timedelta(days=1)
