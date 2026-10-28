import { describe, expect, it } from "vitest";
import { byShard, dayOffset, hotLines, hotOrder, pool } from "./hot-lines";

// local clock times, so the tests hold in any time zone
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();
const iso = (d: number, h: number, m = 0) => new Date(at(d, h, m)).toISOString();
const NOW = at(28, 12); // Wed 28 Oct, noon
const line = (pid: string, match: string, start: string, over: Record<string, unknown> = {}) => ({ pid, match, start_utc: start, stat: "runs", fmt: "T20", line: 20.5, books: [{ over: 1.9 }], ...over });

describe("dayOffset", () => {
  it("is 0 for today and 1 for tomorrow, in the viewer's own days, and -1 for any other day", () => {
    expect(dayOffset(iso(28, 0, 5), NOW)).toBe(0);
    expect(dayOffset(iso(28, 23, 55), NOW)).toBe(0);
    expect(dayOffset(iso(29, 0, 5), NOW)).toBe(1);
    expect(dayOffset(iso(29, 23, 55), NOW)).toBe(1);
    expect(dayOffset(iso(30, 9), NOW)).toBe(-1);
    expect(dayOffset(iso(27, 20), NOW)).toBe(-1);
  });
});

describe("hotLines", () => {
  const lines = [
    line("a", "India vs Pakistan", iso(28, 19)),            // today
    line("b", "India vs Pakistan", iso(28, 19), { stat: "sixes" }),
    line("c", "Namibia vs Oman", iso(29, 9)),               // tomorrow
    line("d", "Fiji vs Samoa", iso(31, 9)),                 // in three days
    line("e", "Chile vs Peru", iso(27, 4)),                 // yesterday, not today or tomorrow
    line("f", "Peru vs Chile", iso(28, 19), { books: [] }),  // not priced
    line("g", "Peru vs Chile", "", {}),                      // no start
    line("h", "Italy vs Malta", iso(28, 3)),                 // today, 9 h ago: still today's
  ];
  const pids = (ls: any[]) => ls.map((l) => l.pid);

  it("takes one day's priced lines and no others", () => {
    expect(pids(hotLines(lines, { day: 0 }, NOW))).toEqual(["a", "b", "h"]);
    expect(pids(hotLines(lines, { day: 1 }, NOW))).toEqual(["c"]);
  });
  it("is never the whole book, however many days it holds (the home used to score every upcoming line)", () => {
    const many = Array.from({ length: 50 }, (_, i) => line(`p${i}`, "X vs Y", iso(29 + (i % 20), 9)));
    expect(hotLines(many, { day: 0 }, NOW)).toHaveLength(0);
    expect(hotLines(many, { day: 1 }, NOW).length).toBeLessThan(many.length / 10);
  });
  it("takes a fixture page's own two sides, in either order and with (W) ignored", () => {
    const ls = [line("a", "India vs Pakistan", iso(28, 19)), line("b", "Pakistan vs India", iso(29, 10)), line("c", "India Women vs Pakistan Women", iso(28, 5)), line("d", "India vs Nepal", iso(28, 19)), line("x", "India vs Pakistan", iso(20, 19))];
    expect(pids(hotLines(ls, { teams: ["India", "Pakistan"], archive: false }, NOW))).toEqual(["a", "b", "c"]); // the old x is past the age window
    expect(pids(hotLines(ls, { teams: ["India", "Pakistan"], archive: true }, NOW))).toEqual(["a", "b", "c", "x"]); // an archived match is read whatever its age
  });
});

describe("byShard", () => {
  const ids = ["p0", "p1", "p2", "p3", "p4", "p5"];
  const indexOf = (pid: string) => ids.indexOf(pid);
  const shardOf = (i: number) => i % 3; // p0,p3 -> 0; p1,p4 -> 1; p2,p5 -> 2
  const ls = (...p: string[]) => p.map((pid) => ({ pid }));
  it("groups the lines by the file their player is in, the file with the most lines first", () => {
    const g = byShard(ls("p1", "p0", "p4", "p3", "p1", "p2"), indexOf, shardOf);
    expect(g.map((x) => [x.shard, x.lines.map((l) => l.pid)])).toEqual([[1, ["p1", "p4", "p1"]], [0, ["p0", "p3"]], [2, ["p2"]]]);
  });
  it("breaks a tie by file number and leaves out players the data does not know", () => {
    const g = byShard(ls("p2", "p0", "ghost"), indexOf, shardOf);
    expect(g.map((x) => x.shard)).toEqual([0, 2]);
    expect(g.flatMap((x) => x.lines).map((l) => l.pid)).not.toContain("ghost");
  });
  it("needs no file for no lines", () => { expect(byShard([], indexOf, shardOf)).toEqual([]); });
});

describe("pool", () => {
  it("runs every item, at most n at a time, and starts the next as soon as one finishes", async () => {
    let running = 0, peak = 0;
    const done: number[] = [];
    await pool([1, 2, 3, 4, 5, 6, 7], 3, async (x) => { running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, x % 2 ? 5 : 1)); running--; done.push(x); });
    expect(peak).toBe(3);
    expect([...done].sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it("copes with no items and with fewer items than slots", async () => {
    await pool([], 8, async () => { throw new Error("never"); });
    const seen: number[] = [];
    await pool([1, 2], 8, async (x) => { seen.push(x); });
    expect(seen).toEqual([1, 2]);
  });
});

describe("hotOrder", () => {
  type K = { id: string; live: boolean; p: number | null; edge: number | null };
  const row = (id: string, live: boolean, p: number | null, edge: number | null = null): K => ({ id, live, p, edge });
  const order = (rows: K[]) => [...rows].sort(hotOrder).map((r) => r.id);

  it("puts a row of a match in play above a row of another match with a higher hit rate", () => {
    expect(order([row("pre-90", false, 0.9), row("live-60", true, 0.6)])).toEqual(["live-60", "pre-90"]);
  });
  it("orders two rows in play by hit rate, and two others by hit rate", () => {
    expect(order([row("live-50", true, 0.5), row("pre-80", false, 0.8), row("live-70", true, 0.7), row("pre-60", false, 0.6)])).toEqual(["live-70", "live-50", "pre-80", "pre-60"]);
  });
  it("breaks a tie on hit rate by the edge, a row with no edge last", () => {
    expect(order([row("none", false, 0.7, null), row("low", false, 0.7, 0.01), row("high", false, 0.7, 0.2)])).toEqual(["high", "low", "none"]);
    expect(order([row("live-low", true, 0.7, 0.01), row("live-high", true, 0.7, 0.2), row("pre", false, 0.9, 0.5)])).toEqual(["live-high", "live-low", "pre"]);
  });
  it("puts a row with no hit rate after those with one", () => {
    expect(order([row("none", false, null), row("some", false, 0.1)])).toEqual(["some", "none"]);
  });
});
