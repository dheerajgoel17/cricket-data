import assert from "node:assert/strict";
import { test } from "node:test";
import { barState, windowRate, windowRates } from "@cricket/engine/windows.js";

const e = (value, extra = {}) => ({ value, ...extra });
// oldest -> newest: 3, 0, 5, DNP, 2, 4, VOID, 1
const entries = [e(3), e(0), e(5), e(null), e(2), e(4), e(null, { void: true }), e(1)];

test("hit rate ignores DNP / VOID fixtures (hand-computed)", () => {
  // over 1.5 across the played ones: 3 y, 0 n, 5 y, 2 y, 4 y, 1 n -> 4 of 6
  const all = windowRate(entries, 0, 1.5, "over");
  assert.deepEqual([all.fixtures, all.played, all.hits], [8, 6, 4]);
  assert.ok(Math.abs(all.p - 4 / 6) < 1e-12);
  assert.ok(Math.abs(all.mean - 15 / 6) < 1e-12);
});

test("L5 is the last five fixtures, DNPs included in the span but not in the rate", () => {
  // last 5 = [e(null), 2, 4, VOID, 1] -> played 2,4,1 -> over 1.5: 2 of 3
  const l5 = windowRate(entries, 5, 1.5, "over");
  assert.deepEqual([l5.label, l5.fixtures, l5.played, l5.hits], ["L5", 5, 3, 2]);
});

test("under side and pushes: a value exactly on the line is neither over nor under", () => {
  const w = windowRate([e(2), e(1), e(3)], 0, 2, "under");
  assert.deepEqual([w.played, w.hits], [3, 1]); // only the 1 is under 2
  const o = windowRate([e(2), e(1), e(3)], 0, 2, "over");
  assert.deepEqual([o.played, o.hits], [3, 1]); // only the 3 is over 2
});

test("no played fixture gives a null rate, not 0%", () => {
  const w = windowRate([e(null), e(null, { void: true })], 0, 0.5);
  assert.equal(w.p, null);
  assert.equal(w.mean, null);
});

test("windows larger than the history are dropped but All stays", () => {
  const ws = windowRates(entries, 1.5, "over");
  assert.deepEqual(ws.map((w) => w.label), ["L5", "All"]); // 8 fixtures: L10/L20/L30 do not fit
  assert.deepEqual(windowRates([e(1), e(2)], 1.5).map((w) => w.label), ["All"]);
});

test("barState names every kind of bar", () => {
  assert.equal(barState(e(3), 1.5), "hit");
  assert.equal(barState(e(1), 1.5), "miss");
  assert.equal(barState(e(2), 2), "push");
  assert.equal(barState(e(1), 1.5, "under"), "hit");
  assert.equal(barState(e(null), 1.5), "dnp");
  assert.equal(barState(e(null, { void: true }), 1.5), "void");
  assert.equal(barState(e(null, { unknown: true }), 1.5), "na");
});
