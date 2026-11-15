"""Feed I: LineFeed-shaped fixtures (*.invalid hosts only; never a real book)."""
import datetime as dt

from value_bets.adapters import feedi

STAMP = "2026-11-15T12:00:00Z"


def ou_outs(line, over, under):
    return [
        {"C": over, "T": 1, "P": line, "N": f"Over {line}"},
        {"C": under, "T": 2, "P": line, "N": f"Under {line}"},
    ]


def named_outs(runners):
    return [{"C": p, "N": n, "T": i + 1} for i, (n, p) in enumerate(runners)]


def game(markets, *, home="New Zealand", away="India", league="T20 Series New Zealand vs India", eid=395410929, sg=None):
    ge = []
    for i, (name, outs) in enumerate(markets):
        ge.append({"G": 1000 + i, "N": name, "E": [outs]})
    value = {
        "I": eid, "O1E": home, "O2E": away, "L": league,
        "S": int(dt.datetime(2026, 11, 16, 7, 0, tzinfo=dt.timezone.utc).timestamp()),
        "GE": ge,
    }
    if sg:
        value["SG"] = sg
    return value


def test_mapped_player_lines_fancy_and_catalogue():
    markets = [
        ("Player total runs - Suryavanshi, Vaibhav", ou_outs(25.5, 1.85, 1.85)),
        ("Player total sixes - Suryavanshi, Vaibhav", ou_outs(1.5, 1.9, 1.8)),
        ("Bowler wickets - Bumrah, Jasprit", ou_outs(1.5, 1.72, 2.05)),
        ("Player performance - Kishan, Ishan", ou_outs(36.5, 1.83, 1.87)),
        ("To score 50 - Sharma, Abhishek", ou_outs(49.5, 2.1, 1.71)),
        ("Total runs", ou_outs(401.5, 1.85, 1.85)),
        ("Total runs - India", ou_outs(203.5, 1.85, 1.85)),
        ("Total fours", ou_outs(28.5, 1.9, 1.8)),
        ("Total sixes - New Zealand", ou_outs(9.5, 1.88, 1.82)),
        ("Top batsman - New Zealand", named_outs([("Conway, Devon", 3.5), ("Allen, Finn", 4.2)])),
        ("1x2", named_outs([("New Zealand", 2.16), ("India", 1.67)])),
        ("First innings total runs", ou_outs(200.5, 1.85, 1.85)),
        ("Total runs after 10 overs - India", ou_outs(70.5, 1.85, 1.85)),
    ]
    rows, fx, cat, left = feedi.parse_game(game(markets), "feedi_d", STAMP)
    runs = [(r["player"], r["side"], r["line"], r["back"]) for r in rows if r["market_type"] == "batter_runs"]
    assert runs == [("Vaibhav Suryavanshi", "over", 25.5, 1.85), ("Vaibhav Suryavanshi", "under", 25.5, 1.85)]
    six = [(r["player"], r["side"], r["line"], r["back"]) for r in rows if r["market_type"] == "batter_sixes"]
    assert six == [("Vaibhav Suryavanshi", "over", 1.5, 1.9), ("Vaibhav Suryavanshi", "under", 1.5, 1.8)]
    wk = [(r["player"], r["side"], r["line"], r["back"]) for r in rows if r["market_type"] == "bowler_wickets"]
    assert wk == [("Jasprit Bumrah", "over", 1.5, 1.72), ("Jasprit Bumrah", "under", 1.5, 2.05)]
    pts = [(r["player"], r["side"], r["line"], r["back"]) for r in rows if r["market_type"] == "player_points"]
    assert pts == [("Ishan Kishan", "over", 36.5, 1.83), ("Ishan Kishan", "under", 36.5, 1.87)]
    ms = [(r["player"], r["side"], r["line"]) for r in rows if r["market_type"] == "batter_milestone"]
    assert ms == [("Abhishek Sharma", "over", 49.5), ("Abhishek Sharma", "under", 49.5)]
    top = [(r["player"], r["team"], r["back"]) for r in rows if r["market_type"] == "top_batter_team"]
    assert top == [("Devon Conway", "New Zealand", 3.5), ("Finn Allen", "New Zealand", 4.2)]
    assert rows[0]["match"] == "New Zealand vs India" and rows[0]["source"] == "feedi_d" and rows[0]["in_play"] is False
    keys = {(x["key"], x["team"], x["line"]) for x in fx}
    assert ("match_runs", None, 401.5) in keys
    assert ("team_total_runs", "India", 203.5) in keys
    assert ("match_fours", None, 28.5) in keys
    assert ("team_total_sixes", "New Zealand", 9.5) in keys
    assert ("first_innings_runs", None, 200.5) in keys
    assert ("overs_10", "India", 70.5) in keys
    assert "1x2" in {x["name"] for x in cat}
    assert "1x2" not in {r["market_raw"] for r in rows}
    assert left == {}


