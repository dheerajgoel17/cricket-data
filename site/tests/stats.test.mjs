import test from "node:test";
import assert from "node:assert/strict";
import { fairOdds, summarize, wilson } from "../src/engine/stats.js";
import { assertSingleFormat } from "../src/engine/filters.js";

test("half lines: over/under hit rates and fair decimal odds", () => {
  const s = summarize([0, 2, 1, 0, 0, 3, 1, 0, 2, 0], 0.5);
  assert.equal(s.n, 10);
  assert.equal(s.over, 5);
  assert.equal(s.under, 5);
  assert.equal(s.push, 0);
  assert.equal(s.pOver, 0.5);
  assert.equal(s.fairOver, 2);
  assert.equal(s.median, 0.5);
});

test("whole-number lines: pushes are void and excluded from the fair price", () => {
  const s = summarize([0, 2, 1, 0, 0, 3, 1, 0, 2, 0], 1);
  assert.deepEqual([s.over, s.under, s.push], [3, 5, 2]);
  assert.equal(s.pOver, 0.375);
  assert.equal(s.fairOver, 2.67);
  assert.equal(s.fairUnder, 1.6);
});

test("no hits means no price rather than infinity", () => {
  assert.equal(fairOdds(0), null);
  assert.equal(summarize([0, 0, 0], 0.5).fairOver, null);
  assert.equal(summarize([], 0.5).n, 0);
});

test("wilson interval brackets the observed rate and widens for small samples", () => {
  const small = wilson(3, 6), big = wilson(300, 600);
  assert.ok(small.lo < 0.5 && small.hi > 0.5);
  assert.ok(small.hi - small.lo > big.hi - big.lo);
});

test("mixing formats is refused", () => {
  assert.throws(() => assertSingleFormat([{ fmt: 0 }, { fmt: 1 }]), /mix formats/);
  assert.doesNotThrow(() => assertSingleFormat([{ fmt: 1 }, { fmt: 1 }]));
});
