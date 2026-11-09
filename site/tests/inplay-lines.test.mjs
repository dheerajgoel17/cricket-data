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
import { keepLiveOu, liveMerge, milestoneRows } from "@cricket/engine/inplay-lines.js";

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

test("live lines are added beside the pre-match ones (never replacing them) and leave everything else alone", () => {
  const out = liveMerge(prematch(), inplayDoc(), resolveRahim);
  const rahim = out.lines.filter((l) => l.pid === "p-rahim" && l.stat === "runs");
  assert.deepEqual(rahim.map((l) => [l.line, l.books[0].over, l.books[0].under, l.books[0].live, l.books.length, l.books[0].source]), [[25.5, 1.8, 1.9, undefined, 2, "bet365"], [33.5, 1.833, 1.833, true, 1, "bet365"], [43.5, 2.6, 1.45, true, 1, "bet365"], [49.5, 2.1, null, true, 1, "bet365"]]); // his pre-match 25.5 stays (two books); his "50+" is a line of his own: 49.5, Yes only
  assert.equal(rahim[0].match, "Bangladesh vs West Indies");
  assert.equal(rahim[0].start_utc, "2026-11-05T03:00:00Z");
  assert.equal(rahim[0].fmt, "Test");
  assert.equal(out.lines.filter((l) => l.stat === "fours").length, 1); // other stats untouched
  assert.equal(out.lines.filter((l) => l.pid === "p-other").length, 1); // other matches untouched
  const bd = out.fancy.filter((f) => f.team === "Bangladesh");
  assert.deepEqual(bd.map((f) => [f.key, f.inn, f.line, f.over, f.under, f.live, f.source]), [["team_total_runs", 1, 200.5, 1.9, 1.9, undefined, "bet365"], ["team_total_runs", 1, 250.5, 1.95, 1.8, true, "bet365"]]); // the pre-match total stays beside the live one
  assert.equal(out.fancy.filter((f) => f.team === "West Indies").length, 1); // the other side's line stays
  assert.equal(out.fancy.find((f) => f.team === "West Indies").line, 300.5);
});

test("a batter who cannot be linked and the runs over a stretch of overs go to the live rows; dismissal and other picks are not shown; an unpriced match is left out", () => {
  const out = liveMerge(prematch(), inplayDoc(), resolveRahim);
  assert.equal(out.live.length, 1);
  assert.deepEqual([out.live[0].home, out.live[0].away, out.live[0].fmt], ["Bangladesh", "West Indies", "Test"]);
  const names = out.live[0].markets.map((x) => x.market);
  assert.ok(names.includes("Litton Das innings runs")); // not linked: shown as a row of its own
  assert.ok(names.includes("Runs in First 20 Overs"));
  assert.ok(!names.includes("Method of Dismissal 6-Way") && !names.includes("M Rahim Milestones")); // nothing to judge a dismissal by; the milestone is in his props
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
  assert.deepEqual(out.lines.filter((l) => l.stat === "runs" && l.pid === "p-rahim").map((l) => l.books[0].live), [undefined, true, true, true]); // his pre-match 25.5, then the live 33.5, 43.5 and the 50+ line
  // a batter with no earlier line and no link goes to the live rows
  assert.ok(out.live[0].markets.some((x) => x.market === "Litton Das innings runs" && x.line === 20.5));
});

import { liveRows } from "@cricket/engine/inplay-lines.js";

test("a fixture's other live markets, either way round, and none for another match", () => {
  const out = liveMerge(prematch(), inplayDoc(), resolveRahim);
  assert.deepEqual(liveRows(out, { a: "West Indies", b: "Bangladesh" }).map((x) => x.market), ["Litton Das innings runs", "Towhid Hridoy innings runs", "Runs in First 20 Overs"]);
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
  const r = out.lines.filter((l) => l.pid === "p-rahim" && l.stat === "runs" && l.books.some((b) => b.live)); // his live lines
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].books.map((b) => b.source), ["bet365", "BookK"]);
  assert.deepEqual(out.fancy.filter((f) => f.team === "Bangladesh" && f.live).map((f) => [f.source, f.line]), [["bet365", 250.5], ["BookE", 255.5]]);
});

