import json
import urllib.error
import urllib.parse
from pathlib import Path

import pytest

from value_bets import booklines, pipeline
from value_bets.adapters import feedg

FIX = Path(__file__).parent / "fixtures"
STAMP = "2026-10-28T10:00:00Z"
ENV = {"FEEDG_NAME": "Test Book", "FEEDG_API": "https://api.invalid"}


def J(name):
    return json.loads((FIX / name).read_text())


@pytest.fixture
def env(monkeypatch):
    for k, v in ENV.items():
        monkeypatch.setenv(k, v)
    monkeypatch.setenv("CV_FEEDG_SPACING_SECS", "0")


def parsed():
    stub = J("feedg_list.json")["data"]["events"][0]
    ev = feedg._ev(stub, STAMP)
    cat = J("feedg_event.json")["data"]
    odds = feedg.decode(J("feedg_odds.json"), cat["fancy_odds_keys"])
    return ev, feedg.parse_event(cat["event"]["fancy"], odds, ev)


def test_the_event_is_read_in_utc_and_a_women_s_side_is_recognised():
    ev, _ = parsed()
    assert (ev["home"], ev["away"], ev["common"]["start_utc"], ev["common"]["gender_hint"]) == ("Melbourne Renegades W", "Sydney Thunder W", "2026-10-29T04:40:00Z", "female")
    assert feedg.split_event("South Australia v Western Australia,") == ("South Australia", "Western Australia") and feedg.split_event("Winner") is None
    assert feedg.start_of("nope") is None


def test_session_rows_read_back_and_lay_rates_as_the_exchange_does_hand_computed():
    _, (rows, fx, left) = parsed()
    # C Webb 18 / 18 at back 90 and lay 110: Yes wins at 18+ (over 17.5, 100 staked wins 90: 1.90), No wins at 17- (under 17.5, 110 staked wins 100: 1.909)
    webb = [(r["line"], r["side"], r["back"]) for r in rows if r["player"] == "C Webb"]
    assert webb == [(17.5, "over", 1.9), (17.5, "under", 1.909)]
    assert {r["source"] for r in rows} == {"feedg_f"} and all(r["market_type"] == "batter_runs" for r in rows)
    by = {(f["key"], f["team"], f["line"]): (f["over"], f["under"]) for f in fx}
    # total match fours 33 / 30 at 100 / 100: over 32.5 and under 29.5, one-sided each, 2.00
    assert by["match_fours", None, 32.5] == (2.0, None) and by["match_fours", None, 29.5] == (None, 2.0)
    # 30s 3 / 3 at 100 / 150: one two-way line at 2.5: 2.00 and 1 + 100 / 150
    assert by["match_30s", None, 2.5] == (2.0, 1.667)
    # the whole innings of a side is the longest "N Over Runs" (20 here); 150 / 147 gives over 149.5 and under 146.5
    assert by["team_total_runs", "Melbourne Renegades W", 149.5] == (2.0, None) and by["team_total_runs", "Melbourne Renegades W", 146.5] == (None, 2.0)
    assert by["team_total_fours", "Sydney Thunder W", 16.5] == (2.0, None)  # "1st Inn Total Match Fours ST W"
    assert ("top_score", None, 58.5) in by and ("highest_over", None, 17.5) in by
    side = [f for f in fx if f["key"] == "team_total_runs"]
    assert all(f["bat_first"] and f["rules"] == "void_any_ball" for f in side) and all("bat_first" not in f and f["rules"] == "not_voided_by_lost_balls" for f in fx if f["scope"] == "match")


def test_part_innings_odd_even_and_counting_markets_are_left_out():
    _, (rows, fx, left) = parsed()
    assert {"6 Over Runs MR W Adv", "10 Over Runs ST W Adv", "6 Over Odd Even Run Bhav MR W Adv", "T Wilson Boundaries Adv", "Match 1st Over Run Adv", "Total Match Extras (MR W vs ST W) Adv"} <= set(left)
    assert not any(f["line"] in (43.5, 44.5) for f in fx)  # no 6-over line


def test_a_closed_market_is_not_a_price():
    ev, _ = parsed()
    cat = J("feedg_event.json")["data"]
    odds = feedg.decode(J("feedg_odds.json"), cat["fancy_odds_keys"])
    for o in odds.values():
        o["suspended"] = "1"
    assert feedg.parse_event(cat["event"]["fancy"], odds, ev)[:2] == ([], [])
    odds = feedg.decode(J("feedg_odds.json"), cat["fancy_odds_keys"])
    for o in odds.values():
        o["ball_running"] = "1"
    assert feedg.parse_event(cat["event"]["fancy"], odds, ev)[:2] == ([], [])


def test_the_book_is_published_under_its_configured_name_and_off_without_it(env, monkeypatch):
    assert feedg.published() == {"feedg_f": "Test Book Fancy"}
    assert booklines.public({"s": "feedg_f"}) == {"s": "Test Book Fancy"}
    assert "feedg" in {m.NAME for m in pipeline.adapters()}
    for k in ENV:
        monkeypatch.delenv(k)
    assert feedg.published() == {} and feedg.settings() == {}
    with pytest.raises(feedg.Skip):
        feedg.fetch(STAMP)


