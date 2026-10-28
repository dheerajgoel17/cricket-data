import json

import pytest

from value_bets import config, store
from value_bets.adapters import betfair, moviodds, oddsapi, smarkets
from value_bets.names import PlayerResolver, TeamResolver, norm_team
from value_bets.pricing import devig, edge, effective_odds, exchange_mid, kelly_pct
from value_bets.util import ist, parse_ts


def test_devig_two_way_and_power():
    p = devig([1.83, 1.83])
    assert abs(sum(p) - 1) < 1e-9 and abs(p[0] - 0.5) < 1e-9
    q = devig([2.0, 4.0, 6.0, 15.0, 30.0])
    assert abs(sum(q) - 1) < 1e-6
    raw = [1 / o for o in (2.0, 4.0, 6.0, 15.0, 30.0)]
    # power method takes proportionally more margin off longshots
    assert q[-1] / (raw[-1] / sum(raw)) < q[0] / (raw[0] / sum(raw))


def test_edge_kelly_commission():
    assert abs(edge(0.5, 2.2, "moviodds_bet365") - 0.1) < 1e-9
    assert effective_odds(3.0, "smarkets") == pytest.approx(1 + 2 * 0.98)
    assert kelly_pct(0.4, 2.0, "x") == 0.0
    k = kelly_pct(0.55, 2.0, "x")
    assert 0 < k <= config.get("MAX_STAKE_PCT")
    assert exchange_mid(2.0, 2.04) == pytest.approx((0.5 + 1 / 2.04) / 2)
    assert exchange_mid(2.0, 4.0) is None  # spread too wide


def test_parse_ts_variants():
    assert ist(parse_ts("2026-10-17T13:30:00Z")) == "2026-10-17 19:00 IST"
    assert ist(parse_ts("2026-10-17 13:30:00+00")) == "2026-10-17 19:00 IST"
    assert ist(parse_ts("2026-10-17T03:38:15.875591596Z"))[:10] == "2026-10-17"


def test_team_resolver():
    t = TeamResolver({"male": {"India": 100, "Queensland": 50, "West Indies": 90},
                      "female": {"Australia": 40, "New Zealand": 40}})
    assert t.resolve("India T20", "male") == "India"
    assert t.resolve("Queensland Bulls", "male") == "Queensland"
    assert norm_team("Australia (W)") == ("australia", "female")
    assert t.resolve("New Zealand Women", "female") == "New Zealand"
    assert t.resolve("Afghanistan", "male") is None


def test_team_resolver_nz_domestic():
    """The schedule says "Auckland" / "Northern Brave", the books "Auckland Aces" / "Northern Districts": one side each, so a priced match finds its fixture."""
    t = TeamResolver({"male": {"Auckland": 40, "Auckland Aces": 60, "Wellington": 40, "Wellington Firebirds": 60, "Otago": 30, "Otago Volts": 60,
                               "Northern Districts": 80, "Canterbury": 90, "Central Stags": 70}})
    for sched, book in [("Auckland", "Auckland Aces"), ("Wellington", "Wellington Firebirds"), ("Otago", "Otago Volts"),
                        ("Northern Brave", "Northern Districts"), ("Canterbury", "Canterbury Kings"), ("Central Stags", "Central Stags")]:
        assert t.resolve(sched, "male") == t.resolve(book, "male") is not None, (sched, book)


def test_player_resolver():
    ros = {"India": [("Ishan Kishan", "a1", "2026-10-11", 30), ("Kuldeep Yadav", "a2", "2026-10-11", 40),
                     ("MP Yadav", "a3", "2026-10-11", 10), ("Prince Yadav", "a4", "2026-10-11", 5)],
           "West Indies": [("SD Hope", "b1", "2026-10-11", 60)]}
    p = PlayerResolver(ros)
    assert p.resolve("IPKP Kishan", ["India", "West Indies"])["player_id"] == "a1"
    assert p.resolve("Shai Hope", ["India", "West Indies"])["player_id"] == "b1"
    assert p.resolve("Kuldeep Singh Yadav", ["India"])["player_id"] == "a2"
    assert p.resolve("Mayank Yadav", ["India"])["player_id"] == "a3"
    assert p.resolve("Nobody Atall", ["India"]) is None


def test_optional_adapters_noop(monkeypatch):
    for k in ("ODDS_API_KEY", "BETFAIR_APP_KEY", "BETFAIR_USERNAME", "BETFAIR_PASSWORD"):
        monkeypatch.delenv(k, raising=False)
    with pytest.raises(oddsapi.Skip):
        oddsapi.fetch("t")
    with pytest.raises(betfair.Skip):
        betfair.fetch("t")


def test_oddsapi_budget_guard(monkeypatch, tmp_path):
    monkeypatch.setenv("ODDS_API_KEY", "dummy")
    st = tmp_path / "u.json"
    from value_bets.util import iso, now_utc
    st.write_text(json.dumps({"month": now_utc().strftime("%Y-%m"), "credits": 3, "last_call": iso(now_utc())}))
    monkeypatch.setattr(oddsapi, "STATE", st)
    with pytest.raises(oddsapi.Skip):  # called within the min interval -> no network, no credits spent
        oddsapi.fetch("t")


