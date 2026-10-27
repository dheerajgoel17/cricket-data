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
