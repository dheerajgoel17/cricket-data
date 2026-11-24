import assert from "node:assert/strict";
import { test } from "node:test";
import { parityBlocks, parityMarks, parityOvers } from "@cricket/engine/parity.js";

// team 0 and 1, ground 0 / 1, T20 (f 0). Over tapes are hand-made so every parity below is counted by hand.
const inn = (team, runs, wkts) => [team, runs, wkts];
const mk = (rows) => {
  const M = { id: [], d: [], f: [], g: [], a: [], b: [], v: [], q: [], fi: [], dls: [], inn: [], ov: [], i: [], e: [], pv: [] };
  rows.forEach((r, i) => { M.id.push(i); M.d.push(r.d); M.f.push(0); M.g.push(0); M.a.push(r.a); M.b.push(r.b); M.v.push(r.v ?? 0); M.q.push(1); M.fi.push(r.a); M.dls.push(r.dls ?? 0); M.inn.push(r.inn); M.ov.push(r.ov); M.i.push(1); M.e.push(0); M.pv.push(0); });
  return { M, n: rows.length, venues: ["G0", "G1"], venueType: () => "n" };
};
const tape = (...xs) => xs;
const rows = [
  // 1: team0 bats first (cum 5 ov = 41 odd, 10 ov = 80 even), team1 chases (5 ov = 38 even, 10 ov = 77 odd)
  { d: "2026-01-01", a: 0, b: 1, inn: [inn(0, 160, 5), inn(1, 150, 8)], ov: [tape(8, 15, 22, 33, 41, 50, 58, 66, 73, 80), tape(6, 12, 20, 30, 38, 49, 55, 60, 70, 77)] },
  // 2: team1 bats first (5 ov = 44 even), team0 chases and wins in 3 overs of tape (no 5-over value)
  { d: "2026-01-05", a: 1, b: 0, v: 1, inn: [inn(1, 140, 6), inn(0, 30, 0)], ov: [tape(9, 18, 25, 36, 44), tape(10, 20, 30)] },
  // 3: team0 batting second is all out for 25 after 3 overs: the total stands for every cutoff past it
  { d: "2026-01-09", a: 0, b: 1, inn: [inn(1, 120, 3), inn(0, 25, 10)], ov: [tape(5, 10, 15, 20, 27), tape(10, 20, 25)] },
  // 4: weather-adjusted: never counted
  { d: "2026-01-12", a: 0, b: 1, dls: 1, inn: [inn(0, 90, 2), inn(1, 70, 1)], ov: [tape(7, 14, 21, 28, 35), tape(9, 18, 27, 36, 45)] },
];
const store = mk(rows);

test("overs offered per format", () => {
  assert.deepEqual(parityOvers("T20"), [5, 10, 15, 20]);
  assert.deepEqual(parityOvers("T10"), [5, 10]);
  assert.equal(parityOvers("ODI").length, 10);
  assert.deepEqual(parityOvers("Test"), []);
});

test("a side's score after 5 overs, by innings: tapes read by hand, no tape or a finished chase is skipped", () => {
  const first = parityMarks(store, { fmt: 0, team: 0, inn: 1, overs: 5 });
  assert.deepEqual(first.marks.map((x) => [x.score, x.odd]), [[41, true]]);
  const second = parityMarks(store, { fmt: 0, team: 0, inn: 2, overs: 5 });
  // match 2: the chase ended inside 5 overs, not all out: no value; match 3: all out for 25, the total stands (odd); match 4 is weather-adjusted
  assert.deepEqual(second.marks.map((x) => [x.score, x.odd]), [[25, true]]);
  const both = parityMarks(store, { fmt: 0, team: 0, overs: 5 });
  assert.equal(both.n, 2);
  assert.equal(both.odd, 2);
  assert.equal(both.pOdd, 1);
});

test("team 1 at 5 and 10 overs; the ground slice reads every side's innings", () => {
  assert.deepEqual(parityMarks(store, { fmt: 0, team: 1, inn: 2, overs: 5 }).marks.map((x) => [x.score, x.odd, x.vs]), [[38, false, 0]]);
  assert.deepEqual(parityMarks(store, { fmt: 0, team: 1, inn: 2, overs: 10 }).marks.map((x) => x.score), [77]);
  const g1 = parityMarks(store, { fmt: 0, inn: 1, overs: 5, venue: [0] });
  assert.deepEqual(g1.marks.map((x) => x.score), [41, 27]);
  assert.equal(g1.typical, 34);
  assert.equal(parityMarks(store, { fmt: 0, inn: 1, overs: 5, venue: [1] }).marks[0].score, 44);
});

test("lastN keeps the newest matches that have a value", () => {
  const r = parityMarks(store, { fmt: 0, team: 0, overs: 5, lastN: 1 });
  assert.deepEqual(r.marks.map((x) => x.score), [25]);
});

test("no tape column means no answer, and blocks assemble every slice", () => {
  assert.equal(parityMarks({ M: { ov: null }, n: 0 }, { fmt: 0, overs: 5 }), null);
  const b = parityBlocks(store, { fmt: 0, team: 0, opp: 1, venue: [0], overs: 5 });
  assert.equal(b.first.n, 1);
  assert.equal(b.vs.n, 2);
  assert.equal(b.ground2.n, 2); // match 1 (38) and match 3 (all out for 25)
});
