import json
import urllib.error
from datetime import date

import pytest
import synth
from test_build import _line, _out, _src_players, _vb

from cricket_site import build as B
from cricket_site import profiles as P


def page(role=None, bats=None, bowls=None):
    """A player page as the source serves it: a key / value table (only the rows given)."""
    rows = "".join(f'<tr class="keyValueSection"><td _ngcontent-sc58="" class="key">{k}</td><td _ngcontent-sc58="" class="value">{v}</td></tr>'
                   for k, v in (("Birth Place", "Delhi"), ("Role", role), ("Bats", bats), ("Bowls", bowls)) if v is not None)
    return f"<html><body><table>{rows}</table></body></html>"


def test_a_page_is_reduced_to_the_fixed_vocabulary_and_what_it_does_not_say_stays_missing():
    assert P.parse_profile(page("Batter", "right handed . middle order", "right-arm medium . Faster")) == {"role": "BAT", "bat": "RHB", "bowl": "RM"}
    assert P.parse_profile(page("All Rounder", "left handed . opener", "left-arm orthodox spin . Spinner")) == {"role": "AR", "bat": "LHB", "bowl": "SLA"}
    assert P.parse_profile(page("Wicket-keeper", "left handed . lower order", "na .")) == {"role": "WK", "bat": "LHB", "bowl": ""}
    assert P.parse_profile(page("Bowler", "right handed . lower order")) == {"role": "BWL", "bat": "RHB", "bowl": ""}
    assert P.parse_profile(page("Spinning hero", "ambidextrous", "slow")) == {"role": "", "bat": "", "bowl": ""}, "nothing is guessed"
    assert P.parse_profile(page()) is None and P.parse_profile("") is None, "no profile table: no profile"


@pytest.mark.parametrize("text,code", [
    ("right-arm fast . Faster", "RF"), ("right-arm fast-medium . Faster", "RFM"), ("right-arm medium fast . Faster", "RFM"), ("right-arm medium . Faster", "RM"),
    ("left-arm fast . Faster", "LF"), ("left-arm fast-medium . Faster", "LFM"), ("left-arm medium . Faster", "LM"),
    ("right-arm off-break . Spinner", "OB"), ("right-arm offbreak . Spinner", "OB"), ("right-arm leg-break . Spinner", "LB"), ("legbreak googly . Spinner", "LB"),
    ("left-arm orthodox spin . Spinner", "SLA"), ("slow left-arm orthodox . Spinner", "SLA"), ("left-arm chinaman . Spinner", "SLC"), ("left-arm wrist spin . Spinner", "SLC"),
    ("na .", ""), ("", ""), ("fast", ""), ("left-arm off-break . Spinner", ""), ("right-arm orthodox", "")])
def test_bowling_styles(text, code):
    assert P.norm_bowl(text) == code


def test_every_style_the_vocabulary_can_produce_has_a_label():
    assert set(P.BOWL_LABELS) == {"RF", "RFM", "RM", "LF", "LFM", "LM", "OB", "LB", "SLA", "SLC"}


def test_the_store_is_a_sorted_csv_and_a_known_player_is_never_asked_again_but_an_empty_one_is_after_a_while(tmp_path):
    P.save(tmp_path, {"B": {"source_id": "B", "role": "BAT", "bat": "RHB", "bowl": "", "checked": "2026-01-01"}, "A": {"source_id": "A", "checked": "2026-10-01"}})
    assert (tmp_path / "profiles" / "profiles.csv").read_text().splitlines() == ["source_id,role,bat,bowl,checked", "A,,,,2026-10-01", "B,BAT,RHB,,2026-01-01"]
    rows = P.load(tmp_path)
    today = date(2026, 11, 3)
    assert P.known(rows["B"], today), "a value is final"
    assert P.known(rows["A"], today), "an empty answer stands for a while"
    assert not P.known(rows["A"], date(2026, 12, 31)) and not P.known(None, today)


def test_the_site_file_maps_our_ids_and_leaves_out_what_is_missing():
    rows = {"S1": {"role": "AR", "bat": "LHB", "bowl": "SLA"}, "S2": {"role": "", "bat": "RHB", "bowl": ""}, "S3": {"role": "", "bat": "", "bowl": ""}}
    doc = P.build_json(rows, {"p1": "S1", "p2": "S2", "p3": "S3", "p4": "S4"})
    assert doc["p"] == {"p1": {"r": "AR", "b": "LHB", "w": "SLA"}, "p2": {"b": "RHB"}}
    assert doc["v"] == 1 and doc["l"]["w"]["SLA"] == "Left-arm orthodox" and doc["l"]["r"]["WK"] == "Wicketkeeper"


class Fake:
    def __init__(self, pages):
        self.pages, self.got = pages, []

    def get(self, url):
        self.got.append(url)
        v = self.pages[url]
        if isinstance(v, Exception):
            raise v
        return v


def _site(tmp_path, links, n):
    site = tmp_path / "site"
    site.mkdir()
    (site / "identity.json").write_text(json.dumps({"v": 1, "s": links, "b": {}}))
    (site / "index.json").write_text(json.dumps({"players": {"id": list(n), "n": list(n.values())}}))
    return site


