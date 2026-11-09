import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { SKIP_MARKET, mergeMatches, parseInplayFeed, parseQuotes } from "@cricket/engine/inplay-lines.js";

// The shape the feed gave for a match that had started (probed from a workflow run): one quote per side per line.
const q = (group_name, label, handicap, odds_dec, extra = {}) => ({ group_name, label, line: handicap, side: label, handicap, odds_dec, ...extra });
const QUOTES = [
  q("M Rahim Innings Runs", "Over", "33.5", 1.8333333), q("M Rahim Innings Runs", "Under", "33.5", 1.8333333),
  q("M Rahim Innings Runs", "Over", "43.5", 2.6), q("M Rahim Innings Runs", "Under", "43.5", 1.45),
  q("Bangladesh 1st Inns Runs", "Over", "250.5", 1.9), q("Bangladesh 1st Inns Runs", "Under", "250.5", 1.8),
  q("Bangladesh 1st Inns Runs", "Over", "250.5", 1.95), // a second listing of the same line: the better price wins
  q("M Rahim Milestones", "50+", null, 2.1), // not read
  q("Runs in First 20 Overs", "Under", "68.5", 1.83), // not read
  q("Method of Dismissal 6-Way", "Caught", null, 2),
  q("Towhid Hridoy Innings Runs", "Under", "37.5", 1.8333), // one side only: kept, the other is null
];

test("a market line is one row with the best price each side; the other markets come as over/under lines or picks", () => {
  const rows = parseQuotes(QUOTES);
  assert.deepEqual(rows.map((r) => [r.kind, r.player || r.team || r.market, r.line ?? null, r.over ?? null, r.under ?? null]), [
    ["team_runs", "Bangladesh", 250.5, 1.95, 1.8],
    ["player_runs", "M Rahim", 33.5, 1.833, 1.833],
    ["player_runs", "M Rahim", 43.5, 2.6, 1.45],
    ["player_runs", "Towhid Hridoy", 37.5, null, 1.833],
    ["ou", "Runs in First 20 Overs", 68.5, null, 1.83],
    ["pick", "M Rahim Milestones", null, null, null],
    ["pick", "Method of Dismissal 6-Way", null, null, null],
  ]);
  assert.equal(rows.find((r) => r.kind === "team_runs").inn, 1);
  assert.deepEqual(rows.find((r) => r.market === "M Rahim Milestones").outcomes, [{ label: "50+", price: 2.1 }]);
});

test("a pick keeps its outcomes with the best price each and the sub-label, at most twelve of them", () => {
  const rows = parseQuotes([
    { group_name: "To Score Most Runs", label: "A", odds_dec: 2 }, { group_name: "To Score Most Runs", label: "A", odds_dec: 2.2 }, { group_name: "To Score Most Runs", label: "B", n2: "Pakistan", odds_dec: 3 },
    ...Array.from({ length: 20 }, (_, i) => ({ group_name: "Many", label: `p${i}`, odds_dec: 5 })),
  ]);
  assert.deepEqual(rows.find((r) => r.market === "To Score Most Runs").outcomes, [{ label: "A", price: 2.2 }, { label: "B", price: 3, sub: "Pakistan" }]);
  assert.equal(rows.find((r) => r.market === "Many").outcomes.length, 12);
});

test("a price is decimal above 1 and rounds to three places; a quote with no price or no name is ignored", () => {
  assert.equal(parseQuotes([q("A Innings Runs", "Over", "10.5", 1.8333333333)])[0].over, 1.833);
  assert.equal(parseQuotes([q("A Innings Runs", "Over", "10.5", 1)]).length, 0); // 1.00 is no price
  assert.equal(parseQuotes([q("", "Over", "10.5", 2)]).length, 0);
  assert.equal(parseQuotes([{ group_name: "A Innings Runs", side: "Over", handicap: "x", odds_dec: 2 }]).length, 0); // no line and no label
  assert.deepEqual(parseQuotes([q("A Innings Runs", "Over", null, 2)]).map((r) => r.kind), ["pick"]); // no line: it is a pick
});

test("only matches that have started are kept, and one with no line at all is dropped", () => {
  const doc = { matches: [
    { home: "Bangladesh", away: "West Indies", league: "2nd Test", in_play: true, kickoff_utc: "2026-11-05T03:30:00Z", quotes: QUOTES },
    { home: "India", away: "Australia", in_play: false, quotes: QUOTES },
    { home: "Pakistan", away: "Sri Lanka", in_play: true, quotes: [] },
  ] };
  const ms = parseInplayFeed(doc);
  assert.equal(ms.length, 1);
  assert.deepEqual([ms[0].home, ms[0].away, ms[0].kickoff], ["Bangladesh", "West Indies", "2026-11-05T03:30:00Z"]);
  assert.deepEqual(parseInplayFeed(null), []);
});

