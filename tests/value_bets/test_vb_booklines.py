import datetime as dt
import json

from value_bets.booklines import book_lines, carry_started, hold_started, prop_events, public


def row(**kw):
    base = {"event_key": "e1", "market_type": "batter_runs", "player_id": "ab12", "player_hist_name": "Abhishek Sharma", "player_team": "India",
            "fmt": "T20", "match": "India vs NZ", "competition": "T20I", "start_utc": "2026-10-27T07:00:00Z", "in_play": False,
            "line": 17.5, "side": "over", "back": 1.85, "source": "moviodds_bet365", "source_type": "bookmaker"}
    base.update(kw)
    return base


def test_two_sided_line_is_kept_with_both_decimal_prices():
    out = book_lines([row(), row(side="under", back=1.95)], "2026-10-26T10:00:00Z")
    assert out["generated_at_utc"] == "2026-10-26T10:00:00Z"
    (ln,) = out["lines"]
    assert (ln["pid"], ln["stat"], ln["line"], ln["fmt"], ln["team"]) == ("ab12", "runs", 17.5, "T20", "India")
    assert ln["books"] == [{"source": "bet365", "kind": "bookmaker", "over": 1.85, "under": 1.95}]


def test_a_line_carries_the_name_the_book_uses_for_the_player():
    ln = book_lines([row(player="Kusal Mendis", player_hist_name="BKG Mendis"), row(side="under", back=1.95, player="Kusal Mendis", player_hist_name="BKG Mendis")], "t")["lines"][0]
    assert ln["player"] == "BKG Mendis" and ln["book_name"] == "Kusal Mendis"  # the live source says Kusal Mendis too


def test_two_sources_are_listed_separately_and_alt_lines_are_separate_entries():
    rows = [row(), row(side="under", back=1.95), row(source="smarkets", source_type="exchange", back=1.9), row(source="smarkets", source_type="exchange", side="under", back=2.0),
            row(line=22.5, back=2.4), row(line=22.5, side="under", back=1.55)]
    out = book_lines(rows, "t")["lines"]
    assert [x["line"] for x in out] == [17.5, 22.5]
    assert [b["source"] for b in out[0]["books"]] == ["bet365", "smarkets"]  # published under the book's name
    assert out[1]["books"][0]["over"] == 2.4


def test_unmatched_in_play_and_unknown_markets_are_dropped_and_an_under_alone_is_not_a_line():
    rows = [row(player_id=None, line=1.5), row(player_id=None, line=1.5, side="under"),  # player not matched to the registry
            row(in_play=True, line=30.5), row(in_play=True, line=30.5, side="under"),
            row(market_type="batter_milestone", line=49.5), row(market_type="batter_milestone", line=49.5, side="under"),
            row(fmt=None, line=9.5), row(fmt=None, line=9.5, side="under"),
            row(line=5.5, back=None), row(line=5.5, side="under", back=None)]  # no price at all
    assert book_lines(rows, "t")["lines"] == []


def test_a_book_quoting_one_side_per_line_is_kept_and_player_performance_is_the_points_stat():
    """An exchange's session Yes (over Ly - 0.5) and No (under Ln - 0.5) sit on different lines, so a line can have an over price and no under."""
    out = book_lines([row(), row(line=33.5, market_type="player_points", back=2.0), row(line=31.5, market_type="player_points", side="under", back=1.87)], "t")["lines"]
    assert [(x["stat"], x["line"], x["books"][0]["over"], x["books"][0]["under"]) for x in out] == [("points", 31.5, None, 1.87), ("points", 33.5, 2.0, None), ("runs", 17.5, 1.85, None)]  # the No is a line of its own, with no over beside it


def test_multi_day_is_called_test_and_each_stat_maps():
    rows = []
    for mt in ("batter_runs", "batter_sixes", "batter_fours", "bowler_wickets"):
        rows += [row(market_type=mt, fmt="MULTI", line=1.5), row(market_type=mt, fmt="MULTI", line=1.5, side="under")]
    out = book_lines(rows, "t")["lines"]
    assert sorted(x["stat"] for x in out) == ["fours", "runs", "sixes", "wickets"] and {x["fmt"] for x in out} == {"Test"}


