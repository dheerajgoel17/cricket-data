"""In-play lines from the books that list started matches (Feed K and Feed E): market names as probed on a started Test and a started T20."""
import datetime as dt

from value_bets import inplay_extra as ix

NOW = dt.datetime(2026, 11, 9, 8, 0, tzinfo=dt.timezone.utc)


def k_offer(label, outcomes):
    return {"criterion": {"label": label, "englishLabel": label}, "outcomes": outcomes}


def k_out(label, odds, line=None, participant=None, status="OPEN"):
    o = {"label": label, "englishLabel": label, "odds": odds, "status": status}
    if line is not None:
        o["line"] = line
    if participant:
        o["participant"] = participant
    return o


def test_feed_k_reads_team_totals_other_over_unders_and_picks_and_leaves_the_match_winner_out():
    ev = {"homeName": "Pakistan", "awayName": "Sri Lanka"}
    offers = [
        k_offer("Match Odds", [k_out("1", 2600), k_out("X", 2150), k_out("2", 4333)]),
        k_offer("Draw No Bet - Match Odds", [k_out("1", 1500), k_out("2", 2400)]),
        k_offer("Total Runs - Home Team, Innings 1", [k_out("Over", 1840, line=420500), k_out("Under", 1800, line=420500)]),
        k_offer("Total Runs - Away Team, Innings 2", [k_out("Over", 2000, line=250500), k_out("Under", 1700, line=250500)]),
        k_offer("Total Runs - Home Team, Innings 1, Overs 1-45", [k_out("Over", 1900, line=189500), k_out("Under", 1900, line=189500)]),
        k_offer("Total Runs - Home Team, Innings 1, at Fall of Wicket 4", [k_out("Over", 1900, line=195500), k_out("Under", 1900, line=195500, status="SUSPENDED")]),
        k_offer("Next Batter Out - Pakistan, Innings 1, Wicket 4", [k_out("Saud Shakeel", 3000, participant="Saud Shakeel"), k_out("Babar Azam", 4500, participant="Babar Azam")]),
        k_offer("Wicket - Home Team, Innings 1, Over 42", [k_out("Yes", 11000), k_out("No", 1050)]),
        k_offer("Saud Shakeel - Total Runs - Innings 1", [k_out("Over 31.5", 1850, participant="Saud Shakeel"), k_out("Under 31.5", 1850, participant="Saud Shakeel")]),
    ]
    lines = ix.k_lines(ev, offers, "BookK")
    by = {(x["kind"], x.get("team") or x.get("player") or x.get("market")): x for x in lines}
    assert not any("Match Odds" in str(x) for x in lines)
    t1 = by[("team_runs", "Pakistan")]
    assert (t1["inn"], t1["line"], t1["over"], t1["under"], t1["book"]) == (1, 420.5, 1.84, 1.8, "BookK")
    assert (by[("team_runs", "Sri Lanka")]["inn"], by[("team_runs", "Sri Lanka")]["line"]) == (2, 250.5)
    assert by[("ou", "Total Runs - Pakistan, Innings 1, Overs 1-45")]["line"] == 189.5
    # a suspended side leaves the line with one price, not a made-up one
    fall = by[("ou", "Total Runs - Pakistan, Innings 1, at Fall of Wicket 4")]
    assert (fall["over"], fall["under"]) == (1.9, None)
    pl = by[("player_runs", "Saud Shakeel")]
    assert (pl["line"], pl["over"], pl["under"]) == (31.5, 1.85, 1.85)
    nxt = by[("pick", "Next Batter Out - Pakistan, Innings 1, Wicket 4")]
    assert nxt["outcomes"] == [{"label": "Saud Shakeel", "price": 3.0}, {"label": "Babar Azam", "price": 4.5}]
    yn = by[("pick", "Wicket - Pakistan, Innings 1, Over 42")]
    assert yn["outcomes"] == [{"label": "Yes", "price": 11.0}, {"label": "No", "price": 1.05}]


def e_out(name, dec, status="A"):
    return {"outcome": {"name": name, "outcomeStatusCode": status, "children": [{"price": {"priceDec": str(dec)}}]}}


def e_market(name, template, outcomes, status="A"):
    return {"market": {"name": name, "templateMarketName": template, "marketStatusCode": status, "children": outcomes}}


def test_feed_e_reads_team_innings_player_runs_other_over_unders_and_picks_and_leaves_the_match_winner_out():
    ev = {"name": "Bangladesh v Malaysia", "children": [
        e_market("Match Winner", "Match Betting", [e_out("Bangladesh", 1.01), e_out("Malaysia", 13)]),
        e_market("Malaysia Over/Under 104.5 Runs", "Malaysia Team Innings Runs", [e_out("Over", 1.9), e_out("Under", 1.8)]),
        e_market("Malaysia Overs 0-10 Over/Under 26.5 Runs", "Overs Runs", [e_out("Over", 1.85), e_out("Under", 1.85)]),
        e_market("Malaysia Over/Under 2.5 Runs In Over 17", "Over Runs", [e_out("Over", 2.0), e_out("Under", 1.7)]),
        e_market("Malaysia Runs In Over 3 odd or even", "Odd/Even", [e_out("Odd", 1.9), e_out("Even", 1.9)]),
        e_market("Some Player - Over/Under 18.5 Runs", "Batsman Runs", [e_out("Over", 1.9), e_out("Under", 1.9)]),
        e_market("Closed - Over/Under 1.5 Runs In Over 1", "Over Runs", [e_out("Over", 1.9), e_out("Under", 1.9)], status="S"),
    ]}
    lines = ix.e_lines(ev, "BookE")
    by = {(x["kind"], x.get("team") or x.get("player") or x.get("market")): x for x in lines}
    assert len(lines) == 5 and not any(x.get("market") == "Match Winner" for x in lines)
    t = by[("team_runs", "Malaysia")]
    assert (t["line"], t["over"], t["under"], t["inn"], t["book"]) == (104.5, 1.9, 1.8, 1, "BookE")
    assert by[("ou", "Malaysia Overs 0-10 Runs")]["line"] == 26.5
    assert by[("ou", "Malaysia Runs In Over 17")]["line"] == 2.5
    assert by[("pick", "Malaysia Runs In Over 3 odd or even")]["outcomes"] == [{"label": "Odd", "price": 1.9}, {"label": "Even", "price": 1.9}]
    assert by[("player_runs", "Some Player")]["line"] == 18.5


def test_all_matches_counts_each_source_and_a_failing_one_costs_only_itself(monkeypatch):
    monkeypatch.setattr(ix, "k_matches", lambda now: (_ for _ in ()).throw(RuntimeError("down")))
    monkeypatch.setattr(ix, "e_matches", lambda now: [{"home": "A", "away": "B", "league": "", "kickoff": None, "lines": [{"kind": "pick"}]}])
    matches, counts = ix.all_matches(NOW)
    assert counts == {"feedk": 0, "feede": 1} and len(matches) == 1
