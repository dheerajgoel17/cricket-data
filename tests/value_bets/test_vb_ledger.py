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

    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
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
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
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
