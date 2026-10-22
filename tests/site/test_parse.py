import synth
from synth import D, doc, pid, scripted

from cricket_site.parse import parse_match, qualifies


def _rows(m, kind="bat"):
    return {(r["pid"], r["inn"]): r for r in m[kind]}


def test_scripted_innings_numbers():
    st = {"A1": dict(runs=15, f4=2, f6=1, out=True), "A2": dict(runs=2, out=True, kind="run out"),
          "A3": dict(runs=0, out=False), "A4": dict(runs=0, out=False)}
    inn = scripted("X", ["A1", "A2", "A3", "A4"], st, ["B1", "B2"], pad_to=120)
    other = scripted("Y", ["C1", "C2"], {"C1": dict(runs=0), "C2": dict(runs=0)}, ["B1"], pad_to=120)
    m = parse_match("m1", doc("2024-01-01", ("X", "Y"), [inn, other]))
    bat = _rows(m)
    a1, a2 = bat[(pid("A1"), 1)], bat[(pid("A2"), 1)]
    assert (a1["r"], a1["f"], a1["s"], a1["b"], a1["o"], a1["k"]) == (15, 2, 1, 2 + 1 + 15 - 8 - 6, 1, 1)
    assert (a2["r"], a2["o"], a2["k"]) == (2, 2, 7)  # run out
    assert m["q"] == 1 and m["fmt"] == 0 and m["first"] == "X"
    i0 = m["innings"][0]
    assert (i0["runs"], i0["wkts"], i0["f4"], i0["f6"], i0["ts"], i0["tops"]) == (17, 2, 2, 1, 15, [pid("A1")])
    assert i0["nsd"] == 1  # A2's 2; zero scores are not single digits
    assert m["innings"][0]["bat"][pid("A1")]["tb"] == 1 and m["innings"][0]["bat"][pid("A1")]["mt"] == 1


def test_bowler_credit_penalty_wides_and_retirements():
    ds = [
        D("A1", "A2", "B1", 4),
        D("A1", "A2", "B1", 0, extras={"wides": 1}),                 # wide: not a ball faced, 1 run conceded
        D("A1", "A2", "B1", runs=2, extras={"noballs": 1}),       # no-ball: faced, 3 conceded, not legal
        D("A1", "A2", "B1", 0, extras={"byes": 2}),                  # byes: not charged to the bowler
        D("A1", "A2", "B1", 0, extras={"penalty": 5}),               # penalty runs count (team + bowler, as in data/players)
        D("A1", "A2", "B2", 0, wickets=[{"player_out": "A2", "kind": "retired hurt"}]),   # not a wicket
        D("A1", "A3", "B2", 0, wickets=[{"player_out": "A1", "kind": "run out"}]),         # wicket, not the bowler's
        D("A3", "A4", "B2", 0, wickets=[{"player_out": "A3", "kind": "caught"}]),
    ]
    inn = {"team": "X", "overs": [{"over": 0, "deliveries": ds}]}
    super_over = {"team": "Y", "super_over": True, "overs": [{"over": 0, "deliveries": [D("C1", "C2", "B1", 6)]}]}
    m = parse_match("m", doc("2024-01-01", ("X", "Y"), [inn, super_over]))
    assert len(m["innings"]) == 1  # super over ignored
    b1, b2 = _rows(m, "bowl")[(pid("B1"), 1)], _rows(m, "bowl")[(pid("B2"), 1)]
    assert (b1["rc"], b1["bb"], b1["w"]) == (4 + 1 + 3 + 5, 3, 0)
    assert (b2["w"], b2["bb"]) == (1, 3)   # only the catch counts
    i0 = m["innings"][0]
    assert i0["wkts"] == 2 and i0["runs"] == 4 + 1 + 3 + 2 + 5   # retired hurt is not a wicket; penalty counts in the total
    a1 = _rows(m)[(pid("A1"), 1)]
    assert (a1["r"], a1["b"]) == (6, 6)      # the wide is not a ball faced; the no-ball, byes and penalty ball are
    assert _rows(m)[(pid("A2"), 1)]["k"] == 0  # retired hurt is not dismissed


def test_partnerships_who_is_out_first():
    st = {"A1": dict(runs=10, out=True), "A2": dict(runs=20, out=True), "A3": dict(runs=0, out=False),
          "A4": dict(runs=0, out=False)}
    inn = scripted("X", ["A1", "A2", "A3", "A4"], st, ["B1"], pad_to=60)
    m = parse_match("m", doc("2024-01-01", ("X", "Y"), [inn, {"team": "Y", "overs": []}]))
    parts = m["innings"][0]["parts"]
    p1 = parts[0]
    a, b = sorted([pid("A1"), pid("A2")])
    assert (p1["a"], p1["b"]) == (a, b) and p1["open"] == 1 and p1["w"] == 1 and p1["runs"] == 10
    assert p1["x"] == (1 if pid("A1") == a else 2)  # A1 is out first
    assert parts[1]["open"] == 0 and parts[1]["w"] == 2 and parts[1]["runs"] == 20
    assert parts[-1]["x"] == 0  # the unbroken last stand


