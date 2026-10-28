import json
import urllib.error
from pathlib import Path

import pytest

from value_bets import booklines, pipeline
from value_bets.adapters import feedf

FIX = Path(__file__).parent / "fixtures"
STAMP = "2026-10-28T10:00:00Z"
ENV = {"FEEDF_NAME": "Test Book", "FEEDF_API": "https://api.invalid", "FEEDF_PREMIUM": "https://sb.invalid", "FEEDF_TENANT": "42"}


def J(name):
    return json.loads((FIX / name).read_text())


@pytest.fixture
def env(monkeypatch):
    for k, v in ENV.items():
        monkeypatch.setenv(k, v)
    monkeypatch.setenv("CV_FEEDF_SPACING_SECS", "0")


def england_sri_lanka():
    stub = next(c for c in J("feedf_names.json")["data"]["children"] if c["eventId"] == "36246014")
    return feedf._event(stub, feedf.menu_index(J("feedf_menu.json"))["36246014"], STAMP)


def test_a_session_rate_is_even_money_at_100_and_skewed_either_side():
    assert [feedf.dec(r) for r in (100, 85, 115, 0, None, "x")] == [2.0, 1.85, 2.15, None, None, None]


def test_the_event_list_is_read_in_ist_and_the_menu_links_the_two_ids():
    ev = england_sri_lanka()
    assert (ev["home"], ev["away"], ev["sr"], ev["common"]["competition"]) == ("England", "Sri Lanka", 75329894, "One Day Internationals")
    assert ev["common"]["start_utc"] == "2026-10-29T08:00:00Z"  # 13:30 in Asia/Calcutta
    assert feedf.menu_index(J("feedf_menu.json")) == {"36246014": (75329894, "One Day Internationals"), "36246415": (75400001, "Emirates D20")}
    assert feedf.event_start("29/10/2026 20:00:00") == "2026-10-29T14:30:00Z" and feedf.event_start("nope") is None


def test_premium_gives_decimal_player_rows_and_two_way_fancy_lines_and_skips_suspended_markets():
    rows, fx, left = feedf.parse_premium(J("feedf_premium.json")["data"], england_sri_lanka(), STAMP)
    runs = [(r["player"], r["line"], r["side"], r["back"]) for r in rows if r["market_type"] == "batter_runs"]
    assert runs == [("Joe Root", 36.5, "over", 1.85), ("Joe Root", 36.5, "under", 1.85), ("Ben Duckett", 30.5, "over", 1.85), ("Ben Duckett", 30.5, "under", 1.85)]
    ms = {(r["player"], r["line"], r["side"]): r["back"] for r in rows if r["market_type"] == "batter_milestone"}
    assert ms[("Ben Duckett", 99.5, "over")] == 6.25 and ms[("Ben Duckett", 99.5, "under")] == 1.1 and ms[("Joe Root", 49.5, "over")] == 2.35  # "to score 100" is 99.5
    assert {r["source"] for r in rows} == {"feedf_p"} and {f["source"] for f in fx} == {"feedf_p"}
    got = {(f["key"], f["team"]): (f["line"], f["over"], f["under"], f["rules"]) for f in fx}
    assert got[("match_fours", None)] == (48.5, 1.9, 1.8, "void_below_80pct") and got[("match_sixes", None)] == (13.5, 1.75, 1.95, "void_below_80pct")
    assert got[("team_total_sixes", "England")] == (8.5, 2.15, 1.65, "void_below_80pct")  # the suspended duplicate of this market carries no prices
    assert len([f for f in fx if f["key"] == "team_total_sixes"]) == 2 and all("bat_first" not in f for f in fx)  # no batting-order condition in premium
    pp = [(r["player"], r["line"], r["side"], r["back"]) for r in rows if r["market_type"] == "player_points"]
    assert pp == [("Harry Brook", 34.5, "over", 1.85), ("Harry Brook", 34.5, "under", 1.85)]  # the suspended duplicate has no prices
    assert left["Winner (incl. super over)"] == 1 and left["Top batter"] == 1 and "Brook, Harry total player performance" not in left


def test_fancy_yes_is_over_line_minus_half_and_no_is_under_line_minus_half():
    rows, fx, left = feedf.parse_fancy(J("feedf_fancy.json")["data"], england_sri_lanka(), STAMP)
    # B Duckett 30 / 30 at rates 85 / 115: Yes wins at 30 or more (over 29.5, 1.85), No wins at 29 or fewer (under 29.5, 2.15)
    assert [(r["player"], r["line"], r["side"], r["back"]) for r in rows if r["player"] == "B Duckett"] == [("B Duckett", 29.5, "over", 1.85), ("B Duckett", 29.5, "under", 2.15)]
    assert {r["source"] for r in rows} == {"feedf_f"} and {f["source"] for f in fx} == {"feedf_f"}
    by = {(f["key"], f["line"]): f for f in fx}
    # 50 over runs, England: Yes 316 (over 315.5) and No 312 (under 311.5), both at rate 100: two one-sided lines a gap apart
    assert (by["team_total_runs", 315.5]["over"], by["team_total_runs", 315.5]["under"]) == (2.0, None)
    assert (by["team_total_runs", 311.5]["over"], by["team_total_runs", 311.5]["under"]) == (None, 2.0)
    assert by["team_total_runs", 315.5]["team"] == "England" and by["team_total_runs", 315.5]["bat_first"] and by["team_total_runs", 315.5]["rules"] == "void_any_ball"
    # match fours 50 / 47: over 49.5, under 46.5; fifties 3 / 3 at 80 / 130: one two-way line at 2.5
    assert (by["match_fours", 49.5]["over"], by["match_fours", 46.5]["under"]) == (2.0, 2.0)
    assert (by["match_50s", 2.5]["over"], by["match_50s", 2.5]["under"], by["match_50s", 2.5]["rules"]) == (1.8, 2.3, "not_voided_by_lost_balls")
    # player performance (fantasy points: 1 per run, 20 per wicket, 10 per catch, 25 per stumping): H Brook 32 / 34 at 100 / 100 is Yes at 34 (over 33.5) and No at 32 (under 31.5)
    assert [(r["player"], r["market_type"], r["line"], r["side"], r["back"]) for r in rows if r["market_type"] == "player_points"] == [("H Brook", "player_points", 33.5, "over", 2.0), ("H Brook", "player_points", 31.5, "under", 2.0)]
    # not read: first-over, 10-over, wicket-fall, meter and khado markets
    assert {"1st Wkt Meter Eng", "Match 1st Over Run Adv"} <= set(left) and "H Brook" not in left


