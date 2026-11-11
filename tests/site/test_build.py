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
    assert meta["matches"] == 15 and meta["newest_base"] == "2025-04-05"
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
        assert len(M["ov"][m]) == len(inn) and all(len(tape) == 20 for tape in M["ov"][m])  # a completed T20 over tape
        assert all(i[15] is not None and i[16] is not None for i in inn)  # extras and run-outs from deliveries
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


def test_progression_shard_has_one_row_per_innings_of_ten_balls_and_agrees_with_the_batting_rows(tmp_path):
    z, data, out, exp = _out(tmp_path)
    B.build(z, data, out, None, workers=1)
    M, IX = _load(out)
    assert IX["pp"] == 1
    brook = IX["players"]["id"].index(synth.pid(synth.BROOK))
    sh = int(synth.pid(synth.BROOK), 16) % IX["nshard"]
    bat = json.loads((out / "p" / f"{sh:02d}.json").read_text())["bat"]
    assert "pr" not in json.loads((out / "p" / f"{sh:02d}.json").read_text())  # the player files do not grow
    final = {(bat["p"][k], bat["m"][k], bat["i"][k]): (bat["r"][k], bat["b"][k]) for k in range(len(bat["p"]))}
    pr = json.loads((out / "pp" / f"{sh:02d}.json").read_text())
    mine = [k for k in range(len(pr["p"])) if pr["p"][k] == brook]
    assert mine
    for k in mine:
        runs, balls = final[(pr["p"][k], pr["m"][k], pr["i"][k])]
        assert (pr["r"][k], pr["b"][k]) == (runs, balls) and balls >= 10
        at = (10, 20, 30, 50, 75, 100, 150)
        marks = [pr[f"x{i + 1}"][k] for i in range(len(at))]
        assert marks[0] is not None and marks[0] <= runs
        assert all(a is None or (0 <= a <= runs) for a in marks)
        seen = [a for a in marks if a is not None]
        assert seen == sorted(seen)  # runs only go up
        assert all((m is not None) == (balls >= b) for m, b in zip(marks, at, strict=True))  # a mark is there exactly when he faced that many balls


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
    dup = _prov("crex-dup", "2024-01-11", "Alpha", "Beta", pl)  # Base already has Alpha v Beta on 2024-01-10 (+/-1 day)
    for d in (new, dup):
        (data / "provisional" / f"{d['match_id']}.json").write_text(json.dumps(d))
    meta = B.build(z, data, out, None, workers=1)
    assert meta["provisional_matches"] == 1 and meta["provisional_included"] and meta["newest_provisional"] == "2025-06-01"
    assert meta["provisional_rows_unlinked"] == 1
    M, IX = _load(out)
    m = M["id"].index("prov-new")
    assert M["pv"][m] == 1 and M["q"][m] == -1 and M["inn"][m] == [] and M["fi"][m] == -1
    brook = IX["players"]["id"].index(bro)
    shard = json.loads((out / "p" / f"{int(bro, 16) % IX['nshard']:02d}.json").read_text())["bat"]
    rows = [(shard["r"][k], shard["s"][k], shard["o"][k], shard["k"][k]) for k in range(len(shard["p"]))
            if shard["p"][k] == brook and shard["m"][k] == m]
    assert rows == [(40, 2, 0, -1)]  # no batting position / dismissal for scraped games
    xi = json.loads((out / "p" / f"{int(bro, 16) % IX['nshard']:02d}.json").read_text())["xi"]
    assert (brook, m) in list(zip(xi["p"], xi["m"], strict=True))  # named in the scraped squad: in the XI
    assert "prov-dup" not in M["id"]


def test_a_complete_scorecard_without_balls_still_qualifies_for_match_fours(tmp_path):
    """Afghanistan men's games never land in Base: the scorecard totals must still feed Match Fancy."""
    z, data, out, _ = _out(tmp_path)

    def side(team, opp, fours, pid0):
        bat = {"player": f"{team} bat", "player_id": pid0, "team": team, "opponent": opp,
               "runs": "40", "balls": "30", "fours": str(fours), "sixes": "1"}
        bowl = {"player": f"{team} bowl", "player_id": f"{int(pid0, 16) + 1:08x}", "team": team, "opponent": opp,
                "runs": "0", "balls": "0", "wickets": "2", "balls_bowled": "120", "runs_conceded": "50"}
        rest = [{"player": f"{team} {i}", "player_id": f"{int(pid0, 16) + 2 + i:08x}", "team": team, "opponent": opp,
                 "runs": "0", "balls": "0"} for i in range(9)]
        return [bat, bowl, *rest]

    pl = side("Alpha", "Beta", 8, "11111111") + side("Beta", "Alpha", 5, "22222222")
    d = _prov("crex-afg-zim", "2026-10-29", "Alpha", "Beta", pl, status="cricsheet_withheld",
              toss_winner="Beta", toss_decision="field")
    (data / "provisional" / f"{d['match_id']}.json").write_text(json.dumps(d))
    B.build(z, data, out, None, workers=1)
    M, _ = _load(out)
    m = M["id"].index("prov-afg-zim")
    assert M["pv"][m] == 1 and M["q"][m] == 1
    inn = M["inn"][m]
    assert len(inn) == 2 and sum(i[4] for i in inn) == 13  # f4
    assert inn[0][1] == 40  # Alpha batted first (Beta fielded)


def test_a_stated_innings_summary_replaces_the_sum_of_the_player_rows():
    """The WBBL 2026 opener: batters' runs gave Stars 176/3, the card states 192/4 (16 extras, one run-out)."""
    def row(team, opp, **kw):
        return {"player": f"{team}{len(kw)}", "player_id": "", "team": team, "opponent": opp, "runs": "0", "balls": "0", **{k: str(v) for k, v in kw.items()}}

    pl = [row("Stars", "Hurricanes", runs=176, balls=110), row("Hurricanes", "Stars", runs=165, balls=118),
          row("Hurricanes", "Stars", balls_bowled=120, wickets=3), row("Stars", "Hurricanes", balls_bowled=120, wickets=8)]
    d = {"team_a": "Stars", "team_b": "Hurricanes", "winner": "Stars", "toss_winner": "Hurricanes", "toss_decision": "field", "players": pl}
    plain = {"overs": 0, "bpo": 6, "res": 0, "days": 1}
    B._inn_from_totals(plain, d, 0, {})
    assert [(i[2], i[3], i[4], i[16]) for i in plain["inn"]] == [(176, 3, 120, None), (165, 8, 120, None)]  # runs, wkts, balls, extras: unknown
    stated = {"overs": 0, "bpo": 6, "res": 0, "days": 1}
    B._inn_from_totals(stated, {**d, "innings": [{"team": "Stars", "runs": 192, "wickets": 4, "balls": 120}, {"team": "Hurricanes", "runs": 174, "wickets": 8, "balls": 120}]}, 0, {})
    assert [(i[2], i[3], i[4], i[16]) for i in stated["inn"]] == [(192, 4, 120, 16), (174, 8, 120, 9)]  # extras = stated total - batters: 16 and 9