def test_output_is_sorted_by_start_then_player():
    rows = [row(player_hist_name="B Player", start_utc="2026-10-28T07:00:00Z", event_key="e2", player_id="b1"),
            row(player_hist_name="B Player", start_utc="2026-10-28T07:00:00Z", event_key="e2", player_id="b1", side="under"),
            row(), row(side="under", back=1.95)]
    assert [x["player"] for x in book_lines(rows, "t")["lines"]] == ["Abhishek Sharma", "B Player"]


def test_prop_events_lists_every_prerelease_event_with_any_player_prop_even_without_a_two_sided_line():
    rows = [row(), row(event_key="e2", match="Namibia vs Ireland", market_type="batter_milestone", line=None, side=None, start_utc="2026-10-27T09:00:00Z"),
            row(event_key="e2", match="Namibia vs Ireland", market_type="top_batter_team", line=None, side=None, start_utc="2026-10-27T09:00:00Z", source="smarkets"),
            row(event_key="e3", market_type="match_winner"),  # outright only: not a prop
            row(event_key="e4", in_play=True)]  # live: not a pre-match prop
    ev = prop_events(rows)
    assert [e["match"] for e in ev] == ["India vs NZ", "Namibia vs Ireland"]
    assert ev[1]["markets"] == ["batter_milestone", "top_batter_team"] and ev[1]["sources"] == ["bet365", "smarkets"] and ev[1]["n"] == 2
    assert book_lines(rows, "t")["events"] == ev


def test_a_tests_first_innings_line_is_a_line_of_its_own_beside_the_match_total_of_the_same_number():
    def pair(line, over, under, **kw):
        return [row(fmt="MULTI", line=line, back=over, **kw), row(fmt="MULTI", line=line, back=under, side="under", **kw)]
    rows = [*pair(72.5, 1.83, 1.83), *pair(26.5, 2.0, 1.73, inn=1), *pair(26.5, 1.9, 1.9),
            *pair(26.5, 2.1, 1.7, inn=1, source="smarkets", source_type="exchange"), *pair(36.5, 2.2, 1.6, inn=1), *pair(21.5, 1.8, 2.0, inn=2)]
    out = book_lines(rows, "t")["lines"]
    assert [(x.get("inn", 0), x["line"]) for x in out] == [(0, 26.5), (0, 72.5), (1, 26.5), (1, 36.5), (2, 21.5)], "ordered by player, stat, scope, line"
    assert all(x["fmt"] == "Test" for x in out)
    assert "inn" not in out[0] and "inn" not in out[1], "a whole-match line carries no scope, as every line published before did"
    first = next(x for x in out if x.get("inn") == 1 and x["line"] == 26.5)
    assert first["books"] == [{"source": "bet365", "kind": "bookmaker", "over": 2.0, "under": 1.73}, {"source": "smarkets", "kind": "exchange", "over": 2.1, "under": 1.7}]
    assert next(x for x in out if x["line"] == 26.5 and "inn" not in x)["books"] == [{"source": "bet365", "kind": "bookmaker", "over": 1.9, "under": 1.9}]


def test_an_innings_scope_means_something_only_in_a_test():
    rows = [row(inn=1, line=26.5), row(inn=1, line=26.5, side="under"), row(fmt="ODI", inn=2, line=30.5), row(fmt="ODI", inn=2, line=30.5, side="under")]
    assert book_lines(rows, "t")["lines"] == [], "a T20 or an ODI has one innings a side: the line is the match's or it is nothing"
    assert len(book_lines([row(inn=None), row(inn=None, side="under", back=1.95)], "t")["lines"]) == 1


def test_an_innings_line_makes_its_event_a_prop_event_like_any_player_line():
    rows = [row(fmt="MULTI", inn=1, line=26.5), row(fmt="MULTI", inn=1, line=26.5, side="under")]
    assert [e["markets"] for e in book_lines(rows, "t")["events"]] == [["batter_runs"]]


def test_carried_innings_lines_keep_their_scope_and_order():
    prev = doc(("SA vs Aus", "2026-10-25T08:30:00Z", "Test"))
    prev["lines"] = [{**prev["lines"][0], "inn": 1}, prev["lines"][0], {**prev["lines"][0], "inn": 2}]
    assert [x.get("inn", 0) for x in carry_started(doc(), prev, NOW)["lines"]] == [0, 1, 2]


