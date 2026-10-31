/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ doc: null as any, store: null as any, plans: [] as any[] }));
vi.mock("@/lib/feeds", () => ({ loadLines: async () => env.doc, loadLive: async () => null, loadRail: async () => null, loadArchive: async () => null }));
vi.mock("@/lib/data", () => ({ useData: () => ({ store: env.store, rz: {}, identity: {} }) }));
vi.mock("@/engine/plan.js", () => ({
  runPlan: async (_s: any, _r: any, _p: any, hints: any) => {
    env.plans.push(hints.playerIdx);
    try { await env.store.shard(env.store.shardOf(hints.playerIdx)); } catch (e: any) { return { ok: false, error: `Could not run that query: ${e.message}` }; } // as the engine does for a player file that will not load
    return { ok: true, chart: { entries: Array.from({ length: 10 }, (_, k) => ({ value: 10 + k * 3, date: `2026-0${(k % 9) + 1}-10`, opp: "Somebody" })) }, summary: { pOver: 0.6, n: 10 } };
  },
}));

import { useHotRows } from "./hot-props";

const at = (d: number, h: number) => new Date(2026, 9, d, h).toISOString();
const NOW = new Date(2026, 9, 28, 12).getTime();
const line = (pid: string, start: string, match = "India vs Pakistan") => ({ pid, match, start_utc: start, team: "India", stat: "runs", fmt: "T20", line: 20.5, books: [{ over: 1.9, under: 1.9 }] });

/** A store whose player files are fetched by hand: `requested` is the files asked for so far, `land(n)` lets file n arrive (also before it is asked for), `fail(n)` makes it fail. */
function fakeStore(players: number, nshard: number) {
  const requested: number[] = [], fate = new Map<number, "land" | "fail">(), pending = new Map<number, [() => void, (e: Error) => void]>(), shards = new Map<number, Promise<unknown>>();
  const finish = (n: number) => { const how = fate.get(n); if (how && pending.has(n)) how === "land" ? pending.get(n)![0]() : pending.get(n)![1](new Error("HTTP 500")); };
  return {
    P: { id: Array.from({ length: players }, (_, i) => `id${i}`) }, nshard,
    shardOf: (i: number) => i % nshard, playerName: (i: number) => `Player ${i}`,
    shard(n: number) {
      if (!shards.has(n)) { requested.push(n); shards.set(n, new Promise((res, rej) => pending.set(n, [() => res({}), rej]))); finish(n); }
      return shards.get(n)!;
    },
    requested, land: (n: number) => { fate.set(n, "land"); finish(n); }, fail: (n: number) => { fate.set(n, "fail"); finish(n); },
  };
}

function run(day = 0, teams?: [string, string]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  return renderHook((p: { day: number }) => useHotRows(undefined, teams, p.day), { wrapper, initialProps: { day } });
}
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(2000); });
const landAll = () => { for (let n = 0; n < 12; n++) env.store.land(n); };

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["setTimeout", "clearTimeout", "Date"] });
  env.plans = [];
  // 60 players over 12 files; today has players 0-35 (three to a file), tomorrow 36-37, and a third day 22 more lines scored only when that day is asked
  env.store = fakeStore(60, 12);
  env.doc = { generated_at_utc: "2026-10-28T05:00:00Z", events: [], fancy: [], lines: [
    ...Array.from({ length: 36 }, (_, i) => line(`id${i}`, at(28, 19))),
    line("id36", at(29, 9)), line("id37", at(29, 9)),
    ...Array.from({ length: 22 }, (_, i) => line(`id${38 + i}`, at(31, 9))),
  ] };
});
afterEach(() => { vi.useRealTimers(); });

describe("useHotRows", () => {
  it("asks for the player files the selected day's lines need, several at once (not one after the other)", async () => {
    const { result } = run(0);
    await flush();
    expect(env.store.requested).toEqual([0, 1, 2, 3, 4, 5, 6, 7]); // eight files in flight before any has landed
    env.store.land(0);
    await flush();
    expect(env.store.requested).toHaveLength(9); // a free slot starts the next file
    landAll();
    await settle();
    expect([...env.store.requested].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(result.current.data).toHaveLength(36);
    expect(result.current.scoring).toBe(false);
  });

  it("runs the engine for no line of another day (it runs once per line, so this is where the time went)", async () => {
    const { result } = run(0);
    await flush();
    landAll();
    await settle();
    expect([...env.plans].sort((a, b) => a - b)).toEqual(Array.from({ length: 36 }, (_, i) => i)); // today's 36 players and nobody else
    expect(result.current.data!.every((r) => r.day === 0)).toBe(true);
  });

  it("scores tomorrow only when asked, as a query of its own, and still counts today's lines so the day switch stays", async () => {
    const { result, rerender } = run(0);
    await flush();
    landAll();
    await settle();
    expect(env.plans).toHaveLength(36);
    rerender({ day: 1 });
    await flush();
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    await settle();
    expect(result.current.data!.map((r) => r.idx).sort((a, b) => a - b)).toEqual([36, 37]);
    expect(result.current.otherDay).toBe(58); // today's 36 plus the third day's 22, counted so the day switch stays
  });

  it("puts the rows on screen while the last files are still on their way, once there is a page of them", async () => {
    const { result } = run(0);
    await flush();
    expect(result.current.isLoading).toBe(true);
    for (const n of [3, 4, 5]) env.store.land(n); // nine rows: not yet a page
    await settle();
    expect(result.current.isLoading).toBe(true);
    for (const n of [0, 1, 2, 6, 7, 8, 9, 10]) env.store.land(n); // 33 rows, file 11 still out
    await settle();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.scoring).toBe(true);
    expect(result.current.data!.length).toBeGreaterThanOrEqual(30);
    expect(result.current.data!.length).toBeLessThan(36);
    env.store.land(11);
    await settle();
    expect(result.current.data).toHaveLength(36);
    expect(result.current.scoring).toBe(false);
  });

  it("a fixture page scores just its own match", async () => {
    env.doc.lines.push(line("id20", at(28, 19), "England vs Australia"), line("id21", at(28, 19), "England vs Australia"));
    const { result } = run(0, ["England", "Australia"]);
    await flush();
    landAll();
    await settle();
    expect([...env.plans].sort()).toEqual([20, 21]);
    expect(result.current.data).toHaveLength(2);
  });

  it("loses only the rows of a file that will not load", async () => {
    const { result } = run(0);
    await flush();
    env.store.fail(2);
    for (let n = 0; n < 12; n++) if (n !== 2) env.store.land(n);
    await settle();
    expect(result.current.isError).toBe(false);
    expect(result.current.data!.map((r) => r.idx)).not.toContain(2);
    expect(result.current.data).toHaveLength(33); // file 2 held players 2, 14 and 26
  });
});
