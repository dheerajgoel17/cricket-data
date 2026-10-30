import copy
import urllib.error

import pytest

from value_bets import booklines, fancy, pipeline
from value_bets.adapters import feedh

STAMP = "2026-10-30T12:00:00Z"
ROOT = "https://feedh.invalid"


def ou(desc, line, over, under, mid=1):
    return {"id": mid, "description": desc, "status": "open", "outcomes": [
        {"description": f"Over {line}", "hidden": False, "withdrawn": False,
         "consolidatedPrice": {"currentPrice": {"decimal": over}}},
        {"description": f"Under {line}", "hidden": False, "withdrawn": False,
         "consolidatedPrice": {"currentPrice": {"decimal": under}}}]}


def named(desc, runners, mid=1):
    return {"id": mid, "description": desc, "status": "open", "outcomes": [
        {"description": n, "hidden": False, "withdrawn": False, "consolidatedPrice": {"currentPrice": {"decimal": p}}}
        for n, p in runners]}


def event(markets, **kw):
    ev = {"id": 44628333, "description": "New Zealand vs India", "sportCode": "CRIC",
          "eventDate": "2026-11-01T07:00:00.000+00:00",
          "opponents": [{"name": "New Zealand"}, {"name": "India"}],
          "eventPaths": [{"name": "Cricket"}, {"name": "International"}, {"name": "T20 Series New Zealand vs India"}],
          "markets": markets}
    ev.update(kw)
    return ev


MARKETS = [
    ou("Batsman Runs - Suryavanshi, Vaibhav", 25.5, 1.85, 1.85, 1),
    ou("Batsman Sixes - Suryavanshi, Vaibhav", 1.5, 1.9, 1.8, 13),
    ou("Bowler Wickets - Bumrah, Jasprit", 1.5, 1.72, 2.05, 14),
    ou("Player Performance - Kishan, Ishan", 36.5, 1.83, 1.87, 2),
    ou("To score 50 - Sharma, Abhishek", 49.5, 2.1, 1.71, 3),
    ou("Match Total Runs", 401.5, 1.85, 1.85, 4),
    ou("Total Spreads - India", 203.5, 1.85, 1.85, 5),
    ou("Total fours", 28.5, 1.9, 1.8, 6),
    ou("Total sixes - New Zealand", 9.5, 1.88, 1.82, 7),
    ou("Top batter total", 72.5, 1.9, 1.8, 8),
    named("Top Batsman - New Zealand", [("Conway, Devon", 3.5), ("Allen, Finn", 4.2)], 9),
    named("Head To Head", [("New Zealand", 2.16), ("India", 1.67)], 10),
    ou("Total runs for over 1 in 1st inning - New Zealand", 6.5, 1.65, 2.1, 11),
    ou("Allen, Finn to score 50 and Duffy, Jacob to take 2 wickets", 1.5, 3.0, 1.35, 12),
]


def test_mapped_player_lines_fancy_and_the_full_catalogue():
    rows, fx, cat, left = feedh.parse_event(event(MARKETS), "feedh_d", STAMP)
    runs = [(r["player"], r["side"], r["line"], r["back"]) for r in rows if r["market_type"] == "batter_runs"]
    assert runs == [("Vaibhav Suryavanshi", "over", 25.5, 1.85), ("Vaibhav Suryavanshi", "under", 25.5, 1.85)]
    six = [(r["player"], r["side"], r["line"], r["back"]) for r in rows if r["market_type"] == "batter_sixes"]
    assert six == [("Vaibhav Suryavanshi", "over", 1.5, 1.9), ("Vaibhav Suryavanshi", "under", 1.5, 1.8)]
    wk = [(r["player"], r["side"], r["line"], r["back"]) for r in rows if r["market_type"] == "bowler_wickets"]
    assert wk == [("Jasprit Bumrah", "over", 1.5, 1.72), ("Jasprit Bumrah", "under", 1.5, 2.05)]
    pts = [(r["player"], r["side"], r["line"], r["back"]) for r in rows if r["market_type"] == "player_points"]
    assert pts == [("Ishan Kishan", "over", 36.5, 1.83), ("Ishan Kishan", "under", 36.5, 1.87)]
    ms = [(r["player"], r["side"], r["line"], r["selection"]) for r in rows if r["market_type"] == "batter_milestone"]
    assert ms == [("Abhishek Sharma", "over", 49.5, "Abhishek Sharma 50+ yes"),
                  ("Abhishek Sharma", "under", 49.5, "Abhishek Sharma 50+ no")]
    top = [(r["player"], r["team"], r["back"]) for r in rows if r["market_type"] == "top_batter_team"]
    assert top == [("Devon Conway", "New Zealand", 3.5), ("Finn Allen", "New Zealand", 4.2)]
    assert rows[0]["match"] == "New Zealand vs India" and rows[0]["source"] == "feedh_d" and rows[0]["in_play"] is False
    keys = {(x["key"], x["team"], x["line"]) for x in fx}
    assert keys == {("match_runs", None, 401.5), ("team_total_runs", "India", 203.5), ("match_fours", None, 28.5),
                    ("team_total_sixes", "New Zealand", 9.5), ("top_score", None, 72.5)}
    assert {x["name"] for x in cat} >= {"Batsman Runs - Suryavanshi, Vaibhav", "Head To Head",
                                        "Total runs for over 1 in 1st inning - New Zealand",
                                        "Allen, Finn to score 50 and Duffy, Jacob to take 2 wickets"}
    mapped = {x["name"]: x["mapped"] for x in cat}
    assert mapped["Batsman Runs - Suryavanshi, Vaibhav"] == "batter_runs"
    assert mapped["Player Performance - Kishan, Ishan"] == "player_points"
    assert mapped["Head To Head"] is None
    assert "Head To Head" not in {r["market_raw"] for r in rows}
    assert left == {}


