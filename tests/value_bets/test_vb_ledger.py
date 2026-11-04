"""Internal edge-bet ledger: keys, 1u P&L, over/under settlement, upsert payload, archive join skip."""
import json

from value_bets import ledger, store


def test_bet_key_matches_alert_key():
    v = {"event_key": "e1", "market_type": "batter_runs", "team_scope": "", "selection": "X over 24.5",
         "line": 24.5, "side": "over"}
    assert ledger.bet_key(v) == store.alert_key(v)


def test_line_verdict_and_side_outcome():
    assert ledger.line_verdict(30, 24.5) == "cleared"
    assert ledger.line_verdict(20, 24.5) == "missed"
    assert ledger.line_verdict(24.5, 24.5) == "push"
    assert ledger.side_outcome("over", "cleared") == "won"
    assert ledger.side_outcome("over", "missed") == "lost"
    assert ledger.side_outcome("under", "cleared") == "lost"
    assert ledger.side_outcome("under", "missed") == "won"
    assert ledger.side_outcome("over", "push") == "push"


def test_pnl_u_flat_one_unit():
    assert ledger.pnl_u("won", 2.5) == 1.5
    assert ledger.pnl_u("won", 1.9) == 0.9
    assert ledger.pnl_u("lost", 2.5) == -1.0
    assert ledger.pnl_u("push", 2.5) == 0.0
    assert ledger.pnl_u("void", 2.5) == 0.0


def test_model_row_ou_open_and_unsettled_winner():
    ou = ledger.model_row({
        "event_key": "e", "match": "A vs B", "start_utc": "2026-11-01T10:00:00Z", "format": "T20",
        "gender": "male", "market_type": "batter_runs", "market": "X runs", "team_scope": "",
        "selection": "X over 24.5", "player_id": "p1", "player_team": "A", "line": 24.5, "side": "over",
        "best_odds": 1.9, "best_source": "s", "effective_odds_after_commission": 1.9,
        "fair_odds": 1.82, "lay_odds": 2.0, "back_liquidity": 50, "overround": 0.06, "implied_prob": 0.5263,
        "fair_prob": 0.55, "model_prob": 0.6, "market_prob": 0.5, "edge": 0.05, "edge_pct": 5.0,
        "fair_basis": "blend", "confidence": "medium", "why": "form", "notes": "2 sources",
        "n_sources": 2, "kelly_quarter_stake_pct": 1.2,
    }, seen_at="2026-11-01T01:00:00Z")
    assert ou["kind"] == "model" and ou["status"] == "open" and ou["stat"] == "runs" and ou["player_id"] == "p1"
    assert ou["fair_odds"] == 1.82 and ou["overround"] == 0.06 and ou["implied_prob"] == 0.5263
    assert ou["rates"]["n_sources"] == 2 and ou["notes"] == "2 sources"

    win = ledger.model_row({
        "event_key": "e", "match": "A vs B", "start_utc": "2026-11-01T10:00:00Z", "format": "T20",
        "gender": "male", "market_type": "match_winner", "market": "winner", "team_scope": "",
        "selection": "A", "line": None, "side": None, "best_odds": 1.8, "best_source": "s",
        "edge": 0.06, "edge_pct": 6.0, "fair_prob": 0.6, "fair_basis": "blend", "confidence": "low", "why": "",
    }, seen_at="2026-11-01T01:00:00Z")
    assert win["status"] == "unsettled"


def test_fancy_row_prefixed_key():
    r = ledger.fancy_row({
        "alert_id": "2026-11-01-a-v-b|overs_6|A|0|under", "match": "A vs B",
        "start_utc": "2026-11-01T10:00:00Z", "format": "T20", "key": "overs_6", "team": "A",
        "inn": 0, "side": "under", "line": 40.5, "best_odds": 2.1, "best_source": "bk",
        "hits": 10, "played": 15, "window": 20, "chance": 0.5, "edge": 0.2, "edge_pct": 20.0,
    }, seen_at="2026-11-01T01:00:00Z")
    assert r["kind"] == "fancy" and r["bet_key"].startswith("fancy|") and r["status"] == "open"
    assert r["hits"] == 10 and r["played"] == 15 and r["sample_window"] == 20
    assert r["implied_prob"] == ledger._implied(2.1) and r["market_prob"] == r["implied_prob"]


def test_settle_ou_from_archive(tmp_path, monkeypatch):
    root = tmp_path / "archive" / "2026-11"
    root.mkdir(parents=True)
    (root / "2026-11-01-a-v-b.json").write_text(json.dumps({
        "id": "2026-11-01-a-v-b", "match": "Alpha vs Beta", "start_utc": "2026-11-01T10:00:00Z",
        "lines": [{"pid": "p1", "stat": "runs", "line": 24.5, "team": "Alpha"}],
        "results": [{"pid": "p1", "stat": "runs", "value": 40}],
    }))
    open_row = {
        "bet_key": "k1", "kind": "model", "match": "Alpha vs Beta", "start_utc": "2026-11-01T10:00:00Z",
        "market_type": "batter_runs", "player_id": "p1", "stat": "runs", "inn": 0, "line": 24.5,
        "side": "over", "best_odds": 2.0, "status": "open",
    }
    patches = []

    def fake_list(base, key):
        return [open_row]

    def fake_patch(base, key, bet_key, upd, settled_at):
        patches.append((bet_key, upd))

    monkeypatch.setenv("SUPABASE_URL", "https://db.example.invalid")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "sb_secret_test")
    monkeypatch.setattr(ledger, "_list_open", fake_list)
    monkeypatch.setattr(ledger, "_patch_settled", fake_patch)
    out = ledger.settle(tmp_path / "archive")
    assert out["settled"] == 1
    assert patches[0][1]["status"] == "won" and patches[0][1]["pnl_u"] == 1.0
    assert patches[0][1]["result_value"] == 40