def test_market_bands_and_validity():
    st = {"A": dict(runs=30), "B": dict(runs=49, out=True), "C": dict(runs=50, out=True), "D": dict(runs=99, out=True),
          "E": dict(runs=100, out=True), "F": dict(runs=9, out=True), "G": dict(runs=0, out=True), "H": dict(runs=0, out=False),
          "I": dict(runs=0, out=False)}
    order = ["B", "C", "D", "E", "F", "G", "A", "H", "I"]
    st["B"]["out"] = st["C"]["out"] = st["D"]["out"] = st["E"]["out"] = st["F"]["out"] = st["G"]["out"] = True
    st["A"]["out"] = True
    a = scripted("X", order, st, ["Z"], pad_to=240 if False else 120)
    b = scripted("Y", ["P", "Q"], {"P": dict(runs=0), "Q": dict(runs=0)}, ["Z"], pad_to=96)
    m = parse_match("m", doc("2024-01-01", ("X", "Y"), [a, b]))
    i0 = m["innings"][0]
    assert (i0["n30"], i0["n50"], i0["n100"], i0["n10"], i0["nsd"], i0["nduck"]) == (2, 2, 1, 5, 1, 1)
    assert m["q"] == 1  # exactly 96 balls in the second innings is enough (80% of 120)
    short = scripted("Y", ["P", "Q"], {"P": dict(runs=0), "Q": dict(runs=0)}, ["Z"], pad_to=95)
    m2 = parse_match("m", doc("2024-01-01", ("X", "Y"), [a, short]))
    assert m2["q"] == 0  # one ball short: void


def test_void_rules_odi_hundred_and_test():
    full = lambda n: {"balls": n}  # noqa: E731
    odi = {"fmt": 1, "overs": 50, "bpo": 6, "innings": [full(240), full(239)], "res": 0, "days": 1}
    assert qualifies(odi) == 0
    odi["innings"][1] = full(240)
    assert qualifies(odi) == 1
    hundred = {"fmt": 3, "overs": 20, "bpo": 5, "innings": [full(80), full(80)], "res": 0, "days": 1}
    assert qualifies(hundred) == 1
    hundred["innings"][1] = full(79)
    assert qualifies(hundred) == 0
    # Tests: a result is enough; a draw needs 300 overs (5-day) / 200 (4-day)
    test = {"fmt": 2, "overs": 0, "bpo": 6, "innings": [full(6 * 150), full(6 * 149)], "res": 3, "days": 5}
    assert qualifies(test) == 0
    test["innings"][1] = full(6 * 150)
    assert qualifies(test) == 1
    test.update(res=3, days=4, innings=[full(6 * 100), full(6 * 100)])
    assert qualifies(test) == 1
    test.update(res=0, innings=[full(6 * 10)])
    assert qualifies(test) == 1  # a result always counts


def test_hundred_is_its_own_format_and_first_class_is_ignored():
    inn = scripted("X", ["A", "B"], {"A": dict(runs=1), "B": dict(runs=0)}, ["Z"], pad_to=100)
    d = doc("2024-08-01", ("X", "Y"), [inn], mtype="T20", bpo=5)
    assert parse_match("h", d)["fmt"] == 3
    assert parse_match("f", doc("2024-08-01", ("X", "Y"), [inn], mtype="MDM")) is None
    assert synth.make_dataset()[1]["t20"][0]["id"] == "t20_00"


def test_playing_xi_includes_players_who_never_reached_the_crease():
    st = {"A": dict(runs=5, out=True), "B": dict(runs=0, out=False), "C": dict(runs=0, out=False)}
    a = scripted("X", ["A", "B", "C"], st, ["Z"], pad_to=60)
    b = scripted("Y", ["P", "Q"], {"P": dict(runs=0), "Q": dict(runs=0)}, ["Z"], pad_to=60)
    m = parse_match("m", doc("2024-01-01", ("X", "Y"), [a, b], xi_extra={"X": ["Benched DNB"]}))
    assert pid("Benched DNB") in m["xi"]            # named in the XI ...
    assert pid("Benched DNB") not in {r["pid"] for r in m["bat"]}   # ... but no batting row: a void bet


def test_squad_quality_flags_unreliable_xi_lists():
    from cricket_site.parse import squad_quality
    assert squad_quality([11, 11]) == 1 and squad_quality([12, 11]) == 1 and squad_quality([13, 13]) == 1   # impact subs named
    assert squad_quality([11]) == 0 and squad_quality([]) == 0                                              # list missing
    assert squad_quality([11, 8]) == 0 and squad_quality([15, 11]) == 0                                    # half a scorecard / a whole squad
    assert squad_quality([10, 10], lo=10) == 1 and squad_quality([9, 11], lo=10) == 0                       # scraped squads are stricter