def test_subgame_player_total_runs():
    sg = [{
        "PN": "Suryavanshi, Vaibhav",
        "GE": [{"G": 1, "N": "Total", "E": [ou_outs(22.5, 1.9, 1.8)]}],
    }]
    rows, fx, cat, left = feedi.parse_game(game([], sg=sg), "feedi_d", STAMP)
    runs = [r for r in rows if r["market_type"] == "batter_runs"]
    assert [(r["player"], r["line"], r["side"], r["back"]) for r in runs] == [
        ("Vaibhav Suryavanshi", 22.5, "over", 1.9),
        ("Vaibhav Suryavanshi", 22.5, "under", 1.8),
    ]


def test_test_unscoped_player_line_is_catalogue_only():
    markets = [
        ("Player total runs - Conway, Devon", ou_outs(40.5, 1.9, 1.8)),
        ("Total runs", ou_outs(500.5, 1.85, 1.85)),
    ]
    rows, fx, cat, left = feedi.parse_game(
        game(markets, league="Test Series South Africa vs Australia"), "feedi_d", STAMP,
    )
    assert not [r for r in rows if r["market_type"] == "batter_runs"]
    assert any(x["name"].startswith("Player total runs") and x["mapped"] is None for x in cat)
    assert any(x["key"] == "match_runs" for x in fx)


def test_live_game_lines_player_and_team():
    markets = [
        ("Total", ou_outs(30.5, 1.9, 1.8)),
        ("Total runs - India", ou_outs(160.5, 1.85, 1.85)),
        ("1x2", named_outs([("India", 1.5)])),
    ]
    sg = [{"PN": "Kohli, Virat", "GE": [{"G": 1, "N": "Total", "E": [ou_outs(30.5, 1.9, 1.8)]}]}]
    lines = feedi.live_game_lines(game(markets[1:], home="India", away="Australia", sg=sg), "1xBet")
    kinds = {x["kind"] for x in lines}
    assert "player_runs" in kinds
    assert "team_runs" in kinds
    assert not any(x.get("market", "").lower().startswith("1x2") for x in lines if x["kind"] == "pick")


def test_published_and_skip_without_env(monkeypatch):
    monkeypatch.delenv("FEEDI_URL", raising=False)
    monkeypatch.delenv("FEEDI_NAME", raising=False)
    assert feedi.settings() == {}
    assert feedi.published() == {}
    try:
        feedi.fetch(STAMP)
        assert False, "expected Skip"
    except feedi.Skip:
        pass


def test_fetch_lab_host(monkeypatch):
    """*.invalid listing + one game; no relay required."""
    base = "https://feedi.invalid"
    monkeypatch.setenv("FEEDI_URL", base)
    monkeypatch.setenv("FEEDI_NAME", "1xBet")
    monkeypatch.delenv("FEEDH_RELAY", raising=False)
    monkeypatch.delenv("FEEDG_RELAY", raising=False)

    listing = {
        "Success": True,
        "Value": [{
            "L": "T20 Series New Zealand vs India",
            "E": [{
                "I": 101, "O1E": "New Zealand", "O2E": "India",
                "S": int(dt.datetime(2026, 11, 20, 7, 0, tzinfo=dt.timezone.utc).timestamp()),
                "L": "T20 Series New Zealand vs India",
            }],
        }],
    }
    gzip = {
        "Success": True,
        "Value": game(
            [("Player total runs - Conway, Devon", ou_outs(25.5, 1.85, 1.85))],
            eid=101,
        ),
    }

    def fake_request(url: str):
        if "Get1x2_VZip" in url:
            return listing
        if "GetGameZip" in url:
            return gzip
        raise AssertionError(url)

    monkeypatch.setattr(feedi, "request", fake_request)
    rows, raw = feedi.fetch("2026-11-15T12:00:00Z")
    assert len(rows) == 2
    assert raw["books"]["1xBet"]["events"] == 1
    assert raw["books"]["1xBet"]["rows"] == 2
