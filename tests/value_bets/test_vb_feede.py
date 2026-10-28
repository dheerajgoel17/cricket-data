import copy
import json
import urllib.error
from pathlib import Path

import pytest

from value_bets import booklines, fancy, pipeline
from value_bets.adapters import feede

FIX = Path(__file__).parent / "fixtures"
STAMP = "2026-10-28T01:00:00Z"
ROOT = "https://feed.invalid/ss/Drilldown/2.31"


def event():
    return json.loads((FIX / "feede_event.json").read_text())["SSResponse"]["children"][0]["event"]


def test_player_lines_and_fancy_of_one_event():
    rows, fx, left = feede.parse_event(event(), "feede_a", STAMP)
    runs = [r for r in rows if r["market_type"] == "batter_runs"]
    assert [(r["player"], r["side"], r["line"], r["back"]) for r in runs] == [
        ("Sediqullah Atal", "over", 22.5, 1.83), ("Sediqullah Atal", "under", 22.5, 1.83),
        ("Ben Curran", "over", 14.5, runs[2]["back"]), ("Ben Curran", "under", 14.5, runs[3]["back"])]
    assert len({r["group_key"] for r in runs[:2]}) == 1 and runs[0]["group_key"] != runs[2]["group_key"]
    assert runs[0]["match"] == "Afghanistan vs Zimbabwe" and runs[0]["competition"] == "T20 Internationals" and runs[0]["start_utc"] == "2026-10-29T14:30:00Z"
    assert runs[0]["source"] == "feede_a" and runs[0]["gender_hint"] is None
    ladder = {(r["player"], r["side"]): (r["line"], r["back"], r["ms_scope"]) for r in rows if r["market_type"] == "batter_milestone"}
    assert ladder[("Ben Curran", "over")] == (49.5, 7.0, "match") and ladder[("Ben Curran", "under")] == (49.5, 1.06, "match")
    assert ("Ibrahim Zadran", "over") in ladder
    assert fx == [{"match": "Afghanistan vs Zimbabwe", "home": "Afghanistan", "away": "Zimbabwe", "start_utc": "2026-10-29T14:30:00Z", "key": "match_sixes", "scope": "match",
                   "team": None, "line": 13.5, "over": 1.8, "under": 1.91, "source": "feede_a", "kind": "bookmaker"}]
    assert left["Match Winner"] == 1 and left["Zimbabwe Top Runscorer"] == 1 and left["Any Player To Score 50"] == 1
    assert left["Rahmanullah Gurbaz - Over/Under 21.5 Runs"] == 1, "a suspended market is left out, not read"


def test_a_multi_day_match_gives_fancy_only_and_a_women_s_match_is_marked():
    ev = event()
    ev["typeName"] = "Test Matches"
    rows, fx, _ = feede.parse_event(ev, "feede_a", STAMP)
    assert rows == [] and [x["key"] for x in fx] == ["match_sixes"], "a Test's player runs line is not the match total"
    ev = event()
    ev["typeName"], ev["name"] = "WBBL", "Melbourne Stars v Hobart Hurricanes"
    assert feede.parse_event(ev, "feede_a", STAMP)[0][0]["gender_hint"] == "female"
    ev["name"] = "no opponent here"
    assert feede.parse_event(ev, "feede_a", STAMP) == ([], [], feede.Counter())


def test_a_one_sided_or_closed_price_is_not_a_line():
    ev = event()
    runs = next(c for c in ev["children"] if c["market"]["name"].startswith("Sediqullah"))
    runs["market"]["children"][1]["outcome"]["outcomeStatusCode"] = "S"
    rows, _, left = feede.parse_event({**ev, "children": [runs]}, "feede_a", STAMP)
    assert rows == [] and left["Sediqullah Atal - Over/Under 22.5 Runs"] == 1


def test_books_come_from_the_environment(monkeypatch):
    monkeypatch.delenv("FEEDE_BOOKS", raising=False)
    assert feede.books() == {} and feede.published() == {}
    with pytest.raises(feede.Skip):
        feede.fetch(STAMP)
    monkeypatch.setenv("FEEDE_BOOKS", f"a=Alpha@{ROOT}/, b = Beta @ {ROOT}2 ,junk,c=NoRoot")
    assert feede.books() == {"a": ("Alpha", ROOT), "b": ("Beta", ROOT + "2")}
    assert feede.published() == {"feede_a": "Alpha", "feede_b": "Beta"}