def test_a_scraped_scorecard_counts_run_outs_so_an_all_out_innings_is_a_natural_end():
    """Bowlers' wickets alone read an all-out innings as 9 down when a run-out ended it; 80% of overs then voided a complete match."""
    def row(team, opp, **kw):
        return {"player": f"{team}{len(kw)}", "player_id": "", "team": team, "opponent": opp, "runs": "0", "balls": "0", **{k: str(v) for k, v in kw.items()}}

    def card(beta_wickets, beta_run_outs):
        pl = [row("Alpha", "Beta", runs=150, balls=100), row("Beta", "Alpha", runs=60, balls=70),
              row("Beta", "Alpha", balls_bowled=120, wickets=2),                              # Beta bowls Alpha's full 20 overs
              row("Alpha", "Beta", balls_bowled=72, wickets=beta_wickets, run_outs=beta_run_outs)]  # Beta is bowled out in 12 overs
        return {"team_a": "Alpha", "team_b": "Beta", "winner": "Alpha", "toss_winner": "Alpha", "toss_decision": "bat", "players": pl}

    for wickets, run_outs, wkts, q in ((7, 3, 10, 1), (9, 0, 9, 0), (9, 4, 10, 1)):  # all out by 7 + 3 run-outs; 9 down in 12 overs is a cut-short match; 13 is capped at 10
        m = {"overs": 0, "bpo": 6, "res": 0, "days": 1}
        B._inn_from_totals(m, card(wickets, run_outs), 0, {})
        assert (m["inn"][1][3], m["inn"][1][4], m["q"]) == (wkts, 72, q)


def test_a_scraped_players_catches_and_stumpings_are_kept_and_a_row_with_no_side_is_skipped_not_fatal(tmp_path):
    z, data, out, _ = _out(tmp_path)
    bro = synth.pid(synth.BROOK)
    pl = [{"player": "Harry Brook", "player_id": bro, "team": "Alpha", "opponent": "Beta", "runs": "10", "balls": "8", "catches": "2", "stumpings": "1"},
          {"player": "Harry Brook", "player_id": bro, "team": "", "opponent": "", "runs": "0", "balls": "0", "catches": "1"},  # fielding, no side
          {"player": "Harry Brook", "player_id": bro, "team": "", "opponent": "", "runs": "5", "balls": "6"}]  # batting, no side: used to KeyError in assemble
    (data / "provisional" / "crex-new.json").write_text(json.dumps(_prov("crex-new", "2025-06-01", "Alpha", "Beta", pl)))
    B.build(z, data, out, None, workers=1)  # used to be a KeyError on the empty side
    M, IX = _load(out)
    m, brook = M["id"].index("prov-new"), IX["players"]["id"].index(bro)
    shard = json.loads((out / "p" / f"{int(bro, 16) % IX['nshard']:02d}.json").read_text())
    sh = shard["fld"]
    assert [(sh["ct"][k], sh["st"][k]) for k in range(len(sh["p"])) if sh["p"][k] == brook and sh["m"][k] == m] == [(2, 1)]
    bat = shard["bat"]
    assert [bat["r"][k] for k in range(len(bat["p"])) if bat["p"][k] == brook and bat["m"][k] == m] == [10]


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
    z, data, out, _ = _out(tmp_path)  # Base has the short Alpha v Beta game on 2024-06-01 (Brook 10 + Duckett 20 + Kohli 30 + Gill 3 = 63 batter runs)
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
    assert xq["prov-2025-07-01-5"] == 1 and xq["prov-thin"] == 0


def test_crex_names_link_scraped_players_that_link_players_missed_and_photos_are_keyed_by_cricsheet_id(tmp_path, monkeypatch):
    from cricket_site import crex_assets as ca

    sitemaps = {"player": "<urlset><url><loc>https://src.test/player/harry-brook-1IG</loc></url><url><loc>https://src.test/player/ben-duckett-ZZ</loc></url></urlset>",
                "team": "<urlset><url><loc>https://src.test/team/alpha-A1</loc></url></urlset>",
                "series": "<urlset><url><loc>https://src.test/series/alpha-tour-of-beta-2024-S1</loc></url><url><loc>https://src.test/series/alpha-tour-of-beta-2025-S2</loc></url></urlset>"}
    monkeypatch.setattr(ca, "fetch_sitemap", lambda kind: sitemaps[kind])
    z, data, out, _ = _out(tmp_path)
    pl = [{"player": "Harry Brook", "player_id": "", "team": "Alpha", "opponent": "Beta", "runs": "40", "balls": "20", "fours": "3", "sixes": "2"},
          {"player": "Nobody Known", "player_id": "", "team": "Alpha", "opponent": "Beta", "runs": "5", "balls": "4"}] + [
          {"player": f"F{i}", "player_id": "", "team": "Alpha" if i < 10 else "Beta", "opponent": "Beta" if i < 10 else "Alpha", "runs": "0", "balls": "0"} for i in range(20)]
    d = _prov("crex-new", "2025-06-01", "Alpha", "Beta", pl)
    (data / "provisional" / "crex-new.json").write_text(json.dumps(d))
    meta = B.build(z, data, out, None, workers=1, photos=True, crex_cache=tmp_path / "cache")
    assert meta["provisional_rows_linked"] == 1 and meta["provisional_rows_unlinked"] == 21
    M, IX = _load(out)
    brook = synth.pid(synth.BROOK)
    shard = json.loads((out / "p" / f"{int(brook, 16) % IX['nshard']:02d}.json").read_text())["bat"]
    m = M["id"].index("prov-new")
    assert any(shard["m"][k] == m and shard["r"][k] == 40 for k in range(len(shard["p"])) if IX["players"]["id"][shard["p"][k]] == brook)
    ph = json.loads((out / "photos.json").read_text())
    assert ph["p"][brook] == "c:1IG" and ph["p"][synth.pid(synth.DUCKETT)] == "c:ZZ"   # keyed by Base id, so a shifting index cannot mismatch photos
    assert ph["l"] == {"alpha tour of beta 2024": "S2", "alpha tour of beta 2025": "S2"}   # league logos: the newest season of the same series, the keys folded with one space (as the site folds); "Beta tour of Alpha" is another series and has none
    assert (tmp_path / "cache" / "crex_match.json").exists()


