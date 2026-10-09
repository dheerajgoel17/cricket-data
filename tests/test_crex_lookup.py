"""Sitemap index, strict match confirmation and backfill processing, all from fixtures (no network)."""
from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest

from cricket_data.backfill import (
    BackfillQueue,
    BackfillTask,
    enumerate_afghanistan_matches,
    process_backfill_batch,
)
from cricket_data.crex_browser import RenderedPage, extract_links
from cricket_data.crex_lookup import (
    candidates_for,
    code_plausible,
    confirm,
    find_match,
    names_match,
    parse_match_page,
    parse_result,
    record_from_facts,
)
from cricket_data.crex_sitemap import CREXSitemapIndex, season_years
from cricket_data.store import Store

FIX = Path(__file__).parent / "fixtures" / "crex"
PAGES = {  # fixture name -> match slug
    "har_jhkd_final_smat_2025": "har-vs-jhkd-final-syed-mushtaq-ali-trophy-elite-2025-match-updates-YKF",
    "afg_ind_1st_t20i_2024": "afg-vs-ind-1st-t20-afghanistan-tour-of-india-2024-match-updates-LR3",
    "afg_ban_only_test_2026": "afg-vs-ban-only-test-afghanistan-vs-bangladesh-in-uae-2026-match-updates-13TH",
}


def _page(name: str, url: str = "") -> RenderedPage:
    html = (FIX / f"{name}.html").read_text(encoding="utf-8")
    text = (FIX / f"{name}.txt").read_text(encoding="utf-8")
    title = html.split("<title>")[1].split("</title>")[0]
    return RenderedPage(url=url, status=200, html=html, text=text, title=title)


class FakeBrowser:
    """Serves fixture pages by URL; records every render so tests can assert how many happened."""

    def __init__(self):
        self.rendered: list[str] = []

    def render(self, url, wait_selector=None, timeout_ms=0):
        self.rendered.append(url)
        slug = url.rsplit("/", 1)[-1]
        for name, s in PAGES.items():
            if s == slug:
                return _page(name, url)
        return RenderedPage(url=url, status=404, html="", text="", title="")


@pytest.fixture
def index():
    idx = CREXSitemapIndex()
    idx.load_from_xml((FIX / "match_sitemap.xml").read_text(), (FIX / "series_sitemap.xml").read_text())
    return idx


def T(d, a, b, mt, gender="male", **kw):
    return BackfillTask(date=d, team_a=a, team_b=b, match_type=mt, gender=gender,
                        category="cricsheet_missing", **kw)


# ---- sitemap index --------------------------------------------------------------------------------
def test_sitemap_parses_matches_and_series(index):
    assert len(index.matches) == 11
    # only top-level /series/<slug> pages, not /matches sub-pages or the /series listing
    assert len(index.series) == 7
    e = index.by_slug(PAGES["har_jhkd_final_smat_2025"])
    assert e.crex_id == "YKF"
    assert e.codes == ("har", "jhkd")
    assert e.label == "final"
    assert e.series_name == "syed-mushtaq-ali-trophy-elite-2025"
    assert e.start_date == date(2025, 12, 18)
    assert not e.is_women


def test_sitemap_dates_index_and_window(index):
    on = {m.crex_id for m in index.matches_on(date(2024, 1, 14), window=0)}
    assert on == {"LR4", "QQ2"}
    near = {m.crex_id for m in index.matches_on(date(2024, 1, 12), window=1)}
    assert near == {"LR3", "QQ1"}  # the 11th is one day away; the 14th is not


def test_sitemap_cache_round_trip(index, tmp_path):
    idx = CREXSitemapIndex(cache_path=tmp_path / "idx.json")
    idx.matches, idx.series = index.matches, index.series
    idx._save_cache()
    fresh = CREXSitemapIndex(cache_path=tmp_path / "idx.json")
    fresh.load()  # served from cache: the fetcher would raise if it were used
    fresh.fetcher = None
    assert len(fresh.matches) == len(index.matches)
    assert fresh.by_slug(PAGES["afg_ind_1st_t20i_2024"]).start_date == date(2024, 1, 11)


def test_season_years():
    assert season_years("vijay-hazare-trophy-2024-25") == (2024, 2025)
    assert season_years("syed-mushtaq-ali-trophy-elite-2025") == (2025, 2025)
    assert season_years("t20-world-cup") is None


