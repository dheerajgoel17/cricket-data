from conftest import make_match

from cricket_data.cricsheet import iter_zip, parse_match


def test_parse_player_stats():
    rec = parse_match("1", make_match(runs=30))
    p = {x.player: x for x in rec.players}
    assert rec.winner == "Australia" and rec.result_margin == "12 runs" and rec.source == "cricsheet"
    r = p["M Renshaw"]
    assert (r.runs, r.balls, r.fours, r.sixes, r.player_id) == (4 + 20 + 6, 2, 1, 1, "abc123")
    k = p["K Bowler"]
    assert (k.wickets, k.balls_bowled, k.runs_conceded) == (1, 2, 4 + 21 + 6)  # wide not a legal ball
    d = p["Q de Kock"]
    assert (d.catches, d.points, d.opponent) == (1, 10, "Australia")


def test_points_rule():
    rec = parse_match("1", make_match(runs=30))
    r = next(x for x in rec.players if x.player == "M Renshaw")
    assert r.points == 30  # 1 point per run
    k = next(x for x in rec.players if x.player == "K Bowler")
    assert k.points == 20  # one wicket


def test_zero_involvement_players_present():
    rec = parse_match("1", make_match())
    assert {"A Keeper", "Q de Kock", "K Bowler", "M Renshaw"} == {p.player for p in rec.players}


def test_iter_zip_skips_bad_json(make_zip, tmp_path):
    import zipfile
    p = make_zip(make_match())
    with zipfile.ZipFile(p, "a") as z:
        z.writestr("broken.json", "{not json")
    assert len(list(iter_zip(p))) == 1
