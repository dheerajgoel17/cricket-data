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

import { tossRecord, tossRows } from "@cricket/engine/toss.js";

test("a side's toss record counts its last matches with a recorded toss, wins, and wins that chose to bat", () => {
  // five T20s of team 0 (men): toss winner 0,1,0,-1 (not recorded),0 ; decision bat,field,field,-1,bat
  const M = { f: [0, 0, 0, 0, 0, 1], g: [0, 0, 0, 0, 0, 0], a: [0, 0, 1, 0, 0, 0], b: [1, 1, 0, 1, 1, 1], tw: [0, 1, 0, -1, 0, 0], td: [1, 0, 0, -1, 1, 1] };
  const store = { M, n: 6 };
  assert.deepEqual(tossRecord(store, 0, { fmt: 0 }), { n: 4, won: 3, bat: 2, form: ["W", "L", "W", "W"] }); // match 3 has no toss, match 5 is another format
  assert.deepEqual(tossRecord(store, 0, { fmt: 0, lastN: 2 }), { n: 2, won: 2, bat: 1, form: ["W", "W"] }); // the last two recorded are matches 2 (won, chose field) and 4 (won, chose bat)
  assert.equal(tossRecord({ M: { f: [], g: [], a: [], b: [] }, n: 0 }, 0, { fmt: 0 }), null); // a build without toss columns
});

test("the toss record can be narrowed to one opponent or to a ground", () => {
  const M = { f: [0, 0, 0, 0], g: [0, 0, 0, 0], a: [0, 0, 0, 2], b: [1, 1, 2, 0], v: [5, 6, 5, 5], tw: [0, 1, 0, 0], td: [1, 0, 1, 0] };
  const store = { M, n: 4 };
  assert.deepEqual(tossRecord(store, 0, { fmt: 0, opp: 1 }), { n: 2, won: 1, bat: 1, form: ["W", "L"] });
  assert.deepEqual(tossRecord(store, 0, { fmt: 0, venue: [5] }), { n: 3, won: 3, bat: 2, form: ["W", "W", "W"] });
  assert.deepEqual(tossRecord(store, 0, { fmt: 0, opp: 2, venue: [5] }), { n: 2, won: 2, bat: 1, form: ["W", "W"] });
});

test("tossRows: one row per side in the fancy row shape, price from the book or 1.95, no edge, last tosses as W / L", () => {
  const M = { f: [0, 0, 0], g: [0, 0, 0], a: [7, 7, 7], b: [9, 9, 9], v: [1, 1, 2], tw: [7, 9, 7], td: [1, 0, 0] };
  const store = { M, n: 3 };
  const rows = tossRows(store, { fancy: [] }, { a: "India", b: "New Zealand", fmt: "T20", startMs: 0 }, { teams: [["India", 7], ["New Zealand", 9]], fmt: 0, venue: [1] });
  assert.deepEqual(rows.map((r) => [r.team, r.over, r.default, r.edge, r.static, r.form.join("")]), [["India", 1.95, true, null, true, "WLW"], ["New Zealand", 1.95, true, null, true, "LWL"]]);
  assert.deepEqual([rows[0].hits, rows[0].played], [2, 3]);
  assert.deepEqual([rows[0].vsOpp, rows[0].atGround], [{ n: 3, won: 2, opp: "New Zealand" }, { n: 2, won: 1 }]);
  assert.equal(tossRows({ M: null, n: 0 }, null, { a: "India", b: "New Zealand" }, { teams: [], fmt: 0 })[0].played, 0); // no history: the row still shows its price
});