def serve(monkeypatch, fail=None):
    calls = []

    def get(url, method="GET", headers=None, data=None, retries=0, **_):
        calls.append((method, url, data))
        if fail and fail in url:
            raise urllib.error.HTTPError(url, 429, "slow down", {}, None)
        if url.endswith("/api/guest/event_list"):
            return J("feedg_list.json"), {}
        if "/api/guest/event/" in url:
            return J("feedg_event.json"), {}
        if url.endswith("/ws/getMarketDataNew"):
            return J("feedg_odds.json"), {}
        raise AssertionError(url)

    monkeypatch.setattr(feedg, "http_json", get)
    return calls


def test_a_run_reads_the_list_then_each_upcoming_cricket_match_with_a_catalogue_and_an_odds_call(env, monkeypatch):
    calls = serve(monkeypatch)
    rows, raw = feedg.fetch(STAMP)  # 10:00 on the 28th: the women's match (04:40 on the 29th) is upcoming, the other cricket event started days ago, the racing one is not cricket
    paths = [(m, u.replace("https://api.invalid", "API").replace("https://hub.invalid", "HUB")) for m, u, _ in calls]
    assert paths == [("GET", "API/api/guest/event_list"), ("POST", "API/api/guest/event/36224613"), ("POST", "HUB/ws/getMarketDataNew")]
    body = calls[2][2].decode()
    assert body.count("market_ids[]=") == 22 and "9.226102812490004" in body  # the 22 run markets of this match (the 4 odd/even ones are not asked for), in one call
    assert raw["books"]["Test Book"]["events"] == 1 and raw["books"]["Test Book"]["fancy"] == len(raw["fancy"]) > 0 and rows
    assert {f["source"] for f in raw["fancy"]} == {"feedg_f"}


def test_an_http_error_ends_the_run_for_the_book_with_nothing_read(env, monkeypatch):
    serve(monkeypatch, fail="/api/guest/event/")
    rows, raw = feedg.fetch(STAMP)
    assert rows == [] and raw["fancy"] == [] and raw["books"]["Test Book"]["stopped"] == "HTTP 429" and raw["books"]["Test Book"]["events"] == 0


def refuse(monkeypatch):
    def get(url, **_):
        raise urllib.error.HTTPError(url, 403, "blocked", {}, None)

    monkeypatch.setattr(feedg, "http_json", get)


def test_when_the_book_refuses_this_network_the_runners_last_read_is_used_if_fresh_and_upcoming_only(env, monkeypatch, tmp_path):
    state = tmp_path / "feedg_latest.json"
    monkeypatch.setattr(feedg, "STATE", state)
    serve(monkeypatch)
    rows, raw = feedg.fetch(STAMP)
    feedg.write_state(rows, raw, STAMP)
    refuse(monkeypatch)
    got_rows, got = feedg.fetch("2026-10-28T11:30:00Z")  # 90 minutes later, before the match (04:40 on the 29th)
    assert got_rows == rows and got["fancy"] == raw["fancy"] and got["books"]["Test Book"]["from_state"] == STAMP
    d = json.loads(state.read_text())  # a read made at 03:00 on the 29th: at 04:50 the match has started
    d["fetched_at"] = "2026-10-29T03:00:00Z"
    state.write_text(json.dumps(d))
    started_rows, started = feedg.fetch("2026-10-29T04:50:00Z")
    assert started_rows == [] and started["fancy"] == []


def test_a_stale_read_is_not_used_and_a_refusal_with_no_read_is_an_error(env, monkeypatch, tmp_path):
    monkeypatch.setattr(feedg, "STATE", tmp_path / "feedg_latest.json")
    refuse(monkeypatch)
    with pytest.raises(urllib.error.HTTPError):
        feedg.fetch(STAMP)  # no read yet
    serve(monkeypatch)
    rows, raw = feedg.fetch(STAMP)
    feedg.write_state(rows, raw, STAMP)
    refuse(monkeypatch)
    with pytest.raises(urllib.error.HTTPError):
        feedg.fetch("2026-10-28T14:00:00Z")  # four hours old: past the 3 hour limit
    with pytest.raises(urllib.error.HTTPError):
        feedg.fetch(STAMP, use_state=False)  # the India runner itself never reads the file


def test_with_a_relay_every_call_goes_through_it_with_the_key_and_the_real_address_in_u(env, monkeypatch):
    monkeypatch.setenv("FEEDG_RELAY", "https://relay.invalid/api/relay")
    monkeypatch.setenv("FEEDG_RELAY_KEY", "k-1")
    calls = []

    def get(url, method="GET", headers=None, data=None, retries=0, **_):
        calls.append((method, url, headers, data))
        real = urllib.parse.unquote(url)
        if "event_list" in real:
            return J("feedg_list.json"), {}
        if "/api/guest/event/" in real:
            return J("feedg_event.json"), {}
        return J("feedg_odds.json"), {}

    monkeypatch.setattr(feedg, "http_json", get)
    rows, raw = feedg.fetch(STAMP)
    assert rows and raw["books"]["Test Book"]["events"] == 1
    assert all(u.startswith("https://relay.invalid/api/relay?u=https%3A%2F%2F") and h["x-relay-key"] == "k-1" for _, u, h, _ in calls)
    assert [m for m, *_ in calls] == ["GET", "POST", "POST"] and calls[0][1].endswith("%2Fapi%2Fguest%2Fevent_list")
    assert calls[1][2]["Content-Type"] == "application/x-www-form-urlencoded" and calls[2][3].startswith(b"market_ids[]=")
    monkeypatch.delenv("FEEDG_RELAY_KEY")
    assert feedg.relay() is None  # no key: direct calls
