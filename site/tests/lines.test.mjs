import assert from "node:assert/strict";
import { test } from "node:test";
import { bookLinesFor, bookName, fancyFor, fixtureBooks, lineProb, overProb } from "../src/engine/lines.js";

const NOW = Date.parse("2026-10-27T05:00:00Z");
const L = (line, over, under, extra = {}) => ({ pid: "ab12", stat: "runs", fmt: "T20", line, match: "India vs NZ", competition: "T20I",
  start_utc: "2026-10-27T07:00:00Z", books: [{ source: "moviodds_bet365", kind: "bookmaker", over, under }], ...extra });

test("overProb removes the margin (hand-computed)", () => {
  // 1.90 / 1.90 -> evens; 1.50 / 2.75: (1/1.5)/((1/1.5)+(1/2.75)) = 0.66667/(0.66667+0.36364) = 0.6471
  assert.ok(Math.abs(overProb(1.9, 1.9) - 0.5) < 1e-12);
  assert.ok(Math.abs(overProb(1.5, 2.75) - 0.64706) < 1e-4);
  assert.equal(overProb(1.0, 2), null);
  assert.equal(overProb(null, 2), null);
});

test("lineProb averages the books that price the line", () => {
  const p = lineProb([{ over: 1.9, under: 1.9 }, { over: 1.5, under: 2.75 }, { over: null, under: 2 }]);
  assert.ok(Math.abs(p - (0.5 + 0.64706) / 2) < 1e-4);
  assert.equal(lineProb([{ over: 1, under: 1 }]), null);
});

test("main line is the one priced closest to evens", () => {
  const doc = { lines: [L(12.5, 1.4, 3.0), L(17.5, 1.85, 1.95), L(22.5, 2.6, 1.45)] };
  const r = bookLinesFor(doc, "ab12", "runs", "T20", NOW);
  assert.equal(r.main.line, 17.5);
  assert.deepEqual(r.lines.map((x) => x.line), [12.5, 17.5, 22.5]);
  assert.equal(r.match, "India vs NZ");
});

test("a tie in how close to evens goes to the lower line", () => {
  const doc = { lines: [L(17.5, 1.8, 2.0), L(18.5, 2.0, 1.8)] }; // p(over) 0.5263 vs 0.4737: equally far from 0.5
  assert.equal(bookLinesFor(doc, "ab12", "runs", "T20", NOW).main.line, 17.5);
});

test("only this player, stat and format; none at all gives null", () => {
  const doc = { lines: [L(17.5, 1.85, 1.95), L(1.5, 1.9, 1.9, { stat: "sixes" }), L(30.5, 1.9, 1.9, { fmt: "ODI" }), L(9.5, 1.9, 1.9, { pid: "zz99" })] };
  assert.equal(bookLinesFor(doc, "ab12", "runs", "T20", NOW).lines.length, 1);
  assert.equal(bookLinesFor(doc, "ab12", "wickets", "T20", NOW), null);
  assert.equal(bookLinesFor(doc, "ab12", "runs", "Test", NOW), null);
  assert.equal(bookLinesFor({ lines: [] }, "ab12", "runs", "T20", NOW), null);
  assert.equal(bookLinesFor(null, "ab12", "runs", "T20", NOW), null);
});

test("the nearest upcoming match wins; a match that started long ago is ignored", () => {
  const doc = { lines: [L(17.5, 1.85, 1.95, { match: "later", start_utc: "2026-10-29T07:00:00Z" }), L(20.5, 1.85, 1.95, { match: "sooner", start_utc: "2026-10-27T07:00:00Z" }),
    L(5.5, 1.85, 1.95, { match: "done", start_utc: "2026-10-27T00:00:00Z" })]};
  const r = bookLinesFor(doc, "ab12", "runs", "T20", NOW);
  assert.equal(r.match, "sooner");
  assert.equal(r.lines.length, 1);
  assert.equal(bookLinesFor({ lines: [L(5.5, 1.85, 1.95, { start_utc: "2026-10-27T00:00:00Z" })] }, "ab12", "runs", "T20", NOW), null);
});

test("book names are readable, unknown sources are shown as-is", () => {
  assert.equal(bookName("moviodds_bet365"), "bet365");
  assert.equal(bookName("smarkets"), "Smarkets");
  assert.equal(bookName("newbook"), "newbook");
});


test("fancyFor matches the fixture by team names and time, whole-match or team-total", () => {
  const f = (o) => ({ home: "New Zealand", away: "India", start_utc: "2026-10-27T07:00:00Z", scope: "match", team: null, source: "moviodds_bet365", over: 1.83, under: 1.83, ...o });
  const doc = { fancy: [f({ key: "match_runs", line: 384.5 }), f({ key: "team_total_sixes", scope: "team", team: "New Zealand", line: 9.5 }),
    f({ key: "match_runs", line: 300.5, home: "Pakistan", away: "Sri Lanka" }), f({ key: "match_runs", line: 99.5, start_utc: "2026-11-02T07:00:00Z" })] };
  const fx = { a: "India", b: "New Zealand", startMs: Date.parse("2026-10-27T07:30:00Z") };
  assert.deepEqual(fancyFor(doc, fx, "match_runs").map((x) => x.line), [384.5], "other teams and a start days away are left out");
  assert.deepEqual(fancyFor(doc, fx, "team_total_sixes", "New Zealand").map((x) => x.line), [9.5]);
  assert.deepEqual(fancyFor(doc, fx, "team_total_sixes", "India"), []);
  assert.deepEqual(fancyFor({}, fx, "match_runs"), []);
});

test("fixtureBooks hides player-prop vs fancy sections when that match has no line", () => {
  const fx = { a: "Netherlands", b: "Oman", start: "2026-10-27T09:00:00Z" };
  const fancyOnly = { lines: [L(17.5, 1.85, 1.95)], fancy: [{ match: "Netherlands vs Oman", home: "Netherlands", away: "Oman", start_utc: "2026-10-27T09:00:00Z", key: "top_score", scope: "match", line: 83.5, over: 1.83, under: 1.83 }] };
  assert.deepEqual(fixtureBooks(fancyOnly, fx), { props: false, fancy: true });
  const both = { lines: [{ ...L(22.5, 1.8, 2.0), match: "Netherlands vs Oman", start_utc: "2026-10-27T09:00:00Z", fmt: "ODI" }], fancy: fancyOnly.fancy };
  assert.deepEqual(fixtureBooks(both, fx), { props: true, fancy: true });
  assert.deepEqual(fixtureBooks({ lines: [L(17.5, 1.85, 1.95)], fancy: [] }, fx), { props: false, fancy: false });
  assert.deepEqual(fixtureBooks(null, fx), { props: false, fancy: false });
});