def fake_feed(monkeypatch, calls, fail=None):
    listing = json.loads((FIX / "feede_listing.json").read_text())
    ev = json.loads((FIX / "feede_event.json").read_text())

    def fake(url, retries=1, **kw):
        calls.append(url)
        assert retries == 0, "one polite attempt, no retries"
        if "/Event?" in url:
            return listing, {}
        if fail and fail in url:
            raise urllib.error.HTTPError(url, 429, "x", {}, None)
        return copy.deepcopy(ev), {}
    monkeypatch.setattr(feede, "http_json", fake)


def test_fetch_is_polite_and_returns_rows_and_fancy(monkeypatch):
    monkeypatch.setenv("FEEDE_BOOKS", f"a=Alpha@{ROOT}")
    monkeypatch.setenv("CV_FEEDE_SPACING_SECS", "0")
    calls = []
    fake_feed(monkeypatch, calls)
    rows, raw = feede.fetch("2026-10-28T01:00:00Z")
    assert len(calls) == 1 + 4, "one listing and one page per match (the outright is not a match)"
    assert calls[0].startswith(ROOT + "/Event?") and "simpleFilter=event.categoryCode:equals:CRICKET" in calls[0]
    assert "event.startTime:greaterThan:2026-10-28T01:00:00Z" in calls[0] and all(c.startswith(ROOT + "/EventToOutcomeForEvent/") for c in calls[1:])
    assert {r["source"] for r in rows} == {"feede_a"} and len(rows) == 4 * 8
    assert raw["books"]["Alpha"]["events"] == 4 and raw["books"]["Alpha"]["fancy"] == 4 and len(raw["fancy"]) == 4


def test_the_event_cap_and_a_429(monkeypatch):
    monkeypatch.setenv("FEEDE_BOOKS", f"a=Alpha@{ROOT},b=Beta@{ROOT}b")
    monkeypatch.setenv("CV_FEEDE_SPACING_SECS", "0")
    monkeypatch.setenv("CV_FEEDE_MAX_EVENTS", "2")
    calls = []
    fake_feed(monkeypatch, calls)
    rows, raw = feede.fetch("2026-10-28T01:00:00Z")
    assert raw["books"]["Alpha"]["events"] == 2 and raw["books"]["Beta"]["events"] == 2, "at most FEEDE_MAX_EVENTS pages per book"
    assert len(calls) == 2 * (1 + 2) and rows
    calls.clear()
    fake_feed(monkeypatch, calls, fail="/2.31b/EventToOutcomeForEvent/")
    rows, raw = feede.fetch("2026-10-28T01:00:00Z")
    assert raw["books"]["Alpha"]["events"] == 2 and raw["books"]["Beta"]["stopped"] == "HTTP 429", "a 429 costs only that book"
    assert {r["source"] for r in rows} == {"feede_a"}


def test_fancy_lines_reach_the_book_file_under_the_published_name(monkeypatch):
    monkeypatch.setenv("FEEDE_BOOKS", f"a=Alpha@{ROOT}")
    _, fx, _ = feede.parse_event(event(), "feede_a", STAMP)
    merged = fancy.adapter_fancy({"feede": {"fancy": fx}, "moviodds_bet365": {"matches": []}, "smarkets": None})
    assert merged == fx
    book = booklines.book_lines([], STAMP, merged)
    assert booklines.public(book)["fancy"][0]["source"] == "Alpha"
    assert feede in pipeline.adapters()


# ---- a Test's innings-scoped lines

def market(name, template, outcomes, status="A"):
    return {"market": {"id": f"m{abs(hash(name)) % 10**6}", "name": name, "templateMarketName": template, "marketStatusCode": status, "children": [
        {"outcome": {"id": f"o{i}", "name": n, "outcomeStatusCode": "A", "children": [{"price": {"priceType": "LP", "priceDec": str(dec)}}]}} for i, (n, dec) in enumerate(outcomes)]}}