U = {s: f"https://src.test/player/x-{s}" for s in ("S1", "S2", "S3", "S4")}
SITEMAP = "".join(f"<url><loc>{u}</loc></url>" for u in U.values()) + "<url><loc>https://src.test/player/x-S1/matches</loc></url>"


def test_a_run_fetches_priced_players_first_then_the_busiest_saves_as_it_goes_and_never_refetches(tmp_path):
    site = _site(tmp_path, {"p1": "S1", "p2": "S2", "p3": "S3", "p4": "S4"}, {"p1": 5, "p2": 90, "p3": 50, "p4": 1})
    data = tmp_path / "data"
    vb = _vb(tmp_path, [_line("p4", "Four")])
    fake = Fake({U["S1"]: page("Batter", "right handed . opener", "na ."), U["S2"]: page("Bowler", None, "right-arm fast . Faster"),
                 U["S3"]: page(), U["S4"]: page("All Rounder", "left handed . lower order", "left-arm orthodox . Spinner")})
    st = P.run(site, data, vb, limit=3, budget=60, pause=0, today=date(2026, 11, 3), fetcher=fake, sitemap=SITEMAP)
    assert [u[-2:] for u in fake.got] == ["S4", "S2", "S3"], "priced first, then by matches played"
    assert (st["fetched"], st["found"], st["empty"], st["pending"]) == (3, 2, 1, 4)
    rows = P.load(data)
    assert rows["S4"]["bowl"] == "SLA" and rows["S2"]["role"] == "BWL" and rows["S3"]["checked"] == "2026-11-03" and "S1" not in rows
    fake2 = Fake({U["S1"]: page("Batter", "right handed . opener")})
    st = P.run(site, data, vb, limit=10, budget=60, pause=0, today=date(2026, 11, 4), fetcher=fake2, sitemap=SITEMAP)
    assert [u[-2:] for u in fake2.got] == ["S1"], "only the player not seen yet; the empty answer stands"
    doc = P.write_site(site, data, {"p1": "S1", "p2": "S2", "p3": "S3", "p4": "S4"})
    assert doc["p"] == {"p1": {"r": "BAT", "b": "RHB"}, "p2": {"r": "BWL", "w": "RF"}, "p4": {"r": "AR", "b": "LHB", "w": "SLA"}}
    assert json.loads((site / "profiles.json").read_text()) == doc


def test_a_source_outage_ends_the_step_quietly_and_keeps_what_was_stored(tmp_path, monkeypatch):
    site = _site(tmp_path, {"p1": "S1", "p2": "S2", "p3": "S3"}, {"p1": 3, "p2": 2, "p3": 1})
    data = tmp_path / "data"
    P.save(data, {"S9": {"source_id": "S9", "role": "BAT", "checked": "2026-10-01"}})
    boom = urllib.error.URLError("down")
    st = P.run(site, data, None, 10, 60, 0, today=date(2026, 11, 3), fetcher=Fake({U["S1"]: boom, U["S2"]: boom, U["S3"]: boom}), sitemap=SITEMAP)
    assert (st["fetched"], st["failed"]) == (0, 3) and set(P.load(data)) == {"S9"}
    # the player list itself unavailable
    monkeypatch.setattr(P, "fetch_sitemap", lambda kind: (_ for _ in ()).throw(urllib.error.URLError("down")))
    assert P.run(site, data, None, 10, 60, 0, fetcher=Fake({}))["fetched"] == 0
    assert P.main(["--site", str(tmp_path / "nowhere"), "--data", str(data)]) == 0, "no built data: skipped, not failed"


def test_five_failures_in_a_row_stop_the_run(tmp_path):
    ids = {f"p{i}": f"S{i}" for i in range(1, 9)}
    site = _site(tmp_path, ids, {p: 100 - i for i, p in enumerate(ids)})
    sm = "".join(f"<loc>https://src.test/player/x-{s}</loc>" for s in ids.values())
    fake = Fake({f"https://src.test/player/x-{s}": OSError("reset") for s in ids.values()})
    st = P.run(site, tmp_path / "d", None, 50, 60, 0, fetcher=fake, sitemap=sm)
    assert len(fake.got) == 5 and st["failed"] == 5


def test_the_build_writes_profiles_for_linked_players_from_the_store(tmp_path, monkeypatch):
    _src_players(monkeypatch, "harry-brook-1IG", "shubman-gill-SG")
    z, data, out, _ = _out(tmp_path)
    brook = synth.pid(synth.BROOK)
    P.save(data, {"1IG": {"source_id": "1IG", "role": "BAT", "bat": "RHB", "bowl": "OB", "checked": "2026-11-03"}, "ZZ": {"source_id": "ZZ", "role": "BWL"}})
    meta = B.build(z, data, out, None, workers=1, photos=True, crex_cache=tmp_path / "cache")
    doc = json.loads((out / "profiles.json").read_text())
    assert doc["p"] == {brook: {"r": "BAT", "b": "RHB", "w": "OB"}} and meta["profiles"] == 1
    assert doc["l"]["w"]["OB"] == "Off-spin"
