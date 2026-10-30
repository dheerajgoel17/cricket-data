import datetime as dt
import json
import re
from pathlib import Path

import pytest

from value_bets import archive as arch
from value_bets.archive import backfill, fixture_id, group, main, match_results, settle, team_key, update

START = "2026-10-27T07:00:00Z"
SCHED = [{"start_utc": "2026-10-27T07:00Z", "format": "T20", "gender": "male", "team_a": "New Zealand", "team_b": "India", "venue": "Eden Park", "series": "NZ v IND", "status": "Upcoming"}]


def at(h, d=26):
    return dt.datetime(2026, 10, d, h, 0, tzinfo=dt.timezone.utc)


def line(pid="ab12", player="Abhishek Sharma", stat="runs", ln=17.5, books=(("bet365", 1.85, 1.95),), **kw):
    return {"pid": pid, "player": player, "book_name": player, "team": "India", "fmt": "T20", "stat": stat, "line": ln, "match": "New Zealand vs India",
            "competition": "NZ v IND - 3rd T20", "start_utc": START, "books": [{"source": s, "kind": "bookmaker", "over": o, "under": u} for s, o, u in books], **kw}


def book(lines=(), fancy=(), events=True):
    ev = [{"match": "New Zealand vs India", "competition": "NZ v IND - 3rd T20", "start_utc": START, "markets": ["batter_runs"], "sources": ["bet365"], "n": 10}] if events else []
    return {"generated_at_utc": "t", "lines": list(lines), "events": ev, "fancy": list(fancy)}


def fancy(ln=198.5, **kw):
    return {"match": "New Zealand vs India", "home": "New Zealand", "away": "India", "start_utc": START, "key": "first_innings_runs", "scope": "match", "team": None,
            "line": ln, "over": 1.833, "under": 1.833, "source": "bet365", "kind": "bookmaker", **kw}


def read(tmp_path, fid="2026-10-27-new-zealand-v-india"):
    return json.loads((tmp_path / fid[:7] / f"{fid}.json").read_text())


def test_a_match_is_filed_under_the_fixture_id_with_the_shared_fields_once(tmp_path):
    wrote, bad = update(tmp_path, book([line()], [fancy()]), at(20), None, SCHED)
    assert wrote == ["2026-10-27-new-zealand-v-india"] and bad == []
    d = read(tmp_path)
    assert (d["match"], d["competition"], d["start_utc"]) == ("New Zealand vs India", "NZ v IND - 3rd T20", START)
    assert d["fixture"] == {"id": d["id"], "start": "2026-10-27T07:00Z", "fmt": "T20", "gender": "male", "a": "New Zealand", "b": "India", "venue": "Eden Park", "series": "NZ v IND"}
    assert d["first_seen"] == d["updated"] == "2026-10-26T20:00:00Z"
    assert not {"match", "competition", "start_utc"} & set(d["lines"][0]) and d["lines"][0]["line"] == 17.5
    assert [x["line"] for x in d["fancy"]] == [198.5] and d["events"][0]["n"] == 10


def test_the_pipelines_own_fixture_match_wins_and_without_any_schedule_the_id_comes_from_the_books(tmp_path):
    fx = {"start_utc": "2026-10-27T07:00Z", "format": "T20", "gender": "male", "team_a": "India", "team_b": "NZ", "venue": "", "series": ""}
    assert update(tmp_path, book([line()]), at(20), {("New Zealand vs India", START): fx})[0] == ["2026-10-27-india-v-nz"]
    assert update(tmp_path, book([line()]), at(20))[0] == ["2026-10-27-new-zealand-v-india"] and read(tmp_path)["fixture"] is None


def test_a_file_only_grows_and_prices_move_only_in_the_last_three_hours(tmp_path):
    update(tmp_path, book([line(), line(pid="cd34", player="Tilak Varma", ln=22.5)]), at(20), None, SCHED)
    # a day out: a new line is added, the price of a line already there is left as it was
    update(tmp_path, book([line(books=(("bet365", 1.70, 2.10),)), line(ln=24.5)]), at(21), None, SCHED)
    d = read(tmp_path)
    assert [(x["player"], x["line"], x["books"][0]["over"]) for x in d["lines"]] == [("Abhishek Sharma", 17.5, 1.85), ("Abhishek Sharma", 24.5, 1.85), ("Tilak Varma", 22.5, 1.85)]
    # inside the last 3 hours: the closing price replaces it, and a line the books no longer list stays
    update(tmp_path, book([line(books=(("bet365", 1.70, 2.10),))]), at(4, 27), None, SCHED)
    d = read(tmp_path)
    assert [(x["line"], x["books"][0]["over"]) for x in d["lines"] if x["player"] == "Abhishek Sharma"] == [(17.5, 1.70), (24.5, 1.85)]
    assert [x["player"] for x in d["lines"]] == ["Abhishek Sharma", "Abhishek Sharma", "Tilak Varma"]


