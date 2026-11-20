"""White-label sportsbook engine fingerprints and feasibility scoring (no hosts, no network).

Classify a candidate by URL path / HTML / JSON shape against the feeds we already scrape, then score
whether a *new* non-paid guest or demo-login engine is worth an adapter. Used by ``scripts/probe_wl_provider.py``.
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field

# Path / query / HTML signals → existing feed letter (duplicate) or a named provider *class* (not a host).
KNOWN: list[tuple[str, re.Pattern[str], str]] = [
    ("J", re.compile(r"/v4/prematch/brand/|/v3/descriptions/brand/", re.I), "betby_class"),
    ("I", re.compile(r"/service-api/(?:Line|Live)Feed/Get(?:Sports|Champ|Game)Zip", re.I), "digitain_linefeed_class"),
    ("K", re.compile(r"/listView/cricket\.json|/betoffer/event/\d+", re.I), "kambi_shared_feed_class"),
    ("E", re.compile(r"translationLang=|responseFormat=json", re.I), "openbet_ssp_class"),
    ("H", re.compile(r"/xapi/rest/events\b", re.I), "xapi_events_class"),
    ("L", re.compile(r"request_session|betcoswarm|get_sports\b|swarm", re.I), "betconstruct_swarm_class"),
    ("F", re.compile(r"fancy_active|getMarketDataNew|/premium/", re.I), "exchange_fancy_class"),
    ("G", re.compile(r"fancy_active|getMarketDataNew", re.I), "exchange_fancy_class"),
]

# Distinct classes we do not yet scrape as a sportsbook engine (targets for discovery).
TARGET_CLASSES: dict[str, re.Pattern[str]] = {
    "asian_aggregator_class": re.compile(
        r"\bsaba\b|\bbti\b|\bibcbet\b|\bmaxbet\b|\bsbobet\b|\bsbo\b|\basianodds\b|"
        r"\boneworks\b|\bbbin\b|\bcmd368\b|\b9wicket\b|\bunited.?gaming\b",
        re.I,
    ),
    "betconstruct_class": re.compile(
        r"betconstruct|springbuilder|bc\.game|swarm\.|datasources\.|sportsbook\.|oddsservice|"
        r"/api/v1/sportsbook|/external/sportsbook",
        re.I,
    ),
    "altenar_class": re.compile(r"altenar|asb\b|widget\.altenar|/sapi/\w+/events", re.I),
    "digitain_softswiss_class": re.compile(
        r"softswiss|digitain(?!.*LineFeed)|centrifugo|softgamings",
        re.I,
    ),
    "casino_agg_sportsbook_class": re.compile(
        r"luckysports|lucky.?sports|568win|gamingsoft|pronet.?sport|wynso|tf.?gaming",
        re.I,
    ),
    "every_matrix_class": re.compile(r"everymatrix|oddsmatrix|/oms/|em-sports", re.I),
}

CRICKET_HINTS = re.compile(
    r"player.?s?\s+total\s+runs|batsman\s+runs|batter\s+runs|to\s+score|"
    r"player\s+(?:sixes|fours|wickets)|top\s+bat(?:sman|ter)|top\s+bowl|"
    r"player\s+performance|fantasy\s+points|over/?under\s+\d",
    re.I,
)
FANCY_HINTS = re.compile(
    r"first\s+\d+\s+overs|session|innings\s+runs|team\s+total|match\s+total|"
    r"total\s+(?:fours|sixes|boundaries|extras)|highest\s+over|fall\s+of\s+wicket",
    re.I,
)
DEMO_HINTS = re.compile(r"\bdemo\b|\btry\s*(?:now|demo)\b|practice\s*mode", re.I)
GUEST_HINTS = re.compile(r"guest(?:\s*(?:mode|login))?|no.?login|public.?feed|without\s+login", re.I)
LOGIN_WALL = re.compile(r"sign\s*in|log\s*in|create\s*account|deposit|kyc|verify\s*identity", re.I)
WINNER_ONLY = re.compile(r"\b(?:1x2|match\s*winner|moneyline)\b", re.I)


@dataclass
class Fingerprint:
    """Result of classifying one candidate blob (URLs + HTML + optional JSON text)."""

    duplicate_feed: str | None = None  # J/I/K/E/H/F/G when shape matches an existing adapter
    engine_class: str | None = None
    signals: list[str] = field(default_factory=list)
    auth: str = "unknown"  # guest | demo | real_account | unknown
    cricket_hits: int = 0
    fancy_hits: int = 0
    notes: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass
class Score:
    """0–2 per rubric axis; verdict Go / Maybe / No-go."""

    access: int = 0
    stability: int = 0
    cricket_depth: int = 0
    fancy_bonus: int = 0
    identity_cost: int = 0
    overlap: int = 0
    total: int = 0
    verdict: str = "No-go"
    reasons: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return asdict(self)


def classify(text: str) -> Fingerprint:
    """Fingerprint URL paths, HTML, and JSON text. Hosts are ignored; only shapes matter."""
    fp = Fingerprint()
    blob = text or ""

    for feed, rx, cls in KNOWN:
        if rx.search(blob):
            fp.duplicate_feed = feed
            fp.engine_class = cls
            fp.signals.append(f"matches_feed_{feed}")
            break

    if not fp.engine_class:
        for cls, rx in TARGET_CLASSES.items():
            if rx.search(blob):
                fp.engine_class = cls
                fp.signals.append(f"class:{cls}")
                break

    if GUEST_HINTS.search(blob):
        fp.auth = "guest"
        fp.signals.append("guest_hint")
    elif DEMO_HINTS.search(blob):
        fp.auth = "demo"
        fp.signals.append("demo_hint")
    elif LOGIN_WALL.search(blob) and "password" in blob.lower():
        fp.auth = "real_account"
        fp.signals.append("login_wall")

    fp.cricket_hits = len(CRICKET_HINTS.findall(blob))
    fp.fancy_hits = len(FANCY_HINTS.findall(blob))
    if fp.cricket_hits:
        fp.signals.append(f"cricket_mentions:{fp.cricket_hits}")
    if fp.fancy_hits:
        fp.signals.append(f"fancy_mentions:{fp.fancy_hits}")

    if WINNER_ONLY.search(blob) and fp.cricket_hits == 0:
        fp.notes.append("winner_heavy_no_props_seen")

    if not fp.engine_class and not fp.duplicate_feed:
        fp.notes.append("unclassified_shape")
    return fp


def score(
    fp: Fingerprint,
    *,
    access_mode: str | None = None,
    transport_ok: bool | None = None,
    demo_refresh_ok: bool | None = None,
    player_names_present: bool | None = None,
    price_overlap_high: bool | None = None,
    market_kinds: dict[str, int] | None = None,
) -> Score:
    """Score a fingerprint (+ optional live probe facts) with the plan rubric."""
    s = Score()
    kinds = market_kinds or {}
    auth = (access_mode or fp.auth or "unknown").lower()

    if fp.duplicate_feed:
        s.verdict = "No-go"
        s.reasons.append(f"duplicate_of_feed_{fp.duplicate_feed}")
        return s

    if auth in ("guest",):
        s.access = 2
    elif auth in ("demo", "demo_login"):
        s.access = 1
    elif auth in ("real_account", "paid", "api_key"):
        s.access = 0
        s.reasons.append("paid_or_real_account_only")
    else:
        s.access = 0
        s.reasons.append("access_unknown")

    if transport_ok is True and (demo_refresh_ok is not False):
        s.stability = 2 if auth == "guest" else 1
    elif transport_ok is False:
        s.stability = 0
        s.reasons.append("transport_blocked")
    else:
        s.stability = 1 if s.access else 0

    prop = sum(kinds.get(k, 0) for k in ("runs", "fours", "sixes", "wickets", "to_score", "top", "points"))
    if prop == 0 and fp.cricket_hits:
        prop = 1 if fp.cricket_hits >= 2 else 0
    has_runs = kinds.get("runs", 0) > 0 or bool(re.search(r"runs", " ".join(fp.signals), re.I)) or fp.cricket_hits >= 1
    has_extra = any(kinds.get(k, 0) > 0 for k in ("fours", "sixes", "wickets", "to_score")) or fp.cricket_hits >= 3
    if has_runs and has_extra:
        s.cricket_depth = 2
    elif has_runs or prop > 0:
        s.cricket_depth = 1
    else:
        s.cricket_depth = 0
        s.reasons.append("thin_or_no_player_props")

    fancy_n = kinds.get("fancy", 0) + fp.fancy_hits
    s.fancy_bonus = 2 if fancy_n >= 3 else (1 if fancy_n else 0)

    if player_names_present is True:
        s.identity_cost = 2
    elif player_names_present is False:
        s.identity_cost = 0
        s.reasons.append("no_player_names")
    else:
        s.identity_cost = 1

    if price_overlap_high is True:
        s.overlap = 0
        s.reasons.append("near_clone_of_existing_feed")
    elif price_overlap_high is False:
        s.overlap = 2
    else:
        s.overlap = 1

    s.total = s.access + s.stability + s.cricket_depth + s.fancy_bonus + s.identity_cost + s.overlap
    if s.access == 0 or (auth in ("real_account", "paid", "api_key")):
        s.verdict = "No-go"
    elif s.access >= 1 and s.cricket_depth >= 1 and s.total >= 6:
        s.verdict = "Go"
    elif s.access >= 1 and s.cricket_depth >= 1:
        s.verdict = "Maybe"
        s.reasons.append("borderline_total_or_risk")
    else:
        s.verdict = "No-go"
    return s


def redact(text: str, origins: list[str] | None = None) -> str:
    """Strip candidate origins / obvious hosts from probe output before logging."""
    out = text or ""
    for o in origins or []:
        if o:
            out = out.replace(o, "<origin>")
            out = out.replace(o.removeprefix("https://").removeprefix("http://"), "<host>")
    out = re.sub(r"https?://[^\s\"'<>]+", "<url>", out)
    return out
