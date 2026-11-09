import test from "node:test";
import assert from "node:assert/strict";
import { BAND, MIN_SAMPLE, checkpoints, conditionalReport, inplayScopes, levelOf, liveInnings, runsAtBalls, runsBand, similarInnings, targetValue } from "@cricket/engine/inplay.js";
import { Store } from "@cricket/engine/store.js";

// Alpha (team 0) bats first in every match, at the same ground, in T20s: a steady c runs an over, so the tape is c, 2c, ... 20c and the total 20c.
// 3 innings at 9 an over (54 after 6 overs, total 180), 4 at 10 (60, 200), 2 at 11 (66, 220), 2 at 7 (42, 140), 1 at 13 (78, 260).
const PACES = [9, 9, 9, 10, 10, 10, 10, 11, 11, 7, 7, 13];
const steady = (c) => Array.from({ length: 20 }, (_, i) => c * (i + 1));
// an innings all out after 62 balls for 95 that had 57 on the board after 6 overs
const COLLAPSE = { inn: [0, 95, 10, 62], ov: [10, 20, 30, 40, 47, 57, 64, 70, 80, 90] };

function synthetic({ extra = [], paces = PACES } = {}) {
  const rows = paces.map((c, m) => ({ inn: [0, 20 * c, 6, 120], ov: steady(c), d: `2026-01-${String(m + 1).padStart(2, "0")}`, f: 0, i: 1 }));
  rows.push(...extra);
  const n = rows.length;
  const M = { id: rows.map((_, m) => `m${m}`), f: rows.map((r) => r.f ?? 0), q: rows.map(() => 1), g: rows.map(() => 0), d: rows.map((r, m) => r.d ?? `2026-02-${String(m + 1).padStart(2, "0")}`),
    i: rows.map((r) => r.i ?? 1), e: rows.map(() => 0), v: rows.map(() => 0), a: rows.map(() => 0), b: rows.map(() => 1), fi: rows.map(() => 0), pv: rows.map(() => 0),
    inn: rows.map((r) => [r.inn, [1, 100, 5, 120]]), ov: rows.map((r) => [r.ov, steady(8)]), h: rows.map(() => -1) };
  const index = { players: { nm: [], id: [] }, teams: [{ n: "Alpha", g: 0 }, { n: "Beta", g: 0 }], venues: ["Ground, City"], events: [], hosts: [], nshard: 0 };
  const store = new Store({}, index, M, async () => { throw new Error("no shards"); });
  store.n = n;
  return store;
}
const all = (store) => Array.from({ length: store.n }, (_, m) => m);

test("a band is 10% of the live runs, at least 4 runs either way", () => {
  assert.deepEqual(BAND, { pct: 0.1, min: 4 });
  assert.deepEqual(runsBand(60), [54, 66]);
  assert.deepEqual(runsBand(20), [16, 24]); // 10% is 2, the floor is 4
  assert.deepEqual(runsBand(2), [0, 6]);
});

test("checkpoints add the innings' end and runsAtBalls reads between them", () => {
  const pts = checkpoints(COLLAPSE.ov, COLLAPSE.inn);
  assert.deepEqual(pts[0], [0, 0]);
  assert.deepEqual(pts.at(-1), [62, 95]);
  assert.equal(runsAtBalls(pts, 36), 57);
  assert.equal(runsAtBalls(pts, 39), 57 + (64 - 57) * 3 / 6); // half-way into the 7th over
  assert.equal(runsAtBalls(pts, 62), 95);
  assert.equal(runsAtBalls(pts, 63), null); // bowled out before then
  assert.equal(checkpoints([], [0, 100, 3, 60]), null); // no tape kept
  assert.equal(runsAtBalls(checkpoints(steady(10), [0, 200, 6, 120]), 39), 65); // 60 after 6 overs, 70 after 7: 39 balls is half-way
});

test("60 after 6 overs: the innings within 54-66 are the 9 at 9, 10 and 11 an over, and 6 of the 9 pass 190.5", () => {
  const store = synthetic(), ms = all(store);
  const rows = similarInnings(store, ms, { innNo: 1, balls: 36, runs: 60 });
  assert.equal(rows.length, 9);
  const r = conditionalReport(store, ms, { state: { balls: 36, runs: 60 }, line: 190.5 });
  assert.equal(r.n, 9);
  assert.deepEqual(r.band, [54, 66]);
  assert.equal(r.summary.over, 6); // 4 at 200 and 2 at 220
  assert.equal(r.summary.under, 3); // 3 at 180
  assert.equal(r.summary.push, 0);
  assert.equal(r.low, false); // 9 >= MIN_SAMPLE
  assert.equal(MIN_SAMPLE, 8);
  assert.equal(r.summary.median, 200);
  assert.equal(r.summary.pOver, 0.6667);
});