def test_book_lines_carries_the_fancy_lines_it_is_given():
    assert book_lines([], "t")["fancy"] == []
    assert book_lines([], "t", [{"key": "match_runs"}])["fancy"] == [{"key": "match_runs"}]


NOW = dt.datetime(2026, 10, 27, 9, 33, tzinfo=dt.timezone.utc)


def doc(*matches):
    """matches: (match, start_utc, fmt); one event, one line and one fancy row each."""
    return {"generated_at_utc": "x",
            "events": [{"match": m, "start_utc": st, "markets": ["batter_runs"], "sources": [], "n": 1} for m, st, _ in matches],
            "lines": [{"match": m, "start_utc": st, "fmt": f, "player": "P", "stat": "runs", "line": 17.5, "books": []} for m, st, f in matches],
            "fancy": [{"match": m, "start_utc": st, "key": "match_runs", "team": None, "line": 300.5} for m, st, _ in matches]}


def test_a_started_match_stays_in_the_file_after_the_books_stop_pricing_it():
    prev = doc(("India vs NZ", "2026-10-27T07:00:00Z", "T20"), ("Afghanistan vs Zimbabwe", "2026-10-27T14:30:00Z", "T20"))
    new = doc(("Afghanistan vs Zimbabwe", "2026-10-27T14:30:00Z", "T20"))
    out = carry_started(new, prev, NOW)
    for kind in ("events", "lines", "fancy"):
        assert [x["match"] for x in out[kind]] == ["India vs NZ", "Afghanistan vs Zimbabwe"], kind  # start order, 2 h 33 min in


def test_a_partial_post_start_pull_keeps_other_books_closing_lines():
    """Books drop off at different times: a later pull that still has only bet365 must not wipe FairWin / Dafabet lines for the same match."""
    base = {"pid": "p1", "player": "P", "team": "India", "fmt": "ODI", "stat": "points", "match": "New Zealand vs India",
            "competition": "", "start_utc": "2026-11-04T02:00:00Z"}
    prev = {"generated_at_utc": "a", "events": [], "fancy": [], "lines": [
        {**base, "line": 20.5, "books": [{"source": "bet365", "kind": "bookmaker", "over": 1.67, "under": 2.1}]},
        {**base, "line": 21.5, "books": [{"source": "FairWin247 Fancy", "kind": "bookmaker", "over": 2.0, "under": None}]},
        {**base, "line": 30.5, "books": [{"source": "Dafabet", "kind": "bookmaker", "over": 1.87, "under": 1.83},
                                         {"source": "FairWin247 Premium", "kind": "bookmaker", "over": 1.85, "under": 1.85}]},
    ]}
    new = {"generated_at_utc": "b", "events": [], "fancy": [], "lines": [
        {**base, "line": 20.5, "books": [{"source": "bet365", "kind": "bookmaker", "over": 1.67, "under": 2.1}]},
    ]}
    out = carry_started(new, prev, dt.datetime(2026, 11, 4, 5, 0, tzinfo=dt.timezone.utc))
    assert sorted(x["line"] for x in out["lines"]) == [20.5, 21.5, 30.5]
    by_line = {x["line"]: [b["source"] for b in x["books"]] for x in out["lines"]}
    assert by_line[20.5] == ["bet365"]
    assert by_line[21.5] == ["FairWin247 Fancy"]
    assert by_line[30.5] == ["Dafabet", "FairWin247 Premium"]


def test_carry_keeps_a_book_source_on_the_same_line_the_new_pull_dropped():
    base = {"pid": "p1", "player": "P", "team": "India", "fmt": "ODI", "stat": "points", "match": "New Zealand vs India",
            "competition": "", "start_utc": "2026-11-04T02:00:00Z", "line": 30.5}
    prev = {"generated_at_utc": "a", "events": [], "fancy": [], "lines": [
        {**base, "books": [{"source": "Dafabet", "kind": "bookmaker", "over": 1.87, "under": 1.83},
                           {"source": "FairWin247 Premium", "kind": "bookmaker", "over": 1.85, "under": 1.85}]},
    ]}
    new = {"generated_at_utc": "b", "events": [], "fancy": [], "lines": [
        {**base, "books": [{"source": "Dafabet", "kind": "bookmaker", "over": 1.9, "under": 1.8}]},
    ]}
    out = carry_started(new, prev, dt.datetime(2026, 11, 4, 5, 0, tzinfo=dt.timezone.utc))
    assert len(out["lines"]) == 1
    books = {b["source"]: b for b in out["lines"][0]["books"]}
    assert books["Dafabet"]["over"] == 1.9  # this pull's price wins
    assert books["FairWin247 Premium"]["over"] == 1.85  # closing price kept


