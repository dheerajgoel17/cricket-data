"""Offline PASS/FAIL scoring for the Book A direct-scrape probe (no network, no hosts)."""
from value_bets.book_a_probe import (
    MAPPED_MARKETS,
    content_class,
    extract_group_names,
    is_challenge,
    is_login_wall,
    mapped_prop_keys,
    merge_scores,
    score_probe,
)


def test_content_class():
    assert content_class("application/json", '{"a":1}') == "json"
    assert content_class("text/html", "<!DOCTYPE html><html>") == "html"
    assert content_class(None, "{") == "json"
    assert content_class("text/plain", "hello") == "other"


def test_challenge_and_login():
    assert is_challenge("Just a moment... cf-browser-verification", 403)
    assert is_challenge("<html>Attention Required</html>", 503)
    assert not is_challenge('{"matches":[]}', 200)
    assert is_login_wall("Please sign in to continue", 401)
    assert is_login_wall("<html><body>Log in</body></html>", 200)


def test_extract_mapped_markets_from_json():
    body = {
        "matches": [{
            "quotes": [
                {"group_name": "Batsman Match Runs", "odds_dec": 1.85},
                {"group_name": "Batsman Total Match Sixes", "odds_dec": 2.1},
                {"group_name": "Unknown Market", "odds_dec": 3.0},
            ]
        }]
    }
    import json
    c = extract_group_names(json.dumps(body))
    assert c["Batsman Match Runs"] == 1
    assert c["Batsman Total Match Sixes"] == 1
    assert mapped_prop_keys(c) == {"batter_runs", "batter_sixes"}


def test_score_pass_on_guest_props():
    raw = (
        '{"sport":"cricket","quotes":['
        '{"group_name":"Batsman Match Runs","odds_dec":1.90},'
        '{"group_name":"Bowler Total Match Wickets","odds_dec":2.05}'
        "]}"
    )
    s = score_probe(status=200, content_type="application/json", body=raw, impersonate="chrome146")
    assert s["verdict"] == "pass"
    assert set(s["prop_keys"]) >= {"batter_runs", "bowler_wickets"}
    assert s["reasons"] == []


def test_score_fail_challenge():
    s = score_probe(status=403, content_type="text/html", body="<html>Just a moment...</html>")
    assert s["verdict"] == "fail"
    assert "challenge" in s["reasons"]


def test_score_fail_html_only():
    s = score_probe(status=200, content_type="text/html", body="<html><body>Welcome to sports</body></html>")
    assert s["verdict"] == "fail"
    assert "html_only" in s["reasons"] or "no_prop_markets" in s["reasons"]


def test_score_fail_no_origin_response():
    s = score_probe(status=None, content_type=None, body="")
    assert s["verdict"] == "fail"
    assert "no_response" in s["reasons"]


def test_merge_pass_if_any():
    bad = score_probe(status=403, content_type="text/html", body="<html>Just a moment</html>")
    good = score_probe(
        status=200,
        content_type="application/json",
        body='{"cricket":true,"quotes":[{"group_name":"Batter Total Match Fours","odds_dec":1.72}]}',
    )
    m = merge_scores([bad, good])
    assert m["verdict"] == "pass"
    assert "batter_fours" in (m["best"]["prop_keys"] or [])


def test_merge_fail_empty():
    assert merge_scores([])["verdict"] == "fail"


def test_mapped_markets_align_with_moviodds():
    from value_bets.adapters import moviodds
    for name, key in MAPPED_MARKETS.items():
        assert moviodds.MAP.get(name) == key, name
