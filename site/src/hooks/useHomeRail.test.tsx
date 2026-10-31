/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const feeds = vi.hoisted(() => ({ lines: null as any, live: null as any, rail: null as any, fixtures: null as any, liveCalls: 0 }));
vi.mock("@/lib/feeds", () => ({ loadLines: () => feeds.lines.promise, loadLive: () => { feeds.liveCalls++; return feeds.live.promise; }, loadRail: () => feeds.rail.promise, loadArchive: async () => null }));
vi.mock("@/lib/data", () => ({ useData: () => ({ store: { loadFixtures: () => feeds.fixtures.promise, teams: [] }, rz: {}, identity: {} }) }));

import { LIVE_CACHE_MS, saveLive } from "@/lib/live-cache";
import { FINISHED_KEEP_MS, LIVE_WAIT_MS, RAIL_WAIT_MS, SHOW_AHEAD_MS, keepFinished, useHomeRail } from "./useHomeRail";
import { usePricedFixtures } from "./useEngine";
import { useLiveDoc } from "./useLive";

const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; };
const NOW = Date.parse("2026-10-28T06:00:00Z");
const fx = (a: string, b: string, h: number, extra: Record<string, unknown> = {}) => ({ id: `${a}${b}`.replace(/\s/g, ""), a, b, fmt: "T20", gender: "male", series: "", start: new Date(NOW + h * 3600e3).toISOString(), ...extra });
const line = (match: string, h: number) => ({ match, start_utc: new Date(NOW + h * 3600e3).toISOString(), pid: "p", stat: "runs", fmt: "T20", line: 20.5, books: [{ over: 1.9 }] });
// three priced matches and one the books do not price; India v Australia is the biggest, then Pakistan v Sri Lanka, then Namibia v Oman
const SCHEDULE = [fx("Namibia", "Oman", 1), fx("Pakistan", "Sri Lanka", 2), fx("India", "Australia", 3), fx("Fiji", "Samoa", 4)];
const BOOK = { generated_at_utc: "2026-10-28T05:00:00Z", lines: [line("Namibia vs Oman", 1), line("Pakistan vs Sri Lanka", 2), line("India vs Australia", 3)], events: [], fancy: [] };
const names = (r: { current: { fixtures: any[] } }) => r.current.fixtures.filter((f) => !f.noProps).map((f) => `${f.a} v ${f.b}`); // the games with props; the ones without follow them
const unpriced = (r: { current: { fixtures: any[] } }) => r.current.fixtures.filter((f) => f.noProps).map((f) => `${f.a} v ${f.b}`);
/** A live feed body in which these sides' matches (given as [a, b, hours from NOW, status]) are listed. */
const kept = (body: unknown, ageMs = 60e3) => saveLive(body, NOW - ageMs); // saved a minute ago, so stale by the live query's 15 s
const liveBody = (...ms: [string, string, number, string][]) => ({ matches: ms.map(([a, b, h, status]) => ({ status, start: new Date(NOW + h * 3600e3).toISOString(), teams: [{ name: a }, { name: b }] })) });

function run() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  return renderHook(() => ({ rail: useHomeRail(), priced: usePricedFixtures() }), { wrapper });
}
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const wait = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  feeds.lines = deferred(); feeds.live = deferred(); feeds.rail = deferred(); feeds.fixtures = deferred();
  feeds.liveCalls = 0;
  localStorage.clear();
});
afterEach(() => { vi.useRealTimers(); });

describe("keepFinished", () => {
  const at = (h: number, extra: Record<string, unknown> = {}) => ({ a: `m${h}`, start: new Date(NOW + h * 3600e3).toISOString(), fmt: "T20", ...extra });
  it("keeps a finished T20 for 24 hours, newest first", () => {
    expect(keepFinished([at(-20), at(-2), at(-16)], NOW).map((f) => f.a)).toEqual(["m-2", "m-16", "m-20"]);
  });
  it("drops a T20 after 24 hours, and keeps a Test for 6 days", () => {
    expect(FINISHED_KEEP_MS).toBe(24 * 3600e3);
    expect(keepFinished([at(-20), at(-25), at(-2)], NOW).map((f) => f.a)).toEqual(["m-2", "m-20"]);
    expect(keepFinished([at(-48, { a: "Test", fmt: "Test" }), at(-25)], NOW).map((f) => f.a)).toEqual(["Test"]);
  });
});

