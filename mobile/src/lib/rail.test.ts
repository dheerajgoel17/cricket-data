import { buildRail, fixtureState, phaseView, seriesChips, type RailItem } from "@/lib/rail";

const NOW = Date.parse("2026-11-01T10:00:00Z");
const at = (hours: number) => new Date(NOW + hours * 3600e3).toISOString();
const fx = (id: string, a: string, b: string, hours: number, o: Record<string, unknown> = {}) => ({ id, a, b, fmt: "T20", gender: "male", series: "", status: "", result: "", start: at(hours), ...o });
const books = (...m: [string, number][]) => ({ lines: [], fancy: [], events: m.map(([match, hours]) => ({ match, start_utc: at(hours), fmt: "T20" })) });
const noBooks = { lines: [], fancy: [], events: [] };
const ids = (r: { fixture: { id: string } }[]) => r.map((x) => x.fixture.id);

const fixtures = [
  fx("ind-nz", "India", "New Zealand", 3),
  fx("pak-sl", "Pakistan", "Sri Lanka", -1, { status: "Live" }),
  fx("ire-nam", "Ireland", "Namibia", -10, { status: "Completed", result: "Ireland won by 4 wickets" }),
];

describe("buildRail", () => {
  test("in play first, then what starts soon, then finished", () => {
    const r = buildRail({ fixtures, lines: noBooks, live: null, now: NOW });
    expect(ids(r)).toEqual(["pak-sl", "ind-nz", "ire-nam"]);
    expect(r.map((x) => x.state)).toEqual(["live", "upcoming", "final"]);
  });

  test("the live feed's word beats the schedule's", () => {
    const live = { matches: [{ status: "live", fmt: "T20", start: at(3), teams: [{ name: "India" }, { name: "New Zealand" }] }] };
    const r = buildRail({ fixtures, lines: noBooks, live, now: NOW });
    expect(r.map((x) => x.state)).toEqual(["live", "live", "final"]);
    expect(r[0].fixture.id).toBe("ind-nz"); // India v New Zealand outranks Pakistan v Sri Lanka by standing (100 + 80 against 85 + 70)
    expect(r[0].live?.teams).toHaveLength(2);
  });

  test("the viewer's own team leads its group", () => {
    const two = [fx("a", "Pakistan", "Sri Lanka", 2), fx("b", "India", "New Zealand", 3)];
    expect(ids(buildRail({ fixtures: two, lines: noBooks, live: null, home: "pakistan", now: NOW }))).toEqual(["a", "b"]);
    expect(ids(buildRail({ fixtures: two, lines: noBooks, live: null, home: null, now: NOW }))).toEqual(["b", "a"]);
  });

  test("games the books price come first; an unpriced game in the next days follows, flagged", () => {
    const two = [fx("pak-sl", "Pakistan", "Sri Lanka", 30), fx("ind-nz", "India", "New Zealand", 5)];
    const r = buildRail({ fixtures: two, lines: books(["India vs New Zealand", 5]), live: null, now: NOW });
    expect(ids(r)).toEqual(["ind-nz", "pak-sl"]);
    expect(r.map((x) => x.noProps)).toEqual([false, true]);
  });

  test("a finished game older than a day leaves the rail when other games are on", () => {
    const old = [...fixtures, fx("old", "Australia", "England", -30, { status: "Completed", result: "Australia won" }), fx("later", "Ireland", "Scotland", 6)];
    expect(ids(buildRail({ fixtures: old, lines: noBooks, live: null, now: NOW }))).not.toContain("old");
  });
});