def test_a_test_match_keeps_unscoped_player_lines_in_the_catalogue_only():
    ev = event([ou("Batsman Runs - Conway, Devon", 40.5, 1.9, 1.8, 1), ou("Match Total Runs", 500.5, 1.85, 1.85, 2)])
    ev["eventPaths"][-1]["name"] = "Test Series South Africa vs Australia"
    rows, fx, cat, _ = feedh.parse_event(ev, "feedh_d", STAMP)
    assert rows == [] and [x["key"] for x in fx] == ["match_runs"]
    assert any(x["name"].startswith("Batsman Runs") and x["mapped"] is None for x in cat)


def test_virtual_and_one_sided_markets_are_not_rows():
    ev = event(MARKETS)
    ev["sportCode"] = "VICR"
    assert feedh.parse_event(ev, "feedh_d", STAMP) == ([], [], [], feedh.Counter())
    m = ou("Batsman Runs - Conway, Devon", 20.5, 1.9, 1.8, 1)
    m["outcomes"][1]["hidden"] = True
    rows, _, cat, left = feedh.parse_event(event([m]), "feedh_d", STAMP)
    assert rows == [] and left["Batsman Runs - Conway, Devon"] == 1 and cat[0]["mapped"] is None


def test_settings_and_published_names_come_from_the_environment(monkeypatch):
    monkeypatch.delenv("FEEDH_URL", raising=False)
    monkeypatch.delenv("FEEDH_NAME", raising=False)
    assert feedh.settings() == {} and feedh.published() == {}
    with pytest.raises(feedh.Skip):
        feedh.fetch(STAMP)
    monkeypatch.setenv("FEEDH_URL", ROOT + "/")
    monkeypatch.setenv("FEEDH_NAME", "Dafabet")
    assert feedh.settings() == {"URL": ROOT, "NAME": "Dafabet"}
    assert feedh.published() == {"feedh_d": "Dafabet"}
    assert booklines.public_names()["feedh_d"] == "Dafabet"
    assert booklines.public({"s": "feedh_d"}) == {"s": "Dafabet"}
    assert "feedh" in {m.NAME for m in pipeline.adapters()}


def test_fetch_lists_then_reads_a_few_events(monkeypatch):
    monkeypatch.setenv("FEEDH_URL", ROOT)
    monkeypatch.setenv("FEEDH_NAME", "Dafabet")
    monkeypatch.setenv("CV_FEEDH_SPACING_SECS", "0")
    stub = event([])
    full = event(MARKETS)
    calls = []

    def fake(url, retries=1, **kw):
        calls.append(url)
        assert retries == 0
        if "includeMarkets=false" in url:
            return [stub, {**stub, "id": 2, "sportCode": "VICR", "eventDate": "2026-11-01T08:00:00.000+00:00"}], {}
        return [copy.deepcopy(full)], {}

    monkeypatch.setattr(feedh, "http_json", fake)
    rows, raw = feedh.fetch(STAMP)
    assert len(rows) > 0 and raw["fancy"] and raw["catalogue"]
    assert raw["books"]["Dafabet"]["events"] == 1
    assert "xapi/rest/events" in calls[0] and "eventPathIds=215" in calls[0]
    assert "eventIds=44628333" in calls[1]
    assert {x["key"] for x in fancy.adapter_fancy({"feedh": raw})} == {x["key"] for x in raw["fancy"]}


