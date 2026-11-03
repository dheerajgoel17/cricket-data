import { wrap } from "@cricket/engine/wrap.js";
import { unwrapText } from "@/lib/unwrap-fast";

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
  });

  test("a different secret does not read it", async () => {
    const doc = await wrap({ a: 1 }, "right", iv);
    const wrong = await unwrapText(doc, "wrong");
    expect(() => JSON.parse(wrong)).toThrow();
  });
});
