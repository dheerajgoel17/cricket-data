import test from "node:test";
import assert from "node:assert/strict";
import { fairOdds, shrunkProb, sideEdge, summarize, wilson } from "@cricket/engine/stats.js";
import { assertSingleFormat } from "@cricket/engine/filters.js";

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


// --- the edge: the player's record pulled toward the market, then worked out against the best price ---
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("shrunkProb pulls a short record toward the market and barely moves a long one (hand-computed)", () => {
  near(shrunkProb(8, 10, 0.5), 13 / 20);     // (8 + 10 * 0.5) / (10 + 10) = 0.65, not 0.80
  near(shrunkProb(40, 60, 0.5), 45 / 70);    // 0.642857, not 0.667
  near(shrunkProb(5, 10, 0.5), 0.5);         // an even record against an even market stays even
  near(shrunkProb(4, 10, 0.6), 0.5);         // (4 + 6) / 20: a 40% record against a 60% market lands between
  near(shrunkProb(8, 10, 0.5, 0), 0.8);      // no weight on the market is the raw hit rate
  assert.equal(shrunkProb(0, 0, 0.5), null);
  assert.equal(shrunkProb(3, 5, null), null);
});

test("sideEdge is shrunk chance x price - 1, and a price the books have right gives about minus their margin (hand-computed)", () => {
  near(sideEdge(8, 10, 0.5, 1.9), 0.65 * 1.9 - 1);          // +23.5%, where the raw hit rate said +52%
  near(sideEdge(8, 10, 0.5, 1.9, 10, 0), 0.8 * 1.9 - 1);    // the old formula, for comparison: 0.52
  near(sideEdge(40, 60, 0.5, 1.9), 45 / 70 * 1.9 - 1);      // +22.1%
  near(sideEdge(5, 10, 0.5, 1.9), -0.05);                   // 1.90 / 1.90 has a 5% margin
  // the under side of a 60% market: 6 of 10 under, prior 0.4, price 2.4: (6 + 4) / 20 = 0.5, 0.5 * 2.4 - 1
  near(sideEdge(6, 10, 0.4, 2.4), 0.2);
});

test("no edge is claimed from under ten games, with no price, or with no market chance", () => {
  assert.equal(sideEdge(8, 9, 0.5, 1.9), null);
  assert.ok(sideEdge(8, 10, 0.5, 1.9) != null);
  assert.equal(sideEdge(8, 10, 0.5, 1), null);
  assert.equal(sideEdge(8, 10, 0.5, 0), null);
  assert.equal(sideEdge(8, 10, null, 1.9), null);
  assert.equal(sideEdge(8, 10, 0.5, undefined), null);
  near(sideEdge(3, 5, 0.5, 2, 5) ?? NaN, (3 + 10 * 0.5) / 15 * 2 - 1); // a caller may lower the bar: 8/15 * 2 - 1 = 0.0667
});

test("data freshness: reads the base date from either meta key and never prints undefined", async () => {
  const { Store } = await import("@cricket/engine/store.js");
  const f = (meta) => Store.prototype.freshness.call({ meta });
  assert.equal(f({ newest_base: "2026-10-25" }).newestBase, "2026-10-25");
  assert.equal(f({ newest_older_build: "2026-10-24", newest_provisional: "2026-10-27" }).newestBase, "2026-10-24"); // an older build's key; the provisional date is not the base date
  assert.equal(f({ newest_provisional: "2026-10-27" }).newestBase, null);
});
