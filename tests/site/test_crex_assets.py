from cricket_site import crex_assets as ca

SITEMAP = """<urlset>
<url><loc>https://src.test/player/harry-brook-1IG</loc></url>
<url><loc>https://src.test/player/harry-brook-1IG/matches</loc></url>
<url><loc>https://src.test/player/virat-kohli-4I</loc></url>
<url><loc>https://src.test/player/rassie-van-der-dussen-9Z</loc></url>
<url><loc>https://src.test/player/dasun-shanaka-7Q</loc></url>
<url><loc>https://src.test/player/steve-smith-5A</loc></url>
<url><loc>https://src.test/player/jamie-smith-6B</loc></url>
</urlset>"""


def players():
    rows = [("HC Brook", 300), ("V Kohli", 900), ("RR van der Dussen", 200), ("MD Shanaka", 150), ("SPD Smith", 500), ("JL Smith", 40), ("VK Singh", 30)]
    return [{"idx": i, "name": n, "n": c, "last": "2026-01-01"} for i, (n, c) in enumerate(rows)]


def test_sitemap_parse_dedupes_ids_and_strips_suffix():
    out = ca.parse_sitemap(SITEMAP, "player")
    assert ("harry brook", "1IG") in out and len([1 for _, c in out if c == "1IG"]) == 1


def test_match_players_is_conservative():
    m = ca.match_players(players(), ca.parse_sitemap(SITEMAP, "player"))
    assert m[0] == "1IG" and m[1] == "4I"          # initials + surname
    assert m[2] == "9Z"                             # particles in the surname
    assert m[3] == "7Q"                             # uncommon surname, initials contain the given name's letter
    assert m[4] == "5A" and m[5] == "6B"            # two Smiths are told apart by their first initial
    assert 6 not in m                               # no Source A entry for VK Singh


def test_ambiguous_names_are_skipped_not_guessed():
    twin = [{"idx": 0, "name": "A Khan", "n": 100, "last": "2026-01-01"}, {"idx": 1, "name": "A Khan", "n": 90, "last": "2026-01-01"}]
    assert ca.match_players(twin, [("ali khan", "XX")]) == {}


def test_match_teams_prefers_mens_and_ignores_women_only_slugs():
    teams = [{"name": "India", "g": 0}, {"name": "Mumbai Indians", "g": 0}]
    crex = [("india women", "W1"), ("india", "O"), ("mumbai indians", "F"), ("india a", "A1")]
    assert ca.match_teams(teams, crex) == {"india": "O", "mumbai indians": "F"}


def test_display_name_makes_a_readable_full_name_from_the_slug():
    from cricket_site.crex_assets import display_name

    assert display_name("bevon john jacobs") == "Bevon John Jacobs"
    assert display_name("quinton de kock") == "Quinton de Kock"
    assert display_name("de kock") == "De Kock"  # a particle that starts the name keeps its capital
    assert display_name("ben mcdermott") == "Ben McDermott"
    assert display_name("kevin o'brien") == "Kevin O'Brien"
    assert display_name("") == ""
    # the source sometimes lists a player by initials only; those stay upper, a real given name still capitalises
    assert display_name("ms dhoni") == "MS Dhoni"
    assert display_name("kl rahul") == "KL Rahul"
    assert display_name("vvs laxman") == "VVS Laxman"
    assert display_name("ab de villiers") == "AB de Villiers"
    assert display_name("bj watling") == "BJ Watling"
    assert display_name("adam milne") == "Adam Milne"


def test_match_players_leaves_a_silhouette_when_two_source_namesakes_tie():
    """RG Sharma matches both Rydham and Rohit on first initial + surname; keeping the sitemap's first pick showed the wrong full name."""
    players = [{"idx": 0, "name": "RG Sharma", "n": 500, "last": "2026-01-01"}]
    assert ca.match_players(players, [("rydham sharma", "MJC"), ("rohit sharma", "2X")]) == {}
    assert ca.match_players(players, [("rohit sharma", "2X")]) == {0: "2X"}  # only one namesake: take it
    assert ca.match_players(players, [("rohit sharma", "2X"), ("rohit sharma", "60H")]) == {0: "2X"}  # same name, two ids: first wins


def test_league_logos_are_matched_on_the_leagues_own_words_and_take_the_newest_season():
    xml = ("<urlset>" + "".join(f"<url><loc>https://src.test/series/{x}</loc></url>" for x in (
        "womens-big-bash-league-2026-2KG", "womens-big-bash-league-2026-2KG/matches", "womens-big-bash-league-2025-1W0",
        "big-bash-league-2026-27-2KQ", "big-bash-league-2025-26-1ZZ", "indian-premier-league-2025-1PD", "indian-premier-league-2026-1PW",
        "t20-blast-2026-241", "mens-t20-world-cup-2026-1UY", "mens-t20-world-cup-africa-qualifier-final-2026-9Q", "the-hundred-men-2026-2AW", "the-hundred-women-2026-2AX")) + "</urlset>")
    series = ca.parse_series(xml)
    assert ("womens big bash league 2026", "2KG") in series and not any(sid == "2KG" and "matches" in n for n, sid in series)  # a season's own page, not its /matches page
    events = ["Women's Big Bash League", "Big Bash League", "Indian Premier League", "Vitality Blast", "ICC Men's T20 World Cup", "The Hundred Men's Competition",
              "The Hundred Women's Competition", "Some Local Cup", "ICC Men's T20 World Cup Sub Regional Africa Qualifier"]
    assert ca.match_leagues(events, series) == {
        "women s big bash league": "2KG",           # the newest season (2026), and not the men's league
        "big bash league": "2KQ",                   # "2026-27" is one season, the newest
        "indian premier league": "1PW",
        "vitality blast": "241",                    # Base and the source name it differently: an alias
        "icc men s t20 world cup": "1UY",
        "the hundred men s competition": "2AW", "the hundred women s competition": "2AX",
    }                                               # a league the source does not list, and a qualifier it lists under another name, are left out
    assert ca.league_key("Women's Big Bash League 2025-26") == ca.league_key("womens-big-bash-league") != ca.league_key("Big Bash League")
    assert ca.league_key("ICC Men's Cricket World Cup League 2") != ca.league_key("ICC Cricket World Cup")   # a number inside the name is kept, only a season goes


def test_a_remembered_source_player_is_added_only_when_todays_list_lacks_his_id():
    cur = [("harry brook", "1IG"), ("virat kohli", "4I")]
    merged, kept = ca.merge_remembered(cur, [("harry brook", "1IG"), ("jomel warrican", "HX"), ("", "NN"), ("blank id", "")])
    assert merged == cur + [("jomel warrican", "HX")] and kept == 1
    assert ca.merge_remembered(cur, []) == (cur, 0), "no memory, no change"
    assert ca.merge_remembered(cur, [("harri brook", "1IG")])[0] == cur, "today's spelling wins for an id both have"