def test_upcoming_matches_are_never_revived_and_finished_ones_are_let_go():
    prev = doc(("Later vs Match", "2026-10-27T14:30:00Z", "T20"), ("Old vs Game", "2026-10-25T07:00:00Z", "ODI"))  # 50 h ago: past the 40 h a finished match is kept
    out = carry_started(doc(), prev, NOW)
    assert out["events"] == out["lines"] == out["fancy"] == []


def test_a_kind_the_new_pull_still_has_for_the_match_is_not_doubled():
    prev = doc(("India vs NZ", "2026-10-27T07:00:00Z", "T20"))
    new = {"generated_at_utc": "y", "events": [{"match": "India vs NZ", "start_utc": "2026-10-27T07:00:00Z", "markets": [], "sources": [], "n": 2}], "lines": [], "fancy": []}
    out = carry_started(new, prev, NOW)
    assert [e["n"] for e in out["events"]] == [2]  # this pull's row, not the old one
    assert len(out["lines"]) == 1 and len(out["fancy"]) == 1  # kinds the pull lacks are kept
    assert out["generated_at_utc"] == "y"


def test_a_multi_day_match_is_kept_across_days():
    prev = doc(("SA vs Aus", "2026-10-25T08:30:00Z", "Test"))  # two days in
    assert len(carry_started(doc(), prev, NOW)["lines"]) == 1
    assert carry_started(doc(), prev, NOW + dt.timedelta(days=5))["lines"] == []
    assert carry_started(doc(), None, NOW) == doc()


def test_a_test_is_one_match_when_the_books_restamp_the_start():
    prev = doc(("SA vs Aus", "2026-10-27T08:30:00Z", "Test"))
    prev["lines"] = [{**prev["lines"][0], "pid": "rk", "inn": 1, "line": 44.5}, {**prev["lines"][0], "pid": "rk"}]
    new = doc(("SA vs Aus", "2026-10-30T08:30:00Z", "Test"))
    new["lines"][0] = {**new["lines"][0], "pid": "rk"}
    out = carry_started(new, prev, dt.datetime(2026, 10, 30, 10, 0, tzinfo=dt.timezone.utc))
    assert {x["start_utc"] for x in out["lines"]} == {"2026-10-27T08:30:00Z"}
    assert {x["start_utc"] for x in out["events"]} == {"2026-10-27T08:30:00Z"}
    assert len(out["events"]) == 1
    assert sorted(x.get("inn", 0) for x in out["lines"]) == [0, 1]


def test_the_next_test_of_a_series_is_not_restamped_to_the_first_tests_start():
    prev = doc(("BAN vs WI", "2026-10-28T03:30:00Z", "Test"))
    new = doc(("BAN vs WI", "2026-11-05T03:30:00Z", "Test"))  # the 2nd Test, priced before it starts
    out = carry_started(new, prev, dt.datetime(2026, 11, 3, 5, 30, tzinfo=dt.timezone.utc))
    assert {x["start_utc"] for x in out["lines"]} == {"2026-11-05T03:30:00Z"}
    assert {x["start_utc"] for x in out["events"]} == {"2026-11-05T03:30:00Z"}


def test_rows_carried_over_from_an_older_pull_are_published_under_the_book_name_too():
    prev = doc(("India vs NZ", "2026-10-27T07:00:00Z", "T20"))
    prev["lines"][0]["books"] = [{"source": "moviodds_bet365", "kind": "bookmaker", "over": 1.8, "under": 1.9}]
    prev["events"][0]["sources"] = ["moviodds_bet365", "smarkets"]
    out = carry_started(doc(), prev, NOW)
    assert out["lines"][0]["books"][0]["source"] == "bet365"
    assert out["events"][0]["sources"] == ["bet365", "smarkets"]
    assert "moviodds" not in json.dumps(public(prev))


