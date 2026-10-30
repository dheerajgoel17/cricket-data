import test from "node:test";
import assert from "node:assert/strict";
import { applyFilters, teamInningNo } from "../src/engine/filters.js";
import { createStore } from "../src/engine/store.js";
import { Resolver } from "../src/engine/resolve.js";
import { playerReport } from "../src/engine/props.js";
import { runPlan, sanitizePlan } from "../src/engine/plan.js";

// Three Tests between Alpha (team 0) and Beta (team 1). `inn` lists each match's innings in batting order, by team.
//   match 0: Alpha bat first   [A, B, A, B]   Batter (Alpha): 40 in innings 1, 10 in innings 3
//   match 1: Beta bat first    [B, A, B, A]   Batter: 15 in innings 2, 60 in innings 4
//   match 2: Alpha bat first   [A, B, B]      Batter: 100 in innings 1; Alpha never bat again, so there is no second innings of his side's
// Match totals: 50, 75, 100. His side's first innings: 40, 15, 100. Second: 10, 60, none.
const TEAMS = [{ n: "Alpha", g: 0 }, { n: "Beta", g: 0 }];
const INN = [[[0, 400], [1, 300], [0, 250], [1, 200]], [[1, 350], [0, 330], [1, 280], [0, 260]], [[0, 520], [1, 200], [1, 180]]];
const col = (rows, k) => rows.map((r) => r[k]);
const BAT = [{ m: 0, i: 1, r: 40 }, { m: 0, i: 3, r: 10 }, { m: 1, i: 2, r: 15 }, { m: 1, i: 4, r: 60 }, { m: 2, i: 1, r: 100 }];

const data = {
  "meta.json": { schema: 1, built_at: "2026-10-28T00:00Z", matches: 3, players: 1, newest_base: "2026-10-20", provisional_matches: 0, newest_provisional: "", provisional_included: false },
  "index.json": { players: { id: ["00000001"], nm: ["T Batter"], g: [0], last: ["2026-10-20"], n: [3], tm: [0], fm: [4] }, aliases: {}, teams: TEAMS, venues: ["Ground"], events: ["Series"],
    hosts: ["Alpha"], kinds: [""], formats: ["T20", "ODI", "Test", "Hundred", "T10", "O60"], nshard: 1 },
  "matches.json": { id: ["t0", "t1", "t2"], d: ["2026-10-01", "2026-10-08", "2026-10-15"], f: [2, 2, 2], g: [0, 0, 0], i: [1, 1, 1], e: [0, 0, 0], v: [0, 0, 0], a: [0, 0, 0], b: [1, 1, 1],
    w: [0, 0, 0], r: [0, 0, 0], o: [90, 90, 90], dy: [5, 5, 5], h: [0, 0, 0], fi: [0, 1, 0], pv: [0, 0, 0], q: [1, 1, 1], ho: [0, 0, 0], mc: [0, 0, 0], ts: [0, 0, 0], xq: [1, 1, 1], inn: INN },
  "p/00.json": { bat: { p: BAT.map(() => 0), m: col(BAT, "m"), i: col(BAT, "i"), t: BAT.map(() => 0), q: BAT.map(() => 1), o: BAT.map(() => 1), r: col(BAT, "r"), b: BAT.map((r) => r.r * 2),
    f: BAT.map(() => 0), s: BAT.map(() => 0), k: BAT.map(() => 0), tb: BAT.map(() => 0), mt: BAT.map(() => 0) }, bowl: {}, pt: {}, xi: { p: [0, 0, 0], m: [0, 1, 2] } },
};
const load = async () => createStore({ fetchJson: async (p) => structuredClone(data[p]) });

test("teamInningNo counts the side's own turns, not the match's (hand-computed)", () => {
  const inn = [[0], [1], [0], [1]];
  assert.deepEqual([teamInningNo(inn, 0, 1), teamInningNo(inn, 1, 2), teamInningNo(inn, 0, 3), teamInningNo(inn, 1, 4)], [1, 1, 2, 2]);
  const followOn = [[0], [1], [1], [0]]; // Beta follow on: innings 2 and 3 are both theirs
  assert.deepEqual([teamInningNo(followOn, 1, 2), teamInningNo(followOn, 1, 3), teamInningNo(followOn, 0, 4)], [1, 2, 2]);
  assert.equal(teamInningNo(inn, 1, 1), null, "innings 1 was not his side's");
  assert.equal(teamInningNo(inn, 0, 5), null, "no fifth innings");
  assert.equal(teamInningNo(inn, 0, 0), null);
  assert.equal(teamInningNo([], 0, 1), null);
  assert.equal(teamInningNo(undefined, 0, 1), null, "a provisional match has no innings detail");
});

