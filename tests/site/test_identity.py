import json

from cricket_site import identity as I

SITEMAP = [("NGF", "ajaz patel"), ("A9", "axar patel"), ("S1", "harry brook"), ("S2", "avishka fernando"), ("S3", "asitha fernando"), ("S4", "vaibhav sooryavanshi"),
           ("S5", "kusal mendis"), ("S6", "kamindu mendis"), ("S7", "sam curran"), ("S8", "sam curran"), ("S9", "tom curran")]
NAMES = {"p1": "HC Brook", "p2": "BKG Mendis", "p3": "PHKD Mendis", "p4": "V Suryavanshi", "p5": "AM Fernando", "p6": "WIA Fernando", "p7": "SM Curran",
         "p8": "Asitha Fernando", "p9": "Chipo Mugeri-Tiripano"}


def priced(hist, *book):
    return {"hist": hist, "names": sorted(book)}


def test_a_source_id_comes_from_an_override_first_then_the_photo_map_then_the_books_exact_name():
    books = {"p1": priced("HC Brook"), "p2": priced("BKG Mendis", "Kusal Mendis"), "p3": priced("Kamindu Mendis"), "p4": priced("V Suryavanshi")}
    table, review, added = I.build({"p1": "c:S1", "p5": "w:a.jpg"}, SITEMAP, NAMES, books, {"p4": "S4"})
    assert table["s"] == {"p1": "S1", "p2": "S5", "p3": "S6", "p4": "S4"}
    assert added == {"p2": "S5", "p3": "S6", "p4": "S4"}, "the photo map already had p1"
    assert table["b"] == {"p2": ["Kusal Mendis"]}, "a book name equal to ours adds nothing"
    assert review == []


def test_the_exact_name_of_a_priced_player_replaces_a_photo_link_to_a_namesake_but_not_one_that_somebody_else_holds():
    names = {**NAMES, "pa": "AR Patel", "pb": "AY Patel"}
    # the photo map's initials-and-surname match gave Axar Patel the source's "Ajaz Patel"; the books say Axar Patel, and one source player has that name
    table, review, added = I.build({"pa": "c:NGF"}, SITEMAP, names, {"pa": priced("Axar Patel", "AR Patel")}, {})
    assert table["s"] == {"pa": "A9"} and added == {"pa": "A9"} and review == []
    # a photo link that agrees with the books stays; one with no evidence from the books stays
    assert I.build({"pa": "c:A9"}, SITEMAP, names, {"pa": priced("Axar Patel")}, {})[0]["s"] == {"pa": "A9"}
    assert I.build({"pa": "c:NGF"}, SITEMAP, names, {"pa": priced("AR Patel")}, {})[0]["s"] == {"pa": "NGF"}
    # the exact name never takes a source player the photo map gave to another player: the photo link it already had is kept, and the disagreement is reviewed
    table, review, _ = I.build({"pa": "c:NGF", "pb": "c:A9"}, SITEMAP, names, {"pa": priced("Axar Patel")}, {})
    assert table["s"] == {"pa": "NGF", "pb": "A9"}
    assert [(r["pid"], r["why"]) for r in review] == [("pa", "the source player with this name (A9) is already linked to pb; his own link NGF came from a name match")]
    # a hand-checked link is never replaced by the books
    assert I.build({}, SITEMAP, names, {"pa": priced("Axar Patel")}, {"pa": "NGF"})[0]["s"] == {"pa": "NGF"}


def test_an_override_beats_the_photo_map_and_takes_the_source_player_from_whoever_the_name_matcher_gave_him_to():
    table, _, added = I.build({"p5": "c:S2"}, SITEMAP, NAMES, {}, {"p6": "S2"})
    assert table["s"] == {"p6": "S2"} and added == {"p6": "S2"}


def test_an_override_naming_an_id_the_sources_list_lacks_is_not_taken_and_without_a_list_it_is_taken_on_trust():
    table, review, _ = I.build({}, SITEMAP, NAMES, {}, {"p4": "S99"})
    assert table["s"] == {} and review[0]["pid"] == "p4" and "S99" in review[0]["why"]
    assert I.build({}, [], NAMES, {}, {"p4": "S99"})[0]["s"] == {"p4": "S99"}