def innings_event(typ="Test Matches"):
    ou = lambda line, o, u: [(f"Over - ({line})", o), (f"Under - ({line})", u)]  # noqa: E731
    return {"id": "9", "name": "Bangladesh v West Indies", "startTime": "2026-10-28T03:30:00Z", "typeName": typ, "eventStatusCode": "A", "eventSortCode": "MTCH", "children": [
        market("Tanzid Hasan - Over/Under 31.5 Runs 1st innings", "Batsman Runs", ou(31.5, 1.83, 1.83)),
        market("Tanzid Hasan - Over/Under 36.5 Runs 1st innings", "Batsman Runs", ou(36.5, 2.1, 1.61)),
        market("Tanzid Hasan - Over/Under 26.5 Runs", "Batsman Runs", ou(26.5, 1.67, 2.1)),
        market("Bangladesh Over/Under 363.5 Runs 1st innings", "Home Team Innings Runs", ou(363.5, 1.83, 1.83)),
        market("West Indies Over/Under 288.5 Runs 2nd innings", "Away Team Innings Runs", ou(288.5, 1.7, 2.0)),
        market("Bangladesh Overs 0-10 Over/Under 21.5 Runs 1st innings", "Home Total Runs Between Overs", ou(21.5, 2.0, 1.83)),
        market("Bangladesh Over/Under 30.5 Runs At Fall Of Wicket 1 1st innings", "Home Team Fall Of Wicket", ou(30.5, 1.83, 1.83)),
    ]}


def test_a_test_gives_first_innings_player_lines_and_team_innings_totals():
    rows, fx, left = feede.parse_event(innings_event(), "feede_a", STAMP)
    assert [(r["player"], r["side"], r["line"], r["back"], r["inn"], r["market_type"]) for r in rows] == [
        ("Tanzid Hasan", "over", 31.5, 1.83, 1, "batter_runs"), ("Tanzid Hasan", "under", 31.5, 1.83, 1, "batter_runs"),
        ("Tanzid Hasan", "over", 36.5, 2.1, 1, "batter_runs"), ("Tanzid Hasan", "under", 36.5, 1.61, 1, "batter_runs")]
    assert len({r["group_key"] for r in rows}) == 2, "one over / under pair per market, a ladder of lines per player"
    assert rows[0]["match"] == "Bangladesh vs West Indies" and rows[0]["competition"] == "Test Matches" and rows[0]["start_utc"] == "2026-10-28T03:30:00Z"
    assert [(x["team"], x["inn"], x["line"], x["over"], x["under"], x["key"], x["scope"]) for x in fx] == [
        ("Bangladesh", 1, 363.5, 1.83, 1.83, "team_total_runs", "team"), ("West Indies", 2, 288.5, 1.7, 2.0, "team_total_runs", "team")]
    assert left["Tanzid Hasan - Over/Under 26.5 Runs"] == 1, "no innings named: not the match total, not a first innings either"
    assert left["Bangladesh Overs 0-10 Over/Under 21.5 Runs 1st innings"] == 1 and left["Bangladesh Over/Under 30.5 Runs At Fall Of Wicket 1 1st innings"] == 1


def test_a_first_class_match_gives_team_innings_but_no_player_lines_and_a_limited_overs_match_no_innings():
    rows, fx, left = feede.parse_event(innings_event("Sheffield Shield"), "feede_a", STAMP)
    assert rows == [] and [x["inn"] for x in fx] == [1, 2], "the site has no first-class history to chart a player line against"
    assert left["Tanzid Hasan - Over/Under 31.5 Runs 1st innings"] == 1
    rows, fx, left = feede.parse_event(innings_event("T20 Internationals"), "feede_a", STAMP)
    assert [r["line"] for r in rows] == [26.5, 26.5], "a T20 line is the match's, and one that names an innings is not read"
    assert rows[0]["inn"] is None and fx == [] and left["Tanzid Hasan - Over/Under 31.5 Runs 1st innings"] == 1


def test_an_unusable_team_innings_total_is_left_out():
    ev = innings_event()
    ev["children"][3]["market"]["children"][1]["outcome"]["outcomeStatusCode"] = "S"
    _, fx, left = feede.parse_event(ev, "feede_a", STAMP)
    assert [x["team"] for x in fx] == ["West Indies"] and left["Bangladesh Over/Under 363.5 Runs 1st innings"] == 1