test("the store tags each batting row with his side's innings", async () => {
  const store = await load();
  const { bat } = await store.playerRows(0);
  assert.deepEqual(bat.map((r) => [r.m, r.i, r.ti]), [[0, 1, 1], [0, 3, 2], [1, 2, 1], [1, 4, 2], [2, 1, 1]]);
});

test("the team-innings filter keeps one innings of his side's, and drops rows with no innings detail as it does for the other innings filters", async () => {
  const store = await load();
  const { bat } = await store.playerRows(0);
  assert.deepEqual(applyFilters(bat, { fmt: 2, tinn: 1 }, store).rows.map((r) => r.r), [40, 15, 100]);
  assert.deepEqual(applyFilters(bat, { fmt: 2, tinn: 2 }, store).rows.map((r) => r.r), [10, 60]);
  assert.equal(applyFilters(bat, { fmt: 2 }, store).rows.length, 5);
  const none = applyFilters([...bat, { ...bat[0], ti: null }], { fmt: 2, tinn: 1 }, store);
  assert.equal(none.rows.length, 3);
  assert.equal(none.dropped.provisional_no_detail, 1);
});

const entries = (rep) => rep.chart.entries.map((e) => [e.value, !!e.void]);
const hit = (rep, n = 0) => { const w = rep.chart.windows.find((x) => x.n === n); return [w.played, w.hits, w.dnp, w.voided]; };

test("the chart is the match total, his first innings, or his second, each against its own line (hand-computed)", async () => {
  const store = await load();
  const run = (filters, line) => playerReport(store, 0, { stat: "runs", line, side: "over", fmt: 2, filters, scope: "innings" });
  // match totals 50, 75, 100 against 55.5: two of three
  const all = await run({}, 55.5);
  assert.deepEqual(entries(all), [[50, false], [75, false], [100, false]]);
  assert.deepEqual(hit(all), [3, 2, 0, 0]);
  // first innings 40, 15, 100 against 30.5: two of three, and not the same two
  const first = await run({ tinn: 1 }, 30.5);
  assert.deepEqual(entries(first), [[40, false], [15, false], [100, false]]);
  assert.deepEqual(hit(first), [3, 2, 0, 0]);
  assert.deepEqual(first.chart.entries.map((e) => e.value > 30.5), [true, false, true]);
  // the same 55.5 line on first innings only: 100 clears it, 40 and 15 do not
  assert.deepEqual(hit(await run({ tinn: 1 }, 55.5)), [3, 1, 0, 0]);
  // second innings 10, 60, and no second turn in match 2 (he is in the XI: VOID, kept out of the rate)
  const second = await run({ tinn: 2 }, 30.5);
  assert.deepEqual(entries(second), [[10, false], [60, false], [null, true]]);
  assert.deepEqual(hit(second), [2, 1, 0, 1]);
  assert.equal(second.scope, "innings");
  assert.deepEqual(second.summary.n, 2, "the ladder and summary use the same innings");
});

test("the plan keeps team_innings (1 or 2) and drops anything else, and runs it", async () => {
  const store = await load(), rz = new Resolver(store);
  assert.deepEqual([1, "2", 3, 0, null, "x"].map((v) => sanitizePlan({ filters: { team_innings: v } }).filters.teamInnings), [1, 2, null, null, null, null]);
  const plan = { kind: "player_prop", stat: "runs", line: 30.5, side: "over", filters: { format: "Test", team_innings: 1 }, split_by: [] };
  const r = await runPlan(store, rz, plan, { playerIdx: 0 });
  assert.ok(r.ok);
  assert.deepEqual(r.chart.entries.map((e) => e.value), [40, 15, 100]);
  assert.ok(r.filters.some(([k, v]) => k === "Test innings" && /1st/.test(v)), "the filter shows as a chip, apart from the batting-first / chasing one");
  const match = await runPlan(store, rz, { ...plan, filters: { format: "Test" } }, { playerIdx: 0 });
  assert.deepEqual(match.chart.entries.map((e) => e.value), [50, 75, 100]);
});
