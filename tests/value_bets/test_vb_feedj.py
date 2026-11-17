"""Feed J: a Betby-style public feed, synthetic payloads on *.invalid hosts only (never a real book)."""
import gzip
import json

import pytest

from value_bets import booklines
from value_bets.adapters import feedj

STAMP = "2026-11-17T12:00:00Z"
API = "https://feedj.invalid/api"
ORIGIN = "https://sb.feedj.invalid"
PL = "bg:player:1:2:"
START = 1795064400  # 2026-11-18T05:00:00Z


def out(**k):
    return {i: {"k": str(p)} for i, p in k.items()}


def stub(props=True, comp="1", **d):
    return {"desc": {"scheduled": START, "type": "match", "sport": "21", "category": "c", "tournament": "t", "player_props": props,
                     "competitors": [{"id": "1", "name": "Australia"}, {"id": "2", "name": "England"}], **d}}


TOURNAMENTS = {"t": {"name": "ICC ODI Championship"}}
PLAYERS = {f"{PL}1": "Mitchell Marsh", f"{PL}2": "Ben Duckett", f"{PL}3": "Cooper Connolly"}
MARKETS = {
    "13700": {f"inningnr=1|player={PL}1|total=30.5": {"12": {"k": "1.83"}, "13": {"k": "1.87"}}},
    # fours: over 12 is the cheaper side for a batter expected to hit more (Duckett 3.5: over 2.06, under 1.63 on another book as well)
    "13710": {f"inningnr=1|player={PL}2|total=3.5": {"13": {"k": "1.63"}, "12": {"k": "2.06"}}},
    "13711": {f"inningnr=1|player={PL}2|total=0.5": {"12": {"k": "2.52"}, "13": {"k": "1.43"}}},
    "662": {f"inningnr=1|player={PL}3|milestone=50|maxovers=29": {"76": {"k": "1.28"}, "74": {"k": "3.15"}}},
    "13613": {"total=108.5": out(**{"12": 1.9, "13": 1.9})},
    "697": {"total=15.5|maxovers=29": {"13": {"k": "1.95"}, "12": {"k": "1.71"}}},
    "654": {"total=0.5|maxovers=29": out(**{"12": 1.75, "13": 2.0})},
    "655": {"total=26.5|maxovers=29": out(**{"12": 1.82, "13": 1.82})},
    "352": {"overnr=5|total=28.5|inningnr=1": {"12": {"k": "1.75"}, "13": {"k": "1.89"}},
            "overnr=7|total=40.5|inningnr=1": {"12": {"k": "1.9"}, "13": {"k": "1.9"}}},
    "353": {"overnr=10|total=52.5|inningnr=1": {"12": {"k": "1.71"}, "13": {"k": "1.95"}}},
    "356": {"inningnr=1|overnr=1|total=4.5": {"13": {"k": "1.75"}, "12": {"k": "1.89"}}},
    "50110": {"total=586.5": out(**{"12": 1.82, "13": 1.82})},
    "690": {"inningnr=1": {"70": {"k": "1.9"}, "72": {"k": "1.9"}}},
}


def common():
    return feedj.ev_common("e1", stub(), TOURNAMENTS, "feedj_d", STAMP)


def test_players_over_under_and_milestone_sides_come_from_outcome_ids():
    rows, fx, cat, left = feedj.parse_event(MARKETS, PLAYERS, common())
    by = {(r["market_type"], r["player"], r["side"]): (r["line"], r["back"]) for r in rows}
    assert by[("batter_runs", "Mitchell Marsh", "over")] == (30.5, 1.83)
    assert by[("batter_runs", "Mitchell Marsh", "under")] == (30.5, 1.87)
    # JSON order lists the under first; the ids decide: 12 = over (2.06), 13 = under (1.63)
    assert by[("batter_fours", "Ben Duckett", "over")] == (3.5, 2.06)
    assert by[("batter_fours", "Ben Duckett", "under")] == (3.5, 1.63)
    assert by[("batter_sixes", "Ben Duckett", "over")] == (0.5, 2.52)
    # to score 50 = line 49.5; 74 = yes (3.15) is the over, 76 = no (1.28) the under
    assert by[("batter_milestone", "Cooper Connolly", "over")] == (49.5, 3.15)
    assert by[("batter_milestone", "Cooper Connolly", "under")] == (49.5, 1.28)
    ms = [r for r in rows if r["market_type"] == "batter_milestone"]
    assert {r["ms_scope"] for r in ms} == {"match"} and {r["selection"] for r in ms} == {"Cooper Connolly 50+ yes", "Cooper Connolly 50+ no"}
    assert len(rows) == 8 and all(r["source"] == "feedj_d" and r["in_play"] is False and r["match"] == "Australia vs England" for r in rows)