test("the match's 1st innings score takes the live line too while only one side has a 1st-innings line, and every live market names its book", () => {
  const doc = prematch();
  doc.fancy.push({ match: "Bangladesh vs West Indies", home: "Bangladesh", away: "West Indies", start_utc: "2026-11-05T03:00:00Z", fmt: "Test", competition: "2nd Test", key: "first_innings_runs", scope: "match", team: null, line: 325.5, over: 1.83, under: 1.83, source: "bet365", kind: "bookmaker" });
  const one = { matches: [{ home: "Bangladesh", away: "West Indies", lines: [{ kind: "team_runs", team: "Bangladesh", inn: 1, line: 250.5, over: 1.9, under: 1.8 }, { kind: "ou", market: "Runs in First 20 Overs", line: 68.5, over: 1.9, under: 1.8, book: "BookK" }, { kind: "ou", market: "Other", line: 1.5, over: 1.9, under: 1.8 }] }] }; // "Other" is not a stretch of overs: not shown
  const out = liveMerge(doc, one, resolveRahim);
  const first = out.fancy.filter((f) => f.key === "first_innings_runs");
  assert.deepEqual(first.map((f) => [f.line, f.scope, f.team, f.live]), [[325.5, "match", null, undefined], [250.5, "match", null, true]]); // the pre-match 325.5 stays beside it
  assert.deepEqual(out.live[0].markets.map((x) => x.book), ["BookK"]);
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
  const r = out.lines.filter((l) => l.pid === "p-rahim" && l.stat === "runs" && l.books.some((b) => b.live)); // his live lines
  assert.equal(r.length, 1);
  assert.equal(r[0].books[0].opened, 25.5); // of 25.5 (1.8 / 1.9) and 45.5 (2.6 / 1.45) the first is nearer evens
  assert.equal(r[0].player, "Mushfiqur Rahim");
  const team = out.fancy.find((f) => f.key === "team_total_runs" && f.team === "Bangladesh" && f.live);
  assert.equal(team.opened, 200.5);
  assert.equal(out.fancy.find((f) => f.key === "first_innings_runs" && f.live).opened, 325.5);
  assert.equal(out.live?.length ?? 0, 0); // nothing fell through to the generic rows
});

test("the merged data says which live player lines it holds and the minute, so a cache keyed on the file's timestamp is not reused", () => {
  const at = (iso) => ({ asOf: iso, matches: inplayDoc().matches });
  const a = liveMerge(prematch(), at("2026-11-09T09:30:10.000Z"), resolveRahim), b = liveMerge(prematch(), at("2026-11-09T09:30:50.000Z"), resolveRahim), c = liveMerge(prematch(), at("2026-11-09T09:31:05.000Z"), resolveRahim);
  assert.equal(a.live_sig, "p-rahim|runs|0|33.5,p-rahim|runs|0|43.5,p-rahim|runs|0|49.5@" + Math.floor(Date.parse("2026-11-09T09:30:00Z") / 60000));
  assert.equal(a.live_sig, b.live_sig); // the same minute: one scoring
  assert.notEqual(a.live_sig, c.live_sig); // the next minute: scored again
  assert.equal(liveMerge(prematch(), { asOf: "2026-11-09T09:30:00Z", matches: [] }, resolveRahim).live_sig, undefined); // nothing live: the plain data
});

// ---- matches the books name differently, and live matches no book priced
import { sameTeam } from "@cricket/engine/inplay-lines.js";

test("a side with a level left off matches (Bangladesh / Bangladesh U19, India / India A), others do not", () => {
  assert.ok(sameTeam("Bangladesh", "Bangladesh U19") && sameTeam("India A", "India") && sameTeam("Pakistan", "Pakistan"));
  assert.ok(!sameTeam("Bangladesh", "India") && !sameTeam("Bangladesh U19", "Bangladesh A") && !sameTeam("", "India"));
});

