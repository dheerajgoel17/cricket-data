import { cardModel } from "@/lib/card";

const NOW = Date.parse("2026-11-01T10:00:00Z");
const at = (hours: number) => new Date(NOW + hours * 3600e3).toISOString();
const fixture = (o: Record<string, unknown> = {}) => ({ id: "x", a: "India", b: "New Zealand", fmt: "T20", gender: "male", series: "", status: "", result: "", start: at(-1), ...o });
const team = (name: string, display: string, runs: number, wkts: number, overs: number) => ({ name, abbr: name.slice(0, 3).toUpperCase(), display, runs, wkts, overs });
const both = [team("India", "191/8 (20.0 ov)", 191, 8, 20), team("New Zealand", "162/2 (14.4 ov)", 162, 2, 14.4)];

describe("cardModel", () => {
  test("a match in play with scores", () => {
    const m = cardModel({ fixture: fixture(), live: { status: "live", summary: "NZ need 30 runs in 32 balls", teams: both } }, NOW);
    expect(m).toMatchObject({ live: true, final: false, delayed: false, hasScore: true, status: "NZ need 30 runs in 32 balls", session: "" });
    expect(m.sides.map((s) => s.lost)).toEqual([false, false]);
    expect(m.sides[0].score.runs).toBe(191);
  });

  test("a finished match: the side that lost steps back", () => {
    const m = cardModel({ fixture: fixture(), live: { status: "final", summary: "India won by 29 runs", teams: both } }, NOW);
    expect(m).toMatchObject({ live: false, final: true });
    expect(m.sides.map((s) => s.lost)).toEqual([false, true]);
  });

  test("a match three hours away says when it starts", () => {
    const m = cardModel({ fixture: fixture({ start: at(3) }), live: null }, NOW);
    expect(m).toMatchObject({ live: false, final: false, delayed: false, timed: true, status: "Starts in 3h" });
  });

  test("the feed says upcoming although the start has passed: delayed, not in play", () => {
    const m = cardModel({ fixture: fixture({ start: at(-0.5) }), live: { status: "upcoming", teams: [] } }, NOW);
    expect(m).toMatchObject({ delayed: true, live: false, status: "Start delayed" });
  });

  test("a Test at stumps shows the session", () => {
    const m = cardModel({ fixture: fixture({ fmt: "Test", start: at(-30) }), live: { status: "live", summary: "Day 3: Stumps - Australia lead by 40 runs", teams: both } }, NOW);
    expect(m).toMatchObject({ live: true, session: "Stumps" });
  });

  test("a date with no clock time is to be confirmed", () => {
    const m = cardModel({ fixture: fixture({ start: "2026-11-05" }), live: null }, NOW);
    expect(m).toMatchObject({ timed: false, status: "Start time to be confirmed" });
  });

  test("a finished fixture the feed does not have shows its result", () => {
    const m = cardModel({ fixture: fixture({ start: at(-20), status: "Completed", result: "Ireland won by 4 wickets" }), live: null }, NOW);
    expect(m).toMatchObject({ final: true, status: "Ireland won by 4 wickets" });
  });
});
