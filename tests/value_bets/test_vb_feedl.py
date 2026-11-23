"""Feed L: BetConstruct-class Swarm parent — synthetic markets only (never a live socket)."""
from value_bets.adapters import feedl

STAMP = "2026-11-20T12:00:00Z"
COMMON = dict(
    source="feedl", source_type="bookmaker", event_id="1", match="Australia vs England",
    team_a="Australia", team_b="England", gender_hint=None, competition="ODI Series",
    start_utc="2026-11-21T05:00:00Z", in_play=False, fetched_at=STAMP, fmt="ODI",
)


def mkt(name, type_, events, base=None):
    return {"id": 1, "name": name, "type": type_, "base": base, "event": {
        str(i): {"name": n, "price": p, "base": b} for i, (n, p, b) in enumerate(events)
    }}


def test_parse_fifty_and_top_and_fancy():
    markets = [
        mkt("HC Brook (England) to Score a Fifty in the Match", "BatsmantoScoreaFiftyintheMatch",
            [("Yes", 3.65, None), ("No", 1.24, None)]),
        mkt("Top Batter", "TopMatchBatsman",
            [("MR Marsh", 5.0, None), ("PD Salt", 6.0, None), ("T Banton", 7.0, None)]),
        mkt("Total Sixes", "TotalMatchSixes", [("Over ", 1.78, 13.5), ("Under ", 1.92, 13.5)], base=13.5),
        mkt("Australia Total Fours", "Team1TotalMatchFours", [("Over ", 1.87, 13.5), ("Under ", 1.83, 13.5)], base=13.5),
        mkt("England 1st Over Total Runs", "Team21stOverTotalRuns", [("Over ", 1.78, 6.5), ("Under ", 1.92, 6.5)], base=6.5),
        mkt("Match Winner", "P1XP2", [("W1", 1.9, None), ("W2", 2.0, None)]),
    ]
    rows, fancy, cat, left = feedl.parse_markets(markets, COMMON)
    assert any(r["market_type"] == "batter_milestone" and r["player"] == "HC Brook" and r["side"] == "over" for r in rows)
    assert any(r["market_type"] == "top_batter_match" and r["player"] == "MR Marsh" for r in rows)
    assert any(f["key"] == "match_sixes" and f["line"] == 13.5 for f in fancy)
    assert any(f["key"] == "team_total_fours" and f["team"] == "Australia" for f in fancy)
    assert any(f["key"] == "overs_1" and f["team"] == "England" for f in fancy)
    assert "Match Winner" in left
    assert any(c["mapped"] == "batter_milestone" for c in cat)


def test_settings_empty_without_env(monkeypatch):
    monkeypatch.delenv("FEEDL_WS", raising=False)
    monkeypatch.delenv("FEEDL_SITE", raising=False)
    monkeypatch.delenv("FEEDL_NAME", raising=False)
    assert feedl.settings() == {}
    assert feedl.published() == {}


def test_settings_ok(monkeypatch):
    monkeypatch.setenv("FEEDL_WS", "wss://swarm.feedl.invalid/")
    monkeypatch.setenv("FEEDL_SITE", "1")
    monkeypatch.setenv("FEEDL_NAME", "SwarmDemo")
    assert feedl.settings()["SITE"] == 1
    assert feedl.published() == {"feedl": "SwarmDemo"}


def test_toss_winner_pair():
    rows, fancy, cat, left = feedl.parse_markets([mkt("To Win the Toss", "TossWinner", [("Australia", 1.9, None), ("England", 1.9, None)])], COMMON)
    assert [(f["key"], f["team"], f["over"]) for f in fancy] == [("toss_winner", "Australia", 1.9), ("toss_winner", "England", 1.9)]
    assert not rows and "To Win the Toss" not in left
