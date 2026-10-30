from value_bets.fancy import _fmt, match_fancy


def q(group, **kw):
    return {"group_name": group, **kw}


RAW = {"matches": [
    {"home": "New Zealand", "away": "India", "kickoff_utc": "2026-10-27T07:00:00Z", "in_play": False, "quotes": [
        q("Total Match Runs", label="Over", handicap="384.5", odds_dec=1.8333), q("Total Match Runs", label="Under", handicap="384.5", odds_dec=1.8333),
        q("Match Totals", label="19.5", handicap="19.5", side="Over", line="Sixes", odds_dec=1.9), q("Match Totals", label="19.5", handicap="19.5", side="Under", line="Sixes", odds_dec=1.85),
        q("Match Totals", label="50.5", handicap="50.5", side="Over", line="Boundaries", odds_dec=1.8),  # under missing: dropped
        q("Team Total Match Sixes", label="9.5", handicap="9.5", side="Over", line="New Zealand", odds_dec=2.1),
        q("Team Total Match Sixes", label="9.5", handicap="9.5", side="Under", line="New Zealand", odds_dec=1.6667),
        q("Highest Individual Score", label="Over 72.5", odds_dec=1.83), q("Highest Individual Score", label="Under 72.5", odds_dec=1.83),
        q("Total Run Outs - Match", label="Over 0.5", odds_dec=1.73),  # not an engine market: ignored
        q("Total Match Runs", label="Over", handicap="3", odds_dec=1.0),  # price must be > 1
    ]},
    {"home": "A", "away": "B", "kickoff_utc": "2026-10-27T09:00:00Z", "in_play": True, "quotes": [q("Total Match Runs", label="Over", handicap="300.5", odds_dec=1.9), q("Total Match Runs", label="Under", handicap="300.5", odds_dec=1.9)]},
]}


def test_pairs_over_and_under_into_lines_keyed_like_the_site_markets():
    out = match_fancy(RAW)
    got = {(x["key"], x["scope"], x["team"], x["line"]): (x["over"], x["under"]) for x in out}
    assert got == {("match_runs", "match", None, 384.5): (1.833, 1.833), ("match_sixes", "match", None, 19.5): (1.9, 1.85),
                   ("team_total_sixes", "team", "New Zealand", 9.5): (2.1, 1.667), ("top_score", "match", None, 72.5): (1.83, 1.83)}
    assert {x["match"] for x in out} == {"New Zealand vs India"} and out[0]["start_utc"] == "2026-10-27T07:00:00Z" and out[0]["source"] == "moviodds_bet365"


def test_empty_or_missing_feed_is_fine():
    assert match_fancy(None) == [] and match_fancy({}) == []


def test_fmt_from_the_books_league_so_a_t20_cannot_price_a_test():
    assert _fmt({"league": "T20 Internationals", "home": "Afghanistan", "away": "Zimbabwe"}) == "T20"
    assert _fmt({"league": "Test Matches", "home": "Afghanistan", "away": "Zimbabwe"}) == "Test"
    assert _fmt({"league": "Abu Dhabi T10", "home": "A", "away": "B"}) == "T10"
    raw = {"matches": [{"home": "Afghanistan", "away": "Zimbabwe", "kickoff_utc": "2026-10-24T14:30:00Z", "in_play": False,
                        "league": "T20 Internationals", "quotes": [
                            q("Total Match Runs", label="Over", handicap="320.5", odds_dec=1.83),
                            q("Total Match Runs", label="Under", handicap="320.5", odds_dec=1.83)]}]}
    out = match_fancy(raw)
    assert out[0]["fmt"] == "T20" and out[0]["competition"] == "T20 Internationals"
