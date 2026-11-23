import importlib.util
from collections import Counter
from pathlib import Path

spec = importlib.util.spec_from_file_location("unmatched_report", Path(__file__).resolve().parents[2] / "scripts" / "unmatched_report.py")
ur = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ur)


def fake_stem(names):
    return [n.split(",")[0].lower() for n in names]


def test_missing_venues_lists_only_grounds_history_never_saw():
    fx = [
        {"venue": "Eden Park, Auckland", "team_a": "A", "team_b": "B", "format": "T20", "start_utc": "2026-11-24T01:00Z"},
        {"venue": "New Ground, Town", "team_a": "C", "team_b": "D", "format": "ODI", "start_utc": "2026-11-25T01:00Z"},
    ]
    out = ur.missing_venues(fx, ["Eden Park"], stem=fake_stem)
    assert list(out) == ["New Ground, Town"] and out["New Ground, Town"] == ["C v D (ODI, 2026-11-25)"]


def test_recent_unmatched_counts_since_date_only():
    rows = [{"date": "2026-11-20", "team": "T", "player": "P", "reason": "no_candidate"}, {"date": "2020-01-01", "team": "T", "player": "Old", "reason": "ambiguous"}]
    assert ur.recent_unmatched(rows, "2026-11-01") == Counter({("T", "P", "no_candidate"): 1})


def test_render_marks_empty_sections():
    text = ur.render({}, [], [], Counter(), 7)
    assert text.count("- none") == 4
