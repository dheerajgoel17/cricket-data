"""Feed I: LineFeed ungrouped fixtures (*.invalid hosts only; never a real book)."""
import datetime as dt

from value_bets.adapters import feedi

STAMP = "2026-11-15T12:00:00Z"


def game(outcomes, *, home="Sydney Thunder (Women)", away="Melbourne Stars (Women)",
         league="Big Bash League. Women", eid=770235044, sg=None):
    return {
        "I": eid, "O1E": home, "O2E": away, "LE": league, "L": league, "SE": "Cricket",
        "S": int(dt.datetime(2026, 11, 16, 8, 10, tzinfo=dt.timezone.utc).timestamp()),
        "E": outcomes,
        "SG": sg or [],
    }


def test_player_runs_sixes_wickets_milestones_from_G_ids():
    outcomes = [
        {"T": 3012, "P": 25.5, "PL": {"N": "Phoebe Litchfield"}, "C": 1.85, "G": 2506},
        {"T": 3013, "P": 25.5, "PL": {"N": "Phoebe Litchfield"}, "C": 1.85, "G": 2506},
        {"T": 9530, "P": 0.5, "PL": {"N": "Meg Lanning"}, "C": 2.375, "G": 9181},
        {"T": 9531, "P": 0.5, "PL": {"N": "Meg Lanning"}, "C": 1.533, "G": 9181},
        {"T": 9532, "P": 2.5, "PL": {"N": "Heather Knight"}, "C": 1.8, "G": 9182},
        {"T": 9533, "P": 2.5, "PL": {"N": "Heather Knight"}, "C": 1.909, "G": 9182},
        {"T": 4957, "P": 1.5, "PL": {"N": "Sophie Day"}, "C": 1.5, "G": 3555},
        {"T": 4958, "P": 1.5, "PL": {"N": "Sophie Day"}, "C": 2.5, "G": 3555},
        {"T": 2638, "P": 50, "PL": {"N": "Meg Lanning"}, "C": 3.5, "G": 2316},
        {"T": 2639, "P": 50, "PL": {"N": "Meg Lanning"}, "C": 1.286, "G": 2316},
        {"T": 2054, "PL": {"N": "Heather Knight"}, "C": 4.75, "G": 1006},
        {"T": 1, "C": 1.5, "G": 1},
        {"T": 2, "C": 2.5, "G": 1},
        {"T": 3016, "P": 145.5, "C": 1.85, "G": 2508},
        {"T": 3017, "P": 145.5, "C": 1.85, "G": 2508},
    ]
    rows, fx, cat, left = feedi.parse_game(game(outcomes), "feedi_d", STAMP)
    runs = [(r["player"], r["side"], r["line"], r["back"]) for r in rows if r["market_type"] == "batter_runs"]
    assert runs == [("Phoebe Litchfield", "over", 25.5, 1.85), ("Phoebe Litchfield", "under", 25.5, 1.85)]
    six = [r for r in rows if r["market_type"] == "batter_sixes"]
    assert six[0]["player"] == "Meg Lanning" and six[0]["line"] == 0.5
    fours = [r for r in rows if r["market_type"] == "batter_fours"]
    assert fours[0]["player"] == "Heather Knight" and fours[0]["line"] == 2.5
    wk = [r for r in rows if r["market_type"] == "bowler_wickets"]
    assert wk[0]["player"] == "Sophie Day" and wk[0]["line"] == 1.5
    ms = [(r["player"], r["line"], r["side"]) for r in rows if r["market_type"] == "batter_milestone"]
    assert ("Meg Lanning", 49.5, "over") in ms and ("Meg Lanning", 49.5, "under") in ms
    top = [r for r in rows if r["market_type"] == "top_batter_match"]
    assert top[0]["player"] == "Heather Knight" and top[0]["back"] == 4.75
    assert all(r["market_type"] in {
        "batter_runs", "batter_sixes", "batter_fours", "bowler_wickets",
        "batter_milestone", "top_batter_match",
    } for r in rows)
    assert any(x["key"] == "match_runs" and x["line"] == 145.5 for x in fx)
    assert rows[0]["in_play"] is False and rows[0]["source"] == "feedi_d"


def test_published_and_skip_without_env(monkeypatch):
    monkeypatch.delenv("FEEDI_URL", raising=False)
    monkeypatch.delenv("FEEDI_NAME", raising=False)
    assert feedi.settings() == {}
    assert feedi.published() == {}
    try:
        feedi.fetch(STAMP)
        raise AssertionError("expected Skip")
    except feedi.Skip:
        pass


def test_fetch_lab_host(monkeypatch):
    base = "https://feedi.invalid"
    monkeypatch.setenv("FEEDI_URL", base)
    monkeypatch.setenv("FEEDI_NAME", "1xBet")
    feedi._session = None

    sports = {
        "Success": True,
        "Value": [{"I": 66, "N": "Cricket", "L": [{"LI": 1852059, "L": "Big Bash League. Women"}]}],
    }
    champ = {
        "Success": True,
        "Value": {"G": [{
            "I": 101,
            "O1E": "Sydney Thunder (Women)", "O2E": "Melbourne Stars (Women)",
            "S": int(dt.datetime(2026, 11, 20, 8, 0, tzinfo=dt.timezone.utc).timestamp()),
        }]},
    }
    gzip = {
        "Success": True,
        "Value": game([
            {"T": 3012, "P": 22.5, "PL": {"N": "Phoebe Litchfield"}, "C": 1.9, "G": 2506},
            {"T": 3013, "P": 22.5, "PL": {"N": "Phoebe Litchfield"}, "C": 1.8, "G": 2506},
        ], eid=101),
    }

    def fake_request(url: str):
        if "GetSportsZip" in url:
            return sports
        if "GetChampZip" in url:
            return champ
        if "GetGameZip" in url:
            return gzip
        raise AssertionError(url)

    monkeypatch.setattr(feedi, "request", fake_request)
    rows, raw = feedi.fetch("2026-11-15T12:00:00Z")
    assert len(rows) == 2
    assert raw["books"]["1xBet"]["events"] == 1


def test_live_game_lines_player_runs():
    value = game([
        {"T": 3012, "P": 30.5, "PL": {"N": "Meg Lanning"}, "C": 1.9, "G": 2506},
        {"T": 3013, "P": 30.5, "PL": {"N": "Meg Lanning"}, "C": 1.8, "G": 2506},
        {"T": 1, "C": 1.5, "G": 1},
    ])
    lines = feedi.live_game_lines(value, "1xBet")
    assert any(x["kind"] == "player_runs" and x["player"] == "Meg Lanning" for x in lines)
