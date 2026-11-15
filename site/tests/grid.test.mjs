import test from "node:test";
import assert from "node:assert/strict";
import { gridFor, spanWidth } from "../packages/tokens/grid.js";

test("columns and margins follow the breakpoints", () => {
  assert.deepEqual(gridFor(375), { columns: 4, gutter: 16, margin: 14, span: 4, perRow: 1 });
  assert.equal(gridFor(768).columns, 8);
  assert.equal(gridFor(768).perRow, 2);
  assert.equal(gridFor(1024).margin, 24);
  assert.equal(gridFor(1024).perRow, 2);
  assert.equal(gridFor(1440).columns, 12);
  assert.equal(gridFor(1440).perRow, 3);
});

test("a full-width card spans the page inside its margins", () => {
  assert.equal(spanWidth(375), 375 - 28);
  const w = spanWidth(1440);
  assert.ok(Math.abs(w * 3 + 16 * 2 - (1440 - 48)) < 0.001);
});