def test_bookmaker_feed_is_odds_only_never_a_fixture_or_start_time(tmp_path):
    (tmp_path / "fixtures").mkdir()
    (tmp_path / "fixtures" / "upcoming.csv").write_text(
        "start_utc,match_id,series,format,gender,team_a,team_b,venue,status,url\n"
        "2026-10-23T05:00Z,afg-u19-x-14SY,Afghanistan U19 vs Bangladesh U19,ODI,male,Afghanistan U19,Bangladesh U19,Oman,Live,u\n"
        "2026-10-23T11:30Z,afg-zim-x,ODI Tri-Nation,ODI,male,Afghanistan,Zimbabwe,Sharjah,Upcoming,u\n")
    vb = tmp_path / "vb"
    vb.mkdir()
    (vb / "value_bets_latest.json").write_text(json.dumps({"events_in_window": [
        {"event": "male|afghanistan|bangladesh|2026-10-23", "start_ist": "2026-10-23 10:30 IST", "format": None},
        {"event": "male|dolphins|badgers|2026-10-23", "start_ist": "2026-10-23 21:30 IST", "format": "T20"}]}))
    fx = B.build_fixtures(tmp_path, vb, {})
    assert [(f["a"], f["start"], f["source"]) for f in fx] == [
        ("Afghanistan U19", "2026-10-23T05:00Z", "src"), ("Afghanistan", "2026-10-23T11:30Z", "src")]


def test_a_priced_match_the_schedule_has_not_reached_yet_gets_a_stop_gap_fixture_until_the_schedule_lists_it(tmp_path):
    (tmp_path / "fixtures").mkdir()
    csv_p = tmp_path / "fixtures" / "upcoming.csv"
    head = "start_utc,match_id,series,format,gender,team_a,team_b,venue,status,url,result\n"
    csv_p.write_text(head + "2040-10-29T11:15Z,x,S,T20,male,Karnali Yaks,Biratnagar Kings,V,Upcoming,u,\n")
    vb = tmp_path / "value_bets" / "out"
    vb.mkdir(parents=True)
    arc = tmp_path / "value_bets" / "archive" / "2040-10"
    arc.mkdir(parents=True)
    def book(name, **k):
        (arc / f"{name}.json").write_text(json.dumps({"match": "Afghanistan vs Zimbabwe", "start_utc": "2040-10-29T14:30:00Z", "fixture": None, "lines": [{"fmt": "T20"}], **k}))

    book("2040-10-29-afghanistan-v-zimbabwe")
    book("2040-10-29-old", match="A vs B", fixture={"id": "x"})   # already linked to a schedule row once: not a stop-gap
    book("2000-10-29-a-v-b", match="A vs B", start_utc="2000-10-29T14:30:00Z")   # long over
    (arc / "broken.json").write_text("{")
    fx = B.build_fixtures(tmp_path, vb, {})
    assert [(f["id"], f["fmt"], f["gender"], f["source"]) for f in fx] == [
        ("2040-10-29-karnali-yaks-v-biratnagar-kings", "T20", "male", "src"), ("2040-10-29-afghanistan-v-zimbabwe", "T20", "male", "books")]
    csv_p.write_text(head + "2040-10-29T14:30Z,y,S,T20,male,Afghanistan,Zimbabwe,Sharjah,Upcoming,u,\n")
    (f,) = B.build_fixtures(tmp_path, vb, {})
    assert (f["source"], f["venue"]) == ("src", "Sharjah")


def test_book_lines_are_copied_into_the_site_data_and_a_missing_or_broken_file_never_fails_the_build(tmp_path):
    z, data, out, _ = _out(tmp_path)
    vb = tmp_path / "vb"
    vb.mkdir()
    doc = {"generated_at_utc": "2026-10-26T10:00:00Z", "lines": [{"pid": "ab12", "stat": "runs", "fmt": "T20", "line": 17.5, "books": [{"source": "smarkets", "over": 1.9, "under": 2.0}]}],
           "events": [{"match": "A vs B", "start_utc": "2026-10-27T07:00:00Z", "markets": ["batter_runs"], "sources": ["smarkets"], "n": 2}],
           "fancy": [{"match": "A vs B", "key": "match_runs", "scope": "match", "team": None, "line": 300.5, "over": 1.9, "under": 1.9}]}
    (vb / "book_lines.json").write_text(json.dumps(doc))
    B.build(z, data, out, vb, workers=1)
    assert json.loads((out / "lines.json").read_text()) == doc
    (vb / "book_lines.json").write_text('{"lines": [')  # half-written
    B.build(z, data, tmp_path / "out2", vb, workers=1)
    assert json.loads((tmp_path / "out2" / "lines.json").read_text()) == {"generated_at_utc": "", "lines": [], "events": [], "fancy": []}
    B.build(z, data, tmp_path / "out3", None, workers=1)  # no value-bets output at all
    assert json.loads((tmp_path / "out3" / "lines.json").read_text())["lines"] == []


def _src_players(monkeypatch, *slugs):
    from cricket_site import crex_assets as ca

    sitemaps = {"player": "<urlset>" + "".join(f"<url><loc>https://src.test/player/{s}</loc></url>" for s in slugs) + "</urlset>",
                "team": "<urlset><url><loc>https://src.test/team/alpha-A1</loc></url></urlset>"}
    monkeypatch.setattr(ca, "fetch_sitemap", lambda kind: sitemaps[kind])


def _vb(tmp_path, lines):
    vb = tmp_path / "vb" / "out"
    vb.mkdir(parents=True)
    (vb / "book_lines.json").write_text(json.dumps({"generated_at_utc": "t", "lines": lines, "events": [], "fancy": []}))
    return vb


def _line(pid, player, book_name=None):
    return {"pid": pid, "player": player, **({"book_name": book_name} if book_name else {}), "stat": "runs", "fmt": "T20", "line": 10.5,
            "books": [{"source": "bet365", "kind": "bookmaker", "over": 1.9, "under": 1.9}]}


