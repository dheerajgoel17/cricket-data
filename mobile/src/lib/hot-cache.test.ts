jest.mock("react-native-mmkv", () => {
  const m = new Map<string, string>();
  return { createMMKV: () => ({ getString: (k: string) => m.get(k), set: (k: string, v: string) => void m.set(k, v), remove: (k: string) => m.delete(k) }) };
});

import { hotSnapKey, readHotSnap, writeHotSnap } from "@/lib/hot-cache";
import type { Row } from "@/lib/hot";

const NOW = Date.parse("2026-11-05T09:00:00Z");
const rows = [{ name: "A", stat: "runs", line: 20.5 }] as unknown as Row[];

describe("kept Hot rows", () => {
  test("a snapshot comes back as written, with the books generation it was scored from", () => {
    const k = hotSnapKey(0, "Thu Nov 05 2026");
    writeHotSnap(k, "2026-11-05T09:05Z", rows, NOW);
    expect(readHotSnap(k, NOW + 60_000)).toEqual({ t: NOW, generated: "2026-11-05T09:05Z", rows });
  });

  test("lists are kept apart by day and by day stamp", () => {
    writeHotSnap(hotSnapKey(1, "Thu Nov 05 2026"), "g", rows, NOW);
    expect(readHotSnap(hotSnapKey(0, "Thu Nov 05 2026"), NOW)?.generated).not.toBe("g");
    expect(readHotSnap(hotSnapKey(1, "Fri Nov 06 2026"), NOW)).toBeNull();
  });

  test("a snapshot older than three hours is not shown", () => {
    const k = hotSnapKey(2, "d");
    writeHotSnap(k, "g", rows, NOW);
    expect(readHotSnap(k, NOW + 2.9 * 3600e3)).not.toBeNull();
    expect(readHotSnap(k, NOW + 3.1 * 3600e3)).toBeNull();
  });

  test("nothing is written for an empty list", () => {
    const k = hotSnapKey(3, "d");
    writeHotSnap(k, "g", [], NOW);
    expect(readHotSnap(k, NOW)).toBeNull();
  });
});
