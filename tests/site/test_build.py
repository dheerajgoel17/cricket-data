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


def test_a_scraped_players_catches_and_stumpings_are_kept_and_a_row_with_no_side_is_skipped_not_fatal(tmp_path):
    z, data, out, _ = _out(tmp_path)
    bro = synth.pid(synth.BROOK)
    pl = [{"player": "Harry Brook", "player_id": bro, "team": "Alpha", "opponent": "Beta", "runs": "10", "balls": "8", "catches": "2", "stumpings": "1"},
          {"player": "Harry Brook", "player_id": bro, "team": "", "opponent": "", "runs": "0", "balls": "0", "catches": "1"}]  # a scraped row naming no side
    (data / "provisional" / "crex-new.json").write_text(json.dumps(_prov("crex-new", "2025-06-01", "Alpha", "Beta", pl)))
    B.build(z, data, out, None, workers=1)  # used to be a KeyError on the empty side
    M, IX = _load(out)
    m, brook = M["id"].index("prov-new"), IX["players"]["id"].index(bro)
    sh = json.loads((out / "p" / f"{int(bro, 16) % IX['nshard']:02d}.json").read_text())["fld"]
    assert [(sh["ct"][k], sh["st"][k]) for k in range(len(sh["p"])) if sh["p"][k] == brook and sh["m"][k] == m] == [(2, 1)]


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
                "team": "<urlset><url><loc>https://src.test/team/alpha-A1</loc></url></urlset>"}
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
    A = {"pids": [], "pstat": {}, "ms": [], "events": [], "team_ix": {}}
    out = tmp_path / "public" / "data"
    out.mkdir(parents=True)
    n = B.build_sitemap(out, A, {}, "https://example.test/", [{"id": "2026-10-29-afghanistan-v-zimbabwe"}])
    sm = (tmp_path / "public" / "sitemap.xml").read_text()
    assert "<loc>https://example.test/fixture/2026-10-29-afghanistan-v-zimbabwe</loc><lastmod>" in sm and n == len(sm.split("<url>")) - 1
    robots = (tmp_path / "public" / "robots.txt").read_text()
    assert "Disallow: /api/" in robots and "Disallow: /data/" in robots


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


def test_a_match_named_by_its_sides_joins_the_series_of_its_siblings():
    rows = [{"start": "2026-10-27T14:30Z", "a": "Afghanistan", "b": "Zimbabwe", "series": "Afghanistan vs Zimbabwe in UAE 2026"},
            {"start": "2026-11-01T14:30Z", "a": "Afghanistan", "b": "Zimbabwe", "series": "AFG vs ZIM"},
            {"start": "2026-11-01T14:30Z", "a": "Oman", "b": "Nepal", "series": "OMN vs NEP"},                      # no sibling: stays as it is
            {"start": "2027-03-01T14:30Z", "a": "Afghanistan", "b": "Zimbabwe", "series": "AFG vs ZIM"}]            # months away: another series
    B._name_series(rows)
    assert [r["series"] for r in rows] == ["Afghanistan vs Zimbabwe in UAE 2026", "Afghanistan vs Zimbabwe in UAE 2026", "OMN vs NEP", "AFG vs ZIM"]
