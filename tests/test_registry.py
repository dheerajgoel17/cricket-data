import json

from cricket_data.cli import main
from cricket_data.models import MatchRecord, PlayerPerf
from cricket_data.registry import build_rosters, freshness, iter_combined, link_players, resolve
from cricket_data.store import Store


def _canon(store, date="2026-10-01", mid="c1", players=(("HC Brook", "4ae1755b"), ("JE Root", "a343262c"))):
    rec = MatchRecord(match_id=mid, date=date, match_type="ODI", team_type="international", gender="male",
                      event="e", venue="v", team_a="England", team_b="Pakistan", winner="England",
                      status="canonical", source="cricsheet",
                      players=[PlayerPerf(match_id=mid, date=date, player=n, player_id=pid, team="England",
                                          opponent="Pakistan", runs=10, sixes=1) for n, pid in players])
    store.upsert([rec])


def _prov(store, date="2026-10-20", mid="crex-eng-vs-pak", teams=("Pakistan", "England"), names=("Harry Brook",)):
    d = {"match_id": mid, "date": date, "match_type": "ODI", "team_type": "international", "gender": "male",
         "event": "e", "venue": "Rawalpindi", "team_a": teams[0], "team_b": teams[1], "toss_winner": "",
         "toss_decision": "", "winner": "Pakistan", "result": "win", "result_margin": "", "player_of_match": "",
         "status": "provisional", "source": "crex",
         "players": [{"match_id": mid, "date": date, "player": n, "player_id": "", "team": "England",
                      "opponent": "Pakistan", "runs": "5", "balls": "7", "fours": "0", "sixes": "0",
                      "wickets": "0", "balls_bowled": "0", "runs_conceded": "0", "catches": "0",
                      "stumpings": "0", "run_outs": "0", "points": "0"} for n in names]}
    p = store.root / "provisional" / f"{mid}.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(d))
    return p


def test_resolve_initials_and_ambiguity():
    ros = {("england", "male"): {"a": ("HC Brook", "2026", 5), "b": ("JE Root", "2026", 5),
                                 "c": ("S Curran", "2026", 1), "d": ("SM Curran", "2026", 1)}}
    assert resolve("Harry Brook", "England", ros, {})[0] == "a"
    assert resolve("JE Root", "England", ros, {}) == ("b", "exact", "")
    assert resolve("Sam Curran", "England", ros, {})[1] == "ambiguous"
    assert resolve("Zak Crawley", "England", ros, {})[0] == ""
    assert resolve("Harry Brook", "England Women", ros, {}, "female")[1] == "team_not_in_cricsheet"
    assert resolve("Sam Curran", "England", ros, {("sam curran", "england"): "d"}) == ("d", "alias", "")


def test_link_players_fills_ids_and_reports(tmp_path):
    store = Store(tmp_path)
    _canon(store)
    p = _prov(store, names=("Harry Brook", "Nobody Known"))
    st = link_players(store)
    assert st["linked"] == 1 and st["unmatched"] == 1
    doc = json.loads(p.read_text())
    assert doc["players"][0]["player_id"] == "4ae1755b"
    rep = (tmp_path / "provisional_unmatched.csv").read_text()
    assert "Nobody Known" in rep and "Harry Brook" not in rep
    assert ("england", "male") in build_rosters(store)


def test_combined_dedupes_when_cricsheet_lands(tmp_path):
    store = Store(tmp_path)
    _canon(store)
    _prov(store)
    assert any(r["match_id"] == "crex-eng-vs-pak" for r in iter_combined(store, "matches"))
    assert not any(r["match_id"] == "crex-eng-vs-pak" for r in iter_combined(store, "matches", False))
    _canon(store, date="2026-10-20", mid="c2")  # Cricsheet publishes the same fixture
    ids = [r["match_id"] for r in iter_combined(store, "players")]
    assert "crex-eng-vs-pak" not in ids and "c2" in ids


def test_freshness_and_cli(tmp_path, capsys):
    from datetime import date
    store = Store(tmp_path)
    _canon(store, date="2026-10-14")
    _prov(store)
    f = freshness(store, today=date(2026, 10, 22))
    assert f["age_days"] == 8 and f["provisional_after_canonical"] == 1
    assert main(["--data-dir", str(tmp_path), "freshness", "--max-age-days", "100000"]) == 0
    assert main(["--data-dir", str(tmp_path), "freshness", "--max-age-days", "-1"]) == 1
    main(["--data-dir", str(tmp_path), "link-players"])
    capsys.readouterr()
    main(["--data-dir", str(tmp_path), "query", "Brook"])
    out = capsys.readouterr().out
    assert "2026-10-20" in out and "4ae1755b" in out
    main(["--data-dir", str(tmp_path), "query", "Brook", "--canonical-only"])
    assert "2026-10-20" not in capsys.readouterr().out
