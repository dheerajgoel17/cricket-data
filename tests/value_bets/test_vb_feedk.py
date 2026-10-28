import json
import urllib.error
from pathlib import Path

import pytest

from value_bets import booklines, config
from value_bets.adapters import feedk

FIX = Path(__file__).parent / "fixtures"
STAMP = "2026-10-28T01:00:00Z"


def load(name):
    j = json.loads((FIX / name).read_text())
    return j["events"][0], j["betOffers"]


def test_limited_overs_player_lines_and_ladders():
    ev, offers = load("feedk_t20.json")
    rows, fancy, left = feedk.parse_event(ev, offers, "feedk_a", STAMP)
    runs = [r for r in rows if r["market_type"] == "batter_runs"]
    assert [(r["player"], r["side"], r["line"], r["back"]) for r in runs] == [
        ("Hayley Matthews", "over", 24.5, 2.0), ("Hayley Matthews", "under", 24.5, 1.73),
        ("Courtney Webb", "over", 19.5, 2.0), ("Courtney Webb", "under", 19.5, 1.73)]
    assert len({r["group_key"] for r in runs[:2]}) == 1 and runs[0]["group_key"] != runs[2]["group_key"], "one over/under pair per player"
    assert runs[0]["match"] == "Melbourne Renegades (W) vs Sydney Thunder (W)" and runs[0]["gender_hint"] == "female"
    assert runs[0]["competition"] == "T20 Womens Big Bash" and runs[0]["start_utc"] == "2026-10-29T04:40:00Z" and runs[0]["source"] == "feedk_a"
    ladder = [r for r in rows if r["market_type"] == "batter_milestone"]
    assert [(r["player"], r["line"], r["side"], r["ms_scope"], r["back"]) for r in ladder] == [
        ("Hayley Matthews", 19.5, "over", "match", 1.65), ("Courtney Webb", 19.5, "over", "match", 1.91)], "a Yes-only rung is one-sided, as a ladder"
    assert left["Match Odds"] == 1 and left["Top Run Scorer - Melbourne Renegades (W)"] == 1, "what was not read is counted"
    assert fancy == [] and all(r["inn"] is None for r in rows), "a limited-overs match has no innings of its own to price"


def team_total(inn=1, side="Home", line=360500, over=1820, under=1820, label=None):
    lab = label or f"Total Runs - {side} Team, Innings {inn}"
    return {"id": 99, "criterion": {"label": lab, "englishLabel": lab}, "outcomes": [
        {"label": "Over", "englishLabel": "Over", "odds": over, "line": line, "status": "OPEN"}, {"label": "Under", "englishLabel": "Under", "odds": under, "line": line, "status": "OPEN"}]}


def test_a_test_gives_first_innings_lines_scoped_to_the_innings_and_milestones():
    ev, offers = load("feedk_test.json")
    assert feedk.multi_day(ev, offers) and feedk.is_test(ev)
    rows, fancy, left = feedk.parse_event(ev, offers + [team_total(), team_total(2, "Away", 280500, 1900, 1800)], "feedk_a", STAMP)
    runs = [r for r in rows if r["market_type"] == "batter_runs"]
    assert [(r["player"], r["side"], r["line"], r["back"], r["inn"]) for r in runs] == [
        ("Shadman Islam", "over", 26.5, 2.0, 1), ("Shadman Islam", "under", 26.5, 1.73, 1), ("Tanzid Hasan", "over", 26.5, 2.0, 1), ("Tanzid Hasan", "under", 26.5, 1.73, 1)]
    assert runs[0]["market_raw"] == "Player's Total Runs - Innings 1" and runs[0]["group_key"] != runs[2]["group_key"] and runs[0]["in_play"] is False
    fifty = [r for r in rows if r["line"] == 49.5]
    assert {(r["player"], r["side"], r["ms_scope"]) for r in fifty} == {("Shadman Islam", "over", "innings"), ("Shadman Islam", "under", "innings"),
                                                                       ("Tanzid Hasan", "over", "innings"), ("Tanzid Hasan", "under", "innings")}
    assert all(r["inn"] is None for r in rows if r["market_type"] == "batter_milestone"), "milestones keep the scope they already had"
    assert [(x["team"], x["inn"], x["line"], x["over"], x["under"], x["key"], x["scope"]) for x in fancy] == [
        ("Bangladesh", 1, 360.5, 1.82, 1.82, "team_total_runs", "team"), ("West Indies", 2, 280.5, 1.9, 1.8, "team_total_runs", "team")]
    assert fancy[0]["start_utc"] == "2026-10-28T04:00:00Z" and fancy[0]["home"] == "Bangladesh" and fancy[0]["source"] == "feedk_a" and fancy[0]["kind"] == "bookmaker"
    assert "Top Run Scorer - Bangladesh, Innings 1" in left and "Player's Total Runs - Innings 1" not in left
    assert not feedk.multi_day(*load("feedk_t20.json"))