describe("useHomeRail", () => {
  it("shows nothing while the bookmaker lines are out, rather than the whole unpriced schedule", async () => {
    const { result } = run();
    feeds.fixtures.resolve(SCHEDULE); feeds.rail.resolve(null); feeds.live.resolve({ matches: [] });
    await flush();
    expect(result.current.priced.ready).toBe(false);
    expect(result.current.priced.fixtures).toEqual([]);
    expect(result.current.rail.ready).toBe(false);
    expect(names({ current: result.current.rail })).toEqual([]);
    feeds.lines.resolve(BOOK);
    await flush();
    expect(result.current.rail.ready).toBe(true);
    expect(names({ current: result.current.rail })).toEqual(["India v Australia", "Pakistan v Sri Lanka", "Namibia v Oman"]); // Fiji v Samoa, which the books do not price, follows them flagged noProps
    expect(unpriced({ current: result.current.rail })).toEqual(["Fiji v Samoa"]);
  });

  it("still lists the whole schedule when the books turn out to price nothing, once it knows", async () => {
    const { result } = run();
    feeds.fixtures.resolve(SCHEDULE); feeds.rail.resolve(null); feeds.live.resolve({ matches: [] });
    feeds.lines.resolve({ generated_at_utc: "x", lines: [], events: [], fancy: [] });
    await flush();
    expect(result.current.rail.ready).toBe(true);
    expect(result.current.rail.fixtures).toHaveLength(4);
  });

  it("waits for the rail settings and the live scores, so the first order is the final one", async () => {
    const { result } = run();
    feeds.fixtures.resolve(SCHEDULE); feeds.lines.resolve(BOOK);
    await flush();
    expect(result.current.rail.ready).toBe(false); // the schedule and the lines are in; the rail file and the live scores are not
    // the rail file raises Namibia v Oman to the top; the live feed has Pakistan v Sri Lanka in play
    feeds.rail.resolve({ standing: { namibia: 1000 } });
    feeds.live.resolve({ matches: [{ status: "live", start: new Date(NOW + 2 * 3600e3).toISOString(), teams: [{ name: "Pakistan" }, { name: "Sri Lanka" }] }] });
    await flush();
    expect(result.current.rail.ready).toBe(true);
    expect(names({ current: result.current.rail })).toEqual(["Pakistan v Sri Lanka", "Namibia v Oman", "India v Australia"]);
  });

  it("paints with what it has once the caps are up, and puts a match in play first when the live scores land late", async () => {
    const { result } = run();
    feeds.fixtures.resolve(SCHEDULE); feeds.lines.resolve(BOOK); feeds.rail.resolve(null);
    await flush();
    expect(result.current.rail.ready).toBe(false);
    await wait(LIVE_WAIT_MS + 50); // the live function is slow
    expect(result.current.rail.ready).toBe(true);
    expect(names({ current: result.current.rail })).toEqual(["India v Australia", "Pakistan v Sri Lanka", "Namibia v Oman"]);
    feeds.live.resolve(liveBody(["Namibia", "Oman", 1, "live"]));
    await flush();
    expect(names({ current: result.current.rail })).toEqual(["Namibia v Oman", "India v Australia", "Pakistan v Sri Lanka"]);
  });

  it("gives the rail file less time than the live scores", () => { expect(RAIL_WAIT_MS).toBeLessThan(LIVE_WAIT_MS); });

  it("shows a priced match 9 days out and drops one on day 11", async () => {
    expect(SHOW_AHEAD_MS).toBe(10 * 86400e3);
    const far = [fx("Namibia", "Oman", 9 * 24), fx("India", "Australia", 11 * 24)];
    const farBook = { generated_at_utc: "x", lines: [line("Namibia vs Oman", 9 * 24), line("India vs Australia", 11 * 24)], events: [], fancy: [] };
    const { result } = run();
    feeds.fixtures.resolve(far); feeds.lines.resolve(farBook); feeds.rail.resolve(null); feeds.live.resolve({ matches: [] });
    await flush();
    expect(names({ current: result.current.rail })).toEqual(["Namibia v Oman"]);
  });

  it("ranks a match in play first as soon as the live state is known, ahead of a bigger match to come", async () => {
    const { result } = run();
    feeds.fixtures.resolve(SCHEDULE); feeds.lines.resolve(BOOK); feeds.rail.resolve(null);
    feeds.live.resolve(liveBody(["Namibia", "Oman", 1, "live"])); // the smallest match, in play
    await flush();
    expect(names({ current: result.current.rail })[0]).toBe("Namibia v Oman");
  });

  describe("with the last live body kept on the device", () => {
    it("is already in order on the first paint, before the fresh body is back", async () => {
      kept(liveBody(["Namibia", "Oman", 1, "live"]));
      const { result } = run();
      feeds.fixtures.resolve(SCHEDULE); feeds.lines.resolve(BOOK); feeds.rail.resolve(null);
      await flush(); // /api/live has not answered: its promise is still open
      expect(result.current.rail.ready).toBe(true);
      expect(names({ current: result.current.rail })[0]).toBe("Namibia v Oman");
    });

    it("re-sorts when the fresh body changes a match's state: one has ended, another has gone live", async () => {
      kept(liveBody(["Namibia", "Oman", 1, "live"]));
      const { result } = run();
      feeds.fixtures.resolve(SCHEDULE); feeds.lines.resolve(BOOK); feeds.rail.resolve(null);
      await flush();
      expect(names({ current: result.current.rail })).toEqual(["Namibia v Oman", "India v Australia", "Pakistan v Sri Lanka"]);
      feeds.live.resolve(liveBody(["Namibia", "Oman", 1, "final"], ["Pakistan", "Sri Lanka", 2, "live"]));
      await flush();
      expect(names({ current: result.current.rail })).toEqual(["Pakistan v Sri Lanka", "India v Australia", "Namibia v Oman"]);
    });

    it("leaves the order as it was when the fresh body changes nothing", async () => {
      kept(liveBody(["Namibia", "Oman", 1, "live"]));
      const { result } = run();
      feeds.fixtures.resolve(SCHEDULE); feeds.lines.resolve(BOOK); feeds.rail.resolve(null);
      await flush();
      const before = result.current.rail.fixtures;
      feeds.live.resolve(liveBody(["Namibia", "Oman", 1, "live"]));
      await flush();
      expect(names({ current: result.current.rail })).toEqual(before.filter((f: any) => !f.noProps).map((f: any) => `${f.a} v ${f.b}`));
    });

    it("does not use a body that is too old to be trusted (a match may have started or ended since)", async () => {
      kept(liveBody(["Namibia", "Oman", 1, "live"]), LIVE_CACHE_MS + 1000);
      const { result } = run();
      feeds.fixtures.resolve(SCHEDULE); feeds.lines.resolve(BOOK); feeds.rail.resolve(null);
      await flush();
      expect(result.current.rail.ready).toBe(false); // waits for the live scores like a first visit
    });

    it("is the live query's starting point, counted as stale so the fresh body is asked for", async () => {
      kept(liveBody(["Namibia", "Oman", 1, "live"]));
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
      const { result } = renderHook(() => useLiveDoc(), { wrapper });
      expect(result.current.data?.matches).toHaveLength(1); // there on the very first render
      await flush();
      expect(feeds.liveCalls).toBe(1);
    });
  });
});
