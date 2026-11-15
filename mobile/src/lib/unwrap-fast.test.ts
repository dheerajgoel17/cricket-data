import { Platform } from "react-native";
import { createWorkletRuntime, runOnRuntimeAsync } from "react-native-worklets";
jest.mock("react-native-worklets", () => ({
  createWorkletRuntime: jest.fn(() => ({})),
  runOnRuntimeAsync: jest.fn(async (_runtime, fn, ...args) => fn(...args)),
}));
import { wrap } from "@cricket/engine/wrap.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { unwrapText, unwrapOnWorker } from "@/lib/unwrap-fast";

const iv = new Uint8Array(16).map((_, i) => (i * 17 + 3) & 255);

describe("unwrapText", () => {
  test("reads what the engine's wrap wrote, for sizes that end inside and exactly on a 32-byte block", async () => {
    for (const n of [0, 1, 2, 5, 11, 12, 30]) {
      const obj = { s: "x".repeat(n), n };
      const doc = await wrap(obj, "a secret", iv);
      expect(JSON.parse(await unwrapText(doc, "a secret"))).toEqual(obj);
    }
  });

  test("a body with accents, emoji and long strings comes back unchanged", async () => {
    const obj = { names: ["Ñandú Äpfel", "日本語のテキスト", "🏏 six!", "AB de Villiers"], big: Array.from({ length: 2000 }, (_, i) => ({ id: i, name: `Player ${i} é`, v: i / 7 })) };
    const doc = await wrap(obj, "another-secret-key", iv);
    expect(await unwrapText(doc, "another-secret-key")).toBe(JSON.stringify(obj));
    expect(unwrapOnWorker(doc, sha256(new TextEncoder().encode("another-secret-key")))).toBe(JSON.stringify(obj));
  });

  test("concurrent responses keep independent keys and IVs across yields", async () => {
    const bodies = ["first", "second", "third"].map((s) => ({ s: s.repeat(12000) }));
    const docs = await Promise.all(bodies.map((body, i) => wrap(body, `key-${i}`, new Uint8Array(16).fill(i + 1))));
    let clock = 0;
    const time = jest.spyOn(Date, "now").mockImplementation(() => clock += 10);
    try {
      const decoded = await Promise.all(docs.map((doc, i) => unwrapText(doc, `key-${i}`)));
      expect(decoded.map((s) => JSON.parse(s))).toEqual(bodies);
    } finally { time.mockRestore(); }
  });

  test("Android schedules decoding on one dedicated worker", async () => {
    const original = Platform.OS;
    const doc = await wrap({ s: "worker 🏏" }, "secret", iv);
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    try {
      expect(JSON.parse(await unwrapText(doc, "secret"))).toEqual({ s: "worker 🏏" });
      await unwrapText(doc, "secret");
      expect(createWorkletRuntime).toHaveBeenCalledTimes(1);
      expect(runOnRuntimeAsync).toHaveBeenCalledTimes(2);
    } finally { Object.defineProperty(Platform, "OS", { configurable: true, value: original }); }
  });

  test("Android falls back to the yielding path when the worklet fails", async () => {
    const original = Platform.OS;
    const doc = await wrap({ s: "fallback" }, "secret", iv);
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    jest.mocked(runOnRuntimeAsync).mockRejectedValueOnce(new Error("no worker"));
    try {
      expect(JSON.parse(await unwrapText(doc, "secret"))).toEqual({ s: "fallback" });
    } finally { Object.defineProperty(Platform, "OS", { configurable: true, value: original }); }
  });

  test("a different secret does not read it", async () => {
    const doc = await wrap({ a: 1 }, "right", iv);
    const wrong = await unwrapText(doc, "wrong");
    expect(() => JSON.parse(wrong)).toThrow();
  });
});
