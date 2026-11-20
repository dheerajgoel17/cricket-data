"""White-label fingerprint + feasibility score (synthetic blobs only; never a real book)."""
from value_bets.wl_fingerprint import classify, redact, score


def test_feed_j_duplicate():
    fp = classify("https://x.invalid/api/v4/prematch/brand/12/en-IN/0 rest_events_versions")
    assert fp.duplicate_feed == "J"
    assert fp.engine_class == "betby_class"
    sc = score(fp, access_mode="guest", transport_ok=True)
    assert sc.verdict == "No-go"
    assert "duplicate_of_feed_J" in sc.reasons


def test_feed_i_duplicate():
    fp = classify("/service-api/LineFeed/GetSportsZip?lng=en&gr=70")
    assert fp.duplicate_feed == "I"


def test_feed_k_duplicate():
    fp = classify("https://feed.invalid/99/listView/cricket.json?lang=en_GB&client_id=2")
    assert fp.duplicate_feed == "K"


def test_feed_h_duplicate():
    fp = classify("/xapi/rest/events?eventPathIds=2&includeMarkets=false")
    assert fp.duplicate_feed == "H"


def test_asian_aggregator_go():
    blob = """
    saba sportsbook widget asianodds
    Player Total Runs Over/Under 32.5  Batsman Fours  To Score 50
    First 10 overs team total  Highest over
    guest mode no login
    Virat Kohli  Rohit Sharma
    """
    fp = classify(blob)
    assert fp.duplicate_feed is None
    assert fp.engine_class == "asian_aggregator_class"
    assert fp.auth == "guest"
    sc = score(
        fp,
        access_mode="guest",
        transport_ok=True,
        player_names_present=True,
        price_overlap_high=False,
        market_kinds={"runs": 2, "fours": 1, "to_score": 1, "fancy": 2},
    )
    assert sc.verdict == "Go"
    assert sc.total >= 6


def test_demo_login_access_score():
    fp = classify("demo login try now Player Total Runs Over 20.5")
    assert fp.auth == "demo"
    sc = score(fp, access_mode="demo", transport_ok=True, market_kinds={"runs": 1, "sixes": 1})
    assert sc.access == 1
    assert sc.verdict in ("Go", "Maybe")


def test_paid_account_nogo():
    fp = classify("sign in create account deposit KYC verify identity")
    sc = score(fp, access_mode="real_account", transport_ok=True, market_kinds={"runs": 5})
    assert sc.verdict == "No-go"


def test_feed_l_swarm_duplicate():
    fp = classify("wss://x.invalid/ request_session betcoswarm get_sports")
    assert fp.duplicate_feed == "L"
    assert fp.engine_class == "betconstruct_swarm_class"


def test_betconstruct_class():
    fp = classify("springbuilder sportsbook datasources betconstruct api")
    assert fp.engine_class == "betconstruct_class"
    assert fp.duplicate_feed is None


def test_redact_origin():
    s = redact("see https://book.example/odds and book.example", ["https://book.example"])
    assert "book.example" not in s
    assert "<origin>" in s or "<host>" in s