test("match winner style markets are not kept, whichever book lists them", () => {
  assert.ok(["Match Winner (Incl. Draw)", "Match Odds", "Draw No Bet - Match Odds", "Double Chance", "2-Way Match Betting", "Team to Lead after 1st Innings"].every((n) => SKIP_MARKET.test(n)));
  assert.equal(parseQuotes([q("Match Winner (Incl. Draw)", "Bangladesh", null, 51), q("Double Chance", "Draw or Bangladesh", null, 3)]).length, 0);
  assert.equal(parseQuotes([q("Next Batter Out", "A", null, 3)]).length, 1);
});

test("the readers' matches are one list: a match once, its lines joined, the same line from the same book kept once", () => {
  const a = [{ home: "Bangladesh", away: "West Indies", league: "", kickoff: null, lines: [{ kind: "team_runs", team: "Bangladesh", inn: 1, line: 250.5, over: 1.9, under: 1.8 }] }];
  const b = [{ home: "West Indies", away: "Bangladesh", league: "2nd Test", kickoff: "2026-11-05T03:30:00Z", lines: [
    { kind: "team_runs", team: "Bangladesh", inn: 1, line: 250.5, over: 1.9, under: 1.8, book: "BookK" },
    { kind: "team_runs", team: "Bangladesh", inn: 1, line: 250.5, over: 1.9, under: 1.8, book: "BookK" },
    { kind: "pick", market: "Next Batter Out", outcomes: [], book: "BookK" },
  ] }, { home: "", away: "", lines: [] }];
  const m = mergeMatches(a, b);
  assert.equal(m.length, 1);
  assert.equal(m[0].league, "2nd Test");
  assert.equal(m[0].lines.length, 3); // the feed's own, BookK's innings line once, its pick
  assert.deepEqual(mergeMatches([], undefined), []);
});

