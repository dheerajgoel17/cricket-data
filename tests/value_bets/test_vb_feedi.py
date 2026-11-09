"""Feed I: player and fancy lines from one guest sportsbook, plus the session the relay has to forward."""
import base64
import io
import json
import urllib.error

import pytest

from value_bets import booklines, fancy, pipeline
from value_bets.adapters import feedi

STAMP = "2026-11-09T06:00:00Z"
ROOT = "https://feedi.invalid"
SHELL = 'brandId: 9, cfgA: "a2V5"'  # a2V5 is the shell key, base64


def ou(des, line, over, under, mid=1, period="1st Innings"):
    return {"id": mid, "des": des, "st": 1, "p": period, "outcomes": [
        {"des": f"Over {line}", "keyDimension": "OVER", "extra1": line, "pr": over, "hidden": False},
        {"des": f"Under {line}", "keyDimension": "UNDER", "extra1": line, "pr": under, "hidden": False}]}


def yesno(des, n, yes, no, mid=1):
    return {"id": mid, "des": des, "st": 1, "p": "1st Innings", "outcomes": [
        {"des": "Yes", "keyDimension": "YES", "extra1": n, "pr": yes},
        {"des": "No", "keyDimension": "NO", "extra1": n, "pr": no}]}


def named(des, runners, mid=1, period="1st Innings"):
    return {"id": mid, "des": des, "st": 1, "p": period, "outcomes": [
        {"des": n, "pr": p, "hidden": False} for n, p in runners]}


DETAIL = {"id": 99, "home_name": "New Zealand", "away_name": "India", "start_time": "2026-11-10T02:00:00Z",
          "in_play": False, "event_type": "GAME", "competition_title": "One Day International",
          "dimensions": {"SPORT": "CRICKET", "COMPETITION": "ONE-DAY-INTERNATIONAL"}}

MARKETS = [
    ou("Shreyas Iyer - Runs - (28.5)", 28.5, 1.85, 1.91, 1),
    ou("Henry Nicholls - Fours - (2.5)", 2.5, 2.2, 1.615, 2),
    ou("RG Sharma - Sixes - (0.5)", 0.5, 1.533, 2.375, 3),
    ou("Matt Henry - Wickets - (1.5)", 1.5, 1.9, 1.8, 4),
    yesno("Tom Latham - To Score 50", 50, 3.0, 1.25, 5),
    named("New Zealand - Top Batter", [("Devon Conway", 3.5), ("Finn Allen", 4.2)], 6),
    named("Top Batsman", [("V Kohli", 3.7)], 7, "Match"),
    ou("India - Runs - (278.5)", 278.5, 1.85, 1.85, 8),
    ou("Match Fours - (48.5)", 48.5, 1.9, 1.8, 9, "Match"),
    ou("Match Sixes - (15.5)", 15.5, 1.85, 1.85, 10, "Match"),
    ou("India - Fours - (25.5)", 25.5, 1.83, 1.87, 11),
    ou("Match Run Outs - (0.5)", 0.5, 1.8, 1.9, 12, "Match"),
    named("2-Way Match Betting", [("New Zealand", 2.1), ("India", 1.667)], 13, "Match"),
    ou("India - Wickets Lost - (7.5)", 7.5, 1.85, 1.85, 14),
]


def test_shell_key_hash_and_xor_roundtrip():
    assert feedi.parse_shell(SHELL) == {"brand": "9", "key": b"key"}
    assert feedi.parse_shell('brandId: 9, cfgA\\":\\"a2V5\\"')["key"] == b"key"
    assert feedi.java_hash("a") == ord("a")
    assert feedi.java_hash("ab") == (ord("a") * 31 + ord("b"))
    key = b"key"
    plain = b'{"ok":1}'
    raw = bytes(b ^ key[i % len(key)] for i, b in enumerate(plain))
    assert feedi.unwrap(base64.b64encode(raw), {"x-content-encoding": "xor"}, key) == plain
    assert feedi.unwrap(plain, {}, b"") == plain


def test_a_fractional_price_becomes_decimal():
    m = ou("Shreyas Iyer - Runs - (28.5)", 28.5, 1.85, 1.91, 1)
    m["outcomes"][0]["pr"] = "17/20"
    m["outcomes"][0].pop("prd", None)
    assert feedi._price(m["outcomes"][0]) == 1.85


