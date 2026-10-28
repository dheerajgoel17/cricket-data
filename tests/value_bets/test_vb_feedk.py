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
    rows, left = feedk.parse_event(ev, offers, "feedk_a", STAMP)
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


def test_a_test_gives_innings_milestones_only():
    ev, offers = load("feedk_test.json")
    assert feedk.multi_day(ev, offers)
    rows, left = feedk.parse_event(ev, offers, "feedk_a", STAMP)
    assert {r["market_type"] for r in rows} == {"batter_milestone"}, "an 'Innings 1' runs line is not the match total"
    fifty = [r for r in rows if r["line"] == 49.5]
    assert {(r["player"], r["side"], r["ms_scope"]) for r in fifty} == {("Shadman Islam", "over", "innings"), ("Shadman Islam", "under", "innings"),
                                                                       ("Tanzid Hasan", "over", "innings"), ("Tanzid Hasan", "under", "innings")}
    assert left["Player's Total Runs - Innings 1"] == 2
    assert not feedk.multi_day(*load("feedk_t20.json"))


def test_unusable_offers_are_left_out_not_guessed():
    ev, offers = load("feedk_t20.json")
    runs = next(b for b in offers if b["criterion"]["label"] == "Player's Total Runs")
    runs["outcomes"][1]["status"] = "SUSPENDED"
    rows, left = feedk.parse_event(ev, [runs], "feedk_a", STAMP)
    assert rows == [] and left["Player's Total Runs"] == 1, "one side closed: no line"
    runs["outcomes"][1].update(status="OPEN", label="Under 25.5", englishLabel="Under 25.5")
    assert feedk.parse_event(ev, [runs], "feedk_a", STAMP)[0] == [], "two different lines are not one market"
    ev["state"] = "STARTED"
    assert feedk.parse_event(ev, offers, "feedk_a", STAMP) == ([], feedk.Counter())


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
    assert raw["books"]["Alpha"]["events"] == 1 and raw["books"]["Beta"]["stopped"] == "HTTP 429"
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
