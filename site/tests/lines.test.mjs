import assert from "node:assert/strict";
import { test } from "node:test";
import { archiveFixture, bookLinesFor, bookName, bookQuotes, fancyByLine, fancyFor, fixtureBooks, isFixtureId, lineProb, overProb, sameFixture, teamKey, withArchive } from "../src/engine/lines.js";

const NOW = Date.parse("2026-10-27T05:00:00Z");
const L = (line, over, under, extra = {}) => ({ pid: "ab12", stat: "runs", fmt: "T20", line, match: "India vs NZ", competition: "T20I",
  start_utc: "2026-10-27T07:00:00Z", books: [{ source: "bet365", kind: "bookmaker", over, under }], ...extra });

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
  assert.equal(bookName("smarkets"), "Smarkets");
  assert.equal(bookName("bet365"), "bet365", "published under the book's own name");
  assert.equal(bookName("newbook"), "newbook");
});


test("fancyFor matches the fixture by team names and time, whole-match or team-total", () => {
  const f = (o) => ({ home: "New Zealand", away: "India", start_utc: "2026-10-27T07:00:00Z", scope: "match", team: null, source: "bet365", over: 1.83, under: 1.83, ...o });
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

// an archive file as src/value_bets/archive.py writes it: the match, competition and start once, lines without them
const ENTRY = {
  id: "2026-10-27-new-zealand-v-india", match: "New Zealand vs India", competition: "NZ v IND - 3rd T20", start_utc: "2026-10-27T07:00:00Z",
  fixture: { id: "2026-10-27-new-zealand-v-india", start: "2026-10-27T07:00Z", fmt: "T20", gender: "male", a: "New Zealand", b: "India", venue: "Eden Park", series: "NZ v IND" },
  events: [{ match: "New Zealand vs India", n: 10 }],
  lines: [{ pid: "ab12", player: "Abhishek Sharma", team: "India", fmt: "T20", stat: "runs", line: 17.5, books: [{ source: "bet365", kind: "bookmaker", over: 1.85, under: 1.95 }] }],
  fancy: [{ match: "New Zealand vs India", home: "New Zealand", away: "India", start_utc: "2026-10-27T07:00:00Z", key: "first_innings_runs", scope: "match", team: null, line: 198.5, over: 1.833, under: 1.833, source: "bet365", kind: "bookmaker" }],
};
const teamIx = (name, g) => ({ "New Zealand|male": 7, "India|male": 3 })[`${name}|${g}`] ?? -1;

test("only a fixture id can name an archive file", () => {
  assert.ok(isFixtureId("2026-10-27-new-zealand-v-india") && isFixtureId("2026-10-29-melbourne-stars-w-v-hobart-hurricanes-w"));
  for (const bad of ["", "../../main/README", "2026-10-27-a/b", "2026-10-27", "x-y", "2026-10-27-India v NZ", "2026-10-27-a--b"]) assert.equal(isFixtureId(bad), false, bad);
});

test("an archived match is a fixture again: the schedule row it was filed with, the data's team index, Completed once it is old", () => {
  const f = archiveFixture(ENTRY, teamIx, Date.parse("2026-10-30T00:00:00Z"));
  assert.deepEqual([f.id, f.a, f.b, f.a_ix, f.b_ix, f.fmt, f.gender, f.venue, f.status, f.source], ["2026-10-27-new-zealand-v-india", "New Zealand", "India", 7, 3, "T20", "male", "Eden Park", "Completed", "archive"]);
  assert.equal(archiveFixture(ENTRY, teamIx, Date.parse("2026-10-27T10:00:00Z")).status, "", "3 hours after the start it is still on");
  assert.equal(archiveFixture({ ...ENTRY, fixture: { ...ENTRY.fixture, fmt: "Test" } }, teamIx, Date.parse("2026-10-30T00:00:00Z")).status, "", "a Test runs for days");
  assert.equal(archiveFixture(null), null);
});

test("a match the schedule never listed is built from the books' names (women's sides by their label)", () => {
  const f = archiveFixture({ id: "2026-10-29-melbourne-stars-w-v-hobart-hurricanes-w", match: "Melbourne Stars (W) vs Hobart Hurricanes (W)", competition: "WBBL", start_utc: "2026-10-29T08:00:00Z", fixture: null, lines: [{ fmt: "T20" }], fancy: [] });
  assert.deepEqual([f.a, f.b, f.gender, f.fmt, f.series, f.start, f.a_ix], ["Melbourne Stars (W)", "Hobart Hurricanes (W)", "female", "T20", "WBBL", "2026-10-29T08:00:00Z", -1]);
});

test("withArchive adds the archived lines the live doc no longer has, with the match, competition and start put back on each", () => {
  const live = { generated_at_utc: "g", lines: [{ ...L(30.5, 1.9, 1.9), match: "Pakistan vs Sri Lanka", pid: "zz99" }], fancy: [], events: [{ match: "Pakistan vs Sri Lanka" }] };
  const doc = withArchive(live, ENTRY), fx = archiveFixture(ENTRY);
  assert.deepEqual(fixtureBooks(live, fx), { props: false, fancy: false });
  assert.deepEqual(fixtureBooks(doc, fx), { props: true, fancy: true });
  const mine = doc.lines.find((l) => l.pid === "ab12");
  assert.deepEqual([mine.match, mine.competition, mine.start_utc, mine.line, mine.books[0].over], ["New Zealand vs India", "NZ v IND - 3rd T20", "2026-10-27T07:00:00Z", 17.5, 1.85]);
  assert.equal(doc.lines.length, 2, "the other match's line stays");
  assert.deepEqual(doc.events, live.events, "events are left alone: an old match must not come back to the home rail");
  assert.equal(doc.generated_at_utc, "g");
  // far from now, the player page's window and the home list's still drop it: only the fixture's own page asks for it
  assert.equal(bookLinesFor(doc, "ab12", "runs", "T20", Date.parse("2026-11-20T00:00:00Z")), null);
  assert.equal(bookLinesFor(doc, "ab12", "runs", "T20", Date.parse("2026-11-20T00:00:00Z"), Infinity).main.line, 17.5);
});

test("withArchive leaves the live doc as it is when it still has the match's lines, and survives no doc or no archive", () => {
  const live = { lines: [{ ...L(20.5, 1.8, 2.0), match: "New Zealand vs India", pid: "ab12" }], fancy: ENTRY.fancy };
  const doc = withArchive(live, ENTRY);
  assert.deepEqual(doc.lines, live.lines);
  assert.deepEqual(doc.fancy, live.fancy);
  assert.equal(withArchive(live, null), live);
  assert.equal(withArchive(undefined, ENTRY).lines.length, 1);
});

test("sameFixture tells a series' matches apart: the same two sides, and a start within 14 hours", () => {
  const fx = { a: "New Zealand", b: "India", start: "2026-10-27T07:00Z" };
  assert.equal(sameFixture({ match: "New Zealand vs India", start_utc: "2026-10-27T07:00:00Z" }, fx), true);
  assert.equal(sameFixture({ match: "India vs New Zealand", start_utc: "2026-10-27T10:30:00Z" }, fx), true, "sides either way round, books a few hours off the schedule");
  assert.equal(sameFixture({ match: "New Zealand vs India", start_utc: "2026-10-30T07:00:00Z" }, fx), false, "the next game of the series");
  assert.equal(sameFixture({ match: "New Zealand vs Pakistan", start_utc: "2026-10-27T07:00:00Z" }, fx), false);
  assert.equal(sameFixture({ match: "New Zealand vs India", start_utc: "2026-10-30T07:00:00Z" }, { a: "New Zealand", b: "India" }), true, "no start known: the names decide");
});

test("fancyByLine puts every book's price on its line, with the best over and best under of each", () => {
  const e = (line, over, under, source) => ({ line, over, under, source });
  const lines = fancyByLine([e(13.5, 1.8, 1.91, "Ladbrokes"), e(14.5, 2.1, 1.7, "bet365"), e(13.5, 1.85, 1.86, "bet365")]);
  assert.deepEqual(lines.map((l) => l.line), [13.5, 14.5], "lowest line first, one entry per line");
  assert.deepEqual(lines[0].books.map((b) => b.source), ["bet365", "Ladbrokes"], "books in name order");
  assert.equal(lines[0].over, 1.85, "best over: bet365's");
  assert.equal(lines[0].under, 1.91, "best under: Ladbrokes'");
  assert.equal(lines[1].books.length, 1);
  assert.deepEqual(fancyByLine(undefined), []);
});

test("sameFixture knows a side the books and the schedule name differently (the Ford Trophy)", () => {
  const at = { start: "2026-10-27T21:30Z" };
  const books = [["Auckland Aces vs Canterbury Kings", "Auckland", "Canterbury"], ["Central Stags vs Northern Districts", "Central Stags", "Northern Brave"], ["Wellington Firebirds vs Otago Volts", "Wellington", "Otago"]];
  for (const [match, a, b] of books) assert.equal(sameFixture({ match, start_utc: "2026-10-27T21:30:00Z" }, { a, b, ...at }), true, match);
  assert.equal(sameFixture({ match: "Auckland Aces vs Otago Volts", start_utc: "2026-10-27T21:30:00Z" }, { a: "Auckland", b: "Canterbury", ...at }), false);
  assert.equal(teamKey("Northern Districts"), teamKey("Northern Brave"));
});

test("withArchive puts a stored result on the archived line it belongs to, matched by id and stat, and leaves the others without one", () => {
  const entry = { ...ENTRY, results: [{ pid: "ab12", stat: "runs", value: 31 }, { pid: "ab12", stat: "sixes", value: 2 }, { pid: "zz99", stat: "runs", value: 5 }],
    lines: [...ENTRY.lines, { ...ENTRY.lines[0], stat: "fours", line: 2.5 }, { ...ENTRY.lines[0], pid: "cd34", line: 22.5 }] };
  const doc = withArchive({ lines: [] }, entry);
  assert.deepEqual(doc.lines.map((l) => [l.pid, l.stat, l.line, l.result]), [["ab12", "runs", 17.5, 31], ["ab12", "fours", 2.5, undefined], ["cd34", "runs", 22.5, undefined]]);
  assert.ok(!("result" in withArchive({ lines: [] }, ENTRY).lines[0]), "a file without results adds none");
});

// books as the file publishes them: bet365 1.833 / 1.833, Ladbrokes 1.83 / 1.83, LeoVegas 2.0 / 1.73
const B = (source, over, under) => ({ source, kind: "bookmaker", over, under });

test("bookQuotes lists each book's own line and over price, the lowest line first and marked best", () => {
  const doc = { lines: [L(17.5, 1.833, 1.833, { books: [B("bet365", 1.833, 1.833)] }), L(14.5, 1.83, 1.83, { books: [B("Ladbrokes", 1.83, 1.83)] })] };
  const q = bookQuotes(bookLinesFor(doc, "ab12", "runs", "T20", NOW).lines);
  assert.deepEqual(q.map((x) => [x.name, x.line, x.over, x.under, x.best]), [["Ladbrokes", 14.5, 1.83, 1.83, true], ["bet365", 17.5, 1.833, 1.833, false]]);
});

test("bookQuotes on one line: the best price wins, books tied on line and price are all best, a lone book is not marked", () => {
  const same = bookQuotes([{ line: 25.5, books: [B("bet365", 1.83, 1.83), B("Ladbrokes", 1.91, 1.77), B("LeoVegas", 1.91, 1.8)] }]);
  assert.deepEqual(same.map((x) => [x.name, x.best]), [["Ladbrokes", true], ["LeoVegas", true], ["bet365", false]], "same price: name order");
  assert.deepEqual(bookQuotes([{ line: 25.5, books: [B("bet365", 1.83, 1.83)] }]).map((x) => x.best), [false]);
});

test("bookQuotes: a lower line is the friendlier over even at a worse price, and the price stays on show", () => {
  const q = bookQuotes([{ line: 11.5, books: [B("Ladbrokes", 1.83, 1.83), B("bet365", 1.833, 1.833)] }, { line: 12.5, books: [B("LeoVegas", 2.0, 1.73)] }]);
  assert.deepEqual(q.map((x) => [x.name, x.line, x.over, x.best]), [["bet365", 11.5, 1.833, true], ["Ladbrokes", 11.5, 1.83, false], ["LeoVegas", 12.5, 2.0, false]]);
});

test("bookQuotes gives a book that lists several lines the one nearest evens, and skips a book with no over price", () => {
  // Smarkets: 12.5 at 1.4 / 3.0 is p(over) 0.682 (0.182 from evens), 17.5 at 1.85 / 1.95 is 0.513 (0.013 from evens)
  const q = bookQuotes([{ line: 12.5, books: [B("smarkets", 1.4, 3.0)] }, { line: 17.5, books: [B("smarkets", 1.85, 1.95), B("bet365", null, 1.9), B("Ladbrokes", 1.83, null)] }]);
  assert.deepEqual(q.map((x) => [x.name, x.line, x.under]), [["Smarkets", 17.5, 1.95], ["Ladbrokes", 17.5, null]]);
  assert.deepEqual(bookQuotes([{ line: 17.5, books: [B("bet365", 1.0, 1.9)] }]), []);
  assert.deepEqual(bookQuotes(undefined), []);
  assert.deepEqual(bookQuotes([]), []);
});