def test_a_book_that_stops_pricing_a_line_is_kept_beside_the_one_that_still_does(tmp_path):
    update(tmp_path, book([line(books=(("bet365", 1.85, 1.95),))]), at(20), None, SCHED)
    update(tmp_path, book([line(books=(("smarkets", 1.9, 2.0),))]), at(4, 27), None, SCHED)
    assert [(b["source"], b["over"]) for b in read(tmp_path)["lines"][0]["books"]] == [("bet365", 1.85), ("smarkets", 1.9)]


def test_an_unchanged_pull_writes_nothing_and_a_pull_without_the_match_deletes_nothing(tmp_path):
    update(tmp_path, book([line()]), at(20), None, SCHED)
    p = tmp_path / "2026-10" / "2026-10-27-new-zealand-v-india.json"
    before = p.read_text()
    assert update(tmp_path, book([line()]), at(21), None, SCHED)[0] == []
    assert update(tmp_path, book(), at(22, 28), None, SCHED)[0] == [] and update(tmp_path, {}, at(23, 28))[0] == []
    assert p.read_text() == before


def test_the_feed_key_is_published_under_the_books_name(tmp_path):
    update(tmp_path, book([line(books=(("moviodds_bet365", 1.85, 1.95),))]), at(20), None, SCHED)
    assert "moviodds" not in (tmp_path / "2026-10" / "2026-10-27-new-zealand-v-india.json").read_text()


def test_a_file_that_cannot_be_read_is_left_as_it_is(tmp_path):
    p = tmp_path / "2026-10" / "2026-10-27-new-zealand-v-india.json"
    p.parent.mkdir(parents=True)
    p.write_text('{"id": ')
    assert update(tmp_path, book([line()]), at(20), None, SCHED) == ([], ["2026-10-27-new-zealand-v-india"]) and p.read_text() == '{"id": '


def test_fancy_lines_join_their_match_even_when_the_feeds_disagree_on_the_start_and_the_names():
    b = book([line()], [fancy(start_utc="2026-10-27T08:00:00Z", home="New Zealand (W)", away="India Women", match="New Zealand Women vs India Women")])
    g = group(b)
    assert len(g) == 1 and len(g[0]["fancy"]) == 1 and len(g[0]["lines"]) == 1
    assert len(group(book([line()], [fancy(start_utc="2026-10-27T22:00:00Z")]))) == 2  # a different day's match between the same sides is its own file


def test_the_ids_agree_with_the_ones_the_site_builder_gives_a_fixture(tmp_path):
    from cricket_site.build import build_fixtures
    (tmp_path / "fixtures").mkdir()
    (tmp_path / "fixtures" / "upcoming.csv").write_text("start_utc,match_id,series,format,gender,team_a,team_b,venue,status,url,result\n"
                                                         "2026-10-27T07:00Z,x,S,T20,male,Côte d'Ivoire,India A,V,Upcoming,,\n")
    (f,) = build_fixtures(tmp_path, None, {})
    assert f["id"] == fixture_id("2026-10-27T07:00Z", "Côte d'Ivoire", "India A")
    assert team_key("India (W)") == team_key("India Women") == "india"
    assert team_key("Auckland Aces") == team_key("Auckland") and team_key("Northern Districts") == team_key("Northern Brave")


def test_same_side_is_the_sites():
    src = (Path(__file__).resolve().parents[2] / "site" / "src" / "engine" / "util.js").read_text()
    js = dict(re.findall(r'(\w+): "(\w+)"', re.search(r"SAME_SIDE = \{(.*?)\}", src).group(1)))
    assert js == arch.SAME_SIDE


def without_name(**kw):
    ln = line(**kw)
    del ln["book_name"]  # how every line was filed before the field existed
    return ln


def test_a_later_pull_gives_a_line_filed_without_the_books_name_its_name_and_leaves_the_price(tmp_path):
    update(tmp_path, book([without_name()]), at(20), None, SCHED)
    update(tmp_path, book([line(books=(("bet365", 1.70, 2.10),), book_name="A Sharma")]), at(21), None, SCHED)  # a day out: the price stays as filed
    (x,) = read(tmp_path)["lines"]
    assert x["book_name"] == "A Sharma" and x["books"][0]["over"] == 1.85


