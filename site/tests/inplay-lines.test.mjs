import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { bookLines, inplayFor, mergeMatches, parseInplayFeed, parseQuotes, playerLine, teamLine } from "@cricket/engine/inplay-lines.js";

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

test("a market line is one row with the best price each side, and only the markets we read", () => {
  const rows = parseQuotes(QUOTES);
  assert.deepEqual(rows.map((r) => [r.kind, r.player || r.team, r.line, r.over, r.under]), [
    ["team_runs", "Bangladesh", 250.5, 1.95, 1.8],
    ["player_runs", "M Rahim", 33.5, 1.833, 1.833],
    ["player_runs", "Towhid Hridoy", 37.5, null, 1.833],
    ["player_runs", "M Rahim", 43.5, 2.6, 1.45],
  ]);
  assert.equal(rows.length, 4);
  assert.equal(rows.find((r) => r.kind === "team_runs").inn, 1);
  assert.equal(rows.filter((r) => r.player === "M Rahim").length, 2);
});

test("a price is decimal above 1 and rounds to three places; a quote with no side or line is ignored", () => {
  assert.equal(parseQuotes([q("A Innings Runs", "Over", "10.5", 1.8333333333)])[0].over, 1.833);
  assert.equal(parseQuotes([q("A Innings Runs", "Over", "10.5", 1)]).length, 0);
  assert.equal(parseQuotes([q("A Innings Runs", "Maybe", "10.5", 2)]).length, 0);
  assert.equal(parseQuotes([q("A Innings Runs", "Over", null, 2)]).length, 0);
  assert.equal(parseQuotes([{ group_name: "A Innings Runs", side: "Over", handicap: "x", odds_dec: 2 }]).length, 0);
});

test("only matches that have started are kept, and one with no line we read is dropped", () => {
  const doc = { matches: [
    { home: "Bangladesh", away: "West Indies", league: "2nd Test", in_play: true, kickoff_utc: "2026-11-05T03:30:00Z", quotes: QUOTES },
    { home: "India", away: "Australia", in_play: false, quotes: QUOTES },
    { home: "Pakistan", away: "Sri Lanka", in_play: true, quotes: [q("Method of Dismissal 6-Way", "Caught", null, 2)] },
  ] };
  const ms = parseInplayFeed(doc);
  assert.equal(ms.length, 1);
  assert.deepEqual([ms[0].home, ms[0].away, ms[0].kickoff], ["Bangladesh", "West Indies", "2026-11-05T03:30:00Z"]);
  assert.deepEqual(parseInplayFeed(null), []);
});

test("a fixture finds its match either way round, and the line nearest even money is the one shown", () => {
  const doc = { matches: parseInplayFeed({ matches: [{ home: "Bangladesh", away: "West Indies", in_play: true, quotes: QUOTES }] }) };
  assert.ok(inplayFor(doc, { a: "West Indies", b: "Bangladesh" }));
  assert.equal(inplayFor(doc, { a: "India", b: "Bangladesh" }), null);
  const m = doc.matches[0];
  assert.equal(teamLine(m, "Bangladesh", 1).line, 250.5);
  assert.equal(teamLine(m, "Bangladesh", 2), null); // a different innings
  assert.equal(playerLine(m, "Mushfiqur Rahim").line, 33.5); // 33.5 is 1.833 / 1.833; 43.5 is 2.6 / 1.45
  assert.equal(playerLine(m, "Towhid Hridoy"), null); // priced on one side only
  assert.equal(playerLine(m, "Litton Das"), null);
});

test("another book's live lines merge onto the same fixture and stay labelled", () => {
  const feed = parseInplayFeed({ matches: [{ home: "Bangladesh", away: "West Indies", in_play: true, quotes: QUOTES }] });
  const extra = [{ home: "West Indies", away: "Bangladesh", lines: [
    { kind: "player_runs", player: "M Rahim", line: 33.5, over: 1.91, under: 1.87, book: "Puntit" },
    { kind: "team_runs", team: "Bangladesh", inn: 1, line: 260.5, over: 1.8, under: 1.9, book: "Puntit" },
  ] }];
  const [m] = mergeMatches(feed, extra);
  assert.equal(bookLines(m, (l) => l.kind === "player_runs" && l.player === "M Rahim").length, 2);
  assert.equal(bookLines(m, (l) => l.kind === "team_runs" && l.inn === 1).find((l) => l.book === "Puntit").line, 260.5);
  assert.equal(mergeMatches([{ home: "India", away: "Australia", lines: [] }], extra).length, 2);
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