def test_the_identity_table_links_the_books_and_hand_checked_links_and_gives_them_to_photos_and_scraped_names(tmp_path, monkeypatch):
    _src_players(monkeypatch, "harry-brook-1IG", "shubman-gill-SG", "run-machine-RM")
    z, data, out, _ = _out(tmp_path)
    brook, gill, kohli = (synth.pid(n) for n in (synth.BROOK, "G Gill", synth.KOHLI))
    (data / "mappings").mkdir()
    (data / "mappings" / "player_identity.csv").write_text(f"player_id,source_id,note\n{kohli},RM,checked by hand: V Kohli is Run Machine\n")
    vb = _vb(tmp_path, [_line(gill, "G Gill", "Shubman Gill"), _line(brook, "HC Brook", "Harry Brook")])
    pl = [{"player": "Run Machine", "player_id": "", "team": "Alpha", "opponent": "Beta", "runs": "33", "balls": "20"}] + [
          {"player": f"F{i}", "player_id": "", "team": "Alpha" if i < 10 else "Beta", "opponent": "Beta" if i < 10 else "Alpha", "runs": "0", "balls": "0"} for i in range(21)]
    (data / "provisional" / "crex-new.json").write_text(json.dumps(_prov("crex-new", "2025-06-01", "Alpha", "Beta", pl)))
    meta = B.build(z, data, out, vb, workers=1, photos=True, crex_cache=tmp_path / "cache")
    ident = json.loads((out / "identity.json").read_text())
    assert ident["s"] == {brook: "1IG", gill: "SG", kohli: "RM"}, "Brook by the photo matcher, Gill by the name the books use, Kohli by hand"
    assert ident["b"] == {gill: ["Shubman Gill"], brook: ["Harry Brook"]}
    assert (meta["identity_linked"], meta["identity_review"]) == (3, 0) and not (out / "identity_review.json").exists()
    ph = json.loads((out / "photos.json").read_text())["p"]
    assert (ph[gill], ph[kohli], ph[brook]) == ("c:SG", "c:RM", "c:1IG"), "a linked player gets his source photo"
    assert [r for r in json.loads((out / "crex_index.json").read_text())["players"] if r[0] == "RM"] == [["RM", "run machine", kohli]]
    assert meta["provisional_rows_linked"] == 1, "the scraped name 'Run Machine' is Kohli now"
    M, IX = _load(out)
    shard = json.loads((out / "p" / f"{int(kohli, 16) % IX['nshard']:02d}.json").read_text())["bat"]
    m = M["id"].index("prov-new")
    assert any(shard["m"][k] == m and shard["r"][k] == 33 for k in range(len(shard["p"])) if IX["players"]["id"][shard["p"][k]] == kohli)


def test_a_priced_player_who_could_not_be_linked_goes_to_the_review_list_and_a_stale_list_is_removed(tmp_path, monkeypatch):
    _src_players(monkeypatch, "harry-brook-1IG", "vaibhav-sooryavanshi-DBT")
    z, data, out, _ = _out(tmp_path)
    gill = synth.pid("G Gill")
    vb = _vb(tmp_path, [_line(gill, "V Gill", "Vaibhav Gillanshi")])
    meta = B.build(z, data, out, vb, workers=1, photos=True, crex_cache=tmp_path / "cache")
    (r,) = json.loads((out / "identity_review.json").read_text())
    assert (r["pid"], r["name"], r["books"], r["why"]) == (gill, "G Gill", ["Vaibhav Gillanshi"], "no source player has this name") and meta["identity_review"] == 1
    assert gill not in json.loads((out / "identity.json").read_text())["s"]
    B.build(z, data, out, None, workers=1, photos=True, crex_cache=tmp_path / "cache")  # nothing priced any more
    assert not (out / "identity_review.json").exists()


def test_the_sitemap_lists_the_fixtures_with_a_date_and_robots_keeps_crawlers_off_the_api(tmp_path):
    A = {"pids": [], "pstat": {}, "ms": [{"venue": "Ground", "event": "", "teams": []} for _ in range(8)], "events": [], "team_ix": {}, "venues": ["Ground"]}
    out = tmp_path / "public" / "data"
    out.mkdir(parents=True)
    n = B.build_sitemap(out, A, {}, "https://example.test/", [{"id": "2026-10-29-afghanistan-v-zimbabwe"}])
    sm = (tmp_path / "public" / "sitemap.xml").read_text()
    assert "<loc>https://example.test/fixture/2026-10-29-afghanistan-v-zimbabwe</loc><lastmod>" in sm and n == len(sm.split("<url>")) - 1
    assert "<loc>https://example.test/venue/0</loc>" in sm
    assert "/privacy" not in sm and "/terms" not in sm and "/disclaimer" not in sm and "/docs" not in sm and "/privacy-policy" not in sm
    robots = (tmp_path / "public" / "robots.txt").read_text()
    assert "Disallow: /api/" in robots and "Disallow: /data/" in robots
    assert robots.index("User-agent: Twitterbot") < robots.index("Disallow: /api/")
    assert "User-agent: Twitterbot\nAllow: /" in robots
    for bot in ("GPTBot", "ClaudeBot", "CCBot", "Google-Extended", "Bytespider", "SemrushBot"):  # training crawlers and SEO scrapers
        assert f"User-agent: {bot}\nDisallow: /\n" in robots
    for bot in ("ChatGPT-User", "OAI-SearchBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Perplexity-User"):  # assistants and AI search follow the `*` rules: pages yes, /api/ and /data/ no
        assert f"User-agent: {bot}" not in robots
    assert "User-agent: Googlebot" not in robots and "User-agent: Bingbot" not in robots  # search engines stay allowed