def test_what_cannot_be_linked_is_reviewed_with_the_reason_and_who_it_might_be():
    books = {"p4": priced("V Suryavanshi"), "p6": priced("WIA Fernando"), "p7": priced("SM Curran", "Sam Curran"), "p9": priced("Chipo Mugeri-Tiripano", "C Mugeri-Tiripano")}
    table, review, added = I.build({}, SITEMAP, NAMES, books, {})
    assert table["s"] == {} and added == {}
    by = {r["pid"]: r for r in review}
    assert by["p4"]["why"] == "no source player has this name" and by["p4"]["suggest"] == [["S4", "vaibhav sooryavanshi"]], "Suryavanshi ~ Sooryavanshi, same first initial"
    assert by["p6"]["suggest"] == [["S2", "avishka fernando"], ["S3", "asitha fernando"]], "W, I, A: the given names starting with A; the surname is the same"
    assert by["p7"]["why"] == "several source players have this name" and by["p7"]["suggest"] == [["S7", "sam curran"], ["S8", "sam curran"]]
    assert by["p9"]["suggest"] == [] and by["p9"]["books"] == ["C Mugeri-Tiripano"]
    assert [r["pid"] for r in review] == ["p9", "p7", "p4", "p6"], "listed by name"


def test_two_of_our_players_claiming_one_source_player_get_neither():
    books = {"p5": priced("AM Fernando", "Asitha Fernando"), "p8": priced("Asitha Fernando")}
    table, review, _ = I.build({}, SITEMAP, NAMES, books, {})
    assert table["s"] == {}
    assert {r["pid"] for r in review} == {"p5", "p8"} and all("claimed by 2" in r["why"] for r in review)


def test_a_source_player_already_linked_to_another_is_not_given_away_by_a_name():
    table, review, _ = I.build({"p2": "c:S5"}, SITEMAP, NAMES, {"p3": priced("PHKD Mendis", "Kusal Mendis")}, {})
    assert table["s"] == {"p2": "S5"} and review[0]["pid"] == "p3" and "already linked to p2" in review[0]["why"]


def test_overrides_file_skips_comments_and_the_header_and_a_later_line_wins(tmp_path):
    (tmp_path / "mappings").mkdir()
    (tmp_path / "mappings" / "player_identity.csv").write_text(
        "# links checked by hand\nplayer_id,source_id,note\n\np4,S4,\"V Suryavanshi, spelled differently\"\np6,S2,first\np6,S3,second\n  # indented comment\n,S1,no player\n")
    assert I.load_overrides(tmp_path) == {"p4": "S4", "p6": "S3"}
    assert I.load_overrides(tmp_path / "nowhere") == {} and I.load_overrides(None) == {}


def test_books_are_collected_from_the_book_file_and_the_archive_and_a_broken_file_is_skipped(tmp_path):
    out = tmp_path / "out"
    (tmp_path / "archive" / "2026-10").mkdir(parents=True)
    out.mkdir()
    (out / "book_lines.json").write_text(json.dumps({"lines": [{"pid": "p2", "player": "BKG Mendis", "book_name": "Kusal Mendis"}, {"pid": "p3", "player": "PHKD Mendis"}]}))
    (tmp_path / "archive" / "2026-10" / "a.json").write_text(json.dumps({"lines": [{"pid": "p2", "player": "BKG Mendis", "book_name": "K Mendis"}, {"pid": "p3", "player": "PHKD Mendis", "book_name": "Kamindu Mendis"}]}))
    (tmp_path / "archive" / "2026-10" / "b.json").write_text('{"lines": [')
    assert I.collect_books(out) == {"p2": {"hist": "BKG Mendis", "names": ["K Mendis", "Kusal Mendis"]}, "p3": {"hist": "PHKD Mendis", "names": ["Kamindu Mendis"]}}
    (tmp_path / "empty" / "out").mkdir(parents=True)
    assert I.collect_books(None) == {} and I.collect_books(tmp_path / "empty" / "out") == {}


def test_the_review_reads_as_a_table_with_the_line_to_add():
    r = [{"pid": "p4", "name": "V Suryavanshi", "books": [], "why": "no source player has this name", "suggest": [["S4", "vaibhav sooryavanshi"]]}]
    md = I.to_markdown(r)
    assert "| V Suryavanshi | `p4` | - | no source player has this name | `S4` vaibhav sooryavanshi |" in md and "player_identity.csv" in md
    assert "Every priced player is linked" in I.to_markdown([])
