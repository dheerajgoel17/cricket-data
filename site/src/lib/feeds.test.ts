import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LINES_LIVE_MS, loadLines, newerLines } from "./feeds";

const doc = (at: string, extra: Record<string, unknown> = {}) => ({ generated_at_utc: at, lines: [{ pid: at }], events: [{ e: at }], fancy: [{ f: at }], ...extra });

describe("newerLines", () => {
  it("takes the live file when it is newer, or the same age", () => {
    expect(newerLines(doc("2026-10-28T08:00:00Z"), doc("2026-10-28T09:00:00Z")).lines[0].pid).toBe("2026-10-28T09:00:00Z");
    expect(newerLines(doc("2026-10-28T08:00:00Z", { lines: [{ pid: "bundle" }] }), doc("2026-10-28T08:00:00Z", { lines: [{ pid: "live" }] })).lines[0].pid).toBe("live");
  });
  it("keeps the bundled file when the live one is older or missing", () => {
    expect(newerLines(doc("2026-10-28T09:00:00Z"), doc("2026-10-28T08:00:00Z")).lines[0].pid).toBe("2026-10-28T09:00:00Z");
    expect(newerLines(doc("2026-10-28T09:00:00Z"), null).lines[0].pid).toBe("2026-10-28T09:00:00Z");
  });
  it("uses the live file alone when there is no bundle, and an empty book when there is neither", () => {
    expect(newerLines(null, doc("2026-10-28T09:00:00Z")).lines).toHaveLength(1);
    expect(newerLines(null, null)).toEqual({ lines: [], events: [], fancy: [] });
  });
  it("lets a live file from before `events` and `fancy` existed keep the bundled lists", () => {
    const { events: _e, fancy: _f, ...old } = doc("2026-10-28T09:00:00Z"); // eslint-disable-line @typescript-eslint/no-unused-vars
    const d = newerLines(doc("2026-10-28T08:00:00Z"), old);
    expect(d.lines[0].pid).toBe("2026-10-28T09:00:00Z");
    expect(d.events).toEqual([{ e: "2026-10-28T08:00:00Z" }]);
    expect(d.fancy).toEqual([{ f: "2026-10-28T08:00:00Z" }]);
  });
});

describe("loadLines", () => {
  const BUNDLE = doc("2026-10-28T08:00:00Z"), FRESH = doc("2026-10-28T09:00:00Z");
  type Pending = { url: string; resolve: (d: unknown) => void; aborted: boolean };
  let pending: Pending[];
  beforeEach(() => {
    vi.useFakeTimers();
    pending = [];
    vi.stubGlobal("fetch", (url: string, init?: { signal?: AbortSignal }) => new Promise((resolve, reject) => {
      const p: Pending = { url, aborted: false, resolve: (d) => resolve({ ok: d != null, json: async () => d }) };
      init?.signal?.addEventListener("abort", () => { p.aborted = true; reject(new DOMException("aborted", "AbortError")); });
      pending.push(p);
    }));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  const at = (part: string) => pending.find((p) => p.url.includes(part))!;

  it("asks for the bundled file and the live one at the same time, not the live one after the bundle", () => {
    void loadLines();
    expect(pending).toHaveLength(2); // both requests are out before either has answered
    expect(at("/data/lines.json")).toBeDefined();
    expect(at("book_lines.json")).toBeDefined();
  });
  it("answers with the newer of the two", async () => {
    const r = loadLines();
    at("/data/lines.json").resolve(BUNDLE);
    at("book_lines.json").resolve(FRESH);
    expect((await r).generated_at_utc).toBe(FRESH.generated_at_utc);
  });
  it("gives up on a slow live file after LINES_LIVE_MS and goes with the bundle", async () => {
    let out: any = null;
    void loadLines().then((d) => { out = d; });
    at("/data/lines.json").resolve(BUNDLE);
    await vi.advanceTimersByTimeAsync(LINES_LIVE_MS - 100);
    expect(out).toBeNull(); // still waiting for the live file
    await vi.advanceTimersByTimeAsync(200);
    expect(at("book_lines.json").aborted).toBe(true);
    expect(out.generated_at_utc).toBe(BUNDLE.generated_at_utc);
  });
  it("does not wait for the live file longer than it would have waited alone (the bundle is slow, the live file quick)", async () => {
    const r = loadLines();
    at("book_lines.json").resolve(FRESH);
    await vi.advanceTimersByTimeAsync(1000);
    at("/data/lines.json").resolve(BUNDLE);
    expect((await r).generated_at_utc).toBe(FRESH.generated_at_utc);
  });
  it("is an empty book when neither file can be read", async () => {
    const r = loadLines();
    at("/data/lines.json").resolve(null);
    at("book_lines.json").resolve(null);
    expect(await r).toEqual({ lines: [], events: [], fancy: [] });
  });
});
