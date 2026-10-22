import json

import synth

from cricket_site import build as B
from cricket_site.parse import FORMAT_NAMES


def _out(tmp_path):
    docs, exp = synth.make_dataset()
    z = synth.write_zip(docs, tmp_path / "all_json.zip")
    data = tmp_path / "data"
    (data / "provisional").mkdir(parents=True)
    out = tmp_path / "out"
    return z, data, out, exp


def _load(out):
    M = json.loads((out / "matches.json").read_text())
    IX = json.loads((out / "index.json").read_text())
    return M, IX


def test_build_outputs_and_meta(tmp_path):
    z, data, out, exp = _out(tmp_path)
    meta = B.build(z, data, out, None, workers=1)
    assert meta["matches"] == 15 and meta["newest_cricsheet"] == "2025-04-05"
    assert meta["provisional_included"] is False
    M, IX = _load(out)
    assert IX["formats"] == FORMAT_NAMES
    assert all((out / f).exists() for f in ("meta.json", "index.json", "matches.json", "fixtures.json", "props.json"))
    # T20 summary markets: the 5-over game is void, the 10 full games are valid
    t20 = [m for m in range(len(M["id"])) if M["f"][m] == 0]
    assert sorted(M["q"][m] for m in t20) == [0] + [1] * 10
    byid = {M["id"][m]: m for m in range(len(M["id"]))}
    for e in exp["t20"]:
        m = byid[e["id"]]
        inn = M["inn"][m]
        assert sum(i[4] for i in inn) == e["fours"] and sum(i[5] for i in inn) == e["sixes"]
        assert sum(i[6] for i in inn) == e["n30"] and sum(i[7] for i in inn) == e["n50"] and M["ts"][m] == e["top"]
    # an "X tour of Y" event makes Y the host, and Alpha's matches there are away
    hosts = IX["hosts"]
    m0 = byid["t20_00"]
    assert hosts[M["h"][m0]] == "Beta"


def test_player_shards_hold_rows_and_partnerships(tmp_path):
    z, data, out, exp = _out(tmp_path)
    B.build(z, data, out, None, workers=1)
    M, IX = _load(out)
    brook = IX["players"]["id"].index(synth.pid(synth.BROOK))
    sixes_t20 = []
    n_shard = IX["nshard"]
    shard = json.loads((out / "p" / f"{int(synth.pid(synth.BROOK), 16) % n_shard:02d}.json").read_text())
    b = shard["bat"]
    for k in range(len(b["p"])):
        if b["p"][k] == brook and M["f"][b["m"][k]] == 0 and M["q"][b["m"][k]] != 0:
            sixes_t20.append((M["d"][b["m"][k]], b["s"][k]))
    assert [s for _, s in sorted(sixes_t20)] == synth.BROOK_F6
    # partnerships live in the shard of the lower player index
    duck = IX["players"]["id"].index(synth.pid(synth.DUCKETT))
    lo, hi = sorted((brook, duck))
    shard_lo = json.loads((out / "p" / f"{int(IX['players']['id'][lo], 16) % n_shard:02d}.json").read_text())
    pt = shard_lo["pt"]
    rows = [k for k in range(len(pt["a"])) if (pt["a"][k], pt["b"][k]) == (lo, hi) and pt["o"][k] == 1]
    assert len(rows) == 15  # one opening stand in each of 10 T20s, 4 ODIs and the short T20


def _prov(match_id, date, team_a, team_b, players, **kw):
    d = {"match_id": match_id, "date": date, "match_type": "T20", "team_type": "international", "gender": "male", "event": "X",
         "venue": "Beta Oval", "team_a": team_a, "team_b": team_b, "winner": team_a, "status": "provisional", "players": players}
    d.update(kw)
    return d


