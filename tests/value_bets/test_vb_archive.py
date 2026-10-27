import datetime as dt
import json

from value_bets.archive import fixture_id, group, team_key, update

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
