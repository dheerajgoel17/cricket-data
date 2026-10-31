import test from "node:test";
import assert from "node:assert/strict";
import { HIGH_ODDS, LOW_ODDS, marketTape, quoteMove, stillNeed } from "../src/engine/tape.js";

test("quoteMove: line and over each sign their delta", () => {
  assert.deepEqual(quoteMove(null, { line: 24.5, over: 1.9 }), { line: 0, odds: 0 });
  assert.deepEqual(quoteMove({ line: 24.5, over: 1.9 }, { line: 22.5, over: 1.7 }), { line: -1, odds: -1 });
  assert.deepEqual(quoteMove({ line: 24.5, over: 1.8 }, { line: 24.5, over: 2.1 }), { line: 0, odds: 1 });
  assert.deepEqual(quoteMove({ line: 19.5, over: 1.9 }, { line: 21.5, over: 1.9 }), { line: 1, odds: 0 });
});

test("stillNeed: how many to clear an over line; gone once there is a verdict (hand-computed)", () => {
  assert.equal(stillNeed(12, 24.5, null), 12.5);
  assert.equal(stillNeed(24, 24.5, null), 0.5);
  assert.equal(stillNeed(25, 24.5, null), 0, "on or past the mark, still live: 0 to go");
  assert.equal(stillNeed(31, 24.5, "cleared"), null);
  assert.equal(stillNeed(null, 24.5, null), null);
});

test("marketTape: high-odds hits and low-odds misses (hand-computed thresholds)", () => {
  assert.equal(HIGH_ODDS, 2.5);
  assert.equal(LOW_ODDS, 1.4);
  const rows = [
    { name: "Long", over: 3.2, verdict: "cleared" },
    { name: "Also long", over: 2.5, verdict: "cleared" },
    { name: "Short miss", over: 1.33, verdict: "missed" },
    { name: "Even miss", over: 1.4, verdict: "missed" },
    { name: "Long miss", over: 3.0, verdict: "missed" },
    { name: "Short hit", over: 1.2, verdict: "cleared" },
    { name: "Live", over: 3.5, verdict: null },
    { name: "Push", over: 2.8, verdict: "push" },
  ];
  const { hits, misses } = marketTape(rows);
  assert.deepEqual(hits.map((r) => [r.name, r.over]), [["Long", 3.2], ["Also long", 2.5]]);
  assert.deepEqual(misses.map((r) => [r.name, r.over]), [["Short miss", 1.33], ["Even miss", 1.4]]);
});