def test_a_test_with_a_result_goes_a_day_after_it_ended_not_after_six_days():
    """Started 28 Oct 09:00, first seen over by the 31 Oct 10:00 run: listed until 1 Nov 10:00, so carried at 09:00 and gone by 11:00."""
    start = dt.datetime(2026, 10, 28, 9, 0, tzinfo=dt.timezone.utc)
    prev = doc(("SA vs Aus", "2026-10-28T09:00:00Z", "Test"))
    ended = [("SA vs Aus", start, dt.datetime(2026, 10, 31, 10, 0, tzinfo=dt.timezone.utc))]
    kept = carry_started(doc(), prev, dt.datetime(2026, 11, 1, 9, 0, tzinfo=dt.timezone.utc), ended)
    assert {k: len(kept[k]) for k in ("events", "lines", "fancy")} == {"events": 1, "lines": 1, "fancy": 1}
    gone = carry_started(doc(), prev, dt.datetime(2026, 11, 1, 11, 0, tzinfo=dt.timezone.utc), ended)
    assert gone["events"] == gone["lines"] == gone["fancy"] == []


def test_a_test_with_no_result_yet_keeps_its_six_days_at_stumps_and_on_a_rain_day():
    prev = doc(("SA vs Aus", "2026-10-28T09:00:00Z", "Test"))
    assert len(carry_started(doc(), prev, dt.datetime(2026, 11, 1, 11, 0, tzinfo=dt.timezone.utc), [])["lines"]) == 1   # day 5
    assert len(carry_started(doc(), prev, dt.datetime(2026, 11, 3, 8, 59, tzinfo=dt.timezone.utc), None)["lines"]) == 1
    assert carry_started(doc(), prev, dt.datetime(2026, 11, 3, 9, 1, tzinfo=dt.timezone.utc), [])["lines"] == []   # 28 Oct 09:00 + 6 days


def test_a_test_whose_end_was_not_recorded_is_taken_to_have_ended_at_the_start_of_day_5():
    """Final with no settled_at (settled before it was recorded): end = start + 4 days = 1 Nov 09:00, listed until 2 Nov 09:00."""
    from cricket_site import testend

    start = dt.datetime(2026, 10, 28, 9, 0, tzinfo=dt.timezone.utc)
    end = testend.end_of({"start_utc": "2026-10-28T09:00:00Z", "results": [{"pid": "a", "stat": "runs", "value": 31}]})
    assert end == dt.datetime(2026, 11, 1, 9, 0, tzinfo=dt.timezone.utc)
    prev, ended = doc(("SA vs Aus", "2026-10-28T09:00:00Z", "Test")), [("SA vs Aus", start, end)]
    assert len(carry_started(doc(), prev, dt.datetime(2026, 11, 2, 8, 0, tzinfo=dt.timezone.utc), ended)["lines"]) == 1
    assert carry_started(doc(), prev, dt.datetime(2026, 11, 2, 10, 0, tzinfo=dt.timezone.utc), ended)["lines"] == []


def test_the_end_of_one_test_does_not_touch_another_match_of_the_series_or_a_limited_overs_match():
    start = dt.datetime(2026, 10, 28, 9, 0, tzinfo=dt.timezone.utc)
    ended = [("SA vs Aus", start, dt.datetime(2026, 10, 31, 10, 0, tzinfo=dt.timezone.utc))]
    now = dt.datetime(2026, 11, 8, 0, 0, tzinfo=dt.timezone.utc)
    second = doc(("SA vs Aus", "2026-11-05T09:00:00Z", "Test"))   # the series' next Test, 8 days on: a match of its own
    assert len(carry_started(doc(), second, now, ended)["lines"]) == 1
    t20 = doc(("SA vs Aus", "2026-11-07T20:00:00Z", "T20"))      # same name, limited overs: 40 hours as ever
    assert len(carry_started(doc(), t20, now, ended)["lines"]) == 1
    odi = doc(("India vs NZ", "2026-11-07T07:00:00Z", "ODI"))
    other = [("India vs NZ", start, start)]   # even an entry for its name changes nothing: only a Test reads it
    assert len(carry_started(doc(), odi, dt.datetime(2026, 11, 8, 22, 0, tzinfo=dt.timezone.utc), other)["lines"]) == 1   # 39 h in
    assert carry_started(doc(), odi, dt.datetime(2026, 11, 9, 0, 0, tzinfo=dt.timezone.utc), other)["lines"] == []   # past its 40 h, as before