# ---- page parsing ---------------------------------------------------------------------------------
def test_parse_match_page_reads_schema_facts():
    p = _page("afg_ind_1st_t20i_2024")
    f = parse_match_page(p.html, p.text, p.title)
    assert (f.team_a, f.team_b) == ("India", "Afghanistan")
    assert f.start_date == date(2024, 1, 11)
    assert f.venue.startswith("Punjab Cricket Association")
    assert f.finished
    assert (f.winner, f.result, f.margin) == ("India", "win", "6 wickets")  # Cricsheet wording
    assert f.max_overs == 20.0


def test_parse_match_page_rejects_non_match_pages():
    assert parse_match_page("<html><title>Error</title></html>") is None


def test_parse_result_variants():
    assert parse_result("Match tied")[2] == "tie"
    assert parse_result("Match drawn")[2] == "draw"
    assert parse_result("No result")[2] == "no result"
    assert parse_result("Australia won by an innings and 9 runs 🏆") == ("Australia", "innings 9 runs", "win")
    assert parse_result("India won by 5 wickets (DLS method)") == ("India", "5 wickets", "win")
    assert parse_result("India won by 69 runs") == ("India", "69 runs", "win")
    # a super-over finish is a tie with no winner or margin, as in Cricsheet
    assert parse_result("India won in Super Over 🏆") == ("", "", "tie")


# ---- names / codes --------------------------------------------------------------------------------
def test_names_match():
    assert names_match("Haryana", "Haryana")
    assert names_match("Afghanistan", "Afghanistan Cricket Team")
    assert names_match("United States of America", "USA")
    assert not names_match("Haryana", "Jharkhand")


def test_code_plausible_is_loose_but_not_random():
    assert code_plausible("jhkd", "Jharkhand")
    assert code_plausible("har", "Haryana")
    assert code_plausible("afg-w", "Afghanistan")  # qualifier stripped (gender filtered elsewhere)
    assert not code_plausible("ind", "Pakistan")


# ---- strict confirmation ---------------------------------------------------------------------------
def _facts(name):
    p = _page(name)
    return parse_match_page(p.html, p.text, p.title)


def test_confirm_accepts_the_right_match(index):
    task = T("2025-12-18", "Jharkhand", "Haryana", "T20")
    entry = index.by_slug(PAGES["har_jhkd_final_smat_2025"])
    assert confirm(task, entry, _facts("har_jhkd_final_smat_2025")).ok


def test_confirm_allows_a_one_day_offset_but_no_more(index):
    entry = index.by_slug(PAGES["har_jhkd_final_smat_2025"])
    f = _facts("har_jhkd_final_smat_2025")
    assert confirm(T("2025-12-17", "Jharkhand", "Haryana", "T20"), entry, f).ok
    v = confirm(T("2025-12-15", "Jharkhand", "Haryana", "T20"), entry, f)
    assert not v.ok and any("date" in r for r in v.reasons)


def test_confirm_rejects_wrong_teams_and_gender(index):
    entry = index.by_slug(PAGES["har_jhkd_final_smat_2025"])
    f = _facts("har_jhkd_final_smat_2025")
    assert not confirm(T("2025-12-18", "Jharkhand", "Rajasthan", "T20"), entry, f).ok
    assert not confirm(T("2025-12-18", "Jharkhand", "Haryana", "T20", gender="female"), entry, f).ok


def test_confirm_rejects_wrong_format(index):
    entry = index.by_slug(PAGES["afg_ind_1st_t20i_2024"])
    f = _facts("afg_ind_1st_t20i_2024")
    assert confirm(T("2024-01-11", "Afghanistan", "India", "T20I"), entry, f).ok
    v = confirm(T("2024-01-11", "Afghanistan", "India", "ODI"), entry, f)
    assert not v.ok and any("format" in r for r in v.reasons)


def test_regression_afg_ban_2024_odi_is_not_the_2026_test(index):
    """A previous lookup matched 'AFG vs BAN 2024-11-14 ODI' to a 2026 Test. It must be rejected."""
    task = T("2024-11-14", "Afghanistan", "Bangladesh", "ODI")
    entry = index.by_slug(PAGES["afg_ban_only_test_2026"])
    v = confirm(task, entry, _facts("afg_ban_only_test_2026"))
    assert not v.ok
    joined = " ".join(v.reasons)
    assert "date" in joined and "format" in joined
    # and the sitemap never even proposes it for that date
    assert entry not in candidates_for(task, index)