def test_mapped_player_lines_fancy_and_the_catalogue():
    rows, fx, cat, left = feedi.parse_event(DETAIL, MARKETS, "feedi_d", STAMP)
    runs = [(r["player"], r["side"], r["line"], r["back"], r["inn"]) for r in rows if r["market_type"] == "batter_runs"]
    assert runs == [("Shreyas Iyer", "over", 28.5, 1.85, None), ("Shreyas Iyer", "under", 28.5, 1.91, None)]
    fours = [(r["player"], r["line"]) for r in rows if r["market_type"] == "batter_fours"]
    assert fours == [("Henry Nicholls", 2.5), ("Henry Nicholls", 2.5)]
    six = [r["player"] for r in rows if r["market_type"] == "batter_sixes"]
    assert six == ["RG Sharma", "RG Sharma"]
    wk = [(r["player"], r["line"]) for r in rows if r["market_type"] == "bowler_wickets"]
    assert wk == [("Matt Henry", 1.5), ("Matt Henry", 1.5)]
    ms = [(r["player"], r["side"], r["line"], r["selection"]) for r in rows if r["market_type"] == "batter_milestone"]
    assert ms == [("Tom Latham", "over", 49.5, "Tom Latham 50+ yes"), ("Tom Latham", "under", 49.5, "Tom Latham 50+ no")]
    top = [(r["player"], r["team"], r["back"]) for r in rows if r["market_type"] == "top_batter_team"]
    assert top == [("Devon Conway", "New Zealand", 3.5), ("Finn Allen", "New Zealand", 4.2)]
    match = [(r["player"], r["back"]) for r in rows if r["market_type"] == "top_batter_match"]
    assert match == [("V Kohli", 3.7)]
    assert rows[0]["match"] == "New Zealand vs India" and rows[0]["source"] == "feedi_d" and rows[0]["in_play"] is False
    keys = {(x["key"], x.get("team"), x["line"], x.get("inn")) for x in fx}
    assert ("team_total_runs", "India", 278.5, None) in keys
    assert ("match_fours", None, 48.5, None) in keys
    assert ("match_sixes", None, 15.5, None) in keys
    assert ("team_total_fours", "India", 25.5, None) in keys
    assert ("match_runouts", None, 0.5, None) in keys
    mapped = {x["name"]: x["mapped"] for x in cat}
    assert mapped["Shreyas Iyer - Runs - (28.5)"] == "batter_runs"
    assert mapped["2-Way Match Betting"] is None
    assert mapped["India - Wickets Lost - (7.5)"] is None
    assert "2-Way Match Betting" not in {r["market_raw"] for r in rows}
    assert "India - Wickets Lost - (7.5)" not in {r["market_raw"] for r in rows}
    assert left == {}


def test_a_test_innings_line_is_scoped_and_a_virtual_is_dropped():
    detail = {**DETAIL, "competition_title": "Test Match"}
    rows, _, _, _ = feedi.parse_event(detail, [ou("Shreyas Iyer - Runs - (40.5)", 40.5, 1.9, 1.8, 1)], "feedi_d", STAMP)
    assert [(r["market_type"], r["inn"]) for r in rows] == [("batter_runs", 1), ("batter_runs", 1)]
    team = ou("India - Runs - (300.5)", 300.5, 1.85, 1.85, 2)
    _, fx, _, _ = feedi.parse_event(detail, [team], "feedi_d", STAMP)
    assert fx[0]["key"] == "team_total_runs" and fx[0]["inn"] == 1
    virtual = {**DETAIL, "competition_title": "Virtual Cricket"}
    assert feedi.parse_event(virtual, MARKETS, "feedi_d", STAMP) == ([], [], [], feedi.Counter())


def test_a_hidden_side_is_not_a_row():
    m = ou("Shreyas Iyer - Runs - (28.5)", 28.5, 1.85, 1.91, 1)
    m["outcomes"][1]["hidden"] = True
    rows, _, cat, left = feedi.parse_event(DETAIL, [m], "feedi_d", STAMP)
    assert rows == [] and left["Shreyas Iyer - Runs - (28.5)"] == 1 and cat[0]["mapped"] is None


def test_settings_and_published_names_come_from_the_environment(monkeypatch):
    monkeypatch.delenv("FEEDI_URL", raising=False)
    monkeypatch.delenv("FEEDI_NAME", raising=False)
    assert feedi.settings() == {} and feedi.published() == {}
    with pytest.raises(feedi.Skip):
        feedi.fetch(STAMP)
    monkeypatch.setenv("FEEDI_URL", ROOT + "/")
    monkeypatch.setenv("FEEDI_NAME", "Puntit")
    assert feedi.settings() == {"URL": ROOT, "NAME": "Puntit"}
    assert feedi.published() == {"feedi_d": "Puntit"}
    assert booklines.public_names()["feedi_d"] == "Puntit"
    assert booklines.public({"s": "feedi_d"}) == {"s": "Puntit"}
    assert "feedi" in {m.NAME for m in pipeline.adapters()}


