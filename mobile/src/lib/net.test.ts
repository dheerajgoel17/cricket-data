// MMKV is a native module; in a unit test a Map stands in for it.
jest.mock("react-native-mmkv", () => {
  const m = new Map<string, string>();
  return { createMMKV: () => ({ getString: (k: string) => m.get(k), set: (k: string, v: string) => void m.set(k, v), remove: (k: string) => m.delete(k) }) };
});

import { wrap } from "@cricket/engine/wrap.js";
import { getJson, hasKept, peekJson, setDataBuild } from "@/lib/net";

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

describe("the stats files are pinned to a data build", () => {
  const ask = (path: string) => calls.filter((c) => c.url.endsWith(path));
  afterEach(() => setDataBuild(undefined));

  test("under the same build a kept stats file is read from the device with no request", async () => {
    files = { "/data/p/07.json": { etag: '"p1"', body: JSON.stringify({ bat: [1] }) } };
    setDataBuild("b1");
    expect(await getJson("/data/p/07.json")).toEqual({ bat: [1] }); // first read: downloaded, kept under b1
    expect(await getJson("/data/p/07.json")).toEqual({ bat: [1] });
    expect(ask("/data/p/07.json")).toHaveLength(1);
  });

  test("a new build asks again (a 304 keeps the copy and pins it to the new build)", async () => {
    files = { "/data/p/08.json": { etag: '"p1"', body: JSON.stringify({ n: 1 }) } };
    setDataBuild("b1");
    await getJson("/data/p/08.json");
    setDataBuild("b2");
    expect(await getJson("/data/p/08.json")).toEqual({ n: 1 });
    expect(ask("/data/p/08.json")).toHaveLength(2);
    expect(ask("/data/p/08.json")[1].headers["if-none-match"]).toBe('"p1"');
    await getJson("/data/p/08.json"); // pinned to b2 now
    expect(ask("/data/p/08.json")).toHaveLength(2);
  });

  test("a new build with changed content replaces the kept copy", async () => {
    files = { "/data/p/09.json": { etag: '"a"', body: '{"v":1}' } };
    setDataBuild("b1");
    await getJson("/data/p/09.json");
    files["/data/p/09.json"] = { etag: '"b"', body: '{"v":2}' };
    setDataBuild("b2");
    expect(await getJson("/data/p/09.json")).toEqual({ v: 2 });
  });

  test("fixtures, lines and the live feed are never pinned: they are asked for every time", async () => {
    files = { "/data/lines.json": { etag: '"l1"', body: '{"lines":[]}' } };
    setDataBuild("b1");
    await getJson("/data/lines.json");
    await getJson("/data/lines.json");
    expect(ask("/data/lines.json")).toHaveLength(2);
  });

  test("without a known build nothing is pinned", async () => {
    files = { "/data/matches.json": { etag: '"m"', body: '{"id":[]}' } };
    await getJson("/data/matches.json");
    await getJson("/data/matches.json");
    expect(ask("/data/matches.json")).toHaveLength(2);
  });
});

describe("a kept copy can paint a screen before the request is back", () => {
  test("peekJson returns what was read, only while it is recent enough", async () => {
    files = { "/data/fixtures.json": { etag: '"f"', body: '[{"id":"x"}]' } };
    expect(peekJson("/data/fixtures.json", 60_000)).toBeUndefined();
    expect(hasKept("/data/fixtures.json", 60_000)).toBe(false);
    await getJson("/data/fixtures.json");
    expect(peekJson("/data/fixtures.json", 60_000)).toEqual([{ id: "x" }]);
    expect(hasKept("/data/fixtures.json", 60_000)).toBe(true);
    const now = Date.now;
    Date.now = () => now() + 61_000;
    try { expect(peekJson("/data/fixtures.json", 60_000)).toBeUndefined(); } finally { Date.now = now; }
  });
});