def test_backfill_adds_the_books_name_where_the_archive_knows_exactly_one_and_changes_nothing_else(tmp_path):
    ab, cd, ef = ("ab12", "Abhishek Sharma"), ("cd34", "Tilak Varma"), ("ef56", "Rinku Singh")
    update(tmp_path, book([line(*ab, book_name="A Sharma"), without_name(pid=ab[0], player=ab[1], stat="sixes", ln=1.5),
                           line(*cd, ln=22.5, book_name="T Varma"), line(*cd, stat="fours", ln=2.5, book_name="Tilak V"), without_name(pid=cd[0], player=cd[1], stat="sixes", ln=0.5),
                           without_name(pid=ef[0], player=ef[1])]), at(20), None, SCHED)
    path = tmp_path / "2026-10" / "2026-10-27-new-zealand-v-india.json"
    before = json.loads(path.read_text())
    assert backfill(tmp_path) == ["2026-10-27-new-zealand-v-india"]
    after = json.loads(path.read_text())
    got = {(x["pid"], x["stat"]): x.get("book_name") for x in after["lines"]}
    assert got[("ab12", "sixes")] == "A Sharma", "one name for him across the archive"
    assert got[("cd34", "sixes")] is None, "two spellings: not guessed"
    assert got[("ef56", "runs")] is None, "no name anywhere"
    for x in after["lines"]:
        x.pop("book_name", None)
    for x in before["lines"]:
        x.pop("book_name", None)
    assert after == before, "lines, prices and the update time are as they were"
    assert backfill(tmp_path) == [], "nothing left to add"


def test_backfill_takes_names_from_the_current_book_file_too_and_leaves_an_unreadable_file_alone(tmp_path):
    update(tmp_path, book([without_name()]), at(20), None, SCHED)
    bad = tmp_path / "2026-10" / "2026-10-28-broken.json"
    bad.write_text('{"id": ')
    assert backfill(tmp_path, book([line(book_name="A Sharma")])) == ["2026-10-27-new-zealand-v-india"]
    assert read(tmp_path)["lines"][0]["book_name"] == "A Sharma" and bad.read_text() == '{"id": '


# ---- results: what finished matches decided, stored once the live route reports the match final

def settled(pid, stat, ln, value, state="final", **kw):
    return {"pid": pid, "stat": stat, "line": ln, "value": value, "state": state, "verdict": None, **kw}


def live_match(lines, status="final", start="2026-10-27T07:00:00.000Z", mid="12JE", sides=("New Zealand", "India")):
    return {"id": mid, "status": status, "start": start, "teams": [{"name": n} for n in sides], "lines": lines}


def filed(tmp_path, *lines):
    update(tmp_path, book(list(lines) or [line(), line(stat="sixes", ln=1.5), line(pid="cd34", player="Tilak Varma", ln=22.5)]), at(20), None, SCHED)


NOW = at(18, 27)


def test_only_settled_lines_of_a_finished_match_are_results_and_one_value_per_player_and_stat():
    m = live_match([settled("ab12", "runs", 17.5, 31), settled("ab12", "runs", 24.5, 31), settled("ab12", "sixes", 1.5, 2, state="live"),
                    settled("cd34", "runs", 22.5, None, notInXI=True), settled("ef56", "wickets", 0.5, 0), settled("gh78", "runs", 9.5, 4), settled("gh78", "runs", 14.5, 5)])
    assert match_results(m) == {("ab12", "runs", 0): 31, ("ef56", "wickets", 0): 0}  # a zero is a result; "so far", not-in-XI and a player whose lines disagree are not
    assert match_results({**m, "status": "live"}) == {} and match_results({}) == {}


def test_results_are_added_to_the_matchs_file_for_priced_lines_only(tmp_path):
    filed(tmp_path)
    before = read(tmp_path)
    m = live_match([settled("ab12", "runs", 17.5, 31), settled("ab12", "sixes", 1.5, 2), settled("cd34", "runs", 22.5, 0), settled("zz99", "runs", 9.5, 7), settled("ab12", "fours", 2.5, 3)])
    assert settle(tmp_path, [{"matches": [m]}, {"matches": [m]}], NOW) == (["2026-10-27-new-zealand-v-india"], [])
    d = read(tmp_path)
    assert d["results"] == [{"pid": "ab12", "stat": "runs", "value": 31}, {"pid": "ab12", "stat": "sixes", "value": 2}, {"pid": "cd34", "stat": "runs", "value": 0}]  # not zz99 or fours: never priced
    assert d["updated"] == "2026-10-27T18:00:00Z"
    assert {k: v for k, v in d.items() if k not in ("results", "updated")} == {k: v for k, v in before.items() if k != "updated"}, "nothing else in the file moves"


