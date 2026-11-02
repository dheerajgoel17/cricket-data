"""The data guard (src/cricket_site/guard.py): each check is fed deliberately wrong data, including the cases that reached the site."""
import csv
import gzip
import json
import re
import shutil
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from cricket_site import guard as G

ROOT = Path(__file__).resolve().parents[2]
NOW = datetime(2026, 11, 2, 10, 0, tzinfo=timezone.utc).timestamp()
TODAY = date(2026, 11, 2)


def fx(a="Eagles", b="Tuskers", start="2026-11-01T07:30Z", status="Started", source="books", fmt="", gender="male", result=""):
    return {"a": a, "b": b, "start": start, "status": status, "source": source, "fmt": fmt, "gender": gender, "result": result}


def matches(*rows):
    """A matches.json from rows of {d, f, o, r, w, fi, q, inn}; the innings are [team, runs, wkts, balls]."""
    cols = {"id": [], "d": [], "f": [], "o": [], "r": [], "w": [], "fi": [], "q": [], "pv": [], "inn": []}
    for k, r in enumerate(rows):
        for c, dflt in (("id", f"m{k}"), ("d", "2026-10-27"), ("f", 0), ("o", 20), ("r", 0), ("w", 0), ("fi", 0), ("q", 1), ("pv", 0), ("inn", [])):
            cols[c].append(r.get(c, dflt))
    return cols


def problems(c):
    return c.problems


# ------------------------------------------------------------------ a
def test_a_a_fixture_is_live_only_on_the_schedules_word():
    (c,) = G.check_live_evidence([fx(status="Live", source="books"), fx(a="A", status="Live", source="src"), fx(a="B", status="Started"), fx(a="C", status="Upcoming")])
    assert c.level == G.HARD and len(c.problems) == 1 and "Eagles v Tuskers" in c.problems[0] and "'books'" in c.problems[0]
    assert "1 started" in c.note and "2 Live" in c.note
    assert G.check_live_evidence([fx(status="Started")])[0].problems == []


def test_a_the_stop_gap_rows_the_builder_makes_pass_and_the_old_clock_rule_would_not(tmp_path):
    """1 Nov 2026: Eagles v Tuskers started 07:30 with no schedule row and no live row. The old builder published it Live; now it is Started."""
    from cricket_site import build as B

    vb = tmp_path / "value_bets" / "out"
    vb.mkdir(parents=True)
    (tmp_path / "value_bets" / "archive" / "2026-11").mkdir(parents=True)
    (tmp_path / "value_bets" / "archive" / "2026-11" / "2026-11-01-eagles-v-tuskers.json").write_text(json.dumps({"match": "Eagles vs Tuskers", "start_utc": "2026-11-01T07:30:00Z", "fixture": None, "lines": [], "fancy": [{}]}))
    rows = B._unscheduled_priced(vb, [], now=datetime(2026, 11, 1, 10, 30, tzinfo=timezone.utc))
    assert [r["status"] for r in rows] == ["Started"]
    assert G.check_live_evidence(rows)[0].problems == []
    assert G.check_live_evidence([{**rows[0], "status": "Live"}])[0].problems  # what the clock rule published


def test_a_a_match_in_play_in_the_live_body_has_a_score_or_players():
    live = {"matches": [
        {"status": "live", "start": "2026-11-01T07:30:00Z", "teams": [{"name": "Eagles", "display": ""}, {"name": "Tuskers", "display": ""}], "innings": [], "players": []},
        {"status": "live", "teams": [{"name": "A", "display": "151/4"}, {"name": "B", "display": ""}], "innings": [], "players": []},
        {"status": "live", "teams": [{"name": "C"}, {"name": "D"}], "innings": [], "players": [{"name": "x"}]},
        {"status": "upcoming", "teams": [{"name": "E", "display": ""}, {"name": "F", "display": ""}]},
    ]}
    c, w = G.check_live_evidence([], live)
    assert (w.id, w.level, w.checked) == ("a-live", G.WARN, 3)
    assert len(w.problems) == 1 and w.problems[0].startswith("Eagles v Tuskers") and "no score and no players" in w.problems[0]