def test_a_priced_test_day_is_not_a_second_fixture_beside_the_schedules_test(tmp_path):
    from datetime import datetime, timezone

    arc = tmp_path / "value_bets" / "archive" / "2026-10"
    arc.mkdir(parents=True)
    vb = tmp_path / "value_bets" / "out"
    vb.mkdir(parents=True)

    def book(name, start):
        (arc / f"{name}.json").write_text(json.dumps({"match": "Bangladesh vs West Indies", "start_utc": start, "fixture": None, "lines": [{"fmt": "Test"}]}))

    book("day2", "2026-10-29T03:30:00Z")   # the books' list for the Test's second day
    book("later", "2026-11-10T03:30:00Z")  # a different match of the series
    now = datetime(2026, 10, 29, 3, 0, tzinfo=timezone.utc)
    test = [{"start": "2026-10-28T03:30Z", "fmt": "Test", "a": "Bangladesh", "b": "West Indies"}]
    assert [r["start"] for r in B._unscheduled_priced(vb, test, now=now)] == ["2026-11-10T03:30Z"]  # day 2 is the schedule's Test
    t20 = [{**test[0], "fmt": "T20"}]
    assert [r["start"] for r in B._unscheduled_priced(vb, t20, now=now)] == ["2026-10-29T03:30Z", "2026-11-10T03:30Z"]  # a T20 a day apart is another match


def test_duplicate_unscheduled_archive_starts_across_midnight_publish_one_fixture(tmp_path):
    from datetime import datetime, timezone

    arc = tmp_path / "archive" / "2026-11"
    arc.mkdir(parents=True)
    for start in ("2026-11-10T21:50:00Z", "2026-11-11T01:50:00Z", "2026-11-12T01:50:00Z"):
        (arc / f"{start[:10]}.json").write_text(json.dumps({
            "match": "SCG Gov XI vs ADF Tour", "start_utc": start, "fixture": None, "lines": [],
        }))
    rows = B._unscheduled_priced(tmp_path / "out", [], now=datetime(2026, 11, 11, 2, tzinfo=timezone.utc))
    assert [r["start"] for r in rows] == ["2026-11-10T21:50Z", "2026-11-12T01:50Z"]
    assert len(list(arc.glob("*.json"))) == 3


def test_a_priced_test_the_schedule_dropped_comes_back_from_its_archive(tmp_path):
    from datetime import datetime, timezone

    arc = tmp_path / "value_bets" / "archive" / "2026-10"
    arc.mkdir(parents=True)
    vb = tmp_path / "value_bets" / "out"
    vb.mkdir(parents=True)
    (arc / "2026-10-27-south-africa-v-australia.json").write_text(json.dumps({
        "match": "South Africa vs Australia", "start_utc": "2026-10-27T08:30:00Z",
        "fixture": {"id": "2026-10-27-south-africa-v-australia", "start": "2026-10-27T08:30Z", "fmt": "Test",
                    "gender": "male", "a": "South Africa", "b": "Australia", "venue": "Newlands, Cape Town",
                    "series": "Australia tour of South Africa 2026"},
        "lines": [{"fmt": "Test"}],
    }))
    now = datetime(2026, 10, 30, 12, 0, tzinfo=timezone.utc)
    got = B._unscheduled_priced(vb, [], now=now)
    assert [(r["a"], r["status"], r["venue"], r["series"]) for r in got] == [
        ("South Africa", "Started", "Newlands, Cape Town", "Australia tour of South Africa 2026")]
    listed = [{"start": "2026-10-27T08:30Z", "fmt": "Test", "a": "South Africa", "b": "Australia"}]
    assert B._unscheduled_priced(vb, listed, now=now) == []


def test_a_match_named_by_its_sides_joins_the_series_of_its_siblings():
    rows = [{"start": "2026-10-27T14:30Z", "a": "Afghanistan", "b": "Zimbabwe", "series": "Afghanistan vs Zimbabwe in UAE 2026"},
            {"start": "2026-11-01T14:30Z", "a": "Afghanistan", "b": "Zimbabwe", "series": "AFG vs ZIM"},
            {"start": "2026-11-01T14:30Z", "a": "Oman", "b": "Nepal", "series": "OMN vs NEP"},                      # no sibling: stays as it is
            {"start": "2027-03-01T14:30Z", "a": "Afghanistan", "b": "Zimbabwe", "series": "AFG vs ZIM"}]            # months away: another series
    B._name_series(rows)
    assert [r["series"] for r in rows] == ["Afghanistan vs Zimbabwe in UAE 2026", "Afghanistan vs Zimbabwe in UAE 2026", "OMN vs NEP", "AFG vs ZIM"]


def test_a_scraped_matchs_event_takes_the_base_name_of_the_same_league_so_a_live_season_sits_with_its_history():
    canonical = [{"event": "Women's Big Bash League", "gender": 1}, {"event": "Big Bash League", "gender": 0}, {"event": "Indian Premier League", "gender": 0},
                 {"event": "Alpha tour of Beta, 2024", "gender": 0}, {"event": "Alpha tour of Beta, 2025", "gender": 0}, {"event": "", "gender": 0}]
    table = B.canonical_events(canonical)
    assert B.base_event("Womens Big Bash League", 1, table) == "Women's Big Bash League"       # no apostrophe in the scrape
    assert B.base_event("Big Bash League 2026-27", 0, table) == "Big Bash League"              # a season in the name
    assert B.base_event("Big Bash League", 1, table) == "Big Bash League"                      # a women's match is never put in the men's league: left as scraped
    assert B.base_event("Women's Big Bash League", 1, table) == "Women's Big Bash League"
    assert B.base_event("IPL 2026", 0, table) == "IPL 2026"                                    # another name for it: left as scraped
    assert B.base_event("Alpha tour of Beta, 2026", 0, table) == "Alpha tour of Beta, 2026"    # two Base names share one league key: no guess
    assert B.base_event("", 0, table) == ""


def test_a_priced_match_the_books_name_differently_is_not_a_second_fixture(tmp_path):
    """The schedule says "Dolphins v Rocks", the archive file of the books' pull "Dolphins vs Boland" (no schedule row linked): one fixture, the schedule's."""
    from datetime import datetime, timezone

    arc = tmp_path / "value_bets" / "archive" / "2026-11"
    arc.mkdir(parents=True)
    vb = tmp_path / "value_bets" / "out"
    vb.mkdir(parents=True)
    (arc / "2026-11-01-dolphins-v-boland.json").write_text(json.dumps({"match": "Dolphins vs Boland", "start_utc": "2026-11-01T08:00:00Z", "fixture": None, "lines": [{"fmt": "T20"}]}))
    now = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)
    sched = [{"start": "2026-11-01T08:00Z", "fmt": "T20", "a": "Dolphins", "b": "Rocks"}]
    assert B._unscheduled_priced(vb, sched, now=now) == []
    assert [r["a"] for r in B._unscheduled_priced(vb, [], now=now)] == ["Dolphins"]  # with no schedule row it is still the stop-gap
    (tmp_path / "fixtures").mkdir()
    (tmp_path / "fixtures" / "upcoming.csv").write_text("start_utc,match_id,series,format,gender,team_a,team_b,venue,status,url,result\n"
                                                         "2026-11-01T08:00Z,x,CSA,T20,male,Dolphins,Rocks,Kingsmead,Upcoming,,\n")
    assert [f["id"] for f in B.build_fixtures(tmp_path, vb, {})] == ["2026-11-01-dolphins-v-rocks"]