test("a live match the books name without the level finds its priced match by the start, and the wrong start does not match", () => {
  const doc = prematch();
  doc.lines.push({ pid: "p-x", player: "Some Player", team: "Bangladesh U19", fmt: "ODI", stat: "runs", line: 20.5, match: "Bangladesh U19 vs Malaysia U19", competition: "U19", start_utc: "2026-11-09T05:00:00Z", books: [{ source: "bet365", kind: "bookmaker", over: 1.9, under: 1.9 }] });
  const lines = [{ kind: "ou", market: "Runs in First 6 Overs", line: 8.5, over: 1.9, under: 1.8 }];
  const ok = liveMerge(doc, { matches: [{ home: "Bangladesh", away: "Malaysia", kickoff: "2026-11-09T05:30:00Z", lines }] }, () => null);
  assert.deepEqual([ok.live[0].home, ok.live[0].away], ["Bangladesh U19", "Malaysia U19"]); // the site's names
  const later = liveMerge(doc, { matches: [{ home: "Bangladesh", away: "Malaysia", kickoff: "2026-11-12T05:30:00Z", lines }] }, () => null);
  assert.equal((later.live || []).length, 0); // another day's match is not this one
});

test("a live match no book priced takes its fixture from the site's list, a finished or other one does not", () => {
  const fixtures = [{ a: "Sri Lanka U19", b: "Afghanistan U19", start: "2026-11-09T05:00Z", fmt: "ODI", series: "U19 Asia Cup" }];
  const inplay = { matches: [{ home: "Sri Lanka", away: "Afghanistan", kickoff: "2026-11-09T05:00:00Z", lines: [{ kind: "player_runs", player: "A Batter", line: 20.5, over: 1.9, under: 1.9 }, { kind: "team_runs", team: "Sri Lanka", inn: 1, line: 250.5, over: 1.9, under: 1.8 }, { kind: "ou", market: "Runs in First 6 Overs", line: 8.5, over: 1.9, under: 1.8 }] }] };
  const out = liveMerge(prematch(), inplay, () => ({ pid: "p-batter", name: "A Batter", team: "Sri Lanka U19" }), fixtures);
  assert.deepEqual(out.lines.filter((l) => l.pid === "p-batter").map((l) => [l.fmt, l.match, l.books[0].live]), [["ODI", "Sri Lanka U19 vs Afghanistan U19", true]]);
  assert.deepEqual(out.fancy.filter((f) => f.live && f.key === "team_total_runs").map((f) => [f.team, f.fmt, f.home]), [["Sri Lanka U19", "ODI", "Sri Lanka U19"]]); // the site's name for the side
  assert.equal(out.live[0].markets.length, 1);
  assert.deepEqual(liveRows(out, { a: "Afghanistan U19", b: "Sri Lanka U19" }).map((x) => x.market), ["Runs in First 6 Overs"]);
  assert.deepEqual(liveMerge(prematch(), inplay, () => null, []).live, []); // no fixture, no priced match: nothing to attach to
});

// ---- what is shown of the live markets: only what can be judged

test("runs over a stretch of overs are kept; a single over or delivery, the fall of a wicket, wickets lost and dismissal are not", () => {
  for (const m of ["Runs in First 20 Overs", "Runs in First 6 Overs", "Overs 0-10 Over/Under 70.5 Runs", "Overs 1-45 Runs", "0-5 Over Runs", "6 Over Runs", "10 over runs", "Powerplay Runs"]) assert.ok(keepLiveOu(m), m);
  for (const m of ["Runs in over 3", "Over/Under 7.5 Runs In Over 12", "Runs Off Delivery 4", "Runs off 3rd ball", "Runs at Fall of 3rd Wicket", "Fall of Wicket 1 Runs", "Wickets Lost for 100 Runs", "Wicket in an over", "Runs In Over 5 odd or even", "Next Over Runs", "Method of Dismissal", "Other", ""]) assert.ok(!keepLiveOu(m), m);
});

