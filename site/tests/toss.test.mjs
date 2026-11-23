import assert from "node:assert/strict";
import { test } from "node:test";
import { TOSS_DEFAULT, tossMarket } from "@cricket/engine/toss.js";

const FX = { a: "New Zealand", b: "India", fmt: "T20", startMs: Date.parse("2026-11-13T01:30:00Z") };
const R = (team, over, source, extra = {}) => ({ match: "New Zealand vs India", home: "New Zealand", away: "India", start_utc: "2026-11-13T01:30:00Z", fmt: "T20", key: "toss_winner", scope: "team", team, line: 0, over, source, kind: "bookmaker", ...extra });

test("no book lists the toss: both sides at 1.95, flagged as the default", () => {
  const m = tossMarket({ fancy: [] }, FX);
  assert.equal(m.default, true);
  assert.deepEqual(m.sides.map((s) => [s.name, s.price, s.book]), [["New Zealand", 1.95, null], ["India", 1.95, null]]);
  assert.equal(TOSS_DEFAULT, 1.95);
  assert.equal(tossMarket(null, FX).default, true);
});

test("a book that prices both sides is used as quoted; the best price per side wins across books", () => {
  const doc = { fancy: [R("New Zealand", 1.92, "A"), R("India", 1.88, "A"), R("New Zealand", 1.9, "B"), R("India", 2.0, "B")] };
  const m = tossMarket(doc, FX);
  assert.equal(m.default, false);
  assert.deepEqual(m.sides.map((s) => [s.price, s.book]), [[1.92, "A"], [2.0, "B"]]);
  assert.deepEqual(m.books, [{ source: "A", prices: [1.92, 1.88] }, { source: "B", prices: [1.9, 2.0] }]);
});

test("a one-sided book, another match, a live line or a match total is not the toss", () => {
  const doc = { fancy: [R("New Zealand", 1.9, "A"), R("India", 1.9, "B", { live: true }), R("India", 1.9, "C", { home: "X", away: "Y", match: "X vs Y" }),
    { ...R(null, 1.9, "D"), key: "match_runs", scope: "match", team: null, line: 300.5, under: 1.9 }] };
  const m = tossMarket(doc, FX);
  assert.equal(m.default, true);
  assert.equal(m.sides[0].price, 1.95);
});

test("names the book spells differently still match the fixture's sides", () => {
  const doc = { fancy: [R("new zealand", 2.0, "A", { home: "new zealand" }), R("INDIA", 1.8, "A", { away: "INDIA" })] };
  assert.deepEqual(tossMarket(doc, FX).sides.map((s) => s.price), [2.0, 1.8]);
});
