import { describe, expect, it } from "vitest";
import { fixtureScore, homeTeam, rankFixtures } from "./priority";

const fx = (a: string, b: string, extra: Record<string, unknown> = {}) => ({ a, b, fmt: "ODI", gender: "male", series: "", ...extra });
// today's list, in the order the schedule gives it
const today = [
  fx("Namibia", "Ireland"), fx("Netherlands", "Oman"), fx("Pakistan", "Sri Lanka"), fx("South Africa", "Australia", { fmt: "Test" }),
  fx("New Zealand", "India", { fmt: "T20" }), fx("Afghanistan", "Zimbabwe", { fmt: "T20" }), fx("Bangladesh", "West Indies", { fmt: "Test" }),
  fx("India Women", "Zimbabwe Women", { gender: "female" }),
];
const order = (home: string | null, stateOf?: any) => rankFixtures(today, home, stateOf).map((f) => `${f.a} v ${f.b}`);

describe("where the viewer is", () => {
  it("reads the time zone first, then the language", () => {
    expect(homeTeam("Asia/Kolkata", "en-US")).toBe("india");
    expect(homeTeam("Australia/Perth", "en-US")).toBe("australia");
    expect(homeTeam("America/New_York", "en-PK")).toBe("pakistan");
    expect(homeTeam("America/New_York", "en-US")).toBeNull();
  });
});

describe("fixture order", () => {
  it("leads with the viewer's own team, then the biggest matches, then their part of the world", () => {
    expect(order("india").slice(0, 5)).toEqual(["New Zealand v India", "Pakistan v Sri Lanka", "South Africa v Australia", "Bangladesh v West Indies", "India Women v Zimbabwe Women"]);
    expect(order("india").slice(-2)).toEqual(["Namibia v Ireland", "Netherlands v Oman"]);
  });
  it("changes with the viewer", () => {
    expect(order("pakistan")[0]).toBe("Pakistan v Sri Lanka");
    expect(order("australia")[0]).toBe("South Africa v Australia");
    expect(order(null).slice(0, 2)).toEqual(["South Africa v Australia", "New Zealand v India"]); // nobody's team: by standing alone
  });
  it("lifts a match in play, sinks a finished one, keeps the start order on a tie", () => {
    expect(order("india", (f: any) => (f.a === "New Zealand" ? "final" : "upcoming")).at(-1)).toBe("New Zealand v India");
    expect(fixtureScore(fx("India", "Australia"), null, "live")).toBeGreaterThan(fixtureScore(fx("India", "Australia"), null));
    expect(rankFixtures([fx("Spain", "Italy"), fx("France", "Germany")], null).map((f) => f.a)).toEqual(["Spain", "France"]);
  });
  it("counts women's, youth and A sides for less, and big tournaments for more", () => {
    expect(fixtureScore(fx("India", "Australia", { gender: "female" }), null)).toBeLessThan(fixtureScore(fx("India", "Australia"), null));
    expect(fixtureScore(fx("India U19", "Australia U19"), null)).toBeLessThan(fixtureScore(fx("Ireland", "Scotland"), null));
    expect(fixtureScore(fx("Ireland", "Scotland", { series: "T20 World Cup 2026" }), null)).toBeGreaterThan(fixtureScore(fx("Ireland", "Scotland"), null));
  });
});
