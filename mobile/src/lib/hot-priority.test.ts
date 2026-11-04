import { prioritizeHotGroups, shouldPublishHot } from "@/lib/hot-priority";

const NOW = Date.parse("2026-11-03T12:00:00Z");

describe("prioritizeHotGroups", () => {
  test("shards with started matches come first; lines inside a shard prefer started", () => {
    const later = { start_utc: "2026-11-03T18:00:00Z" };
    const live = { start_utc: "2026-11-03T10:00:00Z" };
    const g = prioritizeHotGroups(
      [
        { shard: 1, lines: [later, later] },
        { shard: 2, lines: [later, live] },
        { shard: 3, lines: [live, live, live] },
      ],
      NOW,
    );
    expect(g.map((x) => x.shard)).toEqual([3, 2, 1]);
    expect(g[1].lines[0]).toBe(live);
  });

  test("empty input stays empty", () => {
    expect(prioritizeHotGroups([], NOW)).toEqual([]);
  });
});

describe("shouldPublishHot", () => {
  test("publishes the first row, then on an interval", () => {
    expect(shouldPublishHot(0, 0, NOW)).toBe(false);
    expect(shouldPublishHot(1, 0, NOW)).toBe(true);
    expect(shouldPublishHot(10, NOW, NOW + 100, 1, 350)).toBe(false);
    expect(shouldPublishHot(10, NOW, NOW + 350, 1, 350)).toBe(true);
  });
});
