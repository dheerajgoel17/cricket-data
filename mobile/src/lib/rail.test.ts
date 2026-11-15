import { buildRail, fixtureState, phaseView, type RailItem } from "@/lib/rail";

const NOW = Date.parse("2026-11-01T10:00:00Z");
const at = (hours: number) => new Date(NOW + hours * 3600e3).toISOString();
const fx = (id: string, a: string, b: string, hours: number, o: Record<string, unknown> = {}) => ({ id, a, b, fmt: "T20", gender: "male", series: "", status: "", result: "", start: at(hours), ...o });
const books = (...m: [string, number][]) => ({ lines: [], fancy: [], events: m.map(([match, hours]) => ({ match, start_utc: at(hours), fmt: "T20" })) });
const noBooks = { lines: [], fancy: [], events: [] };
const ids = (r: { fixture: { id: string } }[]) => r.map((x) => x.fixture.id);
/** Live/board body with team totals so a started match can stay on the rail. */
const scored = (...rows: [string, string, number, string?, number?, number?][]) => ({
  matches: rows.map(([a, b, hours, status = "live", runs = 120, wkts = 2]) => ({
    status, fmt: "T20", start: at(hours),
    teams: [{ name: a, runs, wkts, display: `${runs}/${wkts}` }, { name: b, display: "" }],
  })),
});

const fixtures = [
  fx("ind-nz", "India", "New Zealand", 3),
  fx("pak-sl", "Pakistan", "Sri Lanka", -1, { status: "Live" }),
  fx("ire-nam", "Ireland", "Namibia", -10, { status: "Completed", result: "Ireland won by 4 wickets" }),
];
const FIXTURE_BOOKS = books(["India vs New Zealand", 3], ["Pakistan vs Sri Lanka", -1], ["Ireland vs Namibia", -10]);
const FIXTURE_LIVE = scored(["Pakistan", "Sri Lanka", -1, "live"], ["Ireland", "Namibia", -10, "final", 180, 6]);

describe("buildRail", () => {
  test("empty book feed → empty rail (no source-only fallback)", () => {
    expect(ids(buildRail({ fixtures, lines: noBooks, live: null, now: NOW }))).toEqual([]);
  });

  test("in play first, then what starts soon, then finished — started/final need scores", () => {
    const r = buildRail({ fixtures, lines: FIXTURE_BOOKS, live: FIXTURE_LIVE, now: NOW });
    expect(ids(r)).toEqual(["pak-sl", "ind-nz", "ire-nam"]);
    expect(r.map((x) => x.state)).toEqual(["live", "upcoming", "final"]);
  });

  test("priced live/final without team totals stay off the rail", () => {
    // Schedule says Live/Completed but no live/board totals → only upcoming India remains.
    expect(ids(buildRail({ fixtures, lines: FIXTURE_BOOKS, live: null, now: NOW }))).toEqual(["ind-nz"]);
  });

  test("the live feed's word beats the schedule's", () => {
    const live = scored(["India", "New Zealand", 3, "live"], ["Pakistan", "Sri Lanka", -1, "live"], ["Ireland", "Namibia", -10, "final", 180, 6]);
    const r = buildRail({ fixtures, lines: FIXTURE_BOOKS, live, now: NOW });
    expect(r.map((x) => x.state)).toEqual(["live", "live", "final"]);
    expect(r[0].fixture.id).toBe("ind-nz"); // India v New Zealand outranks Pakistan v Sri Lanka by standing (100 + 80 against 85 + 70)
    expect(r[0].live?.teams).toHaveLength(2);
  });

  test("the viewer's own team leads its group", () => {
    const two = [fx("a", "Pakistan", "Sri Lanka", 2), fx("b", "India", "New Zealand", 3)];
    const lines = books(["Pakistan vs Sri Lanka", 2], ["India vs New Zealand", 3]);
    expect(ids(buildRail({ fixtures: two, lines, live: null, home: "pakistan", now: NOW }))).toEqual(["a", "b"]);
    expect(ids(buildRail({ fixtures: two, lines, live: null, home: null, now: NOW }))).toEqual(["b", "a"]);
  });

  test("source-only games stay off the rail even when they start soon", () => {
    const two = [fx("pak-sl", "Pakistan", "Sri Lanka", 30), fx("ind-nz", "India", "New Zealand", 5)];
    const r = buildRail({ fixtures: two, lines: books(["India vs New Zealand", 5]), live: null, now: NOW });
    expect(ids(r)).toEqual(["ind-nz"]);
    expect(r.every((x) => !x.noProps)).toBe(true);
  });

  test("a finished game older than a day leaves the rail when other games are on", () => {
    const old = [...fixtures, fx("old", "Australia", "England", -30, { status: "Completed", result: "Australia won" }), fx("later", "Ireland", "Scotland", 6)];
    const lines = books(["India vs New Zealand", 3], ["Pakistan vs Sri Lanka", -1], ["Ireland vs Namibia", -10], ["Australia vs England", -30], ["Ireland vs Scotland", 6]);
    const live = scored(["Pakistan", "Sri Lanka", -1], ["Ireland", "Namibia", -10, "final", 180, 6], ["Australia", "England", -30, "final", 200, 5]);
    expect(ids(buildRail({ fixtures: old, lines, live, now: NOW }))).not.toContain("old");
  });
});

describe("a started match (begun, no word that play is on)", () => {
  const begun = fx("eag-tus", "Eagles", "Tuskers", -3, { status: "Started" });

  test("fixtureState says started, never live, from the schedule's Started", () => {
    expect(fixtureState(begun, undefined, NOW)).toBe("started");
    expect(fixtureState(begun, "live", NOW)).toBe("live"); // the live feed's word wins
  });

  test("without scores it stays off; with scores it counts under In play", () => {
    const lines = books(["Eagles vs Tuskers", -3], ["India vs New Zealand", 3], ["Pakistan vs Sri Lanka", -1]);
    expect(ids(buildRail({ fixtures: [begun, ...fixtures], lines, live: null, now: NOW }))).not.toContain("eag-tus");
    const live = scored(["Eagles", "Tuskers", -3, "live"], ["Pakistan", "Sri Lanka", -1]);
    const r = buildRail({ fixtures: [begun, ...fixtures], lines, live, now: NOW });
    expect(ids(r)).toContain("eag-tus");
    expect(r.find((x) => x.fixture.id === "eag-tus")?.state).toBe("live"); // live feed word
    expect(phaseView(r).counts.live).toBe(2);
  });

  test("it stays on the rail past the twelve-hour window when scores are present", () => {
    const old = fx("old", "Eagles", "Tuskers", -20, { status: "Started" });
    const live = scored(["Eagles", "Tuskers", -20]);
    expect(ids(buildRail({ fixtures: [old], lines: books(["Eagles vs Tuskers", -20]), live, now: NOW }))).toEqual(["old"]);
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
    expect(v.shown.map((i) => i.fixture.id)).toEqual(["a", "b"]);
  });
  test("noProps rows stay out of every phase (including Pre-match)", () => {
    expect(phaseView(items, "pre").shown.map((i) => i.fixture.id)).toEqual(["c"]);
  });
  test("an empty In play opens Pre-match", () => {
    expect(phaseView([item("c", "upcoming"), item("d", "final")]).phase).toBe("pre");
  });
});
