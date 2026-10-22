import test from "node:test";
import assert from "node:assert/strict";
import { buildChart } from "../public/js/engine/props.js";

// two teams (0 = player's side), fixtures every few days; the player batted in the first two and was left out of the third
function fakeStore(playerLast, newest = "2026-10-20") {
  const dates = ["2026-10-14", "2026-10-16", "2026-10-18", newest];
  const M = { f: dates.map(() => 0), d: dates, a: dates.map(() => 0), b: dates.map(() => 1), v: dates.map(() => 0), e: dates.map(() => 0), i: dates.map(() => 1),
    g: dates.map(() => 1), q: dates.map(() => -1), pv: dates.map(() => 1), fi: dates.map(() => -1) };
  return { M, n: dates.length, P: { tm: [0], last: [playerLast] }, venueType: () => null, battedFirst: () => null };
}
const def = { key: "r", side: "bat" };
const rows = (m) => ({ m, t: 0, date: ["2026-10-14", "2026-10-16", "2026-10-18", "2026-10-20"][m], r: 20, b: 10, o: 0 });

test("a fixture after the player's last innings shows as DNP while he is still active with the team", () => {
  const store = fakeStore("2026-10-16");
  const played = [rows(0), rows(1)];
  const c = buildChart(store, played, played, def, { fmt: 0 }, 0, { line: 9.5, pidx: 0 });
  assert.deepEqual(c.entries.map((e) => e.value), [20, 20, null, null]);
});

test("a retired or long-gone player's later fixtures are not blamed on him", () => {
  const store = fakeStore("2026-01-01"); // last seen ~9 months before the newest match
  const played = [rows(0), rows(1)];
  const c = buildChart(store, played, played, def, { fmt: 0 }, 0, { line: 9.5, pidx: 0 });
  assert.deepEqual(c.entries.map((e) => e.value), [20, 20]);
});
