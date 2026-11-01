// MMKV is a native module; in a unit test a Map stands in for it.
jest.mock("react-native-mmkv", () => {
  const m = new Map<string, string>();
  return { createMMKV: () => ({ getString: (k: string) => m.get(k), set: (k: string, v: string) => void m.set(k, v), remove: (k: string) => m.delete(k) }) };
});

import { LIVE_CACHE_MS, readLive, saveLive, storage } from "@/lib/storage";

const body = { matches: [{ id: "x", status: "live" }] };

describe("kept live body", () => {
  test("comes back within the window, not after it", () => {
    saveLive(body, 1_000_000);
    expect(readLive(1_000_000 + LIVE_CACHE_MS - 1000)?.body).toEqual(body);
    expect(readLive(1_000_000 + LIVE_CACHE_MS + 1000)).toBeNull();
  });

  test("a body without matches is not kept", () => {
    storage.remove("live-body-v1");
    saveLive({ error: "down" }, 1_000_000);
    expect(readLive(1_000_000)).toBeNull();
  });
});