test("the target can be the runs after more overs: after 10 overs these nine were at 90, 100 or 110", () => {
  const store = synthetic(), ms = all(store);
  const r = conditionalReport(store, ms, { state: { balls: 36, runs: 60 }, target: { kind: "overs", n: 10 }, line: 99.5 });
  assert.equal(r.n, 9);
  assert.deepEqual([...r.values].sort((a, b) => a - b), [90, 90, 90, 100, 100, 100, 100, 110, 110]);
  assert.equal(r.summary.over, 6);
  assert.equal(r.summary.under, 3);
});

test("a state off the over mark is read between the checkpoints: 62 after 6.3 overs picks the 9s and 10s, not the 11s", () => {
  const store = synthetic();
  // 39 balls: 9 an over is 58.5, 10 is 65, 11 is 71.5; the band for 62 is 56-68
  const rows = similarInnings(store, all(store), { innNo: 1, balls: 39, runs: 62 });
  assert.equal(rows.length, 7);
  assert.deepEqual(rows.map((r) => r.total).sort((a, b) => a - b), [180, 180, 180, 200, 200, 200, 200]);
  assert.equal(rows[0].at, 58.5);
});

test("an innings bowled out later than the live one is in the spot, one bowled out before is not", () => {
  const store = synthetic({ paces: [], extra: [{ inn: COLLAPSE.inn, ov: COLLAPSE.ov, d: "2026-01-20", f: 0 }] });
  const ms = all(store);
  assert.equal(similarInnings(store, ms, { balls: 36, runs: 57 }).length, 1); // alive at 36 balls
  assert.equal(similarInnings(store, ms, { balls: 66, runs: 70 }).length, 0); // out on ball 62
  // a line on its runs after 12 overs: it was all out, so its total stands
  assert.equal(targetValue(similarInnings(store, ms, { balls: 36, runs: 57 })[0], { kind: "overs", n: 12 }), 95);
  // but one that was still batting reads off its tape
  assert.equal(targetValue(similarInnings(store, ms, { balls: 36, runs: 57 })[0], { kind: "overs", n: 10 }), 90);
});

test("a team scope keeps only that side's own innings, and the second innings reads the chase", () => {
  const store = synthetic();
  const ms = all(store);
  assert.equal(similarInnings(store, ms, { team: 0, innNo: 1, balls: 36, runs: 60 }).length, 9);
  assert.equal(similarInnings(store, ms, { team: 1, innNo: 1, balls: 36, runs: 60 }).length, 0);
  // every second innings is Beta's 8 an over (48 after 6 overs, total 160): within 44-52 of 48
  const chase = conditionalReport(store, ms, { team: 1, innNo: 2, state: { balls: 36, runs: 48 }, line: 150.5 });
  assert.equal(chase.n, 12);
});

test("a match with no over tape is skipped, not read as zero", () => {
  const store = synthetic({ paces: [10], extra: [{ inn: [0, 200, 6, 120], ov: [], d: "2026-01-25" }] });
  assert.equal(conditionalReport(store, all(store), { state: { balls: 36, runs: 60 } }).n, 1);
});

test("liveInnings reads the innings being batted, only in a live limited-overs match", () => {
  const live = (o = {}) => ({ status: "live", innings: [{ n: 1, team: "Alpha", runs: 60, wkts: 1, overs: 6 }], ...o });
  assert.deepEqual(liveInnings(live(), 0), { team: "Alpha", innNo: 1, balls: 36, runs: 60, wkts: 1, overs: 6, max: 20 });
  assert.equal(liveInnings(live({ innings: [{ n: 1, team: "Alpha", runs: 60, wkts: 1, overs: 6.3 }] }), 0).balls, 39);
  assert.equal(liveInnings(live({ innings: [{ n: 1, team: "Alpha", runs: 150, wkts: 4, overs: 20 }] }), 0), null); // overs used
  assert.equal(liveInnings(live({ innings: [{ n: 1, team: "Alpha", runs: 90, wkts: 10, overs: 12 }] }), 0), null); // all out
  assert.equal(liveInnings(live({ status: "final" }), 0), null);
  assert.equal(liveInnings(live(), 2), null); // a Test
  assert.equal(liveInnings(live({ innings: [{ n: 1, team: "Alpha", runs: 160, wkts: 5, overs: 20 }, { n: 2, team: "Beta", runs: 30, wkts: 0, overs: 3 }] }), 0).innNo, 2);
  assert.equal(liveInnings(live({ innings: [] }), 0), null);
});

test("scopes: a side's own last matches, and the wide scope of the format since three years", () => {
  const store = synthetic({ extra: [{ inn: [0, 150, 6, 120], ov: steady(7), d: "2020-01-01", f: 0, i: 1 }] });
  const s = inplayScopes(store, { fmt: 0, gender: 0, team: 0, now: Date.parse("2026-06-01T00:00:00Z") });
  assert.equal(s.team.length, 13);
  assert.equal(s.wide.length, 12); // the 2020 match is older than three years
  assert.equal(levelOf(store, 0, 0, 0), 1);
  assert.equal(levelOf(store, 1, 1, 0), null); // no ODIs
});