def test_settle_skips_when_no_archive_result(tmp_path, monkeypatch):
    (tmp_path / "archive" / "2026-11").mkdir(parents=True)
    (tmp_path / "archive" / "2026-11" / "x.json").write_text(json.dumps({
        "match": "Alpha vs Beta", "start_utc": "2026-11-01T10:00:00Z", "lines": [], "results": [],
    }))
    monkeypatch.setenv("SUPABASE_URL", "https://db.example.invalid")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "sb_secret_test")
    monkeypatch.setattr(ledger, "_list_open", lambda *a: [{
        "bet_key": "k", "kind": "model", "match": "Alpha vs Beta", "start_utc": "2026-11-01T10:00:00Z",
        "market_type": "batter_runs", "player_id": "p1", "stat": "runs", "inn": 0, "line": 24.5,
        "side": "over", "best_odds": 2.0, "status": "open",
    }])
    patches = []
    monkeypatch.setattr(ledger, "_patch_settled", lambda *a, **k: patches.append(a))
    out = ledger.settle(tmp_path / "archive")
    assert out["settled"] == 0 and out["left_open"] == 1 and not patches


def test_upsert_noop_without_secrets(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)
    assert ledger.upsert_model([{"event_key": "e", "market_type": "batter_runs", "selection": "x",
                                 "line": 1, "side": "over", "best_odds": 2}])["skipped"] is True


def test_parse_alert_key_and_history_to_value():
    key = "male|Bangladesh|Zimbabwe|2026-10-17|batter_sixes||Najmul Hossain Shanto over 0.5|0.5|over"
    p = ledger.parse_alert_key(key)
    assert p["event_key"] == "male|Bangladesh|Zimbabwe|2026-10-17"
    assert p["market_type"] == "batter_sixes" and p["line"] == 0.5 and p["side"] == "over"
    assert ledger.player_name_from_selection(p["selection"]) == "Najmul Hossain Shanto"
    v = ledger.history_to_value({
        "alert_id": "abc", "alert_key": key, "alerted_at_ist": "2026-10-17 12:04 IST",
        "match": "Bangladesh vs Zimbabwe", "start_ist": "2026-10-17 17:00 IST",
        "market": "sixes", "selection": p["selection"], "best_odds": 3.4, "best_source": "s",
        "fair_odds": 3.046, "edge_pct": 11.62, "why": "x",
    })
    assert v["start_utc"] == "2026-10-17T11:30:00Z"
    assert v["stat"] == "sixes" and v["edge"] == 0.1162
    assert ledger.bet_key(v) == key


def test_resolve_player_id_from_archive_name():
    arc = {"lines": [
        {"pid": "p1", "stat": "sixes", "player": "Najmul Hossain Shanto", "book_name": "Shanto"},
        {"pid": "p2", "stat": "sixes", "player": "Other", "book_name": "Other"},
    ], "results": {}}
    row = {"selection": "Najmul Hossain Shanto over 0.5", "stat": "sixes"}
    assert ledger.resolve_player_id(row, arc) == "p1"
    assert ledger.resolve_player_id({**row, "player_id": "px"}, arc) == "px"


def test_backfill_history_file(tmp_path, monkeypatch):
    p = tmp_path / "alerts_history.jsonl"
    key = "male|A|B|2026-10-17|batter_runs||X over 24.5|24.5|over"
    p.write_text(json.dumps({
        "alert_id": "1", "alert_key": key, "alerted_at_ist": "2026-10-17 12:00 IST",
        "match": "A vs B", "start_ist": "2026-10-17 17:00 IST", "market": "runs",
        "selection": "X over 24.5", "best_odds": 1.9, "best_source": "s",
        "fair_odds": 1.8, "edge_pct": 5.0, "why": "",
    }) + "\n")
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)
    out = ledger.backfill_history(p)
    assert out["parsed"] == 1 and out["unique"] == 1 and out["skipped"] is True


def test_fetch_by_keys_url_encodes_spaces():
    """Fancy bet_keys carry team names with spaces; a raw space crashes http.client (InvalidURL)."""
    seen = []

    def fake_req(method, url, key, data=None, headers=None, timeout=60):
        seen.append(url)
        return 200, b"[]"

    ledger._req, prev = fake_req, ledger._req
    try:
        out = ledger._fetch_by_keys(
            "https://db.example.invalid", "k",
            ["fancy|2026-11-05-a-v-b|team_total_runs|Adelaide Strikers Women|0|under"],
        )
    finally:
        ledger._req = prev
    assert out == {} and len(seen) == 1
    assert " " not in seen[0].split("?", 1)[1]  # query string has no raw spaces
    assert "Adelaide%20Strikers%20Women" in seen[0]