test("a batter's milestone becomes rows of his own: a named market with Yes / No, a generic one with the batters as outcomes", () => {
  const out = (market, outcomes) => milestoneRows({ kind: "pick", market, outcomes }).map((r) => [r.player, r.rung, r.line, r.over, r.under]);
  assert.deepEqual(out("Saud Shakeel To Score 50+ Runs", [{ label: "Yes", price: 2.2 }, { label: "No", price: 1.65 }]), [["Saud Shakeel", 50, 49.5, 2.2, 1.65]]);
  assert.deepEqual(out("M Rahim Milestones", [{ label: "50+", price: 2.1 }, { label: "100+", price: 6 }]), [["M Rahim", 50, 49.5, 2.1, null], ["M Rahim", 100, 99.5, 6, null]]);
  assert.deepEqual(out("To Score a Century", [{ label: "Babar Azam", price: 5 }, { label: "Saud Shakeel", price: 7.5 }, { label: "Any Other", price: 2 }]), [["Babar Azam", 100, 99.5, 5, null], ["Saud Shakeel", 100, 99.5, 7.5, null]]);
  assert.deepEqual(out("Batter Milestones", [{ label: "Babar Azam 50+", price: 2.4 }, { label: "Babar Azam 100+", price: 7 }]), [["Babar Azam", 50, 49.5, 2.4, null], ["Babar Azam", 100, 99.5, 7, null]]);
  for (const m of ["To Score Most Runs", "Top Batter", "Method of Dismissal 6-Way", "Next Batter Out", "Fastest Fifty", "Team to score 50+ in powerplay"]) assert.deepEqual(out(m, [{ label: "A B", price: 3 }]), [], m);
});

test("a linked batter's milestone is a live line in his props (replacing the earlier one at that line), an unlinked one is not shown, and no other pick is", () => {
  const doc = prematch();
  doc.lines.push({ pid: "p-rahim", player: "Mushfiqur Rahim", team: "Bangladesh", fmt: "Test", stat: "runs", line: 49.5, match: "Bangladesh vs West Indies", competition: "2nd Test", start_utc: "2026-11-05T03:00:00Z", books: [{ source: "bet365", kind: "bookmaker", over: 3, under: null }] });
  const inplay = { matches: [{ home: "Bangladesh", away: "West Indies", lines: [
    { kind: "pick", market: "To Score a Century", outcomes: [{ label: "M Rahim", price: 5 }, { label: "Nobody Known", price: 9 }] },
    { kind: "pick", market: "M Rahim To Score 50+ Runs", outcomes: [{ label: "Yes", price: 2.2 }, { label: "No", price: 1.65 }] },
    { kind: "pick", market: "Method of Dismissal", outcomes: [{ label: "Caught", price: 2 }] },
  ] }] };
  const out = liveMerge(doc, inplay, resolveRahim);
  const rahim = out.lines.filter((l) => l.pid === "p-rahim" && l.stat === "runs");
  assert.deepEqual(rahim.map((l) => [l.line, l.books[0].over, l.books[0].under, l.books[0].live]).sort((a, b) => a[0] - b[0]), [[25.5, 1.8, 1.9, undefined], [49.5, 3, null, undefined], [49.5, 2.2, 1.65, true], [99.5, 5, null, true]]); // the pre-match 49.5 and 25.5 stays (no live O/U line)
  assert.equal(out.lines.filter((l) => l.pid !== "p-rahim" && l.pid !== "p-other").length, 0); // the unlinked batter has no row
  assert.deepEqual(liveRows(out, { a: "Bangladesh", b: "West Indies" }), []); // no milestone, dismissal or pick lands in Match Fancy
});