test("the route serves the Supabase row while it is fresh, an empty list when it is stale or there is none, and reads once per window", async () => {
  let hits = 0, row = null;
  const server = createServer((req, res) => { hits++; assert.equal(req.headers.apikey, "anon-key"); assert.match(req.url, /^\/rest\/v1\/inplay_lines\?select=as_of,body&id=eq\.1$/); res.setHeader("content-type", "application/json"); res.end(JSON.stringify(row ? [row] : [])); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { default: handler, fromRow, snapshot, STALE_MS } = await import("../api/inplay.js");
  const call = async (method = "GET") => { let out; await handler({ method }, { setHeader() {}, status(c) { return { json(b) { out = { c, b }; } }; } }); return out; };
  const wrapKey = process.env.DATA_WRAP_KEY; // CI sets one; the route wraps its body with it, and this test reads the plain body
  delete process.env.DATA_WRAP_KEY;
  const saved = { u: process.env.SUPABASE_URL, k: process.env.SUPABASE_ANON_KEY };
  try {
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_ANON_KEY;
    assert.deepEqual((await call()).b.matches, []); // not configured: empty, not an error
    process.env.SUPABASE_URL = `http://127.0.0.1:${server.address().port}`; process.env.SUPABASE_ANON_KEY = "anon-key";
    const t0 = Date.now() + 600e6; // past the empty body's window
    row = { as_of: new Date(t0 - 10_000).toISOString(), body: { matches: [{ home: "Bangladesh", away: "West Indies", lines: [{ kind: "player_runs", player: "M Rahim", line: 33.5, over: 1.833, under: 1.833 }] }] } };
    const a = await snapshot(t0);
    assert.equal(a.matches.length, 1);
    assert.equal(a.matches[0].lines[0].line, 33.5);
    await snapshot(t0 + 5_000);
    assert.equal(hits, 1); // inside 15 s: no second request
    row = { as_of: new Date(t0 - STALE_MS - 1000).toISOString(), body: { matches: a.matches } };
    assert.deepEqual((await snapshot(t0 + 20_000)).matches, []); // the writer stopped: an old price is not shown
    assert.equal(hits, 2);
    assert.deepEqual(fromRow(null).matches, []);
    assert.deepEqual(fromRow({ as_of: "not a date", body: { matches: [{}] } }).matches, []);
    assert.deepEqual(fromRow({ as_of: new Date().toISOString(), body: {} }).matches, []);
    const r = await call();
    assert.equal(r.c, 200);
    assert.equal(r.b.source, "inplay");
    assert.equal((await call("POST")).c, 405);
  } finally {
    server.close();
    for (const [k, v] of [["SUPABASE_URL", saved.u], ["SUPABASE_ANON_KEY", saved.k], ["DATA_WRAP_KEY", wrapKey]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

// ---- folding the live lines into the lines data the tables read
import { liveMerge } from "@cricket/engine/inplay-lines.js";

const prematch = () => ({
  generated_at_utc: "2026-11-09T05:00:00Z",
  lines: [
    { pid: "p-rahim", player: "Mushfiqur Rahim", team: "Bangladesh", fmt: "Test", stat: "runs", line: 25.5, match: "Bangladesh vs West Indies", competition: "2nd Test", start_utc: "2026-11-05T03:00:00Z", books: [{ source: "bet365", kind: "bookmaker", over: 1.8, under: 1.9 }, { source: "Dafabet", kind: "bookmaker", over: 1.85, under: 1.85 }] },
    { pid: "p-rahim", player: "Mushfiqur Rahim", team: "Bangladesh", fmt: "Test", stat: "fours", line: 2.5, match: "Bangladesh vs West Indies", competition: "2nd Test", start_utc: "2026-11-05T03:00:00Z", books: [{ source: "bet365", kind: "bookmaker", over: 1.8, under: 1.9 }] },
    { pid: "p-other", player: "Other", team: "India", fmt: "T20", stat: "runs", line: 10.5, match: "India vs Australia", competition: "T20", start_utc: "2026-11-09T10:00:00Z", books: [] },
  ],
  fancy: [
    { match: "Bangladesh vs West Indies", home: "Bangladesh", away: "West Indies", start_utc: "2026-11-05T03:00:00Z", fmt: "Test", competition: "2nd Test", key: "team_total_runs", scope: "team", team: "Bangladesh", inn: 1, line: 200.5, over: 1.9, under: 1.9, source: "bet365", kind: "bookmaker" },
    { match: "Bangladesh vs West Indies", home: "Bangladesh", away: "West Indies", start_utc: "2026-11-05T03:00:00Z", fmt: "Test", competition: "2nd Test", key: "team_total_runs", scope: "team", team: "West Indies", inn: 1, line: 300.5, over: 1.9, under: 1.9, source: "bet365", kind: "bookmaker" },
  ],
});
const resolveRahim = (name) => (/rahim/i.test(name) ? { pid: "p-rahim", name: "Mushfiqur Rahim", team: "Bangladesh" } : null);
const inplayDoc = () => ({ matches: parseInplayFeed({ matches: [
  { home: "Bangladesh", away: "West Indies", in_play: true, quotes: [...QUOTES, q("Litton Das Innings Runs", "Over", "20.5", 1.9), q("Litton Das Innings Runs", "Under", "20.5", 1.9)] },
  { home: "Pakistan", away: "Sri Lanka", in_play: true, quotes: [q("Babar Innings Runs", "Over", "40.5", 1.9)] }, // never priced before the start: left out
] }) });

test("live lines replace the earlier ones for the same player runs and side innings, and leave everything else alone", () => {
  const out = liveMerge(prematch(), inplayDoc(), resolveRahim);
  const rahim = out.lines.filter((l) => l.pid === "p-rahim" && l.stat === "runs");
  assert.deepEqual(rahim.map((l) => [l.line, l.books[0].over, l.books[0].under, l.books[0].live, l.books.length, l.books[0].source]), [[33.5, 1.833, 1.833, true, 1, "bet365"], [43.5, 2.6, 1.45, true, 1, "bet365"]]);
  assert.equal(rahim[0].match, "Bangladesh vs West Indies");
  assert.equal(rahim[0].start_utc, "2026-11-05T03:00:00Z");
  assert.equal(rahim[0].fmt, "Test");
  assert.equal(out.lines.filter((l) => l.stat === "fours").length, 1); // other stats untouched
  assert.equal(out.lines.filter((l) => l.pid === "p-other").length, 1); // other matches untouched
  const bd = out.fancy.filter((f) => f.team === "Bangladesh");
  assert.deepEqual(bd.map((f) => [f.key, f.inn, f.line, f.over, f.under, f.live, f.source]), [["team_total_runs", 1, 250.5, 1.95, 1.8, true, "bet365"]]);
  assert.equal(out.fancy.filter((f) => f.team === "West Indies").length, 1); // the other side's line stays
  assert.equal(out.fancy.find((f) => f.team === "West Indies").line, 300.5);
});

test("a batter who cannot be linked, and every other market, go to the live rows; an unpriced match is left out", () => {
  const out = liveMerge(prematch(), inplayDoc(), resolveRahim);
  assert.equal(out.live.length, 1);
  assert.deepEqual([out.live[0].home, out.live[0].away, out.live[0].fmt], ["Bangladesh", "West Indies", "Test"]);
  const names = out.live[0].markets.map((x) => x.market);
  assert.ok(names.includes("Litton Das innings runs")); // not linked: shown as a row of its own
  assert.ok(names.includes("Runs in First 20 Overs") && names.includes("Method of Dismissal 6-Way") && names.includes("M Rahim Milestones"));
  assert.equal(out.live[0].markets.find((x) => x.market === "Litton Das innings runs").line, 20.5);
  assert.ok(!out.live.some((m) => m.home === "Pakistan"));
});

test("with nothing live the data is returned as it is", () => {
  const doc = prematch();
  assert.equal(liveMerge(doc, { matches: [] }, resolveRahim), doc);
  assert.equal(liveMerge(doc, null, resolveRahim), doc);
  assert.equal(liveMerge(null, inplayDoc(), resolveRahim), null);
  // the resolver knows nobody: a batter the books priced before the start is still linked through those earlier lines (the same spelling), so nothing is half-linked
  const out = liveMerge(prematch(), inplayDoc(), () => null);
  assert.deepEqual(out.lines.filter((l) => l.stat === "runs" && l.pid === "p-rahim").map((l) => l.books[0].live), [true, true]); // his 33.5 and 43.5, not the old 25.5
  // a batter with no earlier line and no link goes to the live rows
  assert.ok(out.live[0].markets.some((x) => x.market === "Litton Das innings runs" && x.line === 20.5));
});

import { liveRows } from "@cricket/engine/inplay-lines.js";

test("a fixture's other live markets, either way round, and none for another match", () => {
  const out = liveMerge(prematch(), inplayDoc(), resolveRahim);
  assert.ok(liveRows(out, { a: "West Indies", b: "Bangladesh" }).length >= 4);
  assert.deepEqual(liveRows(out, { a: "India", b: "Australia" }), []);
  assert.deepEqual(liveRows(prematch(), { a: "West Indies", b: "Bangladesh" }), []);
  assert.deepEqual(liveRows(out, {}), []);
});

test("two books' lines for the same batter and line are one entry with both quotes, and each side's innings line is a row per book", () => {
  const doc = prematch();
  const inplay = { matches: [{ home: "Bangladesh", away: "West Indies", lines: [
    { kind: "player_runs", player: "M Rahim", line: 33.5, over: 1.8, under: 1.9 },
    { kind: "player_runs", player: "M Rahim", line: 33.5, over: 1.85, under: 1.85, book: "BookK" },
    { kind: "team_runs", team: "Bangladesh", inn: 1, line: 250.5, over: 1.9, under: 1.8 },
    { kind: "team_runs", team: "Bangladesh", inn: 1, line: 255.5, over: 1.9, under: 1.8, book: "BookE" },
  ] }] };
  const out = liveMerge(doc, inplay, resolveRahim);
  const r = out.lines.filter((l) => l.pid === "p-rahim" && l.stat === "runs");
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].books.map((b) => b.source), ["bet365", "BookK"]);
  assert.deepEqual(out.fancy.filter((f) => f.team === "Bangladesh").map((f) => [f.source, f.line]), [["bet365", 250.5], ["BookE", 255.5]]);
});

test("the match's 1st innings score takes the live line too while only one side has a 1st-innings line, and every live market names its book", () => {
  const doc = prematch();
  doc.fancy.push({ match: "Bangladesh vs West Indies", home: "Bangladesh", away: "West Indies", start_utc: "2026-11-05T03:00:00Z", fmt: "Test", competition: "2nd Test", key: "first_innings_runs", scope: "match", team: null, line: 325.5, over: 1.83, under: 1.83, source: "bet365", kind: "bookmaker" });
  const one = { matches: [{ home: "Bangladesh", away: "West Indies", lines: [{ kind: "team_runs", team: "Bangladesh", inn: 1, line: 250.5, over: 1.9, under: 1.8 }, { kind: "ou", market: "Runs in First 20 Overs", line: 68.5, over: 1.9, under: 1.8, book: "BookK" }, { kind: "ou", market: "Other", line: 1.5, over: 1.9, under: 1.8 }] }] };
  const out = liveMerge(doc, one, resolveRahim);
  const first = out.fancy.filter((f) => f.key === "first_innings_runs");
  assert.deepEqual(first.map((f) => [f.line, f.scope, f.team, f.live]), [[250.5, "match", null, true]]); // the pre-match 325.5 is gone
  assert.deepEqual(out.live[0].markets.map((x) => x.book), ["BookK", "bet365"]);
  // both sides have a 1st-innings line (the first is over): the match's market is left as it was
  const two = { matches: [{ home: "Bangladesh", away: "West Indies", lines: [{ kind: "team_runs", team: "Bangladesh", inn: 1, line: 250.5, over: 1.9, under: 1.8 }, { kind: "team_runs", team: "West Indies", inn: 1, line: 300.5, over: 1.9, under: 1.8 }] }] };
  assert.equal(liveMerge(doc, two, resolveRahim).fancy.filter((f) => f.key === "first_innings_runs")[0].line, 325.5);
});

test("a live line records where the market opened, and a batter is linked through the same book's own earlier spelling", () => {
  const doc = prematch();
  doc.lines[0].book_name = "M Rahim";
  doc.lines.push({ pid: "p-rahim", player: "Mushfiqur Rahim", book_name: "M Rahim", team: "Bangladesh", fmt: "Test", stat: "runs", line: 45.5, match: "Bangladesh vs West Indies", competition: "2nd Test", start_utc: "2026-11-05T03:00:00Z", books: [{ source: "bet365", kind: "bookmaker", over: 2.6, under: 1.45 }] });
  doc.fancy.push({ match: "Bangladesh vs West Indies", home: "Bangladesh", away: "West Indies", start_utc: "2026-11-05T03:00:00Z", fmt: "Test", competition: "2nd Test", key: "first_innings_runs", scope: "match", team: null, line: 325.5, over: 1.83, under: 1.83, source: "bet365", kind: "bookmaker" });
  const inplay = { matches: [{ home: "Bangladesh", away: "West Indies", lines: [
    { kind: "player_runs", player: "M Rahim", line: 33.5, over: 1.8, under: 1.9 },
    { kind: "team_runs", team: "Bangladesh", inn: 1, line: 250.5, over: 1.9, under: 1.8 },
  ] }] };
  const out = liveMerge(doc, inplay, () => null); // the resolver knows nobody: the earlier lines do the linking
  const r = out.lines.filter((l) => l.pid === "p-rahim" && l.stat === "runs");
  assert.equal(r.length, 1);
  assert.equal(r[0].books[0].opened, 25.5); // of 25.5 (1.8 / 1.9) and 45.5 (2.6 / 1.45) the first is nearer evens
  assert.equal(r[0].player, "Mushfiqur Rahim");
  const team = out.fancy.find((f) => f.key === "team_total_runs" && f.team === "Bangladesh");
  assert.equal(team.opened, 200.5);
  assert.equal(out.fancy.find((f) => f.key === "first_innings_runs").opened, 325.5);
  assert.equal(out.live?.length ?? 0, 0); // nothing fell through to the generic rows
});

test("the merged data says which live player lines it holds and the minute, so a cache keyed on the file's timestamp is not reused", () => {
  const at = (iso) => ({ asOf: iso, matches: inplayDoc().matches });
  const a = liveMerge(prematch(), at("2026-11-09T09:30:10.000Z"), resolveRahim), b = liveMerge(prematch(), at("2026-11-09T09:30:50.000Z"), resolveRahim), c = liveMerge(prematch(), at("2026-11-09T09:31:05.000Z"), resolveRahim);
  assert.equal(a.live_sig, "p-rahim|runs|33.5,p-rahim|runs|43.5@" + Math.floor(Date.parse("2026-11-09T09:30:00Z") / 60000));
  assert.equal(a.live_sig, b.live_sig); // the same minute: one scoring
  assert.notEqual(a.live_sig, c.live_sig); // the next minute: scored again
  assert.equal(liveMerge(prematch(), { asOf: "2026-11-09T09:30:00Z", matches: [] }, resolveRahim).live_sig, undefined); // nothing live: the plain data
});
