import { describe, expect, it } from "vitest";
import { DEFAULTS, activeFilters, clearFilter, narrow, options, order, parseScreener, screenerParams, screenerQuery } from "./screener";

const hit = (p: number | null, played = 10) => ({ p, played, hits: Math.round((p ?? 0) * played) });
const row = (o: any) => ({ fmt: "T20", team: "India", comp: "IPL", stat: "runs", edge: 0.05, over: 1.9, l10: hit(0.7), l5: hit(0.6, 5), season: hit(0.5), h2h: hit(null, 0), ven: hit(0.4, 2), live: false, ...o });

describe("screener URL state", () => {
  it("a plain URL is the default and the default writes no query", () => {
    expect(parseScreener(new URLSearchParams(""))).toEqual(DEFAULTS);
    expect(screenerQuery(DEFAULTS)).toBe("");
  });
  it("round-trips every filter", () => {
    const s = { ...DEFAULTS, stat: "wickets", win: "l5" as const, day: "2", match: "m1", team: "India", fmt: "ODI", comp: "IPL", min: 70, value: true, inns: "second" as const, sort: "edge" as const, bars: false };
    expect(parseScreener(screenerParams(s))).toEqual(s);
  });
  it("reads the batting innings and ignores an unknown one", () => {
    expect(parseScreener(new URLSearchParams("inns=first")).inns).toBe("first");
    expect(parseScreener(new URLSearchParams("inns=third")).inns).toBe("all");
    expect(activeFilters({ ...DEFAULTS, inns: "second" })).toEqual([{ key: "inns", label: "Batting", value: "Chasing" }]);
  });
  it("ignores values it does not know instead of breaking", () => {
    const s = parseScreener(new URLSearchParams("win=zzz&sort=nope&day=abc&min=33&bars=0"));
    expect(s).toMatchObject({ win: "l10", sort: "hit", day: "0", min: 0, bars: false });
  });
});

describe("active filters and clearing", () => {
  it("lists only what differs from the default, never the stat rail", () => {
    expect(activeFilters({ ...DEFAULTS, stat: "runs" })).toEqual([]);
    const a = activeFilters({ ...DEFAULTS, day: "1", min: 60, value: true }, { day: () => "Tomorrow" });
    expect(a.map((x) => `${x.label}:${x.value}`)).toEqual(["Day:Tomorrow", "Hit rate:60%+", "Edge:positive"]);
  });
  it("clears one filter, or all of them", () => {
    const s = { ...DEFAULTS, stat: "runs", team: "India", min: 70 };
    expect(clearFilter(s, "team")).toEqual({ ...s, team: "all" });
    expect(clearFilter(s, "all")).toEqual(DEFAULTS);
  });
});

describe("narrowing and ordering rows", () => {
  const rows = [row({ id: 1 }), row({ id: 2, fmt: "ODI", team: "Australia", comp: "ODI series", edge: -0.02, l10: hit(0.9) }), row({ id: 3, comp: "", l10: hit(null, 0), edge: null })];
  it("filters by format, team, competition", () => {
    expect(narrow(rows, { ...DEFAULTS, fmt: "ODI" }).map((r: any) => r.id)).toEqual([2]);
    expect(narrow(rows, { ...DEFAULTS, team: "australia" }).map((r: any) => r.id)).toEqual([2]);
    expect(narrow(rows, { ...DEFAULTS, comp: "IPL" }).map((r: any) => r.id)).toEqual([1]);
  });
  it("a minimum hit rate drops rows with no sample rather than guessing", () => {
    expect(narrow(rows, { ...DEFAULTS, min: 70 }).map((r: any) => r.id)).toEqual([1, 2]);
    expect(narrow(rows, { ...DEFAULTS, min: 80 }).map((r: any) => r.id)).toEqual([2]);
  });
  it("value-only keeps positive edges", () => { expect(narrow(rows, { ...DEFAULTS, value: true }).map((r: any) => r.id)).toEqual([1]); });
  it("orders by the chosen sort with a live match first", () => {
    expect(order(rows, DEFAULTS).map((r: any) => r.id)).toEqual([2, 1, 3]);
    expect(order(rows, { ...DEFAULTS, sort: "edge" }).map((r: any) => r.id)).toEqual([1, 2, 3].sort((a, b) => [0, 0.05, -0.02, -Infinity][b] - [0, 0.05, -0.02, -Infinity][a]));
    expect(order([...rows, row({ id: 4, live: true, l10: hit(0.1) })], DEFAULTS)[0]).toMatchObject({ id: 4 });
    expect(order([row({ id: 5, over: 1.5 }), row({ id: 6, over: 3 })], { ...DEFAULTS, sort: "price" }).map((r: any) => r.id)).toEqual([6, 5]);
  });
  it("offers only values the rows have, most common first", () => {
    expect(options(rows, "fmt")).toEqual(["T20", "ODI"]);
    expect(options(rows, "comp")).toEqual(["IPL", "ODI series"]);
  });
});