test("a Test's live batter line is his side's current innings: it replaces that innings' line only, keeps his match total, and is tagged with the innings", () => {
  const doc = prematch();
  const base = { player: "Mushfiqur Rahim", team: "Bangladesh", fmt: "Test", stat: "runs", match: "Bangladesh vs West Indies", competition: "2nd Test", start_utc: "2026-11-05T03:00:00Z", pid: "p-rahim" };
  doc.lines = doc.lines.filter((l) => l.pid !== "p-rahim"); // start from his lines only
  doc.lines.push(
    { ...base, line: 31.5, inn: 1, books: [{ source: "bet365", kind: "bookmaker", over: 1.85, under: 1.85 }] }, // his 1st innings
    { ...base, line: 69.5, books: [{ source: "bet365", kind: "bookmaker", over: 1.8, under: 1.9 }] }, // his match total
  );
  const inplay = { matches: [{ home: "Bangladesh", away: "West Indies", lines: [
    { kind: "player_runs", player: "M Rahim", line: 95.5, over: 1.83, under: 1.83 },
    { kind: "pick", market: "M Rahim To Score 100+ Runs", outcomes: [{ label: "Yes", price: 3 }] },
  ] }] };
  const first = liveMerge(doc, inplay, resolveRahim, [], () => 1).lines.filter((l) => l.pid === "p-rahim");
  assert.deepEqual(first.map((l) => [l.line, l.inn || 0, !!l.books[0].live]).sort((a, b) => a[0] - b[0]), [[31.5, 1, false], [69.5, 0, false], [95.5, 1, true], [99.5, 1, true]]); // his pre-match 31.5 (1st innings) and 69.5 (match) stay
  assert.equal(first.find((l) => l.line === 95.5).books[0].opened, 31.5); // "was" is the same innings' line, not the match total
  const second = liveMerge(doc, inplay, resolveRahim, [], () => 2).lines.filter((l) => l.pid === "p-rahim");
  assert.deepEqual(second.map((l) => [l.line, l.inn || 0]).sort((a, b) => a[0] - b[0]), [[31.5, 1], [69.5, 0], [95.5, 2], [99.5, 2]]); // his 2nd innings: the 1st-innings line is a finished bet and stays
  assert.equal(second.find((l) => l.line === 95.5).books[0].opened, undefined); // nothing to have opened at
  const plain = liveMerge(doc, inplay, resolveRahim).lines.filter((l) => l.pid === "p-rahim"); // no live match to ask: as before, no scope
  assert.ok(plain.some((l) => l.line === 95.5 && !l.inn));
});

test("a batter's row stays his pre-match one until his runs are past the main pre-match line (nearest evens); then the live line takes over; no pre-match line, or no scorer, shows it at once", () => {
  const doc = prematch();
  const base = { player: "Mushfiqur Rahim", team: "Bangladesh", fmt: "Test", stat: "runs", match: "Bangladesh vs West Indies", competition: "2nd Test", start_utc: "2026-11-05T03:00:00Z", pid: "p-rahim", inn: 1 };
  doc.lines = doc.lines.filter((l) => l.pid !== "p-rahim");
  doc.lines.push({ ...base, line: 31.5, books: [{ source: "bet365", kind: "bookmaker", over: 1.85, under: 1.85 }] }, { ...base, line: 41.5, books: [{ source: "bet365", kind: "bookmaker", over: 2.4, under: 1.5 }] });
  const inplay = { matches: [{ home: "Bangladesh", away: "West Indies", lines: [{ kind: "player_runs", player: "M Rahim", line: 95.5, over: 1.83, under: 1.83 }] }] };
  const runs = (r) => liveMerge(doc, inplay, resolveRahim, [], () => 1, () => r).lines.filter((l) => l.pid === "p-rahim").map((l) => [l.line, !!l.books[0].live]).sort((a, b) => a[0] - b[0]);
  assert.deepEqual(runs(20), [[31.5, false], [41.5, false]]); // short of the main line (31.5, nearest evens): pre-match rows as they were, no live row
  assert.deepEqual(runs(31), [[31.5, false], [41.5, false]]);
  assert.deepEqual(runs(32), [[31.5, false], [41.5, false], [95.5, true]]); // past the main line: the live line is added beside the pre-match ones, with "was" from them
  assert.equal(liveMerge(doc, inplay, resolveRahim, [], () => 1, () => 60).lines.find((l) => l.line === 95.5).books[0].opened, 31.5);
  // a stray high line in the pre-match file (an in-play price that leaked in) does not hold the row back: the main line is the one nearest evens
  doc.lines.push({ ...base, line: 95.5, books: [{ source: "bet365", kind: "bookmaker", over: 1.95, under: 1.75 }] });
  assert.deepEqual(runs(57).filter((l) => l[1]), [[95.5, true]]);
  doc.lines.pop();
  assert.deepEqual(runs(null), [[31.5, false], [41.5, false]]); // not on the board: the pre-match bet stays
  assert.deepEqual(liveMerge(doc, inplay, resolveRahim, [], () => 1).lines.filter((l) => l.pid === "p-rahim").map((l) => l.line), [31.5, 41.5, 95.5]); // no scorer given: the live line is always added
  const second = liveMerge(doc, inplay, resolveRahim, [], () => 2, () => 3).lines.filter((l) => l.pid === "p-rahim").map((l) => [l.line, l.inn]); // his 2nd innings: nothing pre-match in that scope
  assert.deepEqual(second.sort((a, b) => a[0] - b[0]), [[31.5, 1], [41.5, 1], [95.5, 2]]);
});

