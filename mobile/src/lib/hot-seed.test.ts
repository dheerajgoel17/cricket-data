/* eslint-disable @typescript-eslint/no-explicit-any */
import { HISTORY_FIELDS, lineKey } from "@cricket/engine/hot-rows.js";
import { scoreHotRows } from "@/lib/hot";

const NOW = Date.parse("2026-11-03T05:00:00Z");
const line = (o: any = {}) => ({ pid: "3e808d3b", stat: "runs", fmt: "T20", line: 20.5, match: "Alpha vs Beta", competition: "T20I", team: "Alpha", start_utc: "2026-11-03T09:00:00Z", book_name: "V Kohli", books: [{ source: "bet365", kind: "bookmaker", over: 1.85, under: 1.95 }], ...o });
const rec = (o: any = {}) => ({ ...Object.fromEntries(HISTORY_FIELDS.map((k: string) => [k, null])), idx: 3, name: "V Kohli", line: 20.5, prior: 0.5, opp: "Beta", venue: "Ground", l5: { hits: 3, played: 5 }, l10: { hits: 5, played: 10 }, season: { hits: 1, played: 2 }, h2h: { hits: 0, played: 0 }, ven: { hits: 0, played: 0 }, last: [{ v: 30, s: "hit" }], max: 30.75, settled: undefined, ...o });

test("lines the published file covers are rows with no store and no player files, the prices being the phone's own books", async () => {
  const l = line();
  const loadStore = jest.fn(async () => { throw new Error("the store must not be asked for"); });
  const seen: number[] = [];
  const rows = await scoreHotRows({ loadStore, lines: [l], fixtures: [], scope: { day: 0 }, now: NOW, seed: { [lineKey(l)]: rec() }, onRows: (r) => seen.push(r.length) });
  expect(loadStore).not.toHaveBeenCalled();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ pid: "3e808d3b", stat: "runs", line: 20.5, over: 1.85, under: 1.95, l10: { hits: 5, played: 10 }, opp: "Beta", day: 0, edge: null });
  expect(rows[0].quotes[0]).toMatchObject({ source: "bet365", over: 1.85 });
  expect(seen).toEqual([1]);
});

test("a line the file does not cover, or whose main line has moved, goes to the phone's own scoring", async () => {
  const l = line();
  const loadStore = jest.fn(async () => ({ store: { P: { id: [] }, shardOf: () => 0, shard: async () => {} }, rz: {} }));
  const rows = await scoreHotRows({ loadStore, lines: [l], fixtures: [], scope: { day: 0 }, now: NOW, seed: { [lineKey(l)]: rec({ line: 25.5 }) } });
  expect(loadStore).toHaveBeenCalledTimes(1); // asked for the store because the seed's line is not the books' main line (the player is not in this empty store, so no row)
  expect(rows).toEqual([]);
});