# ------------------------------------------------------------------ b
def test_b_a_match_flagged_in_play_is_inside_its_window_and_has_no_result():
    rows = [fx(a="Gone", start="2026-10-31T07:30Z", status="Started", fmt="T20"),             # 51 h on: a T20 keeps 24 h
            fx(a="Fresh", start="2026-11-02T06:30Z", status="Started", fmt="T20"),
            fx(a="Edge", start="2026-11-01T09:30Z", status="Started", fmt="T20"),            # 24.5 h: inside the hour of grace
            fx(a="Test", start="2026-10-29T03:30Z", status="Live", source="src", fmt="Test"),  # day 5 of 6
            fx(a="OldTest", start="2026-10-25T03:30Z", status="Live", source="src", fmt="Test"),
            fx(a="Done", start="2026-11-02T06:30Z", status="Live", source="src", fmt="T20", result="Done won by 3 wickets"),
            fx(a="Over", start="2026-10-20T06:30Z", status="Completed", source="src", result="Over won by 3 wickets")]  # finished long ago: Completed is right
    c = G.check_keep_window(rows, None, NOW)
    assert c.level == G.HARD and c.checked == 6
    assert sorted(p.split(" v ")[0] for p in c.problems) == ["Done", "Gone", "OldTest"]
    assert any("has a result" in p for p in c.problems) and any("50 h after" in p for p in c.problems)


def test_b_published_book_lines_are_inside_the_pipelines_carry_window_when_it_wrote_them():
    def doc(generated, *rows):
        return {"generated_at_utc": generated, "lines": [{"match": m, "start_utc": s, **k} for m, s, k in rows], "events": [], "fancy": []}

    wrote = "2026-11-02T09:50:00Z"
    ok = doc(wrote, ("T20 fresh", "2026-11-01T20:00:00Z", {"fmt": "T20"}), ("T20 old", "2026-11-01T01:00:00Z", {"fmt": "T20"}),     # 32 h: carried, inside the 40 h
              ("Test d5", "2026-10-29T03:30:00Z", {"fmt": "Test"}))
    assert G.check_keep_window([], ok, NOW).problems == []
    bad = doc(wrote, ("T20 kept", "2026-10-31T07:30:00Z", {"fmt": "T20"}), ("Old Test", "2026-10-25T03:30:00Z", {"fmt": "Test"}))
    assert [p.split(" were")[0] for p in G.check_keep_window([], bad, NOW).problems] == ["book lines for Old Test (2026-10-25T03:30)", "book lines for T20 kept (2026-10-31T07:30)"]
    stale = doc("2026-11-01T21:18:00Z", ("T20 kept", "2026-10-31T07:30:00Z", {"fmt": "T20"}))   # judged on when the file was written, not on today
    assert G.check_keep_window([], stale, NOW).problems == []   # 38 h after the start when it was written: inside the 40 h


def test_b_a_book_lines_file_nobody_has_written_for_hours_is_flagged():
    assert G.check_lines_fresh({"generated_at_utc": "2026-11-02T09:20:00Z"}, NOW).problems == []
    c = G.check_lines_fresh({"generated_at_utc": "2026-11-01T21:18:00Z"}, NOW)
    assert c.level == G.WARN and "13 h ago" in c.problems[0]
    assert G.check_lines_fresh({}, NOW).problems == ["the book lines carry no generated_at_utc"]


# ------------------------------------------------------------------ c
def wbbl():
    """Seven matches of one edition: bat first (fi) and winner (w). The batting-first side won 3 of 7 (m0, m2, m5); m6 was a chase that ended early, so it is void (q 0)."""
    fi = [0, 0, 1, 1, 0, 0, 1]
    w = [0, 1, 1, 0, 1, 0, 0]
    return matches(*[{"fi": a, "w": b, "q": 0 if k == 6 else 1} for k, (a, b) in enumerate(zip(fi, w, strict=True))])


def test_c_the_bat_first_recount_counts_every_match_with_a_winner():
    M = wbbl()
    ids = M["id"]
    assert G.recount_bat_first(M, ids) == (7, 42.9)
    M["r"][0] = 1                                # a tie has no winner to count (m0 was a bat-first win)
    assert G.recount_bat_first(M, ids) == (6, 33.3)
    M["r"][0], M["fi"][1] = 0, -1                # first-innings side unknown (m1 was a loss for the side batting first)
    assert G.recount_bat_first(M, ids) == (6, 50.0)


