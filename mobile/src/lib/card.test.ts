import { NO_SCORE, cardModel, playState } from "@/lib/card";

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

describe("playState (mirrors the site's play-state tests)", () => {
  const started = (o: Record<string, unknown> = {}) => fixture({ status: "Started", start: at(-3), ...o });
  const feed = (status: string, scores = false) => ({ status, teams: [{ name: "India", display: scores ? "151/4" : "" }, { name: "New Zealand", display: "" }] });
  const stateOf = (f: any, match: any = null) => playState(f, match, NOW).state;

  test("a priced match no source lists is started, never live, with no score", () => {
    expect(playState(started(), null, NOW)).toEqual({ state: "started", hasScore: false });
    const m = cardModel({ fixture: started(), live: null }, NOW);
    expect(m).toMatchObject({ live: false, started: true, final: false, delayed: false, hasScore: false, status: NO_SCORE });
  });

  test("it stays started for as long as the builder publishes it, a Test for days", () => {
    expect(stateOf(started({ start: at(-20) }))).toBe("started");
    expect(stateOf(started({ fmt: "Test", start: at(-72) }))).toBe("started");
  });

  test("live needs evidence: a score, the live feed's word, or the schedule's own Live", () => {
    expect(playState(started(), feed("live", true), NOW)).toEqual({ state: "live", hasScore: true });
    expect(stateOf(started(), feed("live"))).toBe("live");
    expect(stateOf(started({ status: "Live" }))).toBe("live");
  });

  test("the clock alone never makes a match live: a start that has passed with the schedule behind is started", () => {
    expect(stateOf(fixture({ status: "Upcoming", start: at(-1) }))).toBe("started");
    expect(stateOf(fixture({ status: "Upcoming", start: at(-5) }))).toBe("upcoming"); // long past the clock's four hours, no word at all
  });

  test("delayed when the feed lists the match as not started although its time has passed", () => {
    expect(stateOf(fixture({ status: "Upcoming", start: at(-1) }), feed("upcoming"))).toBe("delayed");
  });
});