def test_a_suspended_or_ball_running_market_is_not_a_price():
    data = J("feedf_fancy.json")["data"]
    for c in data:
        for m in c["markets"]:
            m["status"] = "SUSPENDED"
    assert feedf.parse_fancy(data, england_sri_lanka(), STAMP)[:2] == ([], [])
    prem = J("feedf_premium.json")["data"]
    for m in prem:
        m["marketStatus"] = "Suspended"
    assert feedf.parse_premium(prem, england_sri_lanka(), STAMP)[:2] == ([], [])


def test_team_abbreviations_match_one_side_only():
    assert feedf.abbreviates("ENG", "England") and feedf.abbreviates("SL", "Sri Lanka") and feedf.abbreviates("AFG", "Afghanistan")
    assert not feedf.abbreviates("SL", "England") and not feedf.abbreviates("ENG", "Sri Lanka")
    assert feedf.person("Duckett", "Ben") == "Ben Duckett"


def test_not_configured_is_skipped_and_the_book_is_published_under_its_configured_name(env, monkeypatch):
    assert feedf.published() == {"feedf_p": "Test Book Premium", "feedf_f": "Test Book Fancy"}  # one book, two feeds, two names
    assert booklines.public({"a": "feedf_p", "b": "feedf_f"}) == {"a": "Test Book Premium", "b": "Test Book Fancy"}
    assert "feedf" in {m.NAME for m in pipeline.adapters()}
    for k in ENV:
        monkeypatch.delenv(k)
    assert feedf.published() == {} and feedf.settings() == {}
    with pytest.raises(feedf.Skip):
        feedf.fetch(STAMP)


def serve(monkeypatch, fail=None):
    calls = []

    def get(url, headers=None, retries=0, **_):
        calls.append((url, headers))
        if fail and fail in url:
            raise urllib.error.HTTPError(url, 429, "slow down", {}, None)
        for key, name in (("getEventNames", "feedf_names.json"), ("loadPlayerMenu", "feedf_menu.json"), ("getFancyEventDetails", "feedf_fancy.json"), ("getMarketWithOdds", "feedf_premium.json")):
            if key in url:
                return J(name), {}
        raise AssertionError(url)

    monkeypatch.setattr(feedf, "http_json", get)
    return calls


def test_a_run_reads_the_list_and_menu_once_and_each_upcoming_match_twice(env, monkeypatch):
    calls = serve(monkeypatch)
    rows, raw = feedf.fetch(STAMP)  # now is 10:00 UTC on the 28th: England v Sri Lanka (29th, 08:00) and Afghanistan v Zimbabwe (29th, 14:30) are in the horizon
    paths = [u.replace("https://api.invalid", "").replace("https://sb.invalid", "SB") for u, _ in calls]
    assert paths[:2] == ["/exchange/v2/dashboard/getEventNames", "/exchange/v2/dashboard/loadPlayerMenu"]
    assert sum("getFancyEventDetails" in p for p in paths) == 2 and sum("getMarketWithOdds" in p for p in paths) == 2
    assert "SB/exsr/v1/sports/getMarketWithOdds?eventId=75329894&etId=21" in paths and "SB/exsr/v1/sports/getMarketWithOdds?eventId=75400001&etId=21" in paths
    assert all(h == {"x-timeZone": "Asia/Calcutta", "Tenant-ID": "42"} for _, h in calls)  # the only headers: a time zone and the account id; no session
    assert {r["source"] for r in rows} == {"feedf_p", "feedf_f"} and all(r["start_utc"] in ("2026-10-29T08:00:00Z", "2026-10-29T14:30:00Z") for r in rows)
    assert raw["books"]["Test Book"]["events"] == 2 and len(raw["fancy"]) == raw["books"]["Test Book"]["fancy"] > 0
    assert {f["source"] for f in raw["fancy"]} == {"feedf_p", "feedf_f"} and all(f["kind"] == "bookmaker" for f in raw["fancy"])
    # the same market in both feeds (match fours) stays two lines from two sources: premium 48.5 two-way, fancy 49.5 / 46.5 one-sided
    fours = {(f["source"], f["line"]) for f in raw["fancy"] if f["key"] == "match_fours"}
    assert {("feedf_p", 48.5), ("feedf_f", 49.5), ("feedf_f", 46.5)} <= fours


def test_an_http_error_ends_the_run_for_the_book_and_keeps_what_was_read(env, monkeypatch):
    serve(monkeypatch, fail="getMarketWithOdds")
    rows, raw = feedf.fetch(STAMP)
    assert raw["books"]["Test Book"]["stopped"] == "HTTP 429" and raw["books"]["Test Book"]["events"] == 0
    assert rows  # the first match's fancy rows were read before the premium call failed
