/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const feeds = vi.hoisted(() => ({ lines: null as any, live: null as any, rail: null as any, fixtures: null as any }));
vi.mock("@/lib/feeds", () => ({ loadLines: () => feeds.lines.promise, loadLive: () => feeds.live.promise, loadRail: () => feeds.rail.promise, loadArchive: async () => null }));
vi.mock("@/lib/data", () => ({ useData: () => ({ store: { loadFixtures: () => feeds.fixtures.promise, teams: [] }, rz: {}, identity: {} }) }));

import { LIVE_WAIT_MS, RAIL_WAIT_MS, useHomeRail } from "./useHomeRail";
import { usePricedFixtures } from "./useEngine";

const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; };
const NOW = Date.parse("2026-10-28T06:00:00Z");
const fx = (a: string, b: string, h: number, extra: Record<string, unknown> = {}) => ({ id: `${a}${b}`.replace(/\s/g, ""), a, b, fmt: "T20", gender: "male", series: "", start: new Date(NOW + h * 3600e3).toISOString(), ...extra });
const line = (match: string, h: number) => ({ match, start_utc: new Date(NOW + h * 3600e3).toISOString(), pid: "p", stat: "runs", fmt: "T20", line: 20.5, books: [{ over: 1.9 }] });
// three priced matches and one the books do not price; India v Australia is the biggest, then Pakistan v Sri Lanka, then Namibia v Oman
const SCHEDULE = [fx("Namibia", "Oman", 1), fx("Pakistan", "Sri Lanka", 2), fx("India", "Australia", 3), fx("Fiji", "Samoa", 4)];
const BOOK = { generated_at_utc: "2026-10-28T05:00:00Z", lines: [line("Namibia vs Oman", 1), line("Pakistan vs Sri Lanka", 2), line("India vs Australia", 3)], events: [], fancy: [] };
const names = (r: { current: { fixtures: any[] } }) => r.current.fixtures.map((f) => `${f.a} v ${f.b}`);

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
});
afterEach(() => { vi.useRealTimers(); });

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
    expect(names({ current: result.current.rail })).toEqual(["India v Australia", "Pakistan v Sri Lanka", "Namibia v Oman"]); // the unpriced Fiji v Samoa was never there
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

  it("paints with what it has once the caps are up, and keeps the cards where they are when the live scores land late", async () => {
    const { result } = run();
    feeds.fixtures.resolve(SCHEDULE); feeds.lines.resolve(BOOK); feeds.rail.resolve(null);
    await flush();
    expect(result.current.rail.ready).toBe(false);
    await wait(LIVE_WAIT_MS + 50); // the live function is slow
    expect(result.current.rail.ready).toBe(true);
    const before = names({ current: result.current.rail });
    expect(before).toEqual(["India v Australia", "Pakistan v Sri Lanka", "Namibia v Oman"]);
    // the live feed arrives: Namibia v Oman is in play. Ranked afresh it would lead; the card that is on screen keeps its seat
    feeds.live.resolve({ matches: [{ status: "live", start: new Date(NOW + 1 * 3600e3).toISOString(), teams: [{ name: "Namibia" }, { name: "Oman" }] }] });
    await flush();
    expect(names({ current: result.current.rail })).toEqual(before);
  });

  it("gives the rail file less time than the live scores", () => { expect(RAIL_WAIT_MS).toBeLessThan(LIVE_WAIT_MS); });

  it("ranks afresh when the tab is back after being away", async () => {
    const { result } = run();
    feeds.fixtures.resolve(SCHEDULE); feeds.lines.resolve(BOOK); feeds.rail.resolve(null);
    await wait(LIVE_WAIT_MS + 50);
    feeds.live.resolve({ matches: [{ status: "live", start: new Date(NOW + 1 * 3600e3).toISOString(), teams: [{ name: "Namibia" }, { name: "Oman" }] }] });
    await flush();
    expect(names({ current: result.current.rail })[0]).toBe("India v Australia");
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(names({ current: result.current.rail })[0]).toBe("Namibia v Oman");
  });
});