def test_a_started_priced_match_nothing_lists_is_started_not_live(tmp_path):
    """1 Nov 2026: two pro50 matches the books priced (fancy only, no schedule row, no live-feed row) were published as Live by the clock alone and showed a LIVE badge with no score and no players."""
    from datetime import datetime, timezone

    arc = tmp_path / "value_bets" / "archive" / "2026-11"
    arc.mkdir(parents=True)
    vb = tmp_path / "value_bets" / "out"
    vb.mkdir(parents=True)

    def book(name, match, start, **k):
        (arc / f"{name}.json").write_text(json.dumps({"match": match, "start_utc": start, "fixture": None, "lines": [], "fancy": [{"key": "match_runs"}], **k}))

    book("2026-11-01-eagles-v-tuskers", "Eagles vs Tuskers", "2026-11-01T07:30:00Z")
    book("2026-11-01-mid-west-rhinos-v-mountaineers", "MID West Rhinos vs Mountaineers", "2026-11-01T07:30:00Z")
    book("2026-11-01-later", "Lions vs Titans", "2026-11-01T12:00:00Z")
    book("2026-10-31-over", "Dolphins vs Boland", "2026-10-31T07:30:00Z")                                            # past its 24 h keep window: gone
    book("2026-11-01-resulted", "Namibia vs Ireland", "2026-11-01T05:00:00Z", fixture={"start": "2026-11-01T05:00Z", "fmt": "T20", "gender": "male", "a": "Namibia", "b": "Ireland", "result": "Namibia won by 3 wickets"})
    now = datetime(2026, 11, 1, 10, 30, tzinfo=timezone.utc)                                                          # 3 hours after the first two began
    got = {r["a"]: (r["status"], r["source"]) for r in B._unscheduled_priced(vb, [], now=now)}
    assert got == {"Eagles": ("Started", "books"), "MID West Rhinos": ("Started", "books"), "Lions": ("Upcoming", "books"), "Namibia": ("Completed", "books")}
    # the schedule's own row replaces the stop-gap and carries the schedule's word, Live included
    sched = [{"start": "2026-11-01T07:30Z", "fmt": "", "a": "Eagles", "b": "Tuskers", "status": "Live", "source": "src"}]
    assert "Eagles" not in {r["a"] for r in B._unscheduled_priced(vb, sched, now=now)}


def _archive_test(arc, name, match, start, **extra):
    (arc / f"{name}.json").write_text(json.dumps({"id": name, "match": match, "start_utc": start, "lines": [{"fmt": "Test"}], **extra}))


def test_a_priced_test_the_schedule_has_dropped_is_started_until_its_fixture_has_a_result_and_gone_a_day_after_it_ended(tmp_path):
    from datetime import datetime, timezone

    arc = tmp_path / "value_bets" / "archive" / "2026-10"
    arc.mkdir(parents=True)
    vb = tmp_path / "value_bets" / "out"
    vb.mkdir(parents=True)
    start = "2026-10-28T09:00:00Z"
    fixture = {"start": start, "fmt": "Test"}
    _archive_test(arc, "2026-10-28-sa-v-aus", "South Africa vs Australia", start, fixture={**fixture, "a": "South Africa", "b": "Australia", "result": ""})              # at stumps
    _archive_test(arc, "2026-10-28-ban-v-wi", "Bangladesh vs West Indies", start, fixture={**fixture, "a": "Bangladesh", "b": "West Indies", "result": "West Indies won by 5 wickets"},
                  settled_at="2026-10-31T10:00:00Z", results=[{"pid": "a", "stat": "runs", "value": 3}])
    _archive_test(arc, "2026-10-28-ind-v-eng", "India vs England", start)                                                                                               # never on the schedule
    by = lambda now: {f["a"]: (f["status"], f["result"]) for f in B._unscheduled_priced(vb, [], now=now)}  # noqa: E731
    day5 = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)   # the Test with a result ended 31 Oct 10:00: listed until 1 Nov 10:00
    assert by(day5) == {"South Africa": ("Started", ""), "Bangladesh": ("Completed", "West Indies won by 5 wickets"), "India": ("Started", "")}
    assert set(by(datetime(2026, 11, 1, 11, 0, tzinfo=timezone.utc))) == {"South Africa", "India"}   # a Test with no result yet keeps its 6 days
    assert by(datetime(2026, 11, 3, 10, 0, tzinfo=timezone.utc)) == {}


def test_a_priced_test_expires_from_the_start_it_publishes(tmp_path):
    from datetime import datetime, timezone

    arc = tmp_path / "archive" / "2026-11"
    arc.mkdir(parents=True)
    vb = tmp_path / "out"
    start = "2026-11-02T03:00Z"
    _archive_test(arc, "2026-11-02-a-v-b", "A vs B", "2026-11-02T08:00Z", fixture={"start": start, "fmt": "Test"})
    before = datetime(2026, 11, 8, 2, 59, tzinfo=timezone.utc)
    assert [(r["start"], r["status"]) for r in B._unscheduled_priced(vb, [], now=before)] == [(start, "Started")]
    after = datetime(2026, 11, 8, 4, 50, tzinfo=timezone.utc)
    assert B._unscheduled_priced(vb, [], now=after) == []


