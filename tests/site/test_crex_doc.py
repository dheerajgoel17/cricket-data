import json

import synth
from crex_fixture import FIXTURE, card

from cricket_data import crex_balls
from cricket_data.store import Store
from cricket_site import build as B
from cricket_site.crex_doc import balls_doc
from cricket_site.parse import parse_match

INFO = {"dates": ["2026-10-13"], "match_type": "T20", "team_type": "club", "gender": "male",
        "teams": ["India Champions", "West Indies Champions"], "outcome": {"winner": "West Indies Champions"}}


def rows():
    balls = crex_balls.parse_balls(FIXTURE["events"], "13W5", card())
    return crex_balls.rows_for("crex-x", "2026-10-13", balls)


def stored(rs):  # as read back from the CSV store: everything is a string
    return [{k: str(v) for k, v in r.items()} for r in rs]


def people():
    return {n: f"pid{i:04d}" for i, n in enumerate(sorted(set(card().names.values())))}


def test_doc_parses_to_the_scorecard_numbers():
    m = parse_match("crex-x", balls_doc(stored(rows()), dict(INFO, registry={"people": people()})))
    one, two = m["innings"]
    assert (one["team"], one["runs"], one["wkts"], one["balls"]) == ("India Champions", 110, 8, 120)
    assert (two["runs"], two["wkts"]) == (111, 4)
    assert m["q"] == 0  # the chase ended inside 15 overs: below 80% of 20, so summary markets are void
    # every batter's line equals CREX's scorecard
    pid = people()
    for k, inn in enumerate(card().innings):
        for b in inn.batters:
            if b.balls or b.runs:
                row = m["innings"][k]["bat"][pid[card().names[b.pid]]]
                assert (row["r"], row["b"], row["f"], row["s"]) == (b.runs, b.balls, b.fours, b.sixes)
    assert m["innings"][0]["parts"], "partnerships come from the deliveries"
    assert [i["f4"] for i in m["innings"]] == [sum(b.fours for b in inn.batters) for inn in card().innings]


def test_extras_reach_the_runs_and_wickets_are_typed():
    doc = balls_doc(stored(rows()), INFO)
    dls = [d for inn in doc["innings"] for o in inn["overs"] for d in o["deliveries"]]
    kinds = {k for d in dls for k in d.get("extras", {})}
    assert kinds == {"wides", "noballs", "legbyes"}
    assert sum(d["runs"]["total"] for d in doc["innings"][0]["overs"][-1]["deliveries"]) >= 0
    assert {w["kind"] for d in dls for w in d.get("wickets", [])} == {"caught", "bowled", "lbw", "run out"}


def test_build_gives_a_provisional_match_innings_and_markets_when_it_has_deliveries(tmp_path):
    docs, _ = synth.make_dataset()
    z = synth.write_zip(docs, tmp_path / "all_json.zip")
    data = tmp_path / "data"
    (data / "provisional").mkdir(parents=True)
    reg = people()
    players = [{"player": n, "player_id": pid, "team": "India Champions", "opponent": "West Indies Champions",
                "runs": "1", "balls": "1"} for n, pid in reg.items()]
    d = {"match_id": "crex-x", "date": "2026-10-13", "match_type": "T20", "team_type": "club", "gender": "male",
         "event": "WCL", "venue": "Sharjah", "team_a": "India Champions", "team_b": "West Indies Champions",
         "winner": "West Indies Champions", "status": "provisional", "players": players}
    (data / "provisional" / "crex-x.json").write_text(json.dumps(d))
    Store(data).upsert_balls("crex-x", "2026-10-13", rows())
    out = tmp_path / "out"
    meta = B.build(z, data, out, None, workers=1)
    assert meta["provisional_matches"] == 1
    M = json.loads((out / "matches.json").read_text())
    m = M["id"].index("crex-x")
    assert M["pv"][m] == 1 and len(M["inn"][m]) == 2 and M["inn"][m][0][1:4] == [110, 8, 120]
    assert M["fi"][m] != -1 and M["q"][m] == 0


def test_rows_saved_before_the_name_columns_still_build(tmp_path):
    old = [{k: v for k, v in r.items() if not k.endswith("_name")} for r in stored(rows())]
    doc = balls_doc(old, INFO)  # no KeyError: ids stand in for names
    assert parse_match("crex-x", doc)["innings"] == []  # no team name either: nothing usable, the match stays totals-only
    docs, _ = synth.make_dataset()
    z = synth.write_zip(docs, tmp_path / "all_json.zip")
    data = tmp_path / "data"
    (data / "provisional").mkdir(parents=True)
    d = {"match_id": "crex-x", "date": "2026-10-13", "match_type": "T20", "team_type": "club", "gender": "male",
         "event": "WCL", "venue": "Sharjah", "team_a": "India Champions", "team_b": "West Indies Champions",
         "winner": "West Indies Champions", "status": "provisional", "players": []}
    (data / "provisional" / "crex-x.json").write_text(json.dumps(d))
    Store(data).upsert_balls("crex-x", "2026-10-13", [{k: v for k, v in r.items() if not k.endswith("_name")} for r in rows()])
    out = tmp_path / "out"
    assert B.build(z, data, out, None, workers=1)["provisional_matches"] == 1
    M = json.loads((out / "matches.json").read_text())
    assert M["inn"][M["id"].index("crex-x")] == []