def test_a_competition_node_is_fetched_as_a_path_not_an_event(monkeypatch):
    monkeypatch.setenv("FEEDH_URL", ROOT)
    monkeypatch.setenv("FEEDH_NAME", "Dafabet")
    monkeypatch.setenv("CV_FEEDH_SPACING_SECS", "0")
    path = {"id": 22908454, "sportCode": "CRIC", "eventPaths": [{"name": "Cricket"}, {"name": "International"}]}
    calls = []

    def fake(url, retries=1, **kw):
        calls.append(url)
        if "includeMarkets=false" in url:
            return [path], {}
        return [event(MARKETS)], {}

    monkeypatch.setattr(feedh, "http_json", fake)
    rows, raw = feedh.fetch(STAMP)
    assert len(rows) > 0
    assert "eventPathIds=22908454" in calls[1]
    assert "eventIds=" not in calls[1]
    assert raw["books"]["Dafabet"]["events"] == 1


def test_a_400_on_an_event_id_retries_the_same_id_as_a_path(monkeypatch):
    monkeypatch.setenv("FEEDH_URL", ROOT)
    monkeypatch.setenv("FEEDH_NAME", "Dafabet")
    monkeypatch.setenv("CV_FEEDH_SPACING_SECS", "0")
    stub = event([])
    calls = []

    def fake(url, retries=1, **kw):
        calls.append(url)
        if "includeMarkets=false" in url:
            return [stub], {}
        if "eventIds=" in url:
            raise urllib.error.HTTPError(url, 400, "x", {}, None)
        return [event(MARKETS)], {}

    monkeypatch.setattr(feedh, "http_json", fake)
    rows, raw = feedh.fetch(STAMP)
    assert len(rows) > 0
    assert any("eventIds=44628333" in u for u in calls)
    assert any("eventPathIds=44628333" in u for u in calls)
    assert raw["books"]["Dafabet"].get("stopped") is None


def test_an_in_horizon_game_is_fetched_before_a_club_path(monkeypatch):
    monkeypatch.setenv("FEEDH_URL", ROOT)
    monkeypatch.setenv("FEEDH_NAME", "Dafabet")
    monkeypatch.setenv("CV_FEEDH_SPACING_SECS", "0")
    monkeypatch.setenv("CV_FEEDH_MAX_EVENTS", "1")
    club = {"id": 1001, "sportCode": "CRIC", "eventPaths": [{"name": "Cricket"}, {"name": "Grade"}]}
    game = event([])
    calls = []

    def fake(url, retries=1, **kw):
        calls.append(url)
        if "includeMarkets=false" in url:
            return [club, game], {}
        return [event(MARKETS)], {}

    monkeypatch.setattr(feedh, "http_json", fake)
    feedh.fetch(STAMP)
    assert any("eventIds=44628333" in u for u in calls)
    assert not any("eventPathIds=1001" in u for u in calls)


def test_international_paths_are_fetched_before_club_paths(monkeypatch):
    monkeypatch.setenv("FEEDH_URL", ROOT)
    monkeypatch.setenv("FEEDH_NAME", "Dafabet")
    monkeypatch.setenv("CV_FEEDH_SPACING_SECS", "0")
    monkeypatch.setenv("CV_FEEDH_MAX_EVENTS", "1")
    club = {"id": 1001, "sportCode": "CRIC", "eventPaths": [{"name": "Cricket"}, {"name": "Grade"}]}
    intl = {"id": 22908454, "sportCode": "CRIC", "eventPaths": [{"name": "Cricket"}, {"name": "International"}]}
    calls = []

    def fake(url, retries=1, **kw):
        calls.append(url)
        if "includeMarkets=false" in url:
            return [club, intl], {}
        return [event(MARKETS)], {}

    monkeypatch.setattr(feedh, "http_json", fake)
    feedh.fetch(STAMP)
    assert "eventPathIds=22908454" in calls[1]
    assert not any("eventPathIds=1001" in u for u in calls)


def test_every_listed_page_is_fetched_when_the_cap_allows(monkeypatch):
    monkeypatch.setenv("FEEDH_URL", ROOT)
    monkeypatch.setenv("FEEDH_NAME", "Dafabet")
    monkeypatch.setenv("CV_FEEDH_SPACING_SECS", "0")
    a = {"id": 11, "sportCode": "CRIC", "eventPaths": [{"name": "Cricket"}, {"name": "International"}]}
    b = {"id": 22, "sportCode": "CRIC", "eventPaths": [{"name": "Cricket"}, {"name": "Grade"}]}
    calls = []

    def fake(url, retries=1, **kw):
        calls.append(url)
        if "includeMarkets=false" in url:
            return [a, b], {}
        eid = 11 if "eventPathIds=11" in url else 22
        return [event(MARKETS, id=eid)], {}

    monkeypatch.setattr(feedh, "http_json", fake)
    _, raw = feedh.fetch(STAMP)
    assert raw["books"]["Dafabet"]["events"] == 2
    assert any("eventPathIds=11" in u for u in calls) and any("eventPathIds=22" in u for u in calls)