def test_c_an_edition_that_counts_only_the_matches_that_qualify_is_caught():
    """WBBL 2026: the site said 50% (3 of 6) where the truth is 42.9% (3 of 7)."""
    M = wbbl()
    wrong = {"event": "Women's Big Bash League", "name": "2026", "ids": M["id"], "decided": 6, "pct": 50.0}
    right = {**wrong, "decided": 7, "pct": 42.9}
    none = {"event": "E", "name": "2025", "ids": [], "decided": 0, "pct": None}
    c = G.check_bat_first(M, [wrong, right, none])
    assert c.level == G.HARD and c.checked == 3
    assert c.problems == ["Women's Big Bash League 2026: the site says 50.0% over 6, a recount says 42.9% over 7"]
    assert G.check_bat_first(M, [{**right, "pct": None}]).problems and G.check_bat_first(M, None).skipped
    assert G.check_bat_first(M, [{**right, "decided": 6}]).problems  # the right percentage over the wrong count


@pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")
def test_c_the_real_engine_agrees_with_the_recount_on_built_data(tmp_path):
    src = ROOT / "site" / "tests" / "fixtures" / "data"
    shutil.copytree(src, tmp_path / "d")
    M = json.loads((tmp_path / "d" / "matches.json").read_text())
    M["q"] = [1] * len(M["q"])  # every match counts for summary markets: engines that filter on it and the recount must then agree
    (tmp_path / "d" / "matches.json").write_text(json.dumps(M))
    editions = G.engine_editions(tmp_path / "d")
    assert editions and sum(len(e["ids"]) for e in editions) == len(M["id"])
    assert G.check_bat_first(M, editions).problems == []


# ------------------------------------------------------------------ d
T20_COMPLETE = {"inn": [[0, 150, 10, 110], [1, 151, 3, 90]], "w": 1, "fi": 0}      # all out, then the target chased: a complete match
T20_RAIN = {"inn": [[0, 120, 3, 72], [1, 60, 2, 48]], "w": 1, "fi": 0}             # 12 overs each: cut short


def test_d_a_complete_match_is_not_void_unless_the_weather_is_flagged():
    M = matches({**T20_COMPLETE, "q": 0}, {**T20_COMPLETE, "q": 1}, {**T20_RAIN, "q": 0}, {**T20_COMPLETE, "q": 0, "f": 2}, {**T20_COMPLETE, "q": 0},
                {"inn": [[0, 180, 6, 120], [1, 150, 7, 120]], "w": 0, "fi": 0, "q": 0})   # both innings full length: complete, and void anyway
    c = G.check_complete_not_void(M)
    assert c.level == G.HARD and c.checked == 5            # the Test is out of scope
    assert [p.split(" ")[0] for p in c.problems] == ["m0", "m4", "m5"]
    M["dls"] = [1, 0, 0, 0, 1, 0]                          # the build flags m0 and m4 as decided by a weather adjustment
    assert [p.split(" ")[0] for p in G.check_complete_not_void(M).problems] == ["m5"]


def test_d_a_chase_that_ends_early_or_a_side_bowled_out_is_complete_but_a_win_by_the_side_batting_first_with_the_second_incomplete_is_not():
    chase = {"inn": [[0, 150, 6, 120], [1, 151, 3, 70]], "w": 1, "fi": 0}
    def_ = {"inn": [[0, 150, 6, 120], [1, 100, 9, 70]], "w": 0, "fi": 0}          # second innings short, not all out, target not reached
    assert G.complete_match(matches(chase), 0) and not G.complete_match(matches(def_), 0)
    assert not G.complete_match(matches({"inn": [[0, 150, 6, 120]]}), 0)