describe("a started match (begun, no word that play is on)", () => {
  const begun = fx("eag-tus", "Eagles", "Tuskers", -3, { status: "Started" });

  test("fixtureState says started, never live, from the schedule's Started", () => {
    expect(fixtureState(begun, undefined, NOW)).toBe("started");
    expect(fixtureState(begun, "live", NOW)).toBe("live"); // the live feed's word wins
  });

  test("it keeps its place among the matches in play and counts under In play", () => {
    const r = buildRail({ fixtures: [begun, ...fixtures], lines: books(["Eagles vs Tuskers", -3], ["India vs New Zealand", 3], ["Pakistan vs Sri Lanka", -1]), live: null, now: NOW });
    expect(ids(r)).toContain("eag-tus");
    expect(r.find((x) => x.fixture.id === "eag-tus")?.state).toBe("started");
    expect(phaseView(r).counts.live).toBe(2); // Pakistan v Sri Lanka (Live) and Eagles v Tuskers (Started)
  });

  test("it stays on the rail past the twelve-hour window, as a match in play does", () => {
    const old = fx("old", "Eagles", "Tuskers", -20, { status: "Started" });
    expect(ids(buildRail({ fixtures: [old], lines: books(["Eagles vs Tuskers", -20]), live: null, now: NOW }))).toEqual(["old"]);
  });
});

describe("fixtureState", () => {
  test("a Test at the close of a day, with no result, is still on", () => {
    expect(fixtureState(fx("t", "South Africa", "Australia", -30, { fmt: "Test", status: "Completed" }), undefined, NOW)).toBe("live");
  });
  test("a Test with its result is final", () => {
    expect(fixtureState(fx("t", "South Africa", "Australia", -30, { fmt: "Test", status: "Completed", result: "Australia won by 5 wickets" }), undefined, NOW)).toBe("final");
  });
  test("a limited-overs game marked Completed is final", () => {
    expect(fixtureState(fx("t", "India", "Pakistan", -5, { status: "Completed" }), undefined, NOW)).toBe("final");
  });
});

describe("phaseView", () => {
  const item = (id: string, state: RailItem["state"], noProps = false): RailItem => ({ fixture: { id }, state, live: null, noProps });
  const items = [item("a", "live"), item("b", "live"), item("c", "upcoming"), item("d", "final"), item("e", "upcoming", true), item("f", "live", true)];

  test("counts are of priced games only", () => {
    expect(phaseView(items).counts).toEqual({ live: 2, pre: 1, final: 1 });
  });
  test("with no tap it opens In play when anything is on", () => {
    const v = phaseView(items);
    expect(v.phase).toBe("live");
    expect(v.shown.map((i) => i.fixture.id)).toEqual(["a", "b"]); // the unpriced game that the schedule calls live is not under In play
  });
  test("games with no props yet are listed under Pre-match", () => {
    expect(phaseView(items, "pre").shown.map((i) => i.fixture.id)).toEqual(["c", "e", "f"]);
  });
  test("an empty In play opens Pre-match", () => {
    expect(phaseView([item("c", "upcoming"), item("d", "final")]).phase).toBe("pre");
  });
});


describe("seriesChips", () => {
  const item = (series: string, noProps = false) => ({ fixture: { series }, state: "upcoming", live: null, noProps }) as unknown as RailItem;
  const names = (items: RailItem[]) => seriesChips(items, (f) => f.series).map(([n]) => n);

  test("a series with props comes before one without, even when the one without has more matches", () => {
    const items = [item("Big League", true), item("Big League", true), item("Big League", true), item("Small Cup")];
    expect(names(items)).toEqual(["Small Cup", "Big League"]);
    expect(seriesChips(items, (f) => f.series)).toEqual([["Small Cup", 1], ["Big League", 3]]);
  });

  test("among series with props, more priced matches first, then more matches listed, then name", () => {
    const items = [item("B"), item("B"), item("A"), item("A"), item("A", true), item("C"), item("D", true)];
    // priced: B 2, A 2, C 1, D 0; A has 3 listed against B's 2
    expect(names(items)).toEqual(["A", "B", "C", "D"]);
  });

  test("equal on everything falls back to the name", () => {
    expect(names([item("Zed"), item("Alpha")])).toEqual(["Alpha", "Zed"]);
  });
});