def test_a_scheduled_test_leaves_the_fixtures_a_day_after_it_ended_and_nothing_else_does(tmp_path):
    from datetime import datetime, timezone

    (tmp_path / "fixtures").mkdir()
    head = "start_utc,match_id,series,format,gender,team_a,team_b,venue,status,url,result\n"
    (tmp_path / "fixtures" / "upcoming.csv").write_text(head
        + "2026-10-28T09:00Z,a,S,Test,male,South Africa,Australia,Newlands,Live,u,\n"            # ended 31 Oct 10:00 (settled_at)
        + "2026-10-28T09:00Z,b,S,Test,male,Bangladesh,West Indies,Mirpur,Live,u,\n"              # whole-match result stored before settled_at existed
        + "2026-10-28T09:00Z,c,S,Test,male,India,England,Mumbai,Live,u,\n"                       # no result yet
        + "2026-11-05T09:00Z,d,S,Test,male,South Africa,Australia,Durban,Upcoming,u,\n"          # the next Test of the series, a match of its own
        + "2026-10-31T09:00Z,e,S,T20,male,South Africa,Australia,Newlands,Completed,u,won\n")    # limited overs: not this rule's business
    arc = tmp_path / "value_bets" / "archive" / "2026-10"
    arc.mkdir(parents=True)
    vb = tmp_path / "value_bets" / "out"
    vb.mkdir(parents=True)
    start = "2026-10-28T09:00:00Z"
    _archive_test(arc, "2026-10-28-south-africa-v-australia", "South Africa vs Australia", start, settled_at="2026-10-31T10:00:00Z", results=[{"pid": "a", "stat": "runs", "value": 3}])
    _archive_test(arc, "2026-10-28-bangladesh-v-west-indies", "Bangladesh vs West Indies", start, results=[{"pid": "a", "stat": "runs", "value": 3}])
    listed = lambda now: sorted((f["a"], f["start"][:10]) for f in B.build_fixtures(tmp_path, vb, {}, now=now))  # noqa: E731
    everything = [("Bangladesh", "2026-10-28"), ("India", "2026-10-28"), ("South Africa", "2026-10-28"), ("South Africa", "2026-10-31"), ("South Africa", "2026-11-05")]
    assert listed(datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)) == everything                       # 23 h after the result, and day 5 starts 1 Nov 09:00
    assert listed(datetime(2026, 11, 1, 11, 0, tzinfo=timezone.utc)) == [x for x in everything if x != ("South Africa", "2026-10-28")]
    assert listed(datetime(2026, 11, 2, 10, 0, tzinfo=timezone.utc)) == [("India", "2026-10-28"), ("South Africa", "2026-10-31"), ("South Africa", "2026-11-05")]   # no end recorded: start of day 5 + 24 h
    assert listed(datetime(2026, 11, 4, 10, 0, tzinfo=timezone.utc))[0] == ("India", "2026-10-28"), "a Test with no result keeps its place until the schedule itself lets go"


def test_the_weather_flag_is_published_per_match_for_the_data_guard(tmp_path):
    z, data, out, _ = _out(tmp_path)
    pl = [{"player": "A One", "player_id": "", "team": "Alpha", "opponent": "Beta", "runs": "40", "balls": "20"}]
    for mid, margin in (("crex-wet", "5 runs (DLS method)"), ("crex-dry", "5 runs")):
        (data / "provisional" / f"{mid}.json").write_text(json.dumps(_prov(mid, "2025-06-01" if mid == "crex-wet" else "2025-06-02", "Alpha", "Beta", pl, result_margin=margin)))
    B.build(z, data, out, None, workers=1)
    M, _ = _load(out)
    assert len(M["dls"]) == len(M["id"]) and set(M["dls"]) <= {0, 1}
    assert (M["dls"][M["id"].index("prov-wet")], M["dls"][M["id"].index("prov-dry")]) == (1, 0)


def test_untracked_formats_and_series_are_not_published(tmp_path):
    """Matches in config/untracked.json stay in the data and the archive but get no fixture row; emptying the file turns them back on."""
    cfg = tmp_path / "u.json"
    cfg.write_text('{"formats": ["FC"], "series": ["Ranji"]}', encoding="utf-8")
    assert B._untracked(cfg) == ({"FC"}, ["ranji"])
    assert B._untracked(tmp_path / "missing.json") == (set(), [])
    assert "FC" in B._untracked()[0]  # the shipped config hides first-class


def _minted_game(date, mid, name, pid, n=22):
    """A scraped game where one player carries an id `link-players` minted (nothing in Base names him)."""
    pl = [{"player": name if i == 0 else f"P{i}", "player_id": pid if i == 0 else "", "team": "Alpha" if i < 11 else "Beta", "opponent": "Beta" if i < 11 else "Alpha",
           "runs": "21" if i == 0 else "0", "balls": "10"} for i in range(n)]
    return _prov(mid, date, "Alpha", "Beta", pl)


def test_a_player_only_scraped_matches_know_is_matched_by_his_full_name(tmp_path, monkeypatch):
    """Dewan Marais had no face: Base's names are initials and the photo matcher only looked at Base players, so a minted id (name = the id) never met the source's list."""
    _src_players(monkeypatch, "dewan-marais-9PP", "harry-brook-1IG")
    z, data, out, _ = _out(tmp_path)
    (data / "provisional" / "crex-m.json").write_text(json.dumps(_minted_game("2025-06-01", "crex-m", "Dewan Marais", "deadbeef")))
    people = B.provisional_people(data, {})
    assert people["deadbeef"] == {"name": "Dewan Marais", "n": 1, "last": "2025-06-01"} and "" not in people
    assert B.provisional_people(data, {"deadbeef": "D Marais"}) == {}, "a player Base names is Base's to match"
    B.build(z, data, out, None, workers=1, photos=True, crex_cache=tmp_path / "cache")
    ph = json.loads((out / "photos.json").read_text())["p"]
    assert ph["deadbeef"] == "c:9PP" and ph[synth.pid(synth.BROOK)] == "c:1IG"


def test_a_source_player_the_list_dropped_keeps_his_face_and_a_remembered_namesake_never_breaks_a_link_that_works(tmp_path, monkeypatch):
    """1500+ players had a photo link in an earlier build and none now: the source's list drifts. Pass 1 is the old behaviour, so a remembered name only adds."""
    _src_players(monkeypatch, "ben-duckett-ZZ")                      # today's list: Duckett only; Brook's page dropped off it
    z, data, out, _ = _out(tmp_path)
    remembered = [("harry brook", "1IG"), ("ben duckett", "ZZ"), ("brian duckett", "BD")]  # a remembered namesake of Duckett, same surname and first initial
    monkeypatch.setattr(B, "source_memory", lambda: (remembered, set()))
    B.build(z, data, out, None, workers=1, photos=True, crex_cache=tmp_path / "cache")
    ph = json.loads((out / "photos.json").read_text())["p"]
    assert ph[synth.pid(synth.BROOK)] == "c:1IG", "remembered, so the face we hold is kept"
    assert ph[synth.pid(synth.DUCKETT)] == "c:ZZ", "matched on today's list alone; the remembered Brian Duckett cannot make him ambiguous"
    assert any(r[0] == "1IG" for r in json.loads((out / "crex_index.json").read_text())["players"])