def test_a_429_stops_the_book_for_the_run(monkeypatch):
    monkeypatch.setenv("FEEDH_URL", ROOT)
    monkeypatch.setenv("FEEDH_NAME", "Dafabet")
    monkeypatch.setenv("CV_FEEDH_SPACING_SECS", "0")
    stub = event([])

    def fake(url, retries=1, **kw):
        if "includeMarkets=false" in url:
            return [stub], {}
        raise urllib.error.HTTPError(url, 429, "x", {}, None)

    monkeypatch.setattr(feedh, "http_json", fake)
    rows, raw = feedh.fetch(STAMP)
    assert rows == [] and raw["books"]["Dafabet"]["stopped"] == "HTTP 429"


def test_the_mumbai_relay_is_used_when_configured(monkeypatch):
    monkeypatch.setenv("FEEDH_URL", ROOT)
    monkeypatch.setenv("FEEDH_NAME", "Dafabet")
    monkeypatch.setenv("FEEDH_RELAY", "https://relay.invalid/api/relay")
    monkeypatch.setenv("FEEDH_RELAY_KEY", "k-1")
    monkeypatch.setenv("CV_FEEDH_SPACING_SECS", "0")
    stub = event([])
    seen = []

    def fake(url, retries=1, headers=None, **kw):
        seen.append((url, (headers or {}).get("x-relay-key")))
        if "includeMarkets=false" in url or "includeMarkets%3Dfalse" in url:
            return [stub], {}
        return [event(MARKETS)], {}

    monkeypatch.setattr(feedh, "http_json", fake)
    feedh.fetch(STAMP)
    assert all(u.startswith("https://relay.invalid/api/relay?u=") for u, _ in seen)
    assert {k for _, k in seen} == {"k-1"}


def test_a_laptop_never_calls_the_book(monkeypatch):
    monkeypatch.delenv("GITHUB_ACTIONS", raising=False)
    monkeypatch.setenv("FEEDH_URL", "https://book.example/sports")
    monkeypatch.setenv("FEEDH_NAME", "Dafabet")
    monkeypatch.setenv("FEEDH_RELAY", "https://relay.invalid/api/relay")
    monkeypatch.setenv("FEEDH_RELAY_KEY", "k-1")
    called = []
    monkeypatch.setattr(feedh, "http_json", lambda *a, **k: called.append(a) or ({}, {}))
    with pytest.raises(feedh.Skip, match="local machine"):
        feedh.fetch(STAMP)
    assert called == []


class _Body:
    def __init__(self, text):
        self._raw = text.encode()

    def read(self):
        return self._raw

    def close(self):
        pass


def test_a_relay_403_keeps_the_worker_body(monkeypatch):
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    monkeypatch.setenv("FEEDH_RELAY", "https://relay.invalid/api/relay")
    monkeypatch.setenv("FEEDH_RELAY_KEY", "k-1")

    def fake(url, retries=1, **kw):
        raise urllib.error.HTTPError(url, 403, "Forbidden", {}, _Body("host not allowed"))

    monkeypatch.setattr(feedh, "http_json", fake)
    with pytest.raises(urllib.error.HTTPError) as ei:
        feedh.request("https://book.example/x")
    assert ei.value.code == 403 and ei.value.reason == "host not allowed"


def test_github_actions_never_calls_the_book_directly(monkeypatch):
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    monkeypatch.setenv("FEEDH_URL", "https://book.example/sports")
    monkeypatch.setenv("FEEDH_NAME", "Dafabet")
    monkeypatch.delenv("FEEDH_RELAY", raising=False)
    monkeypatch.delenv("FEEDH_RELAY_KEY", raising=False)
    monkeypatch.delenv("FEEDG_RELAY", raising=False)
    monkeypatch.delenv("FEEDG_RELAY_KEY", raising=False)
    called = []
    monkeypatch.setattr(feedh, "http_json", lambda *a, **k: called.append(a) or ({}, {}))
    with pytest.raises(feedh.Skip, match="never call the book directly"):
        feedh.fetch(STAMP)
    assert called == []