def test_a_result_needs_every_read_to_agree_so_a_card_behind_the_last_ball_is_never_written_down(tmp_path):
    filed(tmp_path)
    a = live_match([settled("ab12", "runs", 17.5, 31), settled("cd34", "runs", 22.5, 18)])
    b = live_match([settled("ab12", "runs", 17.5, 31), settled("cd34", "runs", 22.5, 22)])  # the second read has Tilak four runs further on
    settle(tmp_path, [{"matches": [a]}, {"matches": [b]}], NOW)
    assert read(tmp_path)["results"] == [{"pid": "ab12", "stat": "runs", "value": 31}]
    assert settle(tmp_path, [{"matches": [a]}, {"matches": []}], NOW) == ([], []), "a match missing from the second read is not trusted"
    assert settle(tmp_path, [{"matches": [live_match([settled("cd34", "runs", 22.5, 22)], status="live")]}], NOW) == ([], []), "nothing is stored while the match is on"


def test_a_stored_result_is_never_changed_and_a_missing_one_can_still_be_added(tmp_path):
    filed(tmp_path)
    settle(tmp_path, [{"matches": [live_match([settled("ab12", "runs", 17.5, 31)])]}], NOW)
    later = live_match([settled("ab12", "runs", 17.5, 99), settled("cd34", "runs", 22.5, 18)])  # a later read disagrees about the first and brings the second
    assert settle(tmp_path, [{"matches": [later]}], at(19, 27))[0] == ["2026-10-27-new-zealand-v-india"]
    assert read(tmp_path)["results"] == [{"pid": "ab12", "stat": "runs", "value": 31}, {"pid": "cd34", "stat": "runs", "value": 18}]
    assert settle(tmp_path, [{"matches": [later]}], at(20, 27)) == ([], []), "nothing new, nothing written"


def test_results_go_to_the_file_of_that_match_not_the_next_game_of_the_series_and_an_unreadable_file_is_left_alone(tmp_path):
    update(tmp_path, book([line()]), at(20), None, SCHED)
    nxt = line(match="New Zealand vs India", start_utc="2026-10-30T07:00:00Z")
    sched2 = [*SCHED, {**SCHED[0], "start_utc": "2026-10-30T07:00Z"}]
    update(tmp_path, {**book([nxt]), "events": []}, at(20), None, sched2)
    assert (tmp_path / "2026-10" / "2026-10-30-new-zealand-v-india.json").exists()
    m = live_match([settled("ab12", "runs", 17.5, 31)])
    assert settle(tmp_path, [{"matches": [m]}], NOW)[0] == ["2026-10-27-new-zealand-v-india"]
    assert "results" not in read(tmp_path, "2026-10-30-new-zealand-v-india")
    bad = tmp_path / "2026-10" / "2026-10-27-broken.json"
    bad.write_text('{"id": ')
    assert settle(tmp_path, [{"matches": [live_match([settled("ab12", "runs", 17.5, 40)])]}], NOW)[1] == ["2026-10-27-broken"] and bad.read_text() == '{"id": '


def test_the_hourly_pull_keeps_the_results_and_still_writes_nothing_when_nothing_changed(tmp_path):
    filed(tmp_path)
    settle(tmp_path, [{"matches": [live_match([settled("ab12", "runs", 17.5, 31)])]}], NOW)
    p = tmp_path / "2026-10" / "2026-10-27-new-zealand-v-india.json"
    before = p.read_text()
    assert update(tmp_path, book([line()]), at(21, 27), None, SCHED)[0] == [] and p.read_text() == before
    update(tmp_path, book([line(ln=24.5)]), at(22, 27), None, SCHED)  # a pull that does add a line rewrites the file; the results ride along
    assert read(tmp_path)["results"] == [{"pid": "ab12", "stat": "runs", "value": 31}] and len(read(tmp_path)["lines"]) == 4


