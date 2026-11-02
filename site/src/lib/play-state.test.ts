import { describe, expect, it } from "vitest";
import { playState } from "./play-state";

const NOW = Date.parse("2026-11-01T10:30:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3600e3).toISOString().slice(0, 16) + "Z";
const fx = (over: Record<string, unknown> = {}) => ({ a: "Eagles", b: "Tuskers", fmt: "T20", start: hoursAgo(3), status: "Started", ...over });
const feed = (status: string, scores = false) => ({ status, teams: [{ name: "Eagles", display: scores ? "151/4" : "" }, { name: "Tuskers", display: "" }] });
const stateOf = (f: any, match: any = null) => playState(f, match, NOW).state;

describe("playState", () => {
  it("1 Nov 2026: a priced match the schedule and the live feed do not list is started, never live, with no score", () => {
    // Eagles v Tuskers and Mid West Rhinos v Mountaineers: begun at 07:30, three hours ago, the builder publishes Started
    expect(playState(fx(), null, NOW)).toEqual({ state: "started", hasScore: false });
    expect(playState(fx({ a: "Mid West Rhinos", b: "Mountaineers", fmt: "" }), null, NOW)).toEqual({ state: "started", hasScore: false });
  });
  it("stays started for as long as the builder publishes it, not only for the clock's four hours", () => {
    expect(stateOf(fx({ start: hoursAgo(20) }))).toBe("started");
    expect(stateOf(fx({ fmt: "Test", start: hoursAgo(72) }))).toBe("started");
  });
  it("is live on evidence only: a score, the live feed's word or the schedule's own Live", () => {
    expect(playState(fx(), feed("live", true), NOW)).toEqual({ state: "live", hasScore: true });
    expect(stateOf(fx(), feed("live"))).toBe("live");
    expect(stateOf(fx({ status: "Live" }))).toBe("live");
  });
  it("is never live on the clock: a started time with the schedule behind is started", () => {
    expect(stateOf(fx({ status: "Upcoming", start: hoursAgo(1) }))).toBe("started");
    expect(stateOf(fx({ status: "Upcoming", start: hoursAgo(5) }))).toBe("upcoming"); // long past the clock window, no word at all: not claimed as anything
  });
  it("is delayed when the live feed lists the match as not started although its time has passed", () => {
    expect(stateOf(fx({ status: "Upcoming", start: hoursAgo(1) }), feed("upcoming"))).toBe("delayed");
    expect(stateOf(fx({ status: "Started" }), feed("upcoming"))).toBe("delayed");
  });
  it("is final on a result: the live feed's, or the schedule's Completed", () => {
    expect(stateOf(fx(), feed("final"))).toBe("final");
    expect(stateOf(fx({ status: "Completed", result: "Eagles won by 4 wickets" }))).toBe("final");
  });
  it("is upcoming before the start, and for a date-only start", () => {
    expect(stateOf(fx({ status: "Upcoming", start: new Date(NOW + 3600e3).toISOString().slice(0, 16) + "Z" }))).toBe("upcoming");
    expect(stateOf(fx({ status: "Upcoming", start: "2026-11-01" }))).toBe("upcoming");
  });
});