def _serve(calls):
    def fake(url, headers):
        calls.append(url)
        if url.endswith(f"/sports/{feedi.SPORT_PATH}"):
            return SHELL.encode(), {"set-cookie": "csrf=abc; Path=/"}
        if f"/api/sports/{feedi.SPORT_PATH}" in url:
            return json.dumps({"sections": [{"components": [{"sportId": 17500}]}]}).encode(), {}
        if "/events?c=en-in" in url and "date=" not in url:
            return json.dumps([
                {"id": 99, "description": "New Zealand v India"},
                {"id": 3, "description": "Virtual Cricket SRL"},
                {"id": 7, "description": "Live Match"},
            ]).encode(), {}
        if "date=2026-11-12" in url:
            return json.dumps([{"id": 100, "description": "Australia v England"}]).encode(), {}
        if "date=" in url:
            return b"[]", {}
        if url.endswith("/events/en-in/99"):
            return json.dumps(DETAIL).encode(), {}
        if url.endswith("/events/en-in/7"):
            return json.dumps({**DETAIL, "id": 7, "in_play": True, "start_time": "2026-11-09T05:00:00Z"}).encode(), {}
        if url.endswith("/events/en-in/100"):
            return json.dumps({**DETAIL, "id": 100, "home_name": "Australia", "away_name": "England",
                               "start_time": "2026-11-12T02:00:00Z", "competition_title": "Test Match"}).encode(), {}
        if "coupon_groups" in url:
            return json.dumps([{"id": 7, "name": "Players"}, {"id": 8, "name": "Bet Boost"}]).encode(), {}
        if "/coupons/99/7" in url:
            return json.dumps([{"markets": MARKETS}]).encode(), {}
        if "/coupons/100/7" in url:
            return json.dumps([{"markets": [MARKETS[0]]}]).encode(), {}
        raise AssertionError(url)
    return fake


def test_fetch_reads_the_shell_then_one_event(monkeypatch):
    monkeypatch.setenv("FEEDI_URL", ROOT)
    monkeypatch.setenv("FEEDI_NAME", "Puntit")
    monkeypatch.setenv("CV_FEEDI_SPACING_SECS", "0")
    calls = []
    monkeypatch.setattr(feedi, "_http", _serve(calls))
    rows, raw = feedi.fetch(STAMP)
    assert len(rows) > 0 and raw["fancy"] and raw["catalogue"]
    assert raw["books"]["Puntit"]["events"] == 2  # today's card and a later day; the started match is left for the snapshot
    assert raw["books"]["Puntit"]["days"] == 11
    assert any("date=2026-11-09" in u for u in calls) and any("date=2026-11-19" in u for u in calls)
    assert any(r["match"] == "Australia vs England" for r in rows)
    assert not any("/coupons/7/" in u for u in calls)
    assert any(u.endswith("/sports/215") for u in calls)
    assert any(u.endswith("/events/en-in/99") for u in calls)
    assert any("/coupons/99/7" in u for u in calls)
    assert not any("id=3" in u or u.endswith("/3") for u in calls)
    assert not any("/coupons/99/8" in u for u in calls)
    assert {x["key"] for x in fancy.adapter_fancy({"feedi": raw})} == {x["key"] for x in raw["fancy"]}


def test_a_429_stops_the_book_for_the_run(monkeypatch):
    monkeypatch.setenv("FEEDI_URL", ROOT)
    monkeypatch.setenv("FEEDI_NAME", "Puntit")
    monkeypatch.setenv("CV_FEEDI_SPACING_SECS", "0")

    def fake(url, headers):
        if url.endswith(f"/sports/{feedi.SPORT_PATH}"):
            return SHELL.encode(), {"set-cookie": "csrf=abc; Path=/"}
        if f"/api/sports/{feedi.SPORT_PATH}" in url:
            return json.dumps({"sportId": 17500}).encode(), {}
        if "/events?c=en-in" in url and "date=" not in url:
            return json.dumps([{"id": 99, "description": "New Zealand v India"}]).encode(), {}
        if "date=" in url:
            return b"[]", {}
        raise urllib.error.HTTPError(url, 429, "x", {}, None)

    monkeypatch.setattr(feedi, "_http", fake)
    rows, raw = feedi.fetch(STAMP)
    assert rows == [] and raw["books"]["Puntit"]["stopped"] == "HTTP 429"