def test_confirm_rejects_matches_not_finished(index):
    entry = index.by_slug(PAGES["afg_ban_only_test_2026"])
    v = confirm(T("2026-10-09", "Afghanistan", "Bangladesh", "Test"), entry, _facts("afg_ban_only_test_2026"))
    assert not v.ok and any("not finished" in r for r in v.reasons)


# ---- candidate search / find_match -----------------------------------------------------------------
def test_candidates_filter_by_gender_format_and_teams(index):
    cs = candidates_for(T("2024-01-14", "Afghanistan", "India", "T20I"), index)
    assert [c.crex_id for c in cs] == ["LR4"]  # not the women's / U19 matches on the same day
    assert candidates_for(T("2024-01-14", "Afghanistan", "India", "Test"), index) == []


def test_find_match_found_renders_only_candidates(index):
    b = FakeBrowser()
    r = find_match(T("2025-12-18", "Jharkhand", "Haryana", "T20"), index, b)
    assert r.status == "found" and r.entry.crex_id == "YKF"
    assert len(b.rendered) == 1


def test_find_match_not_found_without_candidates_renders_nothing(index):
    b = FakeBrowser()
    r = find_match(T("2015-03-01", "Foo", "Bar", "ODI"), index, b)
    assert r.status == "not_found" and "no CREX match" in r.reason
    assert b.rendered == []


def test_find_match_not_found_only_after_candidates_are_rendered_and_rejected(index):
    b = FakeBrowser()
    # right day, plausible code for Jharkhand, but the page is Haryana v Jharkhand not Jharkhand v Rajasthan
    r = find_match(T("2025-12-18", "Jharkhand", "Rajasthan", "T20"), index, b)
    assert r.status == "not_found"
    assert r.checked == ["YKF"] and len(b.rendered) == 1


def test_find_match_network_trouble_is_inconclusive_not_not_found(index):
    class Broken:
        def render(self, *a, **k):
            raise RuntimeError("timeout")
    r = find_match(T("2025-12-18", "Jharkhand", "Haryana", "T20"), index, Broken())
    assert r.status == "inconclusive"


# ---- records ---------------------------------------------------------------------------------------
def test_record_from_facts(index):
    entry = index.by_slug(PAGES["afg_ind_1st_t20i_2024"])
    rec = record_from_facts(entry, _facts("afg_ind_1st_t20i_2024"), "2024-01-11", "T20I", "cricsheet_withheld")
    assert rec.match_id == "crex-" + PAGES["afg_ind_1st_t20i_2024"]
    assert (rec.team_type, rec.gender, rec.winner, rec.source) == ("international", "male", "India", "crex")
    assert rec.event == "Afghanistan Tour Of India 2024"
    dom = record_from_facts(index.by_slug(PAGES["har_jhkd_final_smat_2025"]), _facts("har_jhkd_final_smat_2025"),
                            "2025-12-18")
    assert (dom.team_type, dom.match_type) == ("club", "T20")


# ---- Afghanistan enumeration -------------------------------------------------------------------------
def test_afghanistan_enumeration_comes_from_the_sitemap(index):
    q = BackfillQueue()
    stats = enumerate_afghanistan_matches(q, index, today=date(2026, 10, 9))
    keys = {t.key() for t in q.pending}
    # men's senior AFG matches that have been played: 3x India 2024 + Ireland ODI 2026
    assert keys == {
        "2024-01-11-Afghanistan-India", "2024-01-14-Afghanistan-India", "2024-01-17-Afghanistan-India",
        "2026-03-01-Afghanistan-Ireland",
    }
    # not queued: women's, U19, the Test starting today, and the 'tbc' World Cup placeholder
    assert stats["skipped_unplayed"] == 2
    assert all(t.category == "cricsheet_withheld" and t.crex_url for t in q.pending)
    assert enumerate_afghanistan_matches(q, index, today=date(2026, 10, 9))["queued"] == 0  # idempotent


