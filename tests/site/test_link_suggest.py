"""link_suggest: the fixture's sides and the source's nationality settle a name; only a settled one is applied."""
import json
from collections import Counter
from datetime import datetime, timezone

from cricket_site import link_suggest as L


def player(name, teams, nat=(), last="2026-10-01", n=50, g="male"):
    return {"name": name, "g": Counter({g: n}), "n": n, "last": last, "teams": Counter({L.clean_team(t): 5 for t in teams}), "nat": Counter({L.clean_team(t): 5 for t in nat})}


BASE = {
    "p1": player("AD Russell", ["Sydney Thunder", "West Indies"], nat=["West Indies"]),
    "p2": player("AK Russell", ["Somerset"]),
    "p3": player("HT Tector", ["Ireland", "Leinster Lightning"], nat=["Ireland"]),
    "p4": player("S Patel", ["Gujarat"]),
    "p5": player("SN Patel", ["Biratnagar Kings"]),
}


def test_strength_of_a_printed_name_against_base_names():
    assert L.strength("Andre Russell", "AD Russell") == "weak"           # first initial only: two given names are unknown
    assert L.strength("Andre Dwayne Russell", "AD Russell") == "strong"  # both initials accounted for
    assert L.strength("HT Tector", "HT Tector") == "exact"
    assert L.strength("Harry Tector", "AD Russell") is None


def test_the_fixture_separates_two_base_players_of_one_name():
    cands = L.base_candidates("Andre Russell", "male", BASE, "2022-01-01")
    assert {p for p, _ in cands} == {"p1", "p2"}
    pid, why, why_not = L.choose("Andre Russell", cands, {L.clean_team("Sydney Thunder"), L.clean_team("Perth Scorchers")}, BASE)
    assert pid == "p1" and why == ["played for sydney thunder"] and why_not == ""
    pid, _, why_not = L.choose("Andre Russell", cands, {L.clean_team("Kent"), L.clean_team("Essex")}, BASE)
    assert pid is None and "ever played" in why_not   # a weak name fit and no tie to the fixture is not settled


def test_a_national_side_in_the_fixture_ties_a_franchise_player():
    cands = L.base_candidates("Harry Tector", "male", BASE, "2022-01-01")
    pid, why, _ = L.choose("Harry Tector", cands, {L.clean_team("Ireland"), L.clean_team("Netherlands")}, BASE)
    assert pid == "p3" and "Ireland".lower() in why[0]


def test_source_page_is_confirmed_by_the_base_players_national_side():
    pages = {"A": {"nat": "west indies", "demonym": "west indian", "birth_place": "Jamaica"}, "B": {"nat": "england", "demonym": "english", "birth_place": ""}}
    sid, note = L.confirm_source("p1", [("andre russell", "A"), ("andre russell", "B")], BASE, lambda n, i: pages[i])
    assert sid == "A" and "west indian" in note
    sid, why = L.confirm_source("p1", [("andre russell", "B")], BASE, lambda n, i: pages[i])
    assert sid is None and "nationality" in why
    sid, why = L.confirm_source("p2", [("x", "A")], BASE, lambda n, i: pages["A"])   # no national side in Base: no comparison to make
    assert sid is None


def test_parse_profile_reads_nationality_and_birth_place():
    html = "<html><body><div>Birth 5 Jul 1994 Birth Place Lahore Nationality Emirati Role Bowler Bats left handed</div><script>x</script></body></html>"
    assert L.parse_profile(html) == {"demonym": "emirati", "nat": "united arab emirates", "birth_place": "Lahore"}


def test_suggest_and_apply_write_only_settled_lines_and_never_twice(tmp_path):
    sitemap = [("andre russell", "A")]
    names = {"Andre Russell": [{"match": "Sydney Thunder vs Perth Scorchers", "competition": "BBL"}], "Nobody Known": [{"match": "Sydney Thunder vs Perth Scorchers", "competition": ""}]}
    props = L.suggest(names, BASE, sitemap, lambda n, i: {"nat": "west indies", "demonym": "west indian", "birth_place": "Jamaica"})
    by = {p["name"]: p for p in props}
    assert by["Andre Russell"]["certain"] and by["Andre Russell"]["pid"] == "p1" and by["Andre Russell"]["source_id"] == "A"
    assert not by["Nobody Known"]["certain"] and "no Base player" in by["Nobody Known"]["why_not"]
    (tmp_path / "data" / "mappings").mkdir(parents=True)
    (tmp_path / "value_bets" / "mappings").mkdir(parents=True)
    d, v = tmp_path / "data", tmp_path / "value_bets"
    assert L.apply(props, d, v, "2026-11-26") == {"players": 1, "identity": 1}
    assert "Andre Russell,p1" in (v / "mappings" / "players.csv").read_text()
    assert (d / "mappings" / "player_identity.csv").read_text().count("p1,A,") == 1
    assert L.apply(props, d, v, "2026-11-26") == {"players": 0, "identity": 0}   # a second run adds nothing


def test_unmatched_names_come_from_the_archive_catalogue_minus_the_priced_ones(tmp_path):
    arch = tmp_path / "archive" / "2026-11"
    arch.mkdir(parents=True)
    (arch / "m.json").write_text(json.dumps({"match": "India vs Pakistan", "competition": "T20I", "start_utc": "2026-11-26T10:00:00Z",
                                             "lines": [{"book_name": "Babar Azam", "player": "Babar Azam"}],
                                             "catalogue": [{"player": "Babar Azam"}, {"player": "Abdul Samad"}, {"player": "Yes"}, {"player": "India"}]}))
    out = L.unmatched_names(tmp_path, now=datetime(2026, 11, 26, 5, 0, tzinfo=timezone.utc))
    assert list(out) == ["Abdul Samad"] and out["Abdul Samad"][0]["match"] == "India vs Pakistan"


def test_plausible_name_keeps_players_and_drops_market_wording():
    assert all(L.plausible_name(n) for n in ["Abdul Samad", "TS Mills", "Ayush Badoni", "H Silver-Holmes", "Kusal Janith Perera", "Annie O Neil"])
    assert not any(L.plausible_name(n) for n in ["Both Teams To Hit Over 6.5 Sixes", "Melbourne Renegades To Hit a 6", "Four (including nb4)", "320 or more", "Capitals", "Over 1.5 LBW's & Over 16.5 Sixes"])


def test_unmatched_names_prefer_the_odds_jobs_own_full_list(tmp_path):
    out = tmp_path / "out"
    out.mkdir()
    (out / "value_bets_latest.json").write_text(json.dumps({"unmatched_players_detail": {"Abdul Samad": [{"match": "India vs Pakistan", "competition": "", "start": "x"}], "Both Teams To Hit Over 6.5 Sixes": [{"match": "m"}]}}))
    assert list(L.unmatched_names(tmp_path)) == ["Abdul Samad"]