def test_a_multi_day_line_counts_only_with_an_innings_in_a_test_and_for_a_batter():
    ev, offers = load("feedk_test.json")
    runs = next(b for b in offers if b["criterion"]["label"] == "Player's Total Runs - Innings 1")
    bare = {**runs, "criterion": {"label": "Player's Total Runs", "englishLabel": "Player's Total Runs"}}
    wkts = {**runs, "criterion": {"label": "Bowler's Total Wickets - Innings 1", "englishLabel": "Bowler's Total Wickets - Innings 1"}}
    rows, fancy, left = feedk.parse_event(ev, [bare, wkts], "feedk_a", STAMP)
    assert rows == [] and left["Player's Total Runs"] == 1 and left["Bowler's Total Wickets - Innings 1"] == 1, "no innings named, or not a batter: not a line we can scope"
    ev["path"][1]["englishName"] = "Sheffield Shield"  # still multi-day (the draw outcome), no longer a Test
    assert feedk.multi_day(ev, offers) and not feedk.is_test(ev)
    rows, fancy, left = feedk.parse_event(ev, [runs, team_total()], "feedk_a", STAMP)
    assert rows == [] and fancy == [] and left["Player's Total Runs - Innings 1"] == 1 and left["Total Runs - Home Team, Innings 1"] == 1, "the site has no first-class history to chart it against"


def test_a_team_total_needs_both_sides_on_one_line():
    ev, offers = load("feedk_test.json")
    odd = team_total()
    odd["outcomes"][1]["line"] = 365500
    assert feedk.parse_event(ev, [odd], "feedk_a", STAMP)[1] == []
    odd = team_total()
    odd["outcomes"][0]["status"] = "SUSPENDED"
    assert feedk.parse_event(ev, [odd], "feedk_a", STAMP)[1] == []
    assert feedk.parse_event(ev, [team_total(label="Total Runs - Home Team, Innings 1, Over 5")], "feedk_a", STAMP)[1] == [], "a team's runs in one over is another market"


def test_unusable_offers_are_left_out_not_guessed():
    ev, offers = load("feedk_t20.json")
    runs = next(b for b in offers if b["criterion"]["label"] == "Player's Total Runs")
    runs["outcomes"][1]["status"] = "SUSPENDED"
    rows, _, left = feedk.parse_event(ev, [runs], "feedk_a", STAMP)
    assert rows == [] and left["Player's Total Runs"] == 1, "one side closed: no line"
    runs["outcomes"][1].update(status="OPEN", label="Under 25.5", englishLabel="Under 25.5")
    assert feedk.parse_event(ev, [runs], "feedk_a", STAMP)[0] == [], "two different lines are not one market"
    ev["state"] = "STARTED"
    assert feedk.parse_event(ev, offers, "feedk_a", STAMP) == ([], [], feedk.Counter())


def test_milestone_lines():
    assert [feedk.milestone_line(x) for x in ("To score a Half-Century - Innings 1", "To score a Century", "To score at least 30 Runs", "To score a duck")] == [49.5, 99.5, 29.5, None]


def test_books_come_from_the_environment(monkeypatch):
    monkeypatch.delenv("FEEDK_BOOKS", raising=False)
    monkeypatch.delenv("FEEDK_URL", raising=False)
    assert feedk.books() == {} and feedk.published() == {}
    with pytest.raises(feedk.Skip):
        feedk.fetch(STAMP)
    monkeypatch.setenv("FEEDK_URL", "https://feed.invalid/root/")
    with pytest.raises(feedk.Skip):
        feedk.fetch(STAMP)  # no books named
    monkeypatch.setenv("FEEDK_BOOKS", "a=Alpha, b = Beta ,junk")
    assert feedk.books() == {"a": "Alpha", "b": "Beta"} and feedk.published() == {"feedk_a": "Alpha", "feedk_b": "Beta"}