# ---- queue + batch processing --------------------------------------------------------------------------
def test_batch_marks_done_only_when_saved_and_records_not_found_reasons(index, tmp_path):
    store = Store(tmp_path)
    q = BackfillQueue(batch_size=5, delay_between_requests=0)
    q.add_task(T("2025-12-18", "Jharkhand", "Haryana", "T20"))
    q.add_task(T("2015-03-01", "Foo", "Bar", "ODI"))
    enumerate_afghanistan_matches(q, index, today=date(2024, 2, 1))  # the three 2024 India matches
    b = FakeBrowser()
    stats = process_backfill_batch(q, index, b, store, verbose=False, sleep=lambda s: None)

    # LR4/LR5 are in the sitemap but have no fixture page -> 404 -> rejected, not silently "done"
    assert stats["succeeded"] == 2  # Jharkhand v Haryana and Afghanistan v India (1st T20I)
    assert {d["key"] for d in q.done} == {"2025-12-18-Jharkhand-Haryana", "2024-01-11-Afghanistan-India"}
    saved = {p.name for p in (tmp_path / "provisional").glob("*.json")}
    assert saved == {"crex-" + PAGES["har_jhkd_final_smat_2025"] + ".json",
                     "crex-" + PAGES["afg_ind_1st_t20i_2024"] + ".json"}  # done <=> file on disk
    nf = {d["key"]: d for d in q.not_found}
    assert "2015-03-01-Foo-Bar" in nf and nf["2015-03-01-Foo-Bar"]["reason"]
    assert nf["2024-01-14-Afghanistan-India"]["checked"] == ["LR4"]
    assert q.stats()["pending"] == 0


def test_saved_match_keeps_its_permanent_status(index, tmp_path):
    import json
    store = Store(tmp_path)
    q = BackfillQueue(batch_size=1, delay_between_requests=0)
    q.add_task(T("2025-12-18", "Jharkhand", "Haryana", "T20"))
    process_backfill_batch(q, index, FakeBrowser(), store, verbose=False, sleep=lambda s: None)
    doc = json.loads(next((tmp_path / "provisional").glob("*.json")).read_text())
    assert doc["status"] == "cricsheet_missing"


def test_failed_lookup_is_retried_then_parked(index, tmp_path):
    class Broken:
        def render(self, *a, **k):
            raise RuntimeError("timeout")
    q = BackfillQueue(batch_size=1, delay_between_requests=0, max_retries=2)
    q.add_task(T("2025-12-18", "Jharkhand", "Haryana", "T20"))
    for _ in range(3):
        process_backfill_batch(q, index, Broken(), Store(tmp_path), verbose=False, sleep=lambda s: None)
    assert q.stats()["done"] == 0 and q.stats()["not_found"] == 0
    assert len(q.failed) == 1 and q.failed[0].attempts == 2


def test_queue_load_discards_unverified_legacy_state(tmp_path):
    import json
    path = tmp_path / "q.json"
    path.write_text(json.dumps({
        "pending": [
            {"date": "2025-12-18", "team_a": "A", "team_b": "B", "match_type": "T20", "gender": "male",
             "category": "cricsheet_missing"},
            {"date": "2024-11-14", "team_a": "Afghanistan", "team_b": "Bangladesh", "match_type": "ODI",
             "gender": "male", "category": "cricsheet_withheld"},  # hand-typed: no crex_url
        ],
        "not_found": ["2025-12-18-Jharkhand-Haryana"],  # produced by the old, broken lookup
        "done": [],
    }))
    q = BackfillQueue.load(path)
    assert [t.key() for t in q.pending] == ["2025-12-18-A-B"]
    assert q.not_found == []
    from cricket_data.permanent_matches import MissingMatch
    added = q.initialize_from_missing_list([MissingMatch("2025-12-18", "Jharkhand", "Haryana", "T20", "male")])
    assert added == 1  # re-queued for a real lookup


def test_queue_never_requeues_resolved_tasks(tmp_path):
    from cricket_data.permanent_matches import MissingMatch
    q = BackfillQueue()
    t = T("2025-12-18", "Jharkhand", "Haryana", "T20")
    q.add_task(t)
    q.next_task()
    q.mark_not_found(t, "checked", ["YKF"])
    m = MissingMatch("2025-12-18", "Jharkhand", "Haryana", "T20", "male")
    assert q.initialize_from_missing_list([m]) == 0
    q.save(tmp_path / "q.json")
    assert BackfillQueue.load(tmp_path / "q.json").initialize_from_missing_list([m]) == 0


