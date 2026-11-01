import { buildRail, fixtureState } from "@/lib/rail";

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