def test_a_stock_avatar_is_not_a_photo_the_commons_photo_replaces_it_and_the_identity_link_stays(tmp_path, monkeypatch):
    _src_players(monkeypatch, "harry-brook-1IG", "ben-duckett-ZZ")
    z, data, out, _ = _out(tmp_path)
    monkeypatch.setattr(B, "source_memory", lambda: ([], {"1IG"}))   # the picture stored for 1IG is one many players share
    vb = _vb(tmp_path, [_line(synth.pid(synth.BROOK), "HC Brook", "Harry Brook")])
    meta = B.build(z, data, out, vb, workers=1, photos=True, crex_cache=tmp_path / "cache")
    ph = json.loads((out / "photos.json").read_text())["p"]
    assert synth.pid(synth.BROOK) not in ph and ph[synth.pid(synth.DUCKETT)] == "c:ZZ"
    assert json.loads((out / "identity.json").read_text())["s"][synth.pid(synth.BROOK)] == "1IG", "live matching still knows who he is"
    assert (meta["priced_players"], meta["priced_with_photo"]) == (1, 0)


def test_faces_swaps_a_stock_avatar_for_the_commons_photo_or_nothing():
    cx = {"p": {"a": "c:S1", "b": "c:S2", "c": "w:x.jpg", "d": "c:S4", "e": "c:S1"}, "w": {"a": "w:A.jpg"}}
    assert B.faces(cx, {"a", "b", "c", "d"}, {"S1", "S2"}) == {"a": "w:A.jpg", "c": "w:x.jpg", "d": "c:S4"}
    assert B.faces({"p": {"a": "c:S1"}}, {"a"}, {"S1"}) == {}, "a cache from before this existed has no `w`"
    assert B.faces(cx, {"a", "b", "c", "d"}, set()) == {"a": "c:S1", "b": "c:S2", "c": "w:x.jpg", "d": "c:S4"}


def test_a_minted_priced_player_whose_page_belongs_to_the_base_player_gets_the_same_face(tmp_path, monkeypatch):
    """Priced as 'Ben Duckett' under a minted id while Base lists him as BM Duckett: one source page, so one picture; the link stays with Base's id."""
    _src_players(monkeypatch, "ben-duckett-ZZ")
    z, data, out, _ = _out(tmp_path)
    (data / "provisional" / "crex-m.json").write_text(json.dumps(_minted_game("2025-06-01", "crex-m", "Ben Duckett", "deadbeef")))
    vb = _vb(tmp_path, [_line("deadbeef", "Ben Duckett")])
    meta = B.build(z, data, out, vb, workers=1, photos=True, crex_cache=tmp_path / "cache")
    ph = json.loads((out / "photos.json").read_text())["p"]
    ident = json.loads((out / "identity.json").read_text())["s"]
    assert ph["deadbeef"] == ph[synth.pid(synth.DUCKETT)] == "c:ZZ"
    assert list(ident.values()).count("ZZ") == 1, "the identity table keeps one id per source player"
    assert (meta["priced_players"], meta["priced_with_photo"]) == (1, 1) and not (out / "identity_review.json").exists()


def test_a_book_that_names_a_youth_match_by_its_competition_alone_is_not_a_second_fixture(tmp_path):
    """10 Nov 2026: a book listed "India vs United Arab Emirates" in "U19 Asia Cup"; the schedule has India U19 / United Arab Emirates U19, so the archive file became a senior T20 stop-gap with no score."""
    from datetime import datetime, timezone

    arc = tmp_path / "value_bets" / "archive" / "2026-11"
    arc.mkdir(parents=True)
    vb = tmp_path / "value_bets" / "out"
    vb.mkdir(parents=True)
    for name, match in (("2026-11-10-india-v-united-arab-emirates", "India vs United Arab Emirates"), ("2026-11-10-india-u19-v-uae-u19", "India U19 vs UAE U19")):
        (arc / f"{name}.json").write_text(json.dumps({"match": match, "competition": "U19 Asia Cup", "start_utc": "2026-11-10T05:00:00Z", "fixture": None, "events": [{}]}))
    now = datetime(2026, 11, 10, 6, 0, tzinfo=timezone.utc)
    listed = [{"start": "2026-11-10T05:00Z", "fmt": "ODI", "a": "India U19", "b": "United Arab Emirates U19"}]
    assert B._unscheduled_priced(vb, listed, now=now) == []
    assert [r["a"] for r in B._unscheduled_priced(vb, [], now=now)] == ["India U19", "India U19"]  # with no schedule row the stop-gap at least carries the youth tag


def test_a_feed_that_names_a_priced_match_with_other_team_names_is_not_a_second_fixture(tmp_path):
    """9 Nov 2026: "Bangla Tigers v Royal Champs" is the schedule's United Tigers v Royal Desert Champions (same start; the same feed's other pairings line up the same way), and "West Indies A v England Lions" is West Indies A v England A."""
    from datetime import datetime, timezone

    arc = tmp_path / "value_bets" / "archive" / "2026-11"
    arc.mkdir(parents=True)
    vb = tmp_path / "value_bets" / "out"
    vb.mkdir(parents=True)
    for name, match, start in (("2026-11-09-bangla-tigers-v-royal-champs", "Bangla Tigers vs Royal Champs", "2026-11-09T16:00:00Z"),
                               ("2026-11-09-west-indies-a-v-england-lions", "West Indies A vs England Lions", "2026-11-09T18:00:00Z"),
                               ("2026-11-10-delhi-bulls-v-emirates-eagles", "Delhi Bulls vs Emirates Eagles", "2026-11-10T16:00:00Z")):
        (arc / f"{name}.json").write_text(json.dumps({"match": match, "competition": "", "start_utc": start, "fixture": None, "events": [{}]}))
    now = datetime(2026, 11, 10, 20, 0, tzinfo=timezone.utc)
    listed = [{"start": "2026-11-09T16:00Z", "fmt": "T10", "a": "United Tigers", "b": "Royal Desert Champions"},
              {"start": "2026-11-09T18:00Z", "fmt": "ODI", "a": "West Indies A", "b": "England A"},
              {"start": "2026-11-10T16:00Z", "fmt": "T10", "a": "UAE Bulls", "b": "Emirates Eagles"}]
    assert B._unscheduled_priced(vb, listed, now=now) == []
