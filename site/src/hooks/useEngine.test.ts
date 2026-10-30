import { describe, expect, it } from "vitest";
import { fixtureState, shownFixtures } from "./useEngine";

const at = (iso: string) => Date.parse(iso);
const f = (start: string, over: Record<string, unknown> = {}) => ({ start, a: "A", b: "B", ...over });
const state = (x: any) => fixtureState(x, x.live);
const ids = (xs: any[]) => xs.map((x) => x.a);

describe("fixtureState", () => {
  it("takes the live feed's word, else the schedule file's", () => {
    expect(fixtureState(f("2026-10-27T07:00Z"), "final")).toBe("final");
    expect(fixtureState(f("2026-10-27T07:00Z", { status: "Completed" }))).toBe("final");
    expect(fixtureState(f("2026-10-27T07:00Z", { status: "Live" }))).toBe("live");
    expect(fixtureState(f("2026-10-27T07:00Z", { status: "Completed" }), "live")).toBe("live");
    expect(fixtureState(f("2026-10-27T07:00Z"))).toBe("upcoming");
  });
});

describe("a Test between days", () => {
  it("is still on when the schedule says Completed with no result, and over once it has a result", () => {
    const now = Date.parse("2026-10-29T05:00:00Z");
    const test = { start: "2026-10-27T08:30Z", fmt: "Test", status: "Completed", result: "" };
    expect(fixtureState(test, undefined, now)).toBe("live");
    expect(fixtureState({ ...test, result: "AUS won by 5 wkts" }, undefined, now)).toBe("final");
    expect(fixtureState({ ...test, start: "2026-10-20T08:30Z" }, undefined, now)).toBe("final"); // a week on, it is long over
    expect(fixtureState({ ...test, fmt: "T20" }, undefined, now)).toBe("final");
  });
});

describe("shownFixtures", () => {
  const done = (a: string, start: string) => f(start, { a, status: "Completed" });
  const up = (a: string, start: string) => f(a === "" ? start : start, { a });

  it("keeps a completed match for 24 hours, even with plenty of matches lined up", () => {
    const now = at("2026-10-28T06:00:00Z"); // a T20 that began at 07:00 the day before: 23 hours on
    const busy = [done("IndiaNZ", "2026-10-27T07:00Z"), up("m1", "2026-10-28T08:00Z"), up("m2", "2026-10-28T11:00Z"), up("m3", "2026-10-28T14:00Z")];
    expect(ids(shownFixtures(busy, state, () => true, now))).toEqual(["IndiaNZ", "m1", "m2", "m3"]);
  });
  it("lets it go after 24 hours once three or more matches are lined up", () => {
    const now = at("2026-10-28T08:00:00Z"); // 25 hours on
    const busy = [done("IndiaNZ", "2026-10-27T07:00Z"), up("m1", "2026-10-28T09:00Z"), up("m2", "2026-10-28T11:00Z"), up("m3", "2026-10-28T14:00Z")];
    expect(ids(shownFixtures(busy, state, () => true, now))).toEqual(["m1", "m2", "m3"]);
  });
  it("lets it go after a day and a half once three or more matches are lined up", () => {
    const now = at("2026-10-29T09:00:00Z"); // 50 hours on
    const busy = [done("IndiaNZ", "2026-10-27T07:00Z"), up("m1", "2026-10-29T10:00Z"), up("m2", "2026-10-29T11:00Z"), up("m3", "2026-10-29T14:00Z")];
    expect(ids(shownFixtures(busy, state, () => true, now))).toEqual(["m1", "m2", "m3"]);
  });
  it("keeps it, up to 4 days, while fewer than three matches are lined up", () => {
    const now = at("2026-10-29T09:00:00Z");
    const quiet = [done("IndiaNZ", "2026-10-27T07:00Z"), up("m1", "2026-10-29T10:00Z"), up("m2", "2026-10-29T14:00Z")];
    expect(ids(shownFixtures(quiet, state, () => true, now))).toEqual(["IndiaNZ", "m1", "m2"]);
    expect(ids(shownFixtures([done("Old", "2026-10-24T07:00Z"), ...quiet.slice(1)], state, () => true, now))).toEqual(["m1", "m2"]); // 5 days is the limit
  });
  it("shows finished matches whether or not the books still price them, and only priced ones to come", () => {
    const now = at("2026-10-27T13:00:00Z");
    const mix = [done("Fin", "2026-10-27T07:00Z"), up("priced", "2026-10-27T15:00Z"), up("unpriced", "2026-10-27T16:00Z")];
    expect(ids(shownFixtures(mix, state, (x) => x.a !== "unpriced" && x.a !== "Fin", now))).toEqual(["priced", "Fin"].sort((p, q) => (p === "Fin" ? -1 : 1) - (q === "Fin" ? -1 : 1)));
  });
  it("keeps a finished Test for 6 days from its start, since it ends days after it began", () => {
    const now = at("2026-10-29T09:00:00Z"); // 2 days and a bit after the start
    const lined = [f("2026-10-29T10:00Z", { a: "m1" }), f("2026-10-29T11:00Z", { a: "m2" }), f("2026-10-29T14:00Z", { a: "m3" })];
    expect(ids(shownFixtures([f("2026-10-27T08:30Z", { a: "SAvAus", fmt: "Test", status: "Completed" }), ...lined], state, () => true, now))).toEqual(["SAvAus", "m1", "m2", "m3"]);
    expect(ids(shownFixtures([f("2026-10-27T08:30Z", { a: "T20", fmt: "T20", status: "Completed" }), ...lined], state, () => true, now))).toEqual(["m1", "m2", "m3"]);
  });
  it("keeps a match whose start has passed with no play yet (a delay) for 12 hours, then lets it go", () => {
    expect(shownFixtures([f("2026-10-29T01:00Z", { a: "Delayed" })], state, () => true, at("2026-10-29T09:00:00Z"))).toHaveLength(1); // 8 hours late
    expect(shownFixtures([f("2026-10-28T09:00Z", { a: "Gone" })], state, () => true, at("2026-10-29T09:00:00Z"))).toHaveLength(0); // a day late
  });
  it("keeps a match being played for as long as it runs (a Test) and drops an old unscored one", () => {
    const now = at("2026-10-29T09:00:00Z");
    expect(shownFixtures([f("2026-10-27T04:00Z", { a: "Test", fmt: "Test", live: "live" })], state, () => true, now)).toHaveLength(1);
    expect(shownFixtures([f("2026-10-27T04:00Z", { a: "Gone" })], state, () => true, now)).toHaveLength(0);
  });
});