# ---- a Test's player line from a book that does not quote the match total is its 1st-innings line
def test_scope_multiday_rows_tags_the_unscoped_lines_of_every_source_but_the_match_total_one():
    from value_bets.pipeline import scope_multiday_rows

    rows = [
        row(fmt="MULTI", source="feedh_x", line=26.5),                                  # a Test line, no innings: 1st innings
        row(fmt="MULTI", source="feedf_y", market_type="batter_fours", line=2.5),       # any scoped stat
        row(fmt="MULTI", source="feedh_x", market_type="bowler_wickets", line=1.5),
        row(fmt="MULTI", source="feedh_x", market_type="batter_milestone", ms_scope="match", line=49.5),
        row(fmt="MULTI", source="moviodds_bet365", line=59.5),                          # the book that quotes the whole match: left alone
        row(fmt="MULTI", source="feedk_z", inn=2, line=20.5),                           # already scoped: left alone
        row(fmt="T20", source="feedh_x", line=17.5),                                    # one innings per side: nothing to scope
        row(fmt="ODI", source="feedh_x", line=30.5),
        row(fmt="MULTI", source="feedh_x", market_type="player_points", line=40.5),     # a stat not read as innings-scoped
    ]
    assert scope_multiday_rows(rows) == 4
    assert [r.get("inn") for r in rows] == [1, 1, 1, None, None, 2, None, None, None]
    assert rows[3]["ms_scope"] == "innings"
    assert scope_multiday_rows(rows) == 0  # idempotent


def test_tagged_rows_are_published_as_innings_lines_and_the_match_total_stays_a_complete_match_line():
    from value_bets.pipeline import scope_multiday_rows

    rows = []
    for src, line in (("feedh_x", 26.5), ("moviodds_bet365", 59.5)):
        rows += [row(fmt="MULTI", source=src, line=line), row(fmt="MULTI", source=src, line=line, side="under", back=1.95)]
    scope_multiday_rows(rows)
    lines = book_lines(rows, "t")["lines"]
    assert [(x["line"], x.get("inn", 0)) for x in lines] == [(59.5, 0), (26.5, 1)]


def test_earlier_complete_match_lines_of_books_that_do_not_quote_the_total_are_carried_as_1st_innings_lines():
    from value_bets.booklines import rescope_prev

    base = {"pid": "p1", "player": "P", "team": "Bangladesh", "fmt": "Test", "stat": "runs", "match": "Bangladesh vs West Indies", "competition": "", "start_utc": "2026-10-27T03:00:00Z"}
    b = lambda s, o=1.9, u=1.9: {"source": s, "kind": "bookmaker", "over": o, "under": u}  # noqa: E731
    prev = {"generated_at_utc": "a", "events": [], "fancy": [], "lines": [
        {**base, "line": 26.5, "books": [b("Dafabet"), b("ReddyBook Fancy")]},               # both filed untagged: 1st innings
        {**base, "line": 59.5, "books": [b("bet365")]},                                       # the match total: stays
        {**base, "line": 27.5, "books": [b("bet365"), b("Dafabet")]},                          # a mixed entry is split
        {**base, "line": 24.5, "inn": 1, "books": [b("Ladbrokes")]},                           # already scoped: untouched
        {**base, "fmt": "ODI", "line": 30.5, "books": [b("Dafabet")]},                         # not a Test: untouched
    ]}
    out = rescope_prev(prev)
    got = sorted((x["line"], x.get("inn", 0), tuple(y["source"] for y in x["books"])) for x in out["lines"])
    assert got == [(24.5, 1, ("Ladbrokes",)), (26.5, 1, ("Dafabet", "ReddyBook Fancy")), (27.5, 0, ("bet365",)), (27.5, 1, ("Dafabet",)), (30.5, 0, ("Dafabet",)), (59.5, 0, ("bet365",))]
    assert rescope_prev({"lines": [], "events": [], "fancy": []}) == {"lines": [], "events": [], "fancy": []}
    carried = carry_started({"generated_at_utc": "b", "events": [], "fancy": [], "lines": []}, prev, dt.datetime(2026, 10, 27, 9, 33, tzinfo=dt.timezone.utc))
    assert not any(x["fmt"] == "Test" and x.get("inn", 0) == 0 and any(y["source"] == "Dafabet" for y in x["books"]) for x in carried["lines"])