def test_d_the_share_of_void_matches_per_format_per_week_warns_above_a_fifth():
    week = lambda day, n, void: [{"d": day, "q": 0 if k < void else 1} for k in range(n)]  # noqa: E731
    M = matches(*week("2026-10-27", 12, 4), *week("2026-10-20", 12, 2), *week("2026-10-13", 5, 5), *[{**r, "f": 1} for r in week("2026-10-28", 10, 2)], {"d": "2026-10-28", "q": -1}, {"d": "2025-01-01", "q": 0})
    share = G.void_share(M, TODAY)
    assert share[("T20", "2026-W44")] == (4, 12) and share[("T20", "2026-W43")] == (2, 12) and share[("T20", "2026-W42")] == (5, 5) and share[("ODI", "2026-W44")] == (2, 10)
    c = G.check_void_share(M, TODAY)
    assert c.level == G.WARN
    assert c.problems == ["T20 2026-W44: 4 of 12 matches void (33%)"]    # W43 is 17%, W42 has too few matches, the ODIs are 20%
    assert "T20 11 of 29" in c.note


# ------------------------------------------------------------------ e
def doc(match_id="m", innings=None, **k):
    pl = [{"team": "A", "runs": "100"}, {"team": "A", "runs": "60"}, {"team": "B", "runs": "90"}, {"team": "B", "runs": "50"}]
    return {"match_id": match_id, "match_type": "T20", "players": pl, **({"innings": innings} if innings is not None else {}), **k}


def test_e_a_stated_total_is_the_batters_plus_extras_and_the_ball_by_ball_total():
    balls = {"m": {"A": (176, 16), "B": (140, 0)}}
    ok = doc(innings=[{"team": "A", "runs": 176, "wickets": 3, "balls": 120}, {"team": "B", "runs": 140, "wickets": 10, "balls": 110}])
    assert G.check_scraped_totals([ok], balls).problems == []
    # the 192/4 that read 176/3: the batters' 160 + 16 extras, the source stating 192, the ball by ball 192 would pass; a ball-by-ball 170 does not
    wrong = doc(innings=[{"team": "A", "runs": 176, "wickets": 3, "balls": 120}])
    c = G.check_scraped_totals([wrong], {"m": {"A": (170, 16)}})
    assert c.level == G.WARN and c.problems == ["m a: stated 176, batters 160 + extras 16 = 176, ball by ball 170"]


def test_e_a_stated_total_below_the_batters_runs_and_ball_by_ball_that_disagrees_with_the_scorecard():
    assert G.check_scraped_totals([doc(innings=[{"team": "A", "runs": 150}])], None).problems == ["m a: the stated 150 is below the batters' 160"]
    c = G.check_scraped_totals([doc()], {"m": {"A": (137, 17), "B": (140, 0)}})                      # no stated summary: the batters + the ball by ball's extras must make its total
    assert c.problems == ["m a: stated -, batters 160 + extras 17 = 177, ball by ball 137"] and c.checked == 2
    assert G.check_scraped_totals([doc(match_type="Test", innings=[{"team": "A", "runs": 1}])], None).checked == 0   # four innings: out of scope


def test_e_ball_totals_sum_the_first_two_innings_of_each_match(tmp_path):
    (tmp_path / "balls").mkdir()
    rows = [("m", "1", "A", "4", "0"), ("m", "1", "A", "7", "5"), ("m", "2", "B", "6", "1"), ("m", "3", "A", "6", "0"), ("other", "1", "C", "9", "0")]
    with gzip.open(tmp_path / "balls" / "2026-11.csv.gz", "wt", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["match_id", "innings", "team_name", "total", "extra_runs"])
        w.writerows(rows)
    assert G.ball_totals(tmp_path, {"m"}) == {"m": {"A": (11, 5), "B": (6, 1)}}


# ------------------------------------------------------------------ f
def test_f_one_pair_of_sides_is_not_two_fixtures_within_12_hours():
    rows = [fx("Dolphins", "Rocks", "2026-11-01T23:30Z", "Upcoming", "src"), fx("Dolphins", "Boland", "2026-11-02T01:00Z", "Upcoming", "books"),     # Boland is the books' name for Rocks
            fx("India", "Pakistan", "2026-11-01T08:00Z", "Upcoming", "src"), fx("India", "Pakistan", "2026-11-01T21:00Z", "Upcoming", "src"),         # 13 h apart: two matches
            fx("India", "Pakistan", "2026-11-01T08:00Z", "Upcoming", "src", gender="female"),                                                       # the women's side is another pair
            fx("Aus", "SA", "2026-10-27T08:30Z", "Live", "src", fmt="Test"), fx("Aus", "SA", "2026-10-27T11:30Z", "Started", "books", fmt="Test")]
    c = G.check_duplicate_fixtures(rows)
    assert c.level == G.HARD and len(c.problems) == 2
    assert "Dolphins v Rocks" in c.problems[0] and "1.5 h apart" in c.problems[0] and c.problems[1].startswith("Aus v SA")