// ---- a batter's own innings (`player-inplay.js`)
import { playerBand, playerConditional, playerRunsAt, progressPoints } from "@cricket/engine/player-inplay.js";

test("a batter's checkpoints are the 10 / 20 / 30 marks he reached and his end", () => {
  assert.deepEqual(progressPoints({ b: 45, r: 70, x: [12, 30, 48] }), [[0, 0], [10, 12], [20, 30], [30, 48], [45, 70]]);
  assert.deepEqual(progressPoints({ b: 23, r: 34, x: [21, 31, null] }), [[0, 0], [10, 21], [20, 31], [23, 34]]);
  assert.deepEqual(progressPoints({ b: 12, r: 15, x: [11, null, null] }), [[0, 0], [10, 11], [12, 15]]);
  assert.equal(playerRunsAt({ b: 45, r: 70, x: [12, 30, 48] }, 15), 21); // half-way between 12 and 30
  assert.equal(playerRunsAt({ b: 23, r: 34, x: [21, 31, null] }, 25), null); // out after 23 balls
  assert.equal(playerRunsAt({ b: 23, r: 34, x: [21, 31, null] }, 23), 34);
});

test("30 off 20 balls: of his innings that were 25-35 after 20 balls, how many reached 50", () => {
  // ten innings, runs after 20 balls then the final score: 28->55, 30->62, 33->41, 27->50, 31->38, 29->71, 20->30 (below the band), 45->80 (above), 30->49, 32->52
  const spots = [[28, 55], [30, 62], [33, 41], [27, 50], [31, 38], [29, 71], [20, 30], [45, 80], [30, 49], [32, 52]];
  const rows = spots.map(([at20, fin], m) => ({ m, i: 1, b: 40, r: fin, x: [Math.round(at20 / 2), at20, Math.round((at20 + fin) / 2)] }));
  const store = { M: { f: rows.map(() => 0) } };
  assert.deepEqual(playerBand(30), [25, 35]); // 15% of 30 is 4.5, rounded to 5
  const r = playerConditional(store, rows, { fmt: 0, state: { balls: 20, runs: 30 }, line: 49.5 });
  assert.equal(r.n, 8); // all but the 20 and the 45
  assert.equal(r.summary.over, 5); // 55, 62, 50, 71, 52
  assert.equal(r.summary.under, 3); // 41, 38, 49
  assert.equal(r.low, false);
  assert.equal(r.summary.median, 51); // 38 41 49 50 52 55 62 71
});

test("a batter is never compared across formats, nor before ten balls or past thirty", () => {
  const rows = [{ m: 0, i: 1, b: 40, r: 60, x: [14, 30, 45] }, { m: 1, i: 1, b: 40, r: 20, x: [14, 30, 35] }];
  const store = { M: { f: [0, 1] } };
  assert.equal(playerConditional(store, rows, { fmt: 0, state: { balls: 20, runs: 30 } }).n, 1); // the ODI row is left out
  assert.equal(playerConditional(store, rows, { fmt: 0, state: { balls: 9, runs: 10 } }), null);
  assert.equal(playerConditional(store, rows, { fmt: 0, state: { balls: 31, runs: 40 } }), null);
});

test("the store reads one player's progression rows from the progression shard, [] when there is none", async () => {
  const pp = { p: [0, 1, 0], m: [3, 3, 4], i: [1, 2, 1], b: [23, 40, 31], r: [34, 60, 45], x1: [21, 12, 9], x2: [31, 30, 18], x3: [null, 48, 33] };
  const index = (extra) => ({ players: { nm: ["A", "B"], id: ["00", "01"] }, teams: [], venues: [], events: [], hosts: [], nshard: 1, ...extra });
  const asks = [];
  const store = new Store({}, index({ pp: 1 }), { id: [], f: [] }, async (path) => { asks.push(path); return pp; });
  assert.deepEqual(await store.playerProgression(0), [{ m: 3, i: 1, b: 23, r: 34, x: [21, 31, null] }, { m: 4, i: 1, b: 31, r: 45, x: [9, 18, 33] }]);
  assert.deepEqual((await store.playerProgression(1)).map((r) => r.r), [60]);
  assert.deepEqual(asks, ["pp/00.json"]); // one fetch for the shard
  const none = new Store({}, index(), { id: [], f: [] }, async () => { throw new Error("must not be asked"); });
  assert.deepEqual(await none.playerProgression(0), []); // an older build has no progression shards
  let calls = 0;
  const flaky = new Store({}, index({ pp: 1 }), { id: [], f: [] }, async () => { if (++calls === 1) throw new Error("offline"); return pp; });
  assert.deepEqual(await flaky.playerProgression(0), []); // a failed read is not an error for the panel...
  assert.equal((await flaky.playerProgression(0)).length, 2); // ...and is not kept: the next ask tries again
});
