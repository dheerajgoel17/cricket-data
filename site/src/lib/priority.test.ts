import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_RAIL, arrangeFixtures, fixtureScore, homeTeam, rankFixtures, sanitizeRail } from "./priority";

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
  it("keeps a series together: today's result sits next to that series' next game, not behind every other upcoming card", () => {
    const now = Date.parse("2026-10-30T12:00:00Z");
    const heat = fx("Brisbane Heat Women", "Sydney Sixers Women", { series: "WBBL 2026", start: "2026-10-30T08:10:00Z" });
    const strikers = fx("Adelaide Strikers Women", "Melbourne Stars Women", { series: "WBBL 2026", start: "2026-10-31T08:10:00Z" });
    const india = fx("India", "New Zealand", { series: "IND vs NZ 2026", start: "2026-11-01T00:00:00Z" });
    const stateOf = (f: any) => (f.a.startsWith("Brisbane") ? "final" : "upcoming");
    expect(arrangeFixtures([india, strikers, heat], stateOf, null, DEFAULT_RAIL, now).map((f) => f.a)).toEqual(["India", "Brisbane Heat Women", "Adelaide Strikers Women"]);
  });
  it("puts a series in play ahead of other series, and today's remaining game ahead of a finished one in the same series", () => {
    const now = Date.parse("2026-10-30T12:00:00Z");
    const live = fx("South Africa", "Australia", { series: "AUS vs SA 2026", start: "2026-10-27T08:00:00Z", fmt: "Test" });
    const next = fx("Brampton Blazers", "Vancouver Guardians", { series: "Global T20 2026", start: "2026-10-30T14:00:00Z" });
    const done = fx("Montreal Warriors", "Toronto Nationals", { series: "Global T20 2026", start: "2026-10-30T08:00:00Z" });
    const stateOf = (f: any) => (f.a === "South Africa" ? "live" : f.a === "Brampton Blazers" ? "upcoming" : "final");
    expect(arrangeFixtures([done, next, live], stateOf, null, DEFAULT_RAIL, now).map((f) => f.a)).toEqual(["South Africa", "Brampton Blazers", "Montreal Warriors"]);
  });
  it("puts every match in play first, then the ones to come, then finished ones, and keeps the start order on a tie", () => {
    expect(order("india", (f: any) => (f.a === "New Zealand" ? "final" : "upcoming")).at(-1)).toBe("New Zealand v India");
    // a small match in play still leads the biggest one to come
    const o = order("india", (f: any) => (f.a === "Namibia" ? "live" : f.a === "New Zealand" ? "final" : "upcoming"));
    expect(o[0]).toBe("Namibia v Ireland");
    expect(o.at(-1)).toBe("New Zealand v India");
    expect(o[1]).toBe("Pakistan v Sri Lanka");
    // inside the group in play the viewer's team still leads
    expect(order("india", (f: any) => (["Namibia", "New Zealand"].includes(f.a) ? "live" : "upcoming")).slice(0, 2)).toEqual(["New Zealand v India", "Namibia v Ireland"]);
    expect(rankFixtures([fx("Spain", "Italy"), fx("France", "Germany")], null).map((f) => f.a)).toEqual(["Spain", "France"]);
  });
  it("counts women's, youth and A sides for less, and big tournaments for more", () => {
    expect(fixtureScore(fx("India", "Australia", { gender: "female" }), null)).toBeLessThan(fixtureScore(fx("India", "Australia"), null));
    expect(fixtureScore(fx("India U19", "Australia U19"), null)).toBeLessThan(fixtureScore(fx("Ireland", "Scotland"), null));
    expect(fixtureScore(fx("Ireland", "Scotland", { series: "T20 World Cup 2026" }), null)).toBeGreaterThan(fixtureScore(fx("Ireland", "Scotland"), null));
  });
});

describe("the published settings", () => {
  const live = (f: any) => (f.a === "Namibia" ? "live" : "upcoming");
  it("the file in the repo says what the built-in settings say", () => {
    const file = JSON.parse(readFileSync(resolve(process.cwd(), "../config/home_rail.json"), "utf8"));
    expect(sanitizeRail(file)).toEqual(DEFAULT_RAIL);
    expect(file.standing).toEqual(DEFAULT_RAIL.standing);
    expect(file.region).toEqual(DEFAULT_RAIL.region);
  });
  it("changes the order without a code change: group order, a standing, a bonus, a tournament", () => {
    const upcomingFirst = sanitizeRail({ tiers: ["upcoming", "live", "final"] });
    expect(rankFixtures(today, "india", live, upcomingFirst)[0].a).toBe("New Zealand");
    const boosted = sanitizeRail({ standing: { namibia: 500 } });
    expect(rankFixtures(today, null, undefined, boosted)[0].a).toBe("Namibia");
    expect(fixtureScore(fx("India", "Australia"), "india", sanitizeRail({ bonus: { home: 0 } }))).toBe(195);
    expect(fixtureScore(fx("Ireland", "Scotland", { series: "Tri-Series Cup" }), null, sanitizeRail({ bigEvent: ["tri series"] }))).toBe(95);
  });
  it("keeps the built-in value for anything missing, mistyped or out of range, and reads nothing else", () => {
    expect(sanitizeRail(null)).toBe(DEFAULT_RAIL);
    expect(sanitizeRail("nope")).toBe(DEFAULT_RAIL);
    const odd = sanitizeRail({ tiers: ["final", "bogus", "final"], standing: { india: "high", Pakistan: 5, nepal: 1e9, oman: -1, usa: 33 }, region: { india: 7, oman: "asia" }, bonus: { home: NaN, region: "30", event: 5 }, bigEvent: [3, "", "x".repeat(61), "ipl"], extra: { evil: true } });
    expect(odd.tiers).toEqual(["final", "live", "upcoming"]); // an unknown group is dropped and the missing ones follow in the built-in order
    expect(odd.standing.india).toBe(100);
    expect(odd.standing.pakistan).toBe(85);
    expect(odd.standing.nepal).toBe(20);
    expect(odd.standing.oman).toBe(20);
    expect(odd.standing.usa).toBe(33);
    expect(odd.region.india).toBe("asia");
    expect(odd.region.oman).toBe("asia");
    expect(odd.bonus).toEqual({ home: 100, homeWomen: 50, region: 30, event: 5 });
    expect(odd.bigEvent).toEqual(["ipl"]);
    expect("extra" in odd).toBe(false);
  });
  it("matches a tournament by whole words, so 'ipl' is not found inside 'triple'", () => {
    expect(fixtureScore(fx("Ireland", "Scotland", { series: "Triple Crown Cup" }), null)).toBe(fixtureScore(fx("Ireland", "Scotland"), null));
    expect(fixtureScore(fx("Ireland", "Scotland", { series: "Indian Premier League 2026" }), null)).toBe(fixtureScore(fx("Ireland", "Scotland"), null) + 30);
  });
});
