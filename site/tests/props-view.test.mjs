import test from "node:test";
import assert from "node:assert/strict";
import { edgeTag, expectedEnd, groundNote, homeProps, modelSide, seriesChips, sideRate } from "@cricket/engine/props-view.js";

// shrunk chance = (hits + 10 * market chance) / (played + 10); edge = chance * price - 1 (stats.js sideEdge)

test("modelSide: 8 of 10 against an even market at 2.00 is a +30% over (0.65 * 2 - 1)", () => {
  const r = modelSide({ hits: 8, played: 10 }, 0.5, 2, 2);
  assert.equal(r.side, "over");
  assert.ok(Math.abs(r.edge - 0.3) < 1e-12);
});

test("modelSide: 2 of 10 is a +30% under, not a -30% over", () => {
  const r = modelSide({ hits: 2, played: 10 }, 0.5, 2, 2); // under: (8 + 5) / 20 = 0.65 -> 0.30; over: (2 + 5) / 20 = 0.35 -> -0.30
  assert.equal(r.side, "under");
  assert.ok(Math.abs(r.edge - 0.3) < 1e-12);
});

test("modelSide: each side is priced at its own price", () => {
  const r = modelSide({ hits: 2, played: 10 }, 0.5, 2, 1.5); // over 0.35 * 2 - 1 = -0.30; under 0.65 * 1.5 - 1 = -0.025
  assert.equal(r.side, "under");
  assert.ok(Math.abs(r.edge + 0.025) < 1e-12);
});

test("modelSide: no edge under 10 games or without a market chance, and the row stays on the over", () => {
  assert.deepEqual(modelSide({ hits: 4, played: 5 }, 0.5, 2, 2), { edge: null, side: "over" });
  assert.deepEqual(modelSide({ hits: 8, played: 10 }, null, 2, 2), { edge: null, side: "over" });
});

test("modelSide: a side with no price is not claimed", () => {
  const r = modelSide({ hits: 2, played: 10 }, 0.5, 2, 0);
  assert.equal(r.side, "over");
  assert.ok(Math.abs(r.edge + 0.3) < 1e-12);
});

test("sideRate and edgeTag", () => {
  assert.ok(Math.abs(sideRate(0.2, "under") - 0.8) < 1e-12);
  assert.equal(sideRate(0.8, "over"), 0.8);
  assert.equal(sideRate(null, "under"), null);
  assert.equal(edgeTag(0.1, "over"), "Over");
  assert.equal(edgeTag(0.1, "under"), "Under");
  assert.equal(edgeTag(-0.06, "over"), "No edge");
  assert.equal(edgeTag(null, "over"), "");
});

test("groundNote: from two games, lopsided at 75% or 25%", () => {
  assert.equal(groundNote({ hits: 1, played: 1, p: 1 }), null);
  assert.equal(groundNote(null), null);
  assert.deepEqual(groundNote({ hits: 3, played: 4, p: 0.75 }), { hits: 3, played: 4, tone: "good" });
  assert.deepEqual(groundNote({ hits: 1, played: 4, p: 0.25 }), { hits: 1, played: 4, tone: "bad" });
  assert.deepEqual(groundNote({ hits: 2, played: 4, p: 0.5 }), { hits: 2, played: 4, tone: "plain" });
});

const H = 3600e3, start = Date.parse("2026-11-03T10:00:00Z");
const row = (name, edge, fmt = "T20", at = start) => ({ name, edge, fmt, start: new Date(at).toISOString() });
const finalOf = (...names) => (r) => (names.includes(r.name) ? { state: "final" } : { state: "live" });

test("expectedEnd: a T20 is over 4 hours after its start, an ODI 8, a Test day 9", () => {
  assert.equal(expectedEnd(row("a", 0)), start + 4 * H);
  assert.equal(expectedEnd(row("a", 0, "ODI")), start + 8 * H);
  assert.equal(expectedEnd(row("a", 0, "Test")), start + 9 * H);
});

test("homeProps: undecided rows come first, a resulted one yields its place", () => {
  const rows = [row("a", 0), row("b", 0), row("c", 0)];
  assert.deepEqual(homeProps(rows, finalOf("a"), { now: start + 5 * H }).map((r) => r.name), ["b", "c", "a"]);
});

test("homeProps: a resulted row stays 12 hours after the expected end, then goes", () => {
  const rows = [row("a", 0), row("b", 0)], end = start + 4 * H;
  assert.deepEqual(homeProps(rows, finalOf("a"), { now: end + 12 * H - 1 }).map((r) => r.name), ["b", "a"]);
  assert.deepEqual(homeProps(rows, finalOf("a"), { now: end + 12 * H }).map((r) => r.name), ["b"]);
});

test("homeProps: the first four, and more when more undecided rows have an edge, up to ten", () => {
  const six = ["a", "b", "c", "d", "e", "f"].map((n, i) => row(n, i < 4 ? 0.05 : i === 4 ? 0.1 : -0.02));
  // e has an edge, f does not: five rows
  assert.deepEqual(homeProps(six, () => null, { now: start }).map((r) => r.name), ["a", "b", "c", "d", "e"]);
  const many = Array.from({ length: 14 }, (_, i) => row(`r${i}`, 0.05));
  assert.equal(homeProps(many, () => null, { now: start }).length, 10);
});

test("homeProps: rows past the first four that have resulted, or have no edge, are not added", () => {
  const rows = [row("a", 0), row("b", 0), row("c", 0), row("d", 0), row("e", 0.2), row("f", null)];
  assert.deepEqual(homeProps(rows, finalOf("e"), { now: start + 5 * H }).map((r) => r.name), ["a", "b", "c", "d"]); // pending a b c d f come first and e (resulted) last; f has no edge, so nothing is added past the first four
});

test("seriesChips: a series with props first, then more priced, then more listed, then name", () => {
  const it = (series, priced = true) => ({ series, priced });
  const names = (items) => seriesChips(items, (i) => i.series, (i) => i.priced).map(([n]) => n);
  assert.deepEqual(names([it("Big", false), it("Big", false), it("Big", false), it("Small")]), ["Small", "Big"]);
  assert.deepEqual(names([it("B"), it("B"), it("A"), it("A"), it("A", false), it("C"), it("D", false)]), ["A", "B", "C", "D"]);
  assert.deepEqual(names([it("Zed"), it("Alpha")]), ["Alpha", "Zed"]);
});
