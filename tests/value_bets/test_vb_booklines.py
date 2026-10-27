from value_bets.booklines import book_lines, prop_events


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
