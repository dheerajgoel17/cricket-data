"""Board-score supplement: priced gaps, feed parse, match to book fixtures."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from cricket_data.board_scores import (
    board_affinity,
    collect,
    gaps,
    live_covers,
    match_gap,
    parse_feed,
    parse_source_d,
    priced_matches,
    run,
    write_out,
)

NOW = datetime(2026, 11, 15, 12, 0, tzinfo=timezone.utc)


def book(*rows):
    lines = [{"match": m, "start_utc": s, "fmt": f, "pid": "p", "stat": "runs", "line": 20.5, "books": [{"over": 1.9}]} for m, s, f in rows]
    return {"generated_at_utc": "x", "lines": lines, "events": [], "fancy": []}


def test_priced_matches_dedupe():
    b = book(("India vs England", "2026-11-15T10:00:00Z", "T20"), ("India vs England", "2026-11-15T10:00:00Z", "T20"))
    assert len(priced_matches(b)) == 1


def test_gaps_skip_when_live_has_scores():
    b = book(("India vs England", "2026-11-15T10:00:00Z", "T20"))
    live = {"matches": [{"start": "2026-11-15T10:00:00Z", "fmt": "T20", "status": "live",
                         "teams": [{"name": "India", "runs": 120, "wkts": 2, "display": "120/2"}, {"name": "England", "display": ""}]}]}
    assert gaps(b, live, NOW) == []
    assert live_covers(live, priced_matches(b)[0])


def test_gaps_include_priced_without_scores():
    b = book(("India vs England", "2026-11-15T10:00:00Z", "T20"), ("Namibia vs Oman", "2026-11-20T10:00:00Z", "T20"))
    g = gaps(b, {"matches": []}, NOW)
    assert [x["match"] for x in g] == ["India vs England"]  # Namibia is days away


def test_parse_feed_and_match_gap():
    doc = {"matches": [{
        "team1": "India", "team2": "England", "start_utc": "2026-11-15T10:00:00Z", "status": "Live",
        "innings": [{"team": "India", "runs": 145, "wickets": 3, "overs": "18.2"}],
        "flags": {"India": "/flags/ind.svg"},
    }]}
    cards = parse_feed(doc, "in")
    assert len(cards) == 1
    assert cards[0]["teams"][0]["runs"] == 145
    assert cards[0]["teams"][0]["flag"] == "/flags/ind.svg"
    gap = priced_matches(book(("India vs England", "2026-11-15T10:00:00Z", "T20")))[0]
    hit = match_gap(gap, cards)
    assert hit is not None
    assert hit["status"] == "live"


def test_collect_fills_only_gaps(tmp_path: Path):
    b = book(("India vs England", "2026-11-15T10:00:00Z", "T20"))
    feeds = {"in": {"matches": [{
        "team1": "India", "team2": "England", "start": "2026-11-15T10:00:00Z",
        "team1_runs": 90, "team1_wickets": 1, "team1_overs": "12.0",
        "team2_runs": None, "team2_wickets": None,
    }]}}
    got = collect(b, None, feeds, NOW)
    assert len(got) == 1
    assert got[0]["source"] == "board"
    assert got[0]["teams"][0]["runs"] == 90
    doc = write_out(got, tmp_path / "board_scores.json", NOW)
    assert doc["matches"][0]["id"].startswith("board-")


def test_run_without_boards_writes_empty(tmp_path: Path, monkeypatch):
    monkeypatch.delenv("BOARD_IN_BASE", raising=False)
    monkeypatch.delenv("BOARD_EN_BASE", raising=False)
    monkeypatch.delenv("BOARD_ZA_BASE", raising=False)
    monkeypatch.delenv("SRC_D_BASE", raising=False)
    monkeypatch.delenv("CRICKETDATA_API_KEY", raising=False)
    book_path = tmp_path / "book_lines.json"
    book_path.write_text(json.dumps(book(("India vs England", "2026-11-15T10:00:00Z", "T20"))), encoding="utf-8")
    out = tmp_path / "board_scores.json"
    doc = run(book_path, out, live_src=None, now=NOW)
    assert doc["matches"] == []
    assert out.exists()


def test_csa_gap_prefers_za_affinity():
    gap = {"match": "Titans vs Dolphins", "a": "Titans", "b": "Dolphins", "keys": frozenset(("titans", "dolphins"))}
    assert board_affinity(gap, "za") > board_affinity(gap, "in")
    assert board_affinity(gap, "za") > board_affinity(gap, "cd")


def test_parse_source_d_and_home_score_string():
    doc = {"status": "success", "data": [{
        "name": "Titans vs Dolphins", "teams": ["Titans", "Dolphins"], "matchType": "t20",
        "dateTimeGMT": "2026-11-15T10:00:00", "matchStarted": True, "matchEnded": False,
        "status": "Titans batting", "score": [{"r": 145, "w": 3, "o": 18.2, "inning": "Titans Inning 1"}],
    }]}
    cards = parse_source_d(doc)
    assert len(cards) == 1
    assert cards[0]["board"] == "cd"
    assert any(t.get("runs") == 145 for t in cards[0]["teams"])
    flat = parse_feed({"matches": [{
        "home_team": "Easterns", "away_team": "Warriors", "starts_at": "2026-11-15 10:00:00",
        "home_score": "186/7", "away_score": "206/4", "status": "finished", "sport": "Cricket",
    }]}, "za")
    assert flat[0]["teams"][0]["runs"] == 186
    assert flat[0]["teams"][1]["wkts"] == 4


def test_collect_uses_source_d_for_csa_gap():
    b = book(("Titans vs Dolphins", "2026-11-15T10:00:00Z", "T20"))
    feeds = {"cd": {"status": "success", "data": [{
        "name": "Titans vs Dolphins", "teams": ["Titans", "Dolphins"], "matchType": "t20",
        "dateTimeGMT": "2026-11-15T10:00:00", "matchStarted": True,
        "score": [{"r": 90, "w": 1, "o": 12.0, "inning": "Titans Inning 1"}],
    }]}}
    got = collect(b, None, feeds, NOW)
    assert len(got) == 1
    assert got[0]["board"] == "cd"