# ------------------------------------------------------------------ g
def test_g_priced_players_without_a_link_are_listed():
    c = G.check_unlinked([{"name": "Kusal Mendis", "pid": "ab12", "why": "no source player with that name"}], 480)
    assert c.level == G.WARN and c.checked == 481 and c.problems == ["Kusal Mendis (`ab12`): no source player with that name"]
    assert G.check_unlinked([], 480).problems == [] and G.check_unlinked(None).problems == []


# ------------------------------------------------------------------ the run
def site_dir(tmp_path, fixtures, lines=None, review=None, M=None, name="site"):
    d = tmp_path / name
    d.mkdir()
    (d / "matches.json").write_text(json.dumps(M or matches({**T20_COMPLETE})))
    (d / "fixtures.json").write_text(json.dumps(fixtures))
    (d / "lines.json").write_text(json.dumps(lines or {"generated_at_utc": "2026-11-02T09:50:00Z", "lines": [], "events": [], "fancy": []}))
    (d / "meta.json").write_text(json.dumps({"identity_linked": 480}))
    if review is not None:
        (d / "identity_review.json").write_text(json.dumps(review))
    return d


def test_the_run_fails_the_build_only_for_a_hard_check(tmp_path, monkeypatch):
    monkeypatch.setattr(G, "engine_editions", lambda site: [])
    summary = tmp_path / "summary.md"
    args = ["--data", str(tmp_path / "none"), "--summary", str(summary), "--now", "2026-11-02T10:00Z"]
    good = site_dir(tmp_path, [fx(status="Started", start="2026-11-02T06:30Z"), fx("A", "B", status="Upcoming", source="src", start="2026-11-03T07:30Z")], review=[{"name": "Kusal Mendis", "pid": "ab12", "why": "x"}])
    assert G.main(["--site", str(good), *args]) == 0     # only a warning (an unlinked player)
    text = summary.read_text()
    assert text.startswith("### Data guard: passed") and "| g |" in text and "warn (1)" in text and "Kusal Mendis" in text
    summary.unlink()
    bad = site_dir(tmp_path, [fx(status="Live", source="books", start="2026-11-02T06:30Z")], name="bad")
    assert G.main(["--site", str(bad), *args]) == 1
    assert "### Data guard: FAILED, 1 hard check" in summary.read_text() and "FAIL (1)" in summary.read_text()


def test_a_missing_build_is_an_error_not_a_pass(tmp_path, capsys):
    assert G.main(["--site", str(tmp_path / "nothing"), "--data", str(tmp_path)]) == 2
    assert "::error" in capsys.readouterr().out


def test_the_live_body_is_read_from_a_file_and_an_unreadable_one_is_skipped(tmp_path):
    p = tmp_path / "live.json"
    p.write_text(json.dumps({"matches": []}))
    assert G.load_live(str(p)) == {"matches": []} and G.load_live(str(tmp_path / "nope.json")) is None
    p.write_text(json.dumps({"v": 1, "iv": "AAAA", "ct": "AAAA"}))
    assert G.load_live(str(p)) is None                      # still wrapped (no key): skipped, not a finding


def test_the_windows_equal_the_ones_the_site_and_the_pipeline_use():
    js = (ROOT / "site" / "packages" / "engine" / "lines.js").read_text()
    assert int(re.search(r"BOOK_KEEP_MS = (\d+) \* 3600e3", js).group(1)) * 3600 == G.KEEP_S
    assert int(re.search(r"TEST_KEEP_MS = (\d+) \* 24 \* 3600e3", js).group(1)) * 24 * 3600 == G.TEST_KEEP_S
    from value_bets.booklines import LIVE_KEEP, TEST_KEEP

    assert (LIVE_KEEP.total_seconds(), TEST_KEEP.total_seconds()) == (G.CARRY_S, G.TEST_CARRY_S)
