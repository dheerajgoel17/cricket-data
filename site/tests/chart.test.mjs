import test from "node:test";
import assert from "node:assert/strict";
import { buildChart } from "../public/js/engine/props.js";

// two teams (0 = the player's side), fixtures a few days apart; he batted in the first two
function fakeStore(newest = "2026-10-20") {
  const dates = ["2026-10-14", "2026-10-16", "2026-10-18", newest];
  const M = { f: dates.map(() => 0), d: dates, a: dates.map(() => 0), b: dates.map(() => 1), v: dates.map(() => 0), e: dates.map(() => 0), i: dates.map(() => 1),
    g: dates.map(() => 1), q: dates.map(() => -1), pv: dates.map(() => 1), fi: dates.map(() => -1) };
  return { M, n: dates.length, P: { tm: [0] }, venueType: () => null, battedFirst: () => null };
}
const def = { key: "r", side: "bat" };
const rows = (m) => ({ m, t: 0, date: ["2026-10-14", "2026-10-16"][m], r: 20, b: 10, o: 0 });
const chart = (store, extra = {}) => { const played = [rows(0), rows(1)]; return buildChart(store, played, played, def, { fmt: 0 }, 0, { line: 9.5, pidx: 0, ...extra }); };

test("a fixture after the player's last innings shows as DNP while he is still active with the team", () => {
  assert.deepEqual(chart(fakeStore()).entries.map((e) => e.value), [20, 20, null, null]);
});

test("a long-gone player's later fixtures are not blamed on him (judged on his last innings in this format)", () => {
  assert.deepEqual(chart(fakeStore("2027-03-01")).entries.map((e) => e.value), [20, 20]);
});

test("in the XI but never reached the crease is VOID (not DNP) and both stay out of the hit rate", () => {
  const c = chart(fakeStore(), { xi: new Set([2]) });
  assert.deepEqual(c.entries.map((e) => [e.value, !!e.void]), [[20, false], [20, false], [null, true], [null, false]]);
  const all = c.windows.find((w) => w.n === 0);
  assert.deepEqual([all.played, all.voided, all.dnp, all.hits, all.pHit], [2, 1, 1, 2, 1]);
});

test("an XI that was not recorded reliably is n/a, never DNP or VOID", () => {
  const store = fakeStore();
  store.M.xq = [1, 1, 0, 1];
  const c = chart(store, { xi: new Set([2, 3]) });
  assert.deepEqual(c.entries.map((e) => [e.value, !!e.void, !!e.unknown]), [[20, false, false], [20, false, false], [null, false, true], [null, true, false]]);
  const all = c.windows.find((w) => w.n === 0);
  assert.deepEqual([all.played, all.voided, all.dnp, all.unknown], [2, 1, 0, 1]);
});
