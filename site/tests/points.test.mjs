import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "@cricket/engine/store.js";
import { playerReport } from "@cricket/engine/props.js";
import { STATS } from "@cricket/engine/rules.js";

// One player over five T20s. Points = runs + 20 per wicket + 10 per catch + 25 per stumping:
//   m0: 30 runs, 2 wickets, 1 catch, 1 stumping  -> 30 + 40 + 10 + 25 = 105
//   m1: a duck (0 runs), 2 catches                -> 0 + 20 = 20
//   m2: did not bat or bowl, 1 catch              -> 10 (a match he only fielded in still counts)
//   m3: named in the XI, no runs, wickets or catches -> 0 (a played match, not a void)
//   m4: not named at all                          -> DNP
const TEAMS = [{ n: "Alpha", g: 0 }, { n: "Beta", g: 0 }];
const N = 5;
const same = (v) => Array(N).fill(v);
const data = {
  "meta.json": { schema: 1, built_at: "2026-10-28T00:00Z", matches: N, players: 1, newest_base: "2026-10-20", provisional_matches: 0, newest_provisional: "", provisional_included: false },
  "index.json": { players: { id: ["00000001"], nm: ["T Allrounder"], g: [0], last: ["2026-10-20"], n: [4], tm: [0], fm: [1] }, aliases: {}, teams: TEAMS, venues: ["Ground"], events: ["Series"],
    hosts: ["Alpha"], kinds: [""], formats: ["T20", "ODI", "Test", "Hundred", "T10", "O60"], nshard: 1 },
  "matches.json": { id: ["a", "b", "c", "d", "e"], d: ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"], f: same(0), g: same(0), i: same(1), e: same(0), v: same(0), a: same(0), b: same(1),
    w: same(0), r: same(0), o: same(20), dy: same(1), h: same(0), fi: same(0), pv: same(0), q: same(1), ho: same(0), mc: same(0), ts: same(0), xq: same(1), inn: same([[0, 150], [1, 140]]) },
  "p/00.json": {
    bat: { p: [0, 0], m: [0, 1], i: [1, 1], t: [0, 0], q: [1, 1], o: [3, 4], r: [30, 0], b: [20, 4], f: [0, 0], s: [0, 0], k: [0, 0], tb: [0, 0], mt: [0, 0] },
    bowl: { p: [0], m: [0], i: [2], t: [0], q: [1], w: [2], c: [25], n: [24] },
    fld: { p: [0, 0, 0], m: [0, 1, 2], i: [2, 2, 2], t: [0, 0, 0], q: [1, 1, 1], ct: [1, 2, 1], st: [1, 0, 0] },
    pt: {}, xi: { p: [0, 0, 0, 0], m: [0, 1, 2, 3] },
  },
};
const store = await createStore({ fetchJson: async (p) => structuredClone(data[p]) });
const run = (line, side = "over", extra = {}) => playerReport(store, 0, { stat: "points", line, side, fmt: 0, filters: {}, ...extra });

test("the points stat is defined once, with the exchange's scoring", () => {
  assert.equal(STATS.points.label, "Player performance");
  assert.equal(STATS.points.side, "all");
});

test("pointsRows is one row per match from batting, bowling and fielding (hand-computed)", async () => {
  const all = await store.playerRows(0);
  assert.equal(all.fld.length, 3);
  assert.deepEqual(store.pointsRows(all).map((r) => [r.m, r.pts, r.r, r.w, r.ct, r.st]), [[0, 105, 30, 2, 1, 1], [1, 20, 0, 0, 2, 0], [2, 10, 0, 0, 1, 0]]);
});

test("the chart has every fixture: a named player with no credits is 0 points, one not named is DNP, and the rate counts the played ones only", async () => {
  const rep = await run(50.5);
  assert.deepEqual(rep.chart.entries.map((e) => [e.value, !!e.void]), [[105, false], [20, false], [10, false], [0, false], [null, false]]);
  const w = rep.chart.windows.find((x) => x.n === 0);
  assert.deepEqual([w.played, w.hits, w.dnp, w.voided], [4, 1, 1, 0]); // 105 clears 50.5; 20, 10 and 0 do not
  const under = await run(50.5, "under");
  const wu = under.chart.windows.find((x) => x.n === 0);
  assert.equal(wu.hits, 3);
  assert.equal(rep.statLabel, "Player performance");
  assert.equal(rep.n, 3); // the summary reads the rows he has (105, 20, 10); the chart is what adds the named-and-did-nothing match as 0
});