def test_extract_links():
    html = '<a href="/cricket-live-score/x-1"><span>IND</span> Won</a><a href="/other">no</a>'
    assert extract_links(html, "/cricket-live-score/") == [{"href": "/cricket-live-score/x-1", "text": "IND\nWon"}]


def test_index_falls_back_to_stale_cache_when_sitemaps_fail(index, tmp_path):
    import os
    import time

    cache = tmp_path / "idx.json"
    seed = CREXSitemapIndex(cache_path=cache)
    seed.matches, seed.series = index.matches, index.series
    seed._save_cache()
    old = time.time() - 10 * 86400
    os.utime(cache, (old, old))  # older than the daily refresh window

    class Down:
        def get(self, url):
            raise OSError("blocked")

    idx = CREXSitemapIndex(fetcher=Down(), cache_path=cache)
    idx.load()
    assert len(idx.matches) == len(index.matches)
    with pytest.raises(OSError):
        CREXSitemapIndex(fetcher=Down(), cache_path=tmp_path / "none.json").load()


def test_health_checks_flag_a_changed_match_page(tmp_path):
    from cricket_data.health import run_checks

    class Browser:
        def render(self, url, wait_selector=None, timeout_ms=0):
            return RenderedPage(url, 200, "<html>redesigned</html>", "", "t")

        def links(self, url, contains):
            return RenderedPage(url, 200, "<html></html>", "", "t"), []

    class Fetcher:
        def get(self, url):
            return "<urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'></urlset>"

    results = {r.name: r for r in run_checks(Browser(), Fetcher(), tmp_path)}
    assert not any(r.ok for r in results.values())
    assert (tmp_path / "match_page.html").read_text() == "<html>redesigned</html>"  # raw page saved
    assert "parse_match_page" in results["match_page"].hint


def test_parse_match_page_reads_toss_and_overs_from_embedded_data():
    p = _page("ind_wi_1st_t20_2026")
    f = parse_match_page(p.html, p.text, p.title)
    assert (f.toss_winner, f.toss_decision) == ("India", "field")  # same as the Cricsheet record
    assert f.max_overs == 19.1  # 171/10 in 19.1: a T20, and the all-out innings is not mistaken for 50-over
    assert f.winner == "India" and f.venue.endswith("Lucknow")


def test_record_carries_the_toss():
    from cricket_data.crex_sitemap import MatchEntry
    p = _page("ind_wi_1st_t20_2026")
    f = parse_match_page(p.html, p.text, p.title)
    slug = "ind-vs-wi-1st-t20-west-indies-tour-of-india-2026-match-updates-11AL"
    rec = record_from_facts(MatchEntry(url="u", match_id=slug, lastmod="2026-10-06T19:00:00+05:30"), f, "2026-10-06")
    assert (rec.toss_winner, rec.toss_decision, rec.venue.endswith("Lucknow")) == ("India", "field", True)


def test_render_uses_plain_http_and_falls_back_to_the_browser(monkeypatch):
    from cricket_data import crex_browser as cb

    b = cb.CREXBrowser(fetcher=type("F", (), {"allowed": lambda self, u: True})(), min_interval=0)
    page = cb.RenderedPage("u", 200, '<script id="sports-event-schema">x</script>', "x", "t")
    monkeypatch.setattr(b, "_http", lambda url, marker: page)
    monkeypatch.setattr(b, "start", lambda: (_ for _ in ()).throw(AssertionError("browser must not start")))
    assert b.render("u", wait_selector="script#sports-event-schema") is page  # served over HTTP

    monkeypatch.setattr(b, "_http", lambda url, marker: None)  # content missing from the plain response
    with pytest.raises(AssertionError):
        b.render("u", wait_selector="script#sports-event-schema")  # tried to start Chromium


# ---- Cricsheet-shaped records: match fields + every player -----------------------------------------
def _scorecard():
    from cricket_data.crex_scorecard import parse_scorecard
    return parse_scorecard((FIX / "ind_wi_1st_t20_2026_scorecard.html").read_text())