def fake_feed(monkeypatch, calls, fail=None):
    ev, offers = load("feedk_t20.json")
    listing = {"events": [{"event": {**ev, "start": "2026-10-28T08:00:00Z"}}, {"event": {**ev, "id": 2, "nonLiveBoCount": 2, "start": "2026-10-28T09:00:00Z"}}]}

    def fake(url, retries=1, **kw):
        calls.append(url)
        assert retries == 0, "never retried: one polite attempt"
        if "listView" in url:
            return listing, {}
        if fail and f"/{fail[0]}/betoffer" in url:
            raise urllib.error.HTTPError(url, fail[1], "x", {}, None)
        return {"events": [ev], "betOffers": offers}, {}
    monkeypatch.setattr(feedk, "http_json", fake)


def test_fetch_is_polite_and_keeps_the_good_books(monkeypatch):
    monkeypatch.setenv("FEEDK_URL", "https://feed.invalid/root")
    monkeypatch.setenv("FEEDK_BOOKS", "a=Alpha,b=Beta")
    monkeypatch.setenv("CV_FEEDK_SPACING_SECS", "0")
    calls = []
    fake_feed(monkeypatch, calls, fail=("b", 429))
    rows, raw = feedk.fetch("2026-10-28T01:00:00Z")
    assert {r["source"] for r in rows} == {"feedk_a"}, "a 429 on one book costs only that book"
    assert raw["books"]["Alpha"]["events"] == 1 and raw["books"]["Beta"]["stopped"] == "HTTP 429" and raw["fancy"] == []
    assert [u.split("/root/")[1].split("?")[0] for u in calls] == ["a/listView/cricket.json", "a/betoffer/event/" + str(load("feedk_t20.json")[0]["id"]) + ".json",
                                                                 "b/listView/cricket.json", "b/betoffer/event/" + str(load("feedk_t20.json")[0]["id"]) + ".json"]
    assert all("&ncid=" in u for u in calls) and not any("/2.json" in u for u in calls), "an event with too few offers is not fetched"


def test_every_books_price_lands_on_the_line(monkeypatch):
    monkeypatch.setenv("FEEDK_BOOKS", "a=Alpha,b=Beta")
    ev, offers = load("feedk_t20.json")
    rows = []
    for src, scale in (("feedk_a", 1.0), ("feedk_b", 1.05)):
        for r in feedk.parse_event(ev, offers, src, STAMP)[0]:
            r.update(back=round(r["back"] * scale, 4), event_key="e1", player_id="p-" + r["player"], fmt="T20", player_hist_name=r["player"], player_team="Melbourne Renegades")
            rows.append(r)
    book = booklines.book_lines(rows, STAMP)
    line = next(x for x in book["lines"] if x["player"] == "Hayley Matthews" and x["stat"] == "runs")
    assert line["line"] == 24.5
    assert line["books"] == [{"source": "Alpha", "kind": "bookmaker", "over": 2.0, "under": 1.73}, {"source": "Beta", "kind": "bookmaker", "over": 2.1, "under": 1.817}]
    assert booklines.public({"x": ["feedk_a", "feedk_b"]}) == {"x": ["Alpha", "Beta"]}
    assert "Alpha" in book["events"][0]["sources"]


def test_the_source_switches_itself_on(monkeypatch):
    from value_bets import pipeline
    assert feedk in pipeline.adapters() and feedk.NAME == "feedk"
    assert config.get("FEEDK_MAX_EVENTS") > 0


def test_player_performance_is_the_points_stat_for_a_limited_overs_match_only():
    ev, offers = load("feedk_t20.json")
    runs = next(o for o in offers if o["criterion"]["englishLabel"] == "Player's Total Runs")
    pp = json.loads(json.dumps(runs))
    pp["criterion"] = {"label": "Player Performance", "englishLabel": "Player Performance"}
    pp["id"] = 77
    rows, _, _ = feedk.parse_event(ev, offers + [pp], "feedk_a", STAMP)
    pts = [(r["player"], r["side"], r["line"], r["back"]) for r in rows if r["market_type"] == "player_points"]
    assert pts == [("Hayley Matthews", "over", 24.5, 2.0), ("Hayley Matthews", "under", 24.5, 1.73)]  # the same over/under reading as a player's total runs
    assert booklines.STAT["player_points"] == "points"