def test_match_and_side_lines_are_fancy_with_the_right_side_prices():
    _rows, fx, cat, left = feedj.parse_event(MARKETS, PLAYERS, common())
    got = {(f["key"], f["team"], f["line"]): (f["over"], f["under"], f.get("bat_first")) for f in fx}
    assert got == {
        ("top_score", None, 108.5): (1.9, 1.9, None),
        ("match_wickets", None, 15.5): (1.71, 1.95, None),  # JSON lists 13 first; 12 = over
        ("match_runouts", None, 0.5): (1.75, 2.0, None),
        ("match_extras", None, 26.5): (1.82, 1.82, None),
        ("overs_5", "Australia", 28.5): (1.75, 1.89, True),   # market 352 = first team listed
        ("overs_10", "England", 52.5): (1.71, 1.95, True),    # market 353 = second team listed
    }
    assert all(f["scope"] == ("team" if f["team"] else "match") and f["source"] == "feedj_d" for f in fx)


def test_unconfirmed_markets_stay_in_the_catalogue():
    _rows, fx, cat, left = feedj.parse_event(MARKETS, PLAYERS, common())
    keys = {f["key"] for f in fx}
    assert "match_runs" not in keys and "overs_1" not in keys and "overs_7" not in keys  # the "Total runs" ladder, a single over, an odd n
    unmapped = {c["name"].split()[0] for c in cat if c["mapped"] is None}
    assert {"M50110", "M356", "M352"} <= unmapped
    assert left["M690"] == 1 and left["M50110"] == 1 and left["M356"] == 1  # odd/even has no line at all


def test_a_player_without_a_name_or_a_second_innings_line_is_dropped_and_tests_are_skipped():
    m = {"13700": {f"inningnr=2|player={PL}1|total=30.5": out(**{"12": 1.8, "13": 1.9}),
                   "inningnr=1|player=bg:player:9:9:9|total=20.5": out(**{"12": 1.8, "13": 1.9})}}
    rows, fx, cat, left = feedj.parse_event(m, PLAYERS, common())
    assert rows == [] and cat == [] and left["M13700"] == 2
    test = feedj.ev_common("e2", stub(), {"t": {"name": "Test Series"}}, "feedj_d", STAMP)
    rows, fx, cat, _ = feedj.parse_event(MARKETS, PLAYERS, test)
    assert rows == [] and fx == []


def test_skip_without_env_and_published_name(monkeypatch):
    for k in ("API", "BRAND", "ORIGIN", "NAME"):
        monkeypatch.delenv(f"FEEDJ_{k}", raising=False)
    assert feedj.settings() == {} and feedj.published() == {}
    with pytest.raises(feedj.Skip):
        feedj.fetch(STAMP)
    for k, v in (("API", API + "/"), ("BRAND", "77"), ("ORIGIN", ORIGIN), ("NAME", "bc.game")):
        monkeypatch.setenv(f"FEEDJ_{k}", v)
    assert feedj.published() == {"feedj_d": "bc.game"}
    assert booklines.public({"source": "feedj_d"})["source"] == "bc.game"


def test_fetch_lists_versions_then_reads_each_event(monkeypatch):
    for k, v in (("API", API), ("BRAND", "77"), ("ORIGIN", ORIGIN), ("NAME", "bc.game"), ):
        monkeypatch.setenv(f"FEEDJ_{k}", v)
    monkeypatch.setenv("CV_FEEDJ_SPACING_SECS", "0")
    calls = []
    other = stub(False)
    other["desc"]["sport"] = "1"  # football: never read

    def fake(url, origin):
        calls.append(url)
        assert origin == ORIGIN
        b = f"{API}/v4/prematch/brand/77"
        if url == f"{b}/en-IN/0":
            return {"top_events_versions": [5], "rest_events_versions": [6]}
        if url == f"{b}/en-IN/5":
            return {"tournaments": TOURNAMENTS, "events": {"e1": stub()}}
        if url == f"{b}/en-IN/6":
            return {"tournaments": TOURNAMENTS, "events": {"f1": other}}
        if url == f"{b}/event/en-IN/e1":
            return {"events": {"e1": {"markets": MARKETS}}}
        if url == f"{API}/v3/descriptions/brand/77/event/e1/en-IN":
            return {"players": [{"id": k, "name": n} for k, n in PLAYERS.items()]}
        raise AssertionError(url)

    monkeypatch.setattr(feedj, "request", fake)
    rows, raw = feedj.fetch("2026-11-17T12:00:00Z")
    assert len(rows) == 8 and len(raw["fancy"]) == 6 and raw["books"]["bc.game"]["events"] == 1
    assert len(calls) == 5 and not any("f1" in c for c in calls)


def test_request_unzips_and_sends_the_page_origin(monkeypatch):
    seen = {}

    class R:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return gzip.compress(json.dumps({"a": 1}).encode())

    def fake_open(req, timeout=None):
        seen.update(req.headers)
        return R()

    monkeypatch.setattr(feedj.urllib.request, "urlopen", fake_open)
    assert feedj.request("https://feedj.invalid/x", ORIGIN) == {"a": 1}
    assert seen["Origin"] == ORIGIN and seen["Referer"] == ORIGIN + "/"