def test_provisional_matches_feed_player_rows_but_not_match_markets(tmp_path):
    z, data, out, _ = _out(tmp_path)
    bro = synth.pid(synth.BROOK)
    pl = [{"player": "Harry Brook", "player_id": bro, "team": "Alpha", "opponent": "Beta", "runs": "40", "balls": "20",
           "fours": "3", "sixes": "2", "wickets": "0", "balls_bowled": "0", "runs_conceded": "0"},
          {"player": "Unknown Guy", "player_id": "", "team": "Alpha", "opponent": "Beta", "runs": "5", "balls": "4"}]
    new = _prov("crex-new", "2025-06-01", "Alpha", "Beta", pl)
    dup = _prov("crex-dup", "2024-01-11", "Alpha", "Beta", pl)  # Cricsheet already has Alpha v Beta on 2024-01-10 (+/-1 day)
    for d in (new, dup):
        (data / "provisional" / f"{d['match_id']}.json").write_text(json.dumps(d))
    meta = B.build(z, data, out, None, workers=1)
    assert meta["provisional_matches"] == 1 and meta["provisional_included"] and meta["newest_provisional"] == "2025-06-01"
    assert meta["provisional_rows_unlinked"] == 1
    M, IX = _load(out)
    m = M["id"].index("crex-new")
    assert M["pv"][m] == 1 and M["q"][m] == -1 and M["inn"][m] == [] and M["fi"][m] == -1
    brook = IX["players"]["id"].index(bro)
    shard = json.loads((out / "p" / f"{int(bro, 16) % IX['nshard']:02d}.json").read_text())["bat"]
    rows = [(shard["r"][k], shard["s"][k], shard["o"][k], shard["k"][k]) for k in range(len(shard["p"]))
            if shard["p"][k] == brook and shard["m"][k] == m]
    assert rows == [(40, 2, 0, -1)]  # no batting position / dismissal for scraped games
    xi = json.loads((out / "p" / f"{int(bro, 16) % IX['nshard']:02d}.json").read_text())["xi"]
    assert (brook, m) in list(zip(xi["p"], xi["m"], strict=True))  # named in the scraped squad: in the XI
    assert "crex-dup" not in M["id"]


def test_event_host_parses_tour_events():
    national = {"England", "India", "West Indies"}
    assert B.event_host("India tour of England, 2021", national) == "England"
    assert B.event_host("Women's T20 Quadrangular Series (in India)", national) == "India"
    assert B.event_host("ICC World Cup", national) is None
    assert B.event_host("Pakistan tour of England and Ireland", national) is None


def test_committed_js_fixture_is_in_sync(tmp_path):
    """site/tests/fixtures is generated by scripts/make_site_fixture.py; fail loudly when it drifts from the builder."""
    import importlib.util
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    spec = importlib.util.spec_from_file_location("make_site_fixture", root / "scripts" / "make_site_fixture.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.generate(tmp_path)
    for name in ("matches.json", "index.json", "expectations.json"):
        committed = root / "site" / "tests" / "fixtures" / ("data" if name != "expectations.json" else "") / name
        fresh = tmp_path / ("data" if name != "expectations.json" else "") / name
        assert committed.read_text() == fresh.read_text(), f"{name} is stale: run python scripts/make_site_fixture.py"


def _prov_game(date, runs, team_a="Alpha", team_b="Beta", extra_players=0):
    pl = [{"player": f"P{i}", "player_id": "", "team": team_a if i < 11 else team_b, "opponent": team_b if i < 11 else team_a,
           "runs": str(runs if i == 0 else 0), "balls": "10"} for i in range(22 + extra_players)]
    return _prov(f"crex-{date}-{runs}", date, team_a, team_b, pl)


def test_consecutive_day_games_between_the_same_sides_are_not_mistaken_for_duplicates(tmp_path):
    z, data, out, _ = _out(tmp_path)  # Cricsheet has the short Alpha v Beta game on 2024-06-01 (Brook 10 + Duckett 20 + Kohli 30 + Gill 3 = 63 batter runs)
    canonical_runs = 10 + 20 + 30 + 3
    next_day = _prov_game("2024-06-02", 99)           # different totals the next day: a genuinely different game
    same_game = _prov_game("2024-05-31", canonical_runs)  # same totals one day earlier (time-zone shift): the same game
    for d in (next_day, same_game):
        (data / "provisional" / f"{d['match_id']}.json").write_text(json.dumps(d))
    meta = B.build(z, data, out, None, workers=1)
    assert meta["provisional_matches"] == 1
    M, _ = _load(out)
    assert any("-99" in i for i in M["id"]) and not any(i.endswith(f"-{canonical_runs}") for i in M["id"])


def test_half_scraped_scorecards_are_marked_unreliable(tmp_path):
    z, data, out, _ = _out(tmp_path)
    ok = _prov_game("2025-07-01", 5)
    thin = _prov("crex-thin", "2025-07-02", "Alpha", "Beta", [{"player": "Solo", "player_id": "", "team": "Alpha", "opponent": "Beta", "runs": "3", "balls": "4"}])
    for d in (ok, thin):
        (data / "provisional" / f"{d['match_id']}.json").write_text(json.dumps(d))
    B.build(z, data, out, None, workers=1)
    M, _ = _load(out)
    xq = {M["id"][i]: M["xq"][i] for i in range(len(M["id"]))}
    assert xq["crex-2025-07-01-5"] == 1 and xq["crex-thin"] == 0