def test_the_command_reads_the_route_twice_and_a_route_that_is_down_costs_nothing(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(arch.config, "ARCHIVE", tmp_path)
    filed(tmp_path)
    body = tmp_path / "live.json"
    body.write_text(json.dumps({"matches": [live_match([settled("ab12", "runs", 17.5, 31)])]}))
    slept = []
    assert main(["--results", str(body)], sleep=slept.append) == 0
    assert read(tmp_path)["results"] == [{"pid": "ab12", "stat": "runs", "value": 31}] and json.loads(capsys.readouterr().out)["results_written"] == ["2026-10-27-new-zealand-v-india"]
    body.write_text(json.dumps({"matches": [live_match([], status="live")]}))
    slept.clear()
    assert main(["--results", str(body)], sleep=slept.append) == 0 and json.loads(capsys.readouterr().out)["results_written"] == [] and slept == [], "no finished match: nothing read twice, nothing written"
    monkeypatch.setattr(arch, "_read_body", lambda src: {"matches": [live_match([settled("cd34", "runs", 22.5, 18)])]})
    assert main(["--results", "https://site.test/api/live", "--again", "45"], sleep=slept.append) == 0 and slept == [45.0], "a URL is read again after the pause"
    assert read(tmp_path)["results"] == [{"pid": "ab12", "stat": "runs", "value": 31}, {"pid": "cd34", "stat": "runs", "value": 18}]
    capsys.readouterr()
    monkeypatch.undo()
    monkeypatch.setattr(arch.config, "ARCHIVE", tmp_path)
    assert main(["--results", str(tmp_path / "missing.json")], sleep=slept.append) == 0 and "::warning::" in capsys.readouterr().out
    body.write_text("not json")
    assert main(["--results", str(body)], sleep=slept.append) == 0 and "::warning::" in capsys.readouterr().out
    with pytest.raises(SystemExit):
        main(["--results"])


def test_a_wrapped_live_body_is_read_with_the_wrap_key(tmp_path, monkeypatch, capsys):
    from cricket_site.wrap import wrap
    monkeypatch.setattr(arch.config, "ARCHIVE", tmp_path)
    filed(tmp_path)
    plain = {"matches": [live_match([settled("ab12", "runs", 17.5, 31)])]}
    body = tmp_path / "live.json"
    body.write_text(json.dumps(wrap(plain, "ci-test-key")))
    monkeypatch.setenv("DATA_WRAP_KEY", "ci-test-key")
    assert main(["--results", str(body)], sleep=lambda *_: None) == 0
    assert read(tmp_path)["results"] == [{"pid": "ab12", "stat": "runs", "value": 31}]
    capsys.readouterr()
    monkeypatch.delenv("DATA_WRAP_KEY", raising=False)
    body.write_text(json.dumps(wrap(plain, "ci-test-key")))
    assert main(["--results", str(body)], sleep=lambda *_: None) == 0
    assert "::warning::" in capsys.readouterr().out, "ciphertext without a key is not stored as a result"


# ---- a Test's first-innings lines are lines of their own

def test_a_first_innings_line_is_not_the_match_total_line_of_the_same_player_stat_and_number(tmp_path):
    test_line = lambda **kw: line(**{"fmt": "Test", "ln": 26.5, **kw})  # noqa: E731
    pull = book([test_line(), test_line(inn=1, books=(("Alpha", 2.0, 1.73),)), test_line(inn=1, ln=36.5, books=(("Alpha", 2.1, 1.61),)), test_line(inn=2)])
    update(tmp_path, pull, at(20), None, SCHED)
    d = read(tmp_path)
    assert [(x.get("inn", 0), x["line"]) for x in d["lines"]] == [(0, 26.5), (1, 26.5), (1, 36.5), (2, 26.5)], "four lines, not three: ordered match, 1st, 2nd"
    assert "inn" not in d["lines"][0], "a match-total line reads exactly as the ones filed before the field existed"
    # seen again a day out: the price of the first-innings line stays, a new first-innings line is added beside it
    update(tmp_path, book([test_line(inn=1, books=(("Alpha", 1.5, 2.6),)), test_line(inn=1, ln=41.5)]), at(21), None, SCHED)
    d = read(tmp_path)
    assert [(x.get("inn", 0), x["line"], x["books"][0]["over"]) for x in d["lines"] if x.get("inn") == 1] == [(1, 26.5, 2.0), (1, 36.5, 2.1), (1, 41.5, 1.85)]
    # inside the last 3 hours the closing price replaces it, for that innings only
    update(tmp_path, book([test_line(inn=1, books=(("Alpha", 1.5, 2.6),))]), at(4, 27), None, SCHED)
    d = read(tmp_path)
    assert [(x.get("inn", 0), x["books"][0]["over"]) for x in d["lines"] if x["line"] == 26.5] == [(0, 1.85), (1, 1.5), (2, 1.85)]


def test_a_file_filed_before_innings_lines_existed_keeps_its_order_and_content(tmp_path):
    update(tmp_path, book([line(), line(ln=24.5), line(pid="cd34", player="Tilak Varma", ln=22.5)]), at(20), None, SCHED)
    p = tmp_path / "2026-10" / "2026-10-27-new-zealand-v-india.json"
    before = p.read_text()
    assert update(tmp_path, book([line(), line(ln=24.5), line(pid="cd34", player="Tilak Varma", ln=22.5)]), at(21), None, SCHED)[0] == [] and p.read_text() == before
    assert all("inn" not in x for x in json.loads(before)["lines"])


def test_fancy_lines_of_an_innings_are_kept_apart_from_the_whole_match_ones(tmp_path):
    team = lambda **kw: fancy(ln=360.5, key="team_total_runs", scope="team", team="Bangladesh", **kw)  # noqa: E731
    update(tmp_path, book([line(fmt="Test")], [team(), team(inn=1), team(inn=2)]), at(20), None, SCHED)
    assert [(x.get("inn", 0), x["line"]) for x in read(tmp_path)["fancy"]] == [(0, 360.5), (1, 360.5), (2, 360.5)]


def test_innings_results_are_stored_beside_the_match_ones_and_never_mix_with_them(tmp_path):
    filed(tmp_path, line(fmt="Test", ln=72.5), line(fmt="Test", ln=26.5, inn=1), line(fmt="Test", ln=26.5, inn=2))
    m = live_match([settled("ab12", "runs", 72.5, 80, state="live"), settled("ab12", "runs", 26.5, 31, inn=1), settled("ab12", "runs", 26.5, 12, inn=2, state="live"),
                    settled("ab12", "runs", 99.5, 31, inn=1)], status="live")
    assert match_results(m) == {("ab12", "runs", 1): 31}, "an over is settled when its innings is, even with the match still on; the match total and the 2nd innings are not"
    assert settle(tmp_path, [{"matches": [m]}, {"matches": [m]}], NOW)[0] == ["2026-10-27-new-zealand-v-india"]
    assert read(tmp_path)["results"] == [{"pid": "ab12", "stat": "runs", "inn": 1, "value": 31}]
    done = live_match([settled("ab12", "runs", 72.5, 80), settled("ab12", "runs", 26.5, 99, inn=1), settled("ab12", "runs", 26.5, 12, inn=2)])  # the match is over; the stored 1st innings stays
    assert settle(tmp_path, [{"matches": [done]}], at(19, 27))[0] == ["2026-10-27-new-zealand-v-india"]
    assert read(tmp_path)["results"] == [{"pid": "ab12", "stat": "runs", "value": 80}, {"pid": "ab12", "stat": "runs", "inn": 1, "value": 31}, {"pid": "ab12", "stat": "runs", "inn": 2, "value": 12}]
    assert settle(tmp_path, [{"matches": [done]}], at(20, 27)) == ([], [])


def test_a_result_for_an_innings_nobody_priced_is_not_stored(tmp_path):
    filed(tmp_path, line(fmt="Test", ln=72.5))
    m = live_match([settled("ab12", "runs", 26.5, 31, inn=1)], status="live")
    assert settle(tmp_path, [{"matches": [m]}], NOW) == ([], []), "only the match total was priced"


def test_the_command_reads_a_live_route_twice_when_an_innings_is_settled(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(arch.config, "ARCHIVE", tmp_path)
    filed(tmp_path, line(fmt="Test", ln=26.5, inn=1))
    body = tmp_path / "live.json"
    body.write_text(json.dumps({"matches": [live_match([settled("ab12", "runs", 26.5, 31, inn=1)], status="live")]}))
    slept = []
    monkeypatch.setattr(arch, "_read_body", lambda src: json.loads(body.read_text()))
    assert main(["--results", "https://site.test/api/live", "--again", "30"], sleep=slept.append) == 0 and slept == [30.0]
    assert read(tmp_path)["results"] == [{"pid": "ab12", "stat": "runs", "inn": 1, "value": 31}] and json.loads(capsys.readouterr().out)["results_written"]
