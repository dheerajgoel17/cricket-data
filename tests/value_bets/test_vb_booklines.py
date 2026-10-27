import datetime as dt

from value_bets.booklines import book_lines, carry_started, prop_events


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
    assert ln["books"] == [{"source": "moviodds_bet365", "kind": "bookmaker", "over": 1.85, "under": 1.95}]


def test_two_sources_are_listed_separately_and_alt_lines_are_separate_entries():
    rows = [row(), row(side="under", back=1.95), row(source="smarkets", source_type="exchange", back=1.9), row(source="smarkets", source_type="exchange", side="under", back=2.0),
            row(line=22.5, back=2.4), row(line=22.5, side="under", back=1.55)]
    out = book_lines(rows, "t")["lines"]
    assert [x["line"] for x in out] == [17.5, 22.5]
    assert [b["source"] for b in out[0]["books"]] == ["moviodds_bet365", "smarkets"]
    assert out[1]["books"][0]["over"] == 2.4


def test_one_sided_unmatched_in_play_and_unknown_markets_are_dropped():
    rows = [row(),  # over only: no under price
            row(player_id=None, line=1.5), row(player_id=None, line=1.5, side="under"),  # player not matched to the registry
            row(in_play=True, line=30.5), row(in_play=True, line=30.5, side="under"),
            row(market_type="batter_milestone", line=49.5), row(market_type="batter_milestone", line=49.5, side="under"),
            row(fmt=None, line=9.5), row(fmt=None, line=9.5, side="under"),
            row(line=5.5, back=None), row(line=5.5, side="under")]
    assert book_lines(rows, "t")["lines"] == []


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
    assert ev[1]["markets"] == ["batter_milestone", "top_batter_team"] and ev[1]["sources"] == ["moviodds_bet365", "smarkets"] and ev[1]["n"] == 2
    assert book_lines(rows, "t")["events"] == ev


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


def test_upcoming_matches_are_never_revived_and_finished_ones_are_let_go():
    prev = doc(("Later vs Match", "2026-10-27T14:30:00Z", "T20"), ("Old vs Game", "2026-10-26T07:00:00Z", "ODI"))  # 26 h ago
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
