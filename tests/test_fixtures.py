"""Upcoming-fixture selection and parsing, offline (a real Source A page, trimmed to its event JSON-LD)."""
from __future__ import annotations

from datetime import date, datetime, timezone
from pathlib import Path

from cricket_data.crex_sitemap import parse_match_sitemap
from cricket_data.fixtures import FIELDS, fixture_from_html, select_candidates, write_fixtures

FIX = Path(__file__).parent / "fixtures" / "crex"
G3 = "aus-w-vs-ban-w-3rd-odi-bangladesh-women-tour-of-australia-2026-match-updates-11BB"
NOW = datetime(2026, 10, 13, 12, 0, tzinfo=timezone.utc)


def _xml(*rows: tuple[str, str]) -> str:
    body = "".join(f"<url><loc>https://src.test/cricket-live-score/{s}</loc><lastmod>{t}</lastmod></url>"
                   for s, t in rows)
    return f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>'


def test_select_candidates_filters_by_date_team_and_duplicates():
    entries = parse_match_sitemap(_xml(
        (G3, "2026-10-11T20:56:15+05:30"),
        ("aus-w-vs-ban-w-1st-odi-bangladesh-women-tour-of-australia-2026-match-updates-11B9", "2026-10-09T09:20:00+05:30"),
        ("ind-vs-wi-2nd-t20-west-indies-tour-of-india-2026-11AM", "2026-10-14T19:00:00+05:30"),
        ("ind-vs-wi-2nd-t20-west-indies-tour-of-india-2026-match-updates-11AM", "2026-10-14T19:00:00+05:30"),
    ))
    got = select_candidates(entries, date(2026, 10, 13))
    assert [e.crex_id for e in got] == ["11BB", "11AM"]  # old match dropped, duplicate listing merged
    assert [e.crex_id for e in select_candidates(entries, date(2026, 10, 13), teams=["aus-w"])] == ["11BB"]
    assert select_candidates(entries, date(2026, 10, 13), teams=["aus"]) == []  # 'aus' is not 'aus-w'


def test_fixture_from_html_reads_start_venue_and_status(tmp_path):
    entry = parse_match_sitemap(_xml((G3, "2026-10-11T20:56:15+05:30")))[0]
    html = (FIX / "aus_w_ban_w_3rd_odi_2026_upcoming.html").read_text(encoding="utf-8")
    fx = fixture_from_html(entry, html, NOW, horizon_days=30)
    assert fx is not None
    row = fx.row()
    assert row["start_utc"] == "2026-10-14T03:50Z"  # 09:20 IST
    assert (row["team_a"], row["team_b"]) == ("Australia Women", "Bangladesh Women")
    assert row["venue"] == "Allan Border Field, Brisbane"
    assert (row["format"], row["gender"], row["status"]) == ("ODI", "female", "Upcoming")
    assert fixture_from_html(entry, html, NOW, horizon_days=0) is None  # beyond the horizon
    assert fixture_from_html(entry, "<html></html>", NOW, 30) is None  # not a match page

    out = tmp_path / "fixtures" / "upcoming.csv"
    write_fixtures(out, [fx])
    lines = out.read_text(encoding="utf-8").splitlines()
    assert lines[0] == ",".join(FIELDS) and len(lines) == 2


def test_row_cleans_venue_apostrophes_and_labels_one_off_tests():
    html = (FIX / "aus_w_ban_w_3rd_odi_2026_upcoming.html").read_text(encoding="utf-8").replace(
        "Allan Border Field", "Lord''s")
    slug = "aus-w-vs-eng-w-only-womens-ashes-2027-match-updates-13HO"
    entry = parse_match_sitemap(_xml((slug, "2026-10-11T20:56:15+05:30")))[0]
    row = fixture_from_html(entry, html, NOW, 30).row()
    assert row["venue"] == "Lord's, Brisbane"
    assert row["format"] == "Test"