test("the same rule for a side's innings total and a batter's milestone: the pre-match line stays until the runs are past it", () => {
  const doc = prematch(); // Bangladesh 1st innings 200.5 (fancy), West Indies 300.5
  const base = { player: "Mushfiqur Rahim", team: "Bangladesh", fmt: "Test", stat: "runs", match: "Bangladesh vs West Indies", competition: "2nd Test", start_utc: "2026-11-05T03:00:00Z", pid: "p-rahim", inn: 1 };
  doc.lines = doc.lines.filter((l) => l.pid !== "p-rahim");
  doc.lines.push({ ...base, line: 49.5, books: [{ source: "bet365", kind: "bookmaker", over: 2.2, under: null }] }); // "to score 50", priced before the start
  const inplay = { matches: [{ home: "Bangladesh", away: "West Indies", lines: [
    { kind: "team_runs", team: "Bangladesh", inn: 1, line: 250.5, over: 1.9, under: 1.8 },
    { kind: "pick", market: "M Rahim To Score 50+ Runs", outcomes: [{ label: "Yes", price: 2 }] },
    { kind: "pick", market: "M Rahim To Score 100+ Runs", outcomes: [{ label: "Yes", price: 6 }] },
  ] }] };
  const at = (team, runs) => liveMerge(doc, inplay, resolveRahim, [], () => 1, () => runs, () => team);
  const bd = (out) => out.fancy.filter((f) => f.team === "Bangladesh").map((f) => [f.line, !!f.live]);
  const ml = (out) => out.lines.filter((l) => l.pid === "p-rahim").map((l) => [l.line, !!l.books[0].live]).sort((a, b) => a[0] - b[0]);
  assert.deepEqual(bd(at(150, 30)), [[200.5, false]]); // 150 of 200.5: the pre-match total stays, no live row
  assert.deepEqual(bd(at(200, 30)), [[200.5, false]]);
  assert.deepEqual(bd(at(201, 30)), [[200.5, false], [250.5, true]]); // past it: the live total is added beside it
  assert.deepEqual(bd(at(null, 30)), [[200.5, false]]); // the side is not on the live board: it stays
  assert.deepEqual(bd(liveMerge(doc, inplay, resolveRahim, [], () => 1, () => 30)), [[200.5, false], [250.5, true]]); // no side scorer given: as before
  assert.deepEqual(ml(at(0, 30)), [[49.5, false], [99.5, true]]); // 30 short of the 49.5 he was priced at: that stays; the 100 he was never priced at shows at once
  assert.deepEqual(ml(at(0, 50)), [[49.5, false], [49.5, true], [99.5, true]]); // past 49.5: the live one is added beside it
});