def test_inplay_reads_a_started_match_and_names_the_book(monkeypatch):
    monkeypatch.setenv("FEEDI_URL", ROOT)
    monkeypatch.setenv("FEEDI_NAME", "Puntit")
    monkeypatch.setenv("CV_FEEDI_SPACING_SECS", "0")
    calls = []

    def fake(url, headers):
        calls.append(url)
        if url.endswith(f"/sports/{feedi.SPORT_PATH}"):
            return SHELL.encode(), {"set-cookie": "csrf=abc; Path=/"}
        if f"/api/sports/{feedi.SPORT_PATH}" in url:
            return json.dumps({"sportId": 17500}).encode(), {}
        if "mini_inplay" in url:
            return json.dumps([{"id": 5}]).encode(), {}
        if url.endswith("/events/en-in/5"):
            return json.dumps({**DETAIL, "id": 5, "in_play": True, "start_time": "2026-11-09T05:00:00Z"}).encode(), {}
        if "coupon_groups" in url:
            return json.dumps([{"id": 1, "name": "Players"}, {"id": 2, "name": "Innings"}, {"id": 3, "name": "Bet Boost"}]).encode(), {}
        if "/coupons/5/1" in url:
            return json.dumps([{"markets": [ou("Shreyas Iyer - Runs - (28.5)", 28.5, 1.85, 1.91, 1)]}]).encode(), {}
        if "/coupons/5/2" in url:
            return json.dumps([{"markets": [ou("India - Runs - (278.5)", 278.5, 1.85, 1.85, 8, "2nd Innings")]}]).encode(), {}
        raise AssertionError(url)

    monkeypatch.setattr(feedi, "_http", fake)
    matches = feedi.inplay(STAMP)
    assert [(m["home"], m["away"]) for m in matches] == [("New Zealand", "India")]
    got = {(x["kind"], x.get("player") or x.get("team"), x.get("inn"), x["book"], x["line"]) for x in matches[0]["lines"]}
    assert ("player_runs", "Shreyas Iyer", None, "Puntit", 28.5) in got
    assert ("team_runs", "India", 2, "Puntit", 278.5) in got
    assert not any("/coupons/5/3" in u for u in calls)
    assert feedi.horizon_dates(feedi.parse_ts(STAMP), 240)[0] == "2026-11-09"
    assert feedi.horizon_dates(feedi.parse_ts(STAMP), 240)[-1] == "2026-11-19"


def test_the_relay_forwards_the_session(monkeypatch):
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    monkeypatch.setenv("FEEDI_RELAY", "https://relay.example")
    monkeypatch.setenv("FEEDI_RELAY_KEY", "k")
    seen = {}

    class Resp:
        headers = {"content-type": "application/json"}

        def read(self):
            return b"{}"

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def urlopen(req, timeout=None):
        seen["url"] = req.full_url
        seen["headers"] = {k.lower(): v for k, v in req.header_items()}
        return Resp()

    monkeypatch.setattr(feedi.urllib.request, "urlopen", urlopen)
    feedi._http("https://book.test/x", {
        "Accept": "text/html", "X-CSRF-Token": "abc", "x-ct": "12", "x-ct-d": "34",
        "Cookie": "csrf=abc", "Origin": "https://book.test", "Referer": "https://book.test/",
    })
    assert seen["url"].startswith("https://relay.example?")
    assert seen["headers"]["x-relay-csrf"] == "abc"
    assert seen["headers"]["x-relay-ct"] == "12"
    assert seen["headers"]["x-relay-cookie"] == "csrf=abc"
    assert seen["headers"]["x-relay-accept"] == "text/html"
    assert seen["headers"]["x-relay-key"] == "k"


def test_a_refused_hop_is_tagged_without_the_host(monkeypatch):
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    monkeypatch.setenv("FEEDI_RELAY", "https://relay.example")
    monkeypatch.setenv("FEEDI_RELAY_KEY", "k")

    def urlopen(req, timeout=None):
        raise urllib.error.HTTPError(req.full_url, 403, "Forbidden", {}, io.BytesIO(b"host not allowed:book.test"))

    monkeypatch.setattr(feedi.urllib.request, "urlopen", urlopen)
    with pytest.raises(urllib.error.HTTPError) as exc:
        feedi._http("https://book.test/en-in/sports/215", {"Accept": "text/html"})
    assert exc.value.reason == "relay-allow"
    assert "book.test" not in str(exc.value.reason)
