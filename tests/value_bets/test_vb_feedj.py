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
PLAYERS = {f"{PL}1": "Mitchell Marsh", f"{PL}2": "Ben Duckett", f"{PL}3": "Cooper Connolly", f"{PL}4": "Travis Head", f"{PL}5": "Alex Carey",
           f"{PL}6": "Jofra Archer", f"{PL}7": "Sam Curran", f"{PL}8": "Gus Atkinson"}
SIDE = {f"{PL}1": 0, f"{PL}2": 1, f"{PL}3": 0, f"{PL}4": 0, f"{PL}5": 0, f"{PL}6": 1, f"{PL}7": 1, f"{PL}8": 1}
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
    # the "Total runs" ladder: three lines, the JSON lists the under first on the high one
    "50110": {"total=563.5": out(**{"12": 1.61, "13": 2.08}), "total=578.5": out(**{"12": 1.82, "13": 1.82}),
              "total=593.5": {"13": {"k": "1.61"}, "12": {"k": "2.08"}}},
    "13701": {"": {f"{PL}1": {"k": "3.0"}, f"{PL}4": {"k": "2.45"}, f"{PL}5": {"k": "6.0"}}},
    "13704": {"": {f"{PL}6": {"k": "2.6"}, f"{PL}7": {"k": "3.3"}, f"{PL}8": {"k": "5.0"}}},
    "690": {"inningnr=1": {"70": {"k": "1.9"}, "72": {"k": "1.9"}}},
}


def common():
    return feedj.ev_common("e1", stub(), TOURNAMENTS, "feedj_d", STAMP)


def test_players_over_under_and_milestone_sides_come_from_outcome_ids():
    rows, fx, cat, left = feedj.parse_event(MARKETS, PLAYERS, common(), SIDE)
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
    assert len(rows) == 14 and all(r["source"] == "feedj_d" and r["in_play"] is False and r["match"] == "Australia vs England" for r in rows)


def test_match_and_side_lines_are_fancy_with_the_right_side_prices():
    _rows, fx, cat, left = feedj.parse_event(MARKETS, PLAYERS, common(), SIDE)
    got = {(f["key"], f["team"], f["line"]): (f["over"], f["under"], f.get("bat_first")) for f in fx}
    assert got == {
        ("top_score", None, 108.5): (1.9, 1.9, None),
        ("match_wickets", None, 15.5): (1.71, 1.95, None),  # JSON lists 13 first; 12 = over
        ("match_runouts", None, 0.5): (1.75, 2.0, None),
        ("match_extras", None, 26.5): (1.82, 1.82, None),
        ("overs_5", "Australia", 28.5): (1.75, 1.89, True),   # market 352 = first team listed
        ("overs_10", "England", 52.5): (1.71, 1.95, True),    # market 353 = second team listed
        ("overs_7", "Australia", 40.5): (1.9, 1.9, True),     # any n of "overs 0 to N"
        ("overs_1", "Australia", 4.5): (1.89, 1.75, True),    # over 1 of market 356: JSON lists the under (13) first
        # the whole "Total runs" ladder, every line (the 593.5 one lists 13 before 12)
        ("match_runs", None, 563.5): (1.61, 2.08, None),
        ("match_runs", None, 578.5): (1.82, 1.82, None),
        ("match_runs", None, 593.5): (2.08, 1.61, None),
    }
    assert all(f["scope"] == ("team" if f["team"] else "match") and f["source"] == "feedj_d" for f in fx)


def test_unconfirmed_markets_stay_in_the_catalogue():
    _rows, fx, cat, left = feedj.parse_event(MARKETS, PLAYERS, common(), SIDE)
    keys = {f["key"] for f in fx}
    assert "highest_over" not in keys and "team_total_wickets" not in keys
    unmapped = {c["name"].split()[0] for c in cat if c["mapped"] is None}
    assert unmapped == set()  # everything with a line here is mapped
    assert left["M690"] == 1  # odd/even has no line at all
    m = {"356": {"inningnr=1|overnr=10|total=6.5": out(**{"12": 1.8, "13": 1.9})},  # a single later over is not "overs N"
         "649": {"inningnr=1|total=7.5|maxovers=29": out(**{"12": 1.8, "13": 1.9})}}  # whose dismissals? not confirmed: catalogue only
    _r, fx2, cat2, left2 = feedj.parse_event(m, PLAYERS, common(), SIDE)
    assert fx2 == [] and {c["name"].split()[0] for c in cat2 if c["mapped"] is None} == {"M356", "M649"}