def test_scorecard_gives_a_row_for_every_player_with_cricsheet_columns():
    from cricket_data.crex_scorecard import player_rows

    rows = {r.player: r for r in player_rows(_scorecard(), "m", "2026-10-06")}
    assert len(rows) == 22  # both XIs, including those who did not bat or bowl
    iyer = rows["Shreyas Iyer"]
    assert (iyer.team, iyer.opponent, iyer.runs, iyer.balls, iyer.fours, iyer.sixes) == ("India", "West Indies", 102, 43, 10, 6)
    hosein = rows["Akeal Hosein"]
    assert (hosein.team, hosein.wickets, hosein.balls_bowled, hosein.runs_conceded) == ("West Indies", 1, 24, 37)
    assert rows["Tilak Varma"].runs == 0 and rows["Tilak Varma"].team == "India"  # did not bat


def test_scorecard_fielding_credits_match_the_dismissals():
    from cricket_data.crex_scorecard import player_rows

    rows = {r.player: r for r in player_rows(_scorecard(), "m", "2026-10-06")}
    assert rows["Akeal Hosein"].catches == 1  # caught and bowled Samson
    assert rows["Shimron Hetmyer"].run_outs == 0
    assert rows["Shreyas Iyer"].run_outs == 1 and rows["Sanju Samson"].run_outs == 1  # Hetmyer run out
    assert rows["Axar Patel"].catches == 2 and rows["Ishan Kishan"].catches == 2 and rows["Naman Dhir"].catches == 1
    assert sum(r.wickets for r in rows.values() if r.team == "India") == 9  # West Indies lost 10: nine to bowlers, one run out (no bowler credit)


def test_full_record_has_toss_potm_event_and_players(index):
    from cricket_data.crex_lookup import fetch_record
    from cricket_data.crex_sitemap import MatchEntry

    slug = "ind-vs-wi-1st-t20-west-indies-tour-of-india-2026-match-updates-11AL"
    summary = _page("ind_wi_1st_t20_2026")
    facts = parse_match_page(summary.html, summary.text, summary.title)

    class B:
        def render(self, url, wait_selector=None, timeout_ms=0, force_browser=False, marker=None):
            assert url.endswith("/match-scorecard")
            return RenderedPage(url, 200, (FIX / "ind_wi_1st_t20_2026_scorecard.html").read_text(), "", "")

    rec = fetch_record(B(), MatchEntry(url="https://crex.com/cricket-live-score/" + slug, match_id=slug,
                                       lastmod="2026-10-06T19:00:00+05:30"), facts, "2026-10-06")
    assert (rec.match_type, rec.team_type, rec.gender) == ("T20", "international", "male")  # Cricsheet vocabulary
    assert rec.event == "West Indies tour of India"  # no year, as Cricsheet writes it
    assert (rec.toss_winner, rec.toss_decision) == ("India", "field")
    assert (rec.winner, rec.result, rec.result_margin) == ("India", "win", "8 wickets")
    assert rec.player_of_match == "Shreyas Iyer"
    assert rec.venue.endswith("Lucknow") and len(rec.players) == 22


def test_fetch_record_survives_an_unreadable_scorecard():
    from cricket_data.crex_lookup import fetch_record
    from cricket_data.crex_sitemap import MatchEntry

    slug = "ind-vs-wi-1st-t20-west-indies-tour-of-india-2026-match-updates-11AL"
    summary = _page("ind_wi_1st_t20_2026")
    facts = parse_match_page(summary.html, summary.text, summary.title)

    class Down:
        def render(self, *a, **k):
            raise RuntimeError("timeout")

    rec = fetch_record(Down(), MatchEntry(url="u", match_id=slug, lastmod=None), facts, "2026-10-06")
    assert rec.players == [] and rec.toss_winner == "India"


def test_cricsheet_match_type_vocabulary():
    from cricket_data.crex_lookup import cricsheet_match_type as t

    assert t("T20I", "t20", True) == "T20" and t("T20", "t20", False) == "T20"
    assert t("ODI", "50", True) == "ODI" and t("List A", "50", False) == "ODM"
    assert t("Test", "multi", True) == "Test" and t("FC", "multi", False) == "MDM"
    assert t("", "multi", False) == "MDM"