# --- hold_started: the file is pre-match prices, so a started match takes no line it did not already have ---

TEST_FIRST = "2026-11-09T04:00:00Z"
TEST_DAY2 = "2026-11-10T04:30:00Z"  # the book re-lists the Test under the next morning at stumps, "not started"


def tline(pid, line, books, start=TEST_FIRST, inn=1, match="Pakistan vs Sri Lanka", fmt="Test", **kw):
    return {"pid": pid, "player": pid.upper(), "team": "Pakistan", "fmt": fmt, "stat": "runs", "line": line, **({"inn": inn} if inn else {}), "match": match,
            "competition": "", "start_utc": start, "books": [{"source": s, "kind": "bookmaker", "over": 1.9, "under": 1.8} for s in books], **kw}


def pull(*lines, fancy=()):
    return {"generated_at_utc": "x", "events": [], "lines": list(lines), "fancy": list(fancy)}


def utc(*a):
    return dt.datetime(*a, tzinfo=dt.timezone.utc)


def test_a_started_tests_day_two_line_is_held_back_but_the_pre_match_one_stays():
    """Day 1 at stumps (11:59Z) the book re-lists the Test for 10 Nov and prices a batter on 57 not out at 95.5 for his innings. His 31.5 is the real pre-match line."""
    prev = pull(tline("sk", 31.5, ["Dafabet", "Ladbrokes"]))
    new = pull(tline("sk", 31.5, ["Ladbrokes"], TEST_DAY2), tline("sk", 95.5, ["LeoVegas"], TEST_DAY2), tline("ab", 40.5, ["LeoVegas"], TEST_DAY2))
    now = utc(2026, 11, 9, 11, 59)
    kept, held = hold_started(new, prev, now)
    assert held == {"lines": 2, "fancy": 0}
    assert [x["line"] for x in kept["lines"]] == [31.5]
    out = carry_started(kept, prev, now)
    assert [(x["pid"], x["line"], x["start_utc"], [b["source"] for b in x["books"]]) for x in out["lines"]] == [("sk", 31.5, TEST_FIRST, ["Dafabet", "Ladbrokes"])]


def test_the_same_pull_without_the_rule_is_what_leaked():
    """The leak, kept as a check on the test above: carry_started alone restamps the 10 Nov rows to the first morning and files 95.5 as one of the pre-match lines."""
    prev = pull(tline("sk", 31.5, ["Dafabet", "Ladbrokes"]))
    new = pull(tline("sk", 95.5, ["LeoVegas"], TEST_DAY2))
    out = carry_started(new, prev, utc(2026, 11, 9, 11, 59))
    assert sorted(x["line"] for x in out["lines"]) == [31.5, 95.5]


def test_a_second_innings_line_priced_after_the_first_innings_is_held_too():
    prev = pull(tline("sk", 31.5, ["Ladbrokes"]))
    new = pull(tline("sk", 31.5, ["Ladbrokes"], "2026-11-11T04:30:00Z"), tline("sk", 28.5, ["LeoVegas"], "2026-11-11T04:30:00Z", inn=2))
    kept, held = hold_started(new, prev, utc(2026, 11, 10, 12, 0))
    assert held["lines"] == 1 and [(x.get("inn"), x["line"]) for x in kept["lines"]] == [(1, 31.5)]


def test_a_test_not_yet_started_takes_every_new_line():
    prev = pull(tline("sk", 31.5, ["Ladbrokes"]))
    new = pull(tline("sk", 31.5, ["Ladbrokes"]), tline("sk", 36.5, ["Dafabet"]), tline("ab", 40.5, ["Dafabet"]))
    kept, held = hold_started(new, prev, utc(2026, 11, 8, 20, 0))   # 8 h to the first ball
    assert held == {"lines": 0, "fancy": 0} and len(kept["lines"]) == 3