def test_a_player_without_a_name_or_a_second_innings_line_is_dropped_and_tests_are_skipped():
    m = {"13700": {f"inningnr=2|player={PL}1|total=30.5": out(**{"12": 1.8, "13": 1.9}),
                   "inningnr=1|player=bg:player:9:9:9|total=20.5": out(**{"12": 1.8, "13": 1.9})}}
    rows, fx, cat, left = feedj.parse_event(m, PLAYERS, common(), SIDE)
    assert rows == [] and cat == [] and left["M13700"] == 2
    test = feedj.ev_common("e2", stub(), {"t": {"name": "Test Series"}}, "feedj_d", STAMP)
    rows, fx, cat, _ = feedj.parse_event(MARKETS, PLAYERS, test, SIDE)
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
            return {"players": [{"id": k, "name": n, "competitor_id": str(SIDE[k] + 1)} for k, n in PLAYERS.items()]}
        raise AssertionError(url)

    monkeypatch.setattr(feedj, "request", fake)
    rows, raw = feedj.fetch("2026-11-17T12:00:00Z")
    assert len(rows) == 14 and len(raw["fancy"]) == 11 and raw["books"]["bc.game"]["events"] == 1
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


def test_request_goes_through_the_relay_on_github_only(monkeypatch):
    urls = []

    class R:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return b'{"ok": 1}'

    def fake_open(req, timeout=None):
        urls.append((req.full_url, dict(req.headers)))
        return R()

    monkeypatch.setattr(feedj.urllib.request, "urlopen", fake_open)
    for k in ("FEEDJ", "FEEDH", "FEEDG"):
        monkeypatch.delenv(f"{k}_RELAY", raising=False)
        monkeypatch.delenv(f"{k}_RELAY_KEY", raising=False)
    monkeypatch.setenv("FEEDH_RELAY", "https://relay.invalid/r")
    monkeypatch.setenv("FEEDH_RELAY_KEY", "k1")
    monkeypatch.delenv("GITHUB_ACTIONS", raising=False)
    feedj.request("https://feedj.invalid/api/x", ORIGIN)
    assert urls[-1][0] == "https://feedj.invalid/api/x"  # a laptop is never routed anywhere new
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    assert feedj.request("https://feedj.invalid/api/x", ORIGIN) == {"ok": 1}
    u, h = urls[-1]
    assert u == "https://relay.invalid/r?u=https%3A%2F%2Ffeedj.invalid%2Fapi%2Fx"
    assert h["X-relay-key"] == "k1" and h["X-relay-origin"] == ORIGIN and h["X-relay-referer"] == ORIGIN + "/"


def test_a_blocked_call_is_tried_again_and_a_dead_version_file_loses_only_its_events(monkeypatch):
    for k, v in (("API", API), ("BRAND", "77"), ("ORIGIN", ORIGIN), ("NAME", "bc.game")):
        monkeypatch.setenv(f"FEEDJ_{k}", v)
    monkeypatch.setenv("CV_FEEDJ_SPACING_SECS", "0")
    seen = {}

    def fake(url, origin):
        seen[url] = seen.get(url, 0) + 1
        b = f"{API}/v4/prematch/brand/77"
        if url == f"{b}/en-IN/0":
            if seen[url] == 1:
                raise feedj.urllib.error.HTTPError(url, 503, "access blocked", {}, None)  # first try blocked, second fine
            return {"top_events_versions": [5], "rest_events_versions": [6]}
        if url == f"{b}/en-IN/5":
            return {"tournaments": TOURNAMENTS, "events": {"e1": stub()}}
        if url == f"{b}/en-IN/6":
            raise feedj.urllib.error.HTTPError(url, 503, "access blocked", {}, None)  # stays blocked
        if url == f"{b}/event/en-IN/e1":
            return {"events": {"e1": {"markets": MARKETS}}}
        return {"players": [{"id": k, "name": n, "competitor_id": str(SIDE[k] + 1)} for k, n in PLAYERS.items()]}

    monkeypatch.setattr(feedj, "request", fake)
    rows, raw = feedj.fetch("2026-11-17T12:00:00Z")
    assert len(rows) == 14 and raw["books"]["bc.game"]["events"] == 1
    assert seen[f"{API}/v4/prematch/brand/77/en-IN/0"] == 2 and seen[f"{API}/v4/prematch/brand/77/en-IN/6"] == 2


def test_top_batter_and_bowler_of_a_side_are_rows_only_when_every_player_is_on_that_side():
    rows, _fx, cat, left = feedj.parse_event(MARKETS, PLAYERS, common(), SIDE)
    tb = {(r["market_type"], r["team"], r["player"]): r["back"] for r in rows if r["market_type"].startswith("top_")}
    assert tb == {("top_batter_team", "Australia", "Mitchell Marsh"): 3.0, ("top_batter_team", "Australia", "Travis Head"): 2.45,
                  ("top_batter_team", "Australia", "Alex Carey"): 6.0, ("top_bowler_team", "England", "Jofra Archer"): 2.6,
                  ("top_bowler_team", "England", "Sam Curran"): 3.3, ("top_bowler_team", "England", "Gus Atkinson"): 5.0}
    wrong = dict(SIDE, **{f"{PL}5": 1})  # one "Australia" batter listed as England's: the whole market is left out
    rows2, *_ = feedj.parse_event({"13701": MARKETS["13701"]}, PLAYERS, common(), wrong)
    assert rows2 == []
    rows3, *_ = feedj.parse_event({"13701": MARKETS["13701"]}, PLAYERS, common(), None)  # no side information: never guessed
    assert rows3 == []
