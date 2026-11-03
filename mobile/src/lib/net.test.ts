// MMKV is a native module; in a unit test a Map stands in for it.
jest.mock("react-native-mmkv", () => {
  const m = new Map<string, string>();
  return { createMMKV: () => ({ getString: (k: string) => m.get(k), set: (k: string, v: string) => void m.set(k, v), remove: (k: string) => m.delete(k) }) };
});

import { wrap } from "@cricket/engine/wrap.js";
import { getJson } from "@/lib/net";

type Call = { url: string; headers: Record<string, string> };
const calls: Call[] = [];
const res = (status: number, body: string, headers: Record<string, string> = {}) => ({
  status, ok: status >= 200 && status < 300, text: async () => body, json: async () => JSON.parse(body),
  headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
});

let files: Record<string, { etag: string; body: string }> = {};
beforeEach(() => {
  calls.length = 0;
  (globalThis as any).fetch = jest.fn(async (url: string, init: { headers: Record<string, string> }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    calls.push({ url, headers: init.headers });
    if (url.endsWith("/api/gate")) return res(200, "ok", { "x-cd-k": "the-secret", "set-cookie": "cdg=abc; Path=/" });
    const f = files[url.replace(/^.*?(\/(?:data|api)\/.*)$/, "$1")];
    if (!f) return res(404, "{}");
    return init.headers["if-none-match"] === f.etag ? res(304, "") : res(200, f.body, { etag: f.etag });
  });
});

describe("getJson keeps what it reads", () => {
  test("a plain file is read once; the next ask is conditional and a 304 returns the kept copy", async () => {
    files = { "/data/plain.json": { etag: '"v1"', body: JSON.stringify({ a: [1, 2, 3] }) } };
    expect(await getJson("/data/plain.json")).toEqual({ a: [1, 2, 3] });
    expect(await getJson("/data/plain.json")).toEqual({ a: [1, 2, 3] });
    const asks = calls.filter((c) => c.url.endsWith("/data/plain.json"));
    expect(asks).toHaveLength(2);
    expect(asks[0].headers["if-none-match"]).toBeUndefined();
    expect(asks[1].headers["if-none-match"]).toBe('"v1"');
  });

  test("a wrapped file is unwrapped once and kept decoded", async () => {
    const obj = { names: ["Ñandú", "日本"], n: 5 };
    files = { "/data/wrapped.json": { etag: '"w1"', body: JSON.stringify(await wrap(obj, "the-secret", new Uint8Array(16).fill(9))) } };
    expect(await getJson("/data/wrapped.json")).toEqual(obj);
    expect(await getJson("/data/wrapped.json")).toEqual(obj);
    expect(calls.filter((c) => c.url.endsWith("/data/wrapped.json"))[1].headers["if-none-match"]).toBe('"w1"');
  });

  test("a changed file (a new ETag) is downloaded again and replaces the kept copy", async () => {
    files = { "/data/changing.json": { etag: '"a"', body: '{"v":1}' } };
    expect(await getJson("/data/changing.json")).toEqual({ v: 1 });
    files["/data/changing.json"] = { etag: '"b"', body: '{"v":2}' };
    expect(await getJson("/data/changing.json")).toEqual({ v: 2 });
    expect(await getJson("/data/changing.json")).toEqual({ v: 2 });
  });

  test("a failed request throws", async () => {
    files = {};
    await expect(getJson("/data/missing.json")).rejects.toThrow("HTTP 404");
  });
});