def test_the_next_test_of_a_series_is_priced_pre_match_while_the_first_is_being_played():
    """A second Test 8 days after the first is a window of its own: its new lines are pre-match until it starts, whatever the first one is doing."""
    nxt = "2026-11-17T04:00:00Z"
    prev = pull(tline("sk", 31.5, ["Ladbrokes"]))
    new = pull(tline("sk", 33.5, ["Dafabet"], nxt), tline("sk", 95.5, ["LeoVegas"], TEST_DAY2))
    kept, held = hold_started(new, prev, utc(2026, 11, 10, 12, 0))
    assert held["lines"] == 1 and [x["line"] for x in kept["lines"]] == [33.5]


def test_a_started_limited_overs_match_takes_no_new_line_and_keeps_the_old_ones():
    prev = pull(tline("p1", 17.5, ["bet365"], "2026-11-09T07:00:00Z", inn=0, fmt="T20", match="A vs B"))
    new = pull(tline("p1", 17.5, ["bet365", "Dafabet"], "2026-11-09T07:00:00Z", inn=0, fmt="T20", match="A vs B"),   # an existing line: kept, books and prices as pulled
               tline("p1", 30.5, ["bet365"], "2026-11-09T07:00:00Z", inn=0, fmt="T20", match="A vs B"),            # a new line after the start: held
               tline("p9", 22.5, ["bet365"], "2026-11-09T09:00:00Z", inn=0, fmt="T20", match="C vs D"))            # another match, not started: kept
    kept, held = hold_started(new, prev, utc(2026, 11, 9, 7, 30))
    assert held == {"lines": 1, "fancy": 0}
    assert [(x["match"], x["line"]) for x in kept["lines"]] == [("A vs B", 17.5), ("C vs D", 22.5)]
    assert [b["source"] for b in kept["lines"][0]["books"]] == ["bet365", "Dafabet"]


def test_a_book_newly_quoting_an_existing_line_is_kept_only_the_line_key_counts():
    prev = pull(tline("sk", 31.5, ["Ladbrokes"]))
    kept, held = hold_started(pull(tline("sk", 31.5, ["Ladbrokes", "Dafabet"], TEST_DAY2)), prev, utc(2026, 11, 9, 12, 0))
    assert held["lines"] == 0 and [b["source"] for b in kept["lines"][0]["books"]] == ["Ladbrokes", "Dafabet"]


def test_no_previous_file_holds_nothing_back():
    new = pull(tline("sk", 95.5, ["LeoVegas"], TEST_DAY2))
    assert hold_started(new, None, utc(2026, 11, 9, 12, 0)) == (new, {"lines": 0, "fancy": 0})
    assert hold_started(new, pull(), utc(2026, 11, 9, 12, 0)) == (new, {"lines": 0, "fancy": 0})


def test_fancy_lines_follow_the_same_rule_and_events_are_left_alone():
    def fx(line, source, start, **kw):
        return {"match": "Pakistan vs Sri Lanka", "start_utc": start, "key": "team_total_runs", "scope": "team", "team": "Pakistan", "line": line, "inn": 1, "source": source, "kind": "bookmaker", **kw}
    prev = {**pull(tline("sk", 31.5, ["Ladbrokes"]), fancy=[fx(310.5, "Ladbrokes", TEST_FIRST)])}
    ev = {"match": "Pakistan vs Sri Lanka", "start_utc": TEST_DAY2, "markets": ["batter_runs"], "sources": ["LeoVegas"], "n": 4}
    new = {**pull(tline("sk", 31.5, ["Ladbrokes"], TEST_DAY2), fancy=[fx(310.5, "Ladbrokes", TEST_DAY2), fx(395.5, "LeoVegas", TEST_DAY2)]), "events": [ev]}
    kept, held = hold_started(new, prev, utc(2026, 11, 9, 12, 0))
    assert held == {"lines": 0, "fancy": 1}
    assert [x["line"] for x in kept["fancy"]] == [310.5] and kept["events"] == [ev]


def test_a_line_with_no_usable_start_is_not_treated_as_started():
    prev = pull(tline("sk", 31.5, ["Ladbrokes"]))
    kept, held = hold_started(pull(tline("sk", 36.5, ["Ladbrokes"], None)), prev, utc(2026, 11, 9, 12, 0))
    assert held["lines"] == 0 and len(kept["lines"]) == 1