def test_smarkets_classifier():
    assert smarkets.classify("Winner") == ("match_winner", None)
    assert smarkets.classify("India top batsman") == ("top_batter_team", "India")
    assert smarkets.classify("Team with Top Batsman") == (None, None)
    assert smarkets.classify("India top batsman - Innings 1") == (None, None)


def test_moviodds_parse(monkeypatch):
    sample = {"matches": [{"id": "1", "home": "India", "away": "West Indies", "league": "x T20", "in_play": False,
                           "kickoff_utc": "2026-10-17T13:30:00Z", "quotes": [
        {"group_name": "To Win the Match", "label": "India", "odds_dec": 1.33, "market_id": "1246"},
        {"group_name": "Batsman Match Runs", "side": "Over", "line": "SV Samson", "handicap": "27.5",
         "label": "27.5", "n2": "India", "odds_dec": 1.8333, "market_id": "300331"},
        {"group_name": "Player of the Match", "label": "X", "odds_dec": 9.0, "market_id": "346"}]}]}
    monkeypatch.setattr(moviodds, "http_json", lambda *a, **k: (sample, {}))
    rows, _ = moviodds.fetch("t")
    assert len(rows) == 2
    r = rows[1]
    assert r["market_type"] == "batter_runs" and r["line"] == 27.5 and r["side"] == "over"
    assert r["start_ist"] == "2026-10-17 19:00 IST"


def test_alert_dedupe(monkeypatch, tmp_path):
    monkeypatch.setattr(store, "ALERTS", tmp_path / "alerted.json")
    monkeypatch.setattr(config, "OUT", tmp_path)
    v = {"event_key": "e", "market_type": "match_winner", "team_scope": "", "selection": "India", "line": None,
         "side": None, "edge": 0.06, "start_utc": "2999-01-01T00:00:00Z"}
    assert len(store.new_alerts([v])) == 1
    assert len(store.new_alerts([v])) == 0                      # same bet: no repeat
    assert len(store.new_alerts([{**v, "edge": 0.08}])) == 0    # +2pp: below re-alert delta
    out = store.new_alerts([{**v, "edge": 0.095}])               # +3.5pp vs last alert
    assert len(out) == 1 and out[0]["realert"]


def test_innings_scoped_prices_never_reach_the_pricing():
    from value_bets.pipeline import whole_match
    rows = [{"id": 1, "inn": None}, {"id": 2, "inn": 1}, {"id": 3}, {"id": 4, "inn": 2}]
    assert [r["id"] for r in whole_match(rows)] == [1, 3]


def test_performance_markets_lists_what_sources_offered_and_no_adapter_reads():
    from value_bets.pipeline import performance_markets
    raws = {"feedk": {"books": {"A": {"left_out": {"Player Performance": 2, "Top Batter": 1}}}},
            "moviodds_bet365": {"matches": [{"quotes": [{"group_name": "Player Performance Points"}, {"group_name": "Match Totals"}]}]},
            "feedf": {"books": {"B": {"left_out": {"Winner": 1}}}}, "smarkets": None}
    assert performance_markets(raws) == {"feedk": ["Player Performance"], "moviodds_bet365": ["Player Performance Points"]}
    raws["moviodds_bet365"]["matches"][0]["quotes"].append({"group_name": "Player Performance"})  # a group the mirror adapter reads is not "not read yet"
    assert performance_markets(raws)["moviodds_bet365"] == ["Player Performance Points"]


def test_the_book_a_mirror_reads_player_performance_like_its_other_over_unders(monkeypatch):
    quote = lambda side: {"group_name": "Player Performance", "line": "Hayley Matthews", "n2": "Melbourne Renegades", "side": side, "handicap": "45.5", "odds_dec": 1.9, "market_id": "7"}  # noqa: E731
    feed = {"matches": [{"id": "m1", "home": "Melbourne Renegades", "away": "Sydney Thunder", "kickoff_utc": "2026-10-29T04:40:00Z", "in_play": False, "league": "WBBL", "quotes": [quote("Over"), quote("Under")]}]}
    monkeypatch.setattr(moviodds, "http_json", lambda *a, **k: (feed, {}))
    monkeypatch.setattr(moviodds, "host", lambda name: "https://feed.invalid")
    rows, _ = moviodds.fetch("2026-10-28T10:00:00Z")
    assert [(r["market_type"], r["player"], r["side"], r["line"], r["back"]) for r in rows] == [("player_points", "Hayley Matthews", "over", 45.5, 1.9), ("player_points", "Hayley Matthews", "under", 45.5, 1.9)]


def test_trailing_w_marks_a_womens_side():
    from value_bets.names import norm_team
    assert norm_team("Melbourne Renegades W") == ("melbourne renegades", "female")
    assert norm_team("Melbourne Renegades Women") == norm_team("Melbourne Renegades (W)") == ("melbourne renegades", "female")
    assert norm_team("West Indies")[1] is None
