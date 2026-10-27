import json
import os
import sys
import zipfile
from pathlib import Path

import pytest

# Source hosts are deployment configuration, never code: tests point them at placeholder hosts (and ship fixtures that use the same).
for _k, _v in {"LIVE_SOURCE_BASE": "https://src.test", "LIVE_SITEMAP_DIR": "sitemaps", "IMG_CDN_BASE": "https://img.test", "BASE_DATA_URL": "https://base.test",
               "PRICE_FEED_URL": "https://price.test/odds?sport=cricket", "EXCHANGE_API_URL": "https://exch.test/v3",
               "SRC_B_BASE": "https://b.test", "SRC_C_BASE": "https://c.test", "SRC_D_BASE": "https://d.test/v1", "SRC_E_BASE": "https://e.test"}.items():
    os.environ.setdefault(_k, _v)

sys.path.insert(0, str(Path(__file__).parent))  # shared fixture helpers
sys.path.insert(0, str(Path(__file__).parent / "site"))  # synthetic-match helpers for the site tests


def make_match(date="2026-09-30", teams=("Australia", "South Africa"), runs=30, winner="Australia"):
    """Minimal Base-shaped match: one innings, 3 deliveries."""
    return {
        "info": {
            "dates": [date], "match_type": "ODI", "team_type": "international", "gender": "male",
            "event": {"name": "Test Series"}, "venue": "Ground", "teams": list(teams),
            "toss": {"winner": teams[0], "decision": "bat"},
            "outcome": {"winner": winner, "by": {"runs": 12}},
            "players": {teams[0]: ["M Renshaw", "A Keeper"], teams[1]: ["Q de Kock", "K Bowler"]},
            "registry": {"people": {"M Renshaw": "abc123"}},
        },
        "innings": [{"team": teams[0], "overs": [{"over": 0, "deliveries": [
            {"batter": "M Renshaw", "bowler": "K Bowler", "non_striker": "A Keeper",
             "runs": {"batter": 4, "extras": 0, "total": 4}},
            {"batter": "M Renshaw", "bowler": "K Bowler", "non_striker": "A Keeper",
             "runs": {"batter": runs - 10, "extras": 1, "total": runs - 9}, "extras": {"wides": 1}},
            {"batter": "M Renshaw", "bowler": "K Bowler", "non_striker": "A Keeper",
             "runs": {"batter": 6, "extras": 0, "total": 6},
             "wickets": [{"player_out": "M Renshaw", "kind": "caught",
                          "fielders": [{"name": "Q de Kock"}]}]},
        ]}]}],
    }


@pytest.fixture
def make_zip(tmp_path):
    def _make(*matches, name="m.zip"):
        p = tmp_path / name
        with zipfile.ZipFile(p, "w") as z:
            for i, m in enumerate(matches):
                z.writestr(f"{1000 + i}.json", json.dumps(m))
        return p
    return _make
