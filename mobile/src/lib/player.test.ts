/* eslint-disable @typescript-eslint/no-explicit-any */
import { deriveChart } from "@/lib/player";

// the module also holds the screen's hooks, which reach storage; MMKV is a native module, so a no-op stands in for it here
jest.mock("react-native-mmkv", () => ({ createMMKV: () => ({ getString: () => undefined, set: () => undefined, remove: () => undefined }) }));

// Oldest to newest. Against a line of 20: 10 miss, 25 hit, DNP, 20 push (exactly on the line), 30 hit, 5 miss.
const entries: any[] = [
  { value: 10, aux: 12 }, { value: 25, aux: 10 }, { value: null }, { value: 20, aux: 20 }, { value: 30, aux: 30 }, { value: 5, aux: 5 },
];

describe("deriveChart", () => {
  test("the tally counts hit / miss / push and leaves the game he did not play out", () => {
    const c = deriveChart({ entries, line: 20, side: "over", win: 5 });
    expect(c.tally).toEqual({ hit: 2, miss: 2, push: 1 });
    expect(c.all).toEqual({ hits: 2, played: 5, p: 0.4 });
  });

  test("a window holds its last n games, a push is no hit, and a game he did not play is out", () => {
    const c = deriveChart({ entries, line: 20, side: "over", win: 5 });
    expect(c.ws.map((w) => w.label)).toEqual(["L5", "All"]); // L10+ are larger than the history and dropped
    expect(c.cur).toMatchObject({ n: 5, fixtures: 5, played: 4, hits: 2, p: 0.5 });
    expect(c.shown).toHaveLength(5);
    expect(c.mix).toEqual({ hit: 2, miss: 1, push: 1, out: 1 });
    expect(c.auxAvg).toBe(16.25); // (10 + 20 + 30 + 5) / 4 games played
  });

  test("a window that does not exist falls back to All", () => {
    const c = deriveChart({ entries, line: 20, side: "over", win: 99 });
    expect(c.cur.label).toBe("All");
    expect(c.shown).toHaveLength(6);
    expect(c.cur).toMatchObject({ played: 5, hits: 2, p: 0.4 });
  });

  test("under flips hit and miss; the push is still neither", () => {
    const c = deriveChart({ entries, line: 20, side: "under", win: 0 });
    expect(c.tally).toEqual({ hit: 2, miss: 2, push: 1 });
    expect(c.all).toEqual({ hits: 2, played: 5, p: 0.4 });
    const low = deriveChart({ entries, line: 12.5, side: "under", win: 0 });
    expect(low.tally).toEqual({ hit: 2, miss: 3, push: 0 }); // 10 and 5 are under; 25, 20, 30 are not
  });

  test("the engine's own headline wins while the line is the one it ran, the tally once it is stepped", () => {
    const summary = { n: 7, over: 3, under: 4, pOver: 3 / 7, pUnder: 4 / 7 };
    expect(deriveChart({ entries, line: 20, side: "over", win: 0, summary, sameLine: true }).all).toEqual({ hits: 3, played: 7, p: 3 / 7 });
    expect(deriveChart({ entries, line: 20, side: "under", win: 0, summary, sameLine: true }).all).toEqual({ hits: 4, played: 7, p: 4 / 7 });
    expect(deriveChart({ entries, line: 20, side: "over", win: 0, summary, sameLine: false }).all).toEqual({ hits: 2, played: 5, p: 0.4 });
  });

  test("no games gives no windows and no headline", () => {
    const c = deriveChart({ entries: [], line: 20, side: "over", win: 20 });
    expect(c.ws).toEqual([]);
    expect(c.all).toBeNull();
    expect(c.shown).toEqual([]);
    expect(c.auxAvg).toBeNull();
  });
});
