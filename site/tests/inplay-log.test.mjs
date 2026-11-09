import test from "node:test";
import assert from "node:assert/strict";
import { createState, ingest, lineKeyOf, marketName, matchKeyOf, pairOf, pairsToLoad, planRound, scoreState, sigOf, batterOf, liveMatchOf } from "@cricket/engine/inplay-log.js";
import { wrap } from "@cricket/engine/wrap.js";
import { BATCH, PAGE, createLogger, insertRows, loadLatest, readScores } from "../scripts/inplay-log.mjs";
import { run } from "../scripts/inplay-snapshot.mjs";

const KICK = "2026-11-09T05:00:00Z";
const PAIR = "bangladesh|westindies";
const KEY = `${PAIR}@2026-11-09T05:00:00.000Z`;
const AT = "2026-11-09T07:00:15.000Z";

// A T20 in the second innings: Bangladesh 112/3 after 14.2 overs (86 balls), Rahim 41 off 30 and Hridoy 5 off 4 at the crease, Mahmudullah yet to bat.
const T20 = {
  status: "live", fmt: "T20", start: KICK, summary: "BAN need 39 runs", session: "", crr: 7.8, rrr: 9.1, partnership: { runs: 22, balls: 14 },
  teams: [{ name: "Bangladesh", batting: true, display: "112/3 (14.2 ov)" }, { name: "West Indies", batting: false, display: "150/8 (20 ov)" }],
  innings: [{ n: 1, team: "West Indies", runs: 150, wkts: 8, overs: 20 }, { n: 2, team: "Bangladesh", runs: 112, wkts: 3, overs: 14.2 }],
  card: [
    { n: 1, team: "West Indies", batters: [{ name: "Brandon King", runs: 60, balls: 40 }], yetToBat: [] },
    { n: 2, team: "Bangladesh", batters: [{ name: "Mushfiqur Rahim", runs: 41, balls: 30 }, { name: "Towhid Hridoy", runs: 5, balls: 4 }], yetToBat: ["Mahmudullah"] },
  ],
};
const LIVE = { asOf: "2026-11-09T07:00:10.000Z", matches: [T20] };
const M = (lines) => ({ home: "Bangladesh", away: "West Indies", league: "T20I Series", kickoff: KICK, lines });
const rahim = (line, over, under, book) => ({ kind: "player_runs", player: "M Rahim", line, over, under, ...(book ? { book } : {}) });
const loaded = () => { const s = createState(); ingest(s, [PAIR], []); return s; };

test("names and keys: the market as listed, a line's identity whatever its price, a pair whichever way round", () => {
  assert.equal(marketName(rahim(33.5, 1.8, 1.9)), "M Rahim Innings Runs");
  assert.equal(marketName({ kind: "team_runs", team: "Bangladesh", inn: 2 }), "Bangladesh 2nd Inns Runs");
  assert.equal(marketName({ kind: "team_runs", team: "India", inn: 4 }), "India 4th Inns Runs");
  assert.equal(marketName({ kind: "ou", market: "Runs in First 20 Overs" }), "Runs in First 20 Overs");
  assert.equal(lineKeyOf({ ...rahim(33.5, 1.8, 1.9), book: "bet365" }, 1), "bet365|player_runs|m rahim|1|33.5");
  assert.equal(lineKeyOf({ kind: "ou", market: "Runs in  First 20 Overs", line: 68.5, book: "Other" }, null), "other|ou|runs in first 20 overs|0|68.5");
  assert.equal(lineKeyOf({ kind: "pick", market: "Method of Dismissal 6-Way" }, null), "bet365|pick|method of dismissal 6-way|0|");
  assert.equal(pairOf("West Indies", "Bangladesh"), PAIR);
  assert.equal(pairOf("Bangladesh", "West Indies"), PAIR);
});

test("a line's signature is both prices, or every outcome with its price: a moved price changes it, a repeat does not", () => {
  assert.equal(sigOf(rahim(33.5, 1.8, 1.9)), "1.8|1.9");
  assert.equal(sigOf({ ...rahim(33.5, null, 1.9) }), "|1.9");
  assert.equal(sigOf({ over_price: 1.8, under_price: 1.9 }), "1.8|1.9"); // a row read back from the log
  const pick = { kind: "pick", outcomes: [{ label: "Caught", price: 2 }, { label: "Bowled", price: 3.5, sub: "x" }] };
  assert.equal(sigOf(pick), "Caught~~2;Bowled~x~3.5");
  assert.notEqual(sigOf(pick), sigOf({ ...pick, outcomes: [{ label: "Caught", price: 2.1 }, pick.outcomes[1]] }));
});

test("score state in a T20: the batting side, innings, runs / wickets / overs, and the batter's own runs and balls", () => {
  const { inn, score, fmt } = scoreState(T20, rahim(33.5, 1.8, 1.9), LIVE.asOf);
  assert.equal(inn, 1); // his side bats once
  assert.equal(fmt, "T20");
  assert.deepEqual(
    [score.score_at, score.cur_inn, score.bat_team, score.runs, score.wkts, score.overs, score.inn_balls, score.b_runs, score.b_balls],
    [LIVE.asOf, 2, "Bangladesh", 112, 3, 14.2, 86, 41, 30], // 14 overs x 6 + 2 balls = 86
  );
  assert.deepEqual(score.ctx, { status: "live", display: "112/3 (14.2 ov)", summary: "BAN need 39 runs", crr: 7.8, rrr: 9.1, partnership: { runs: 22, balls: 14 } });
  // yet to bat: 0 off 0; a name nobody lists: no batter figures; a side's line carries its own innings
  assert.deepEqual([batterOf(T20, "Mahmudullah").runs, batterOf(T20, "Mahmudullah").balls], [0, 0]);
  assert.equal(scoreState(T20, { kind: "player_runs", player: "Nobody Known", line: 9.5 }, LIVE.asOf).score.b_runs, null);
  assert.equal(scoreState(T20, { kind: "team_runs", team: "Bangladesh", inn: 2, line: 150.5 }, LIVE.asOf).inn, 2);
  assert.equal(scoreState(T20, { kind: "ou", market: "Runs in First 6 Overs", line: 40.5 }, LIVE.asOf).inn, null);
  // no live match: nothing but the line's own scope
  assert.deepEqual(scoreState(null, rahim(33.5, 1.8, 1.9)), { inn: null, score: {} });
});

test("score state in a Test: a batter's innings is his own side's current one, not the match's", () => {
  // India 300 (inn 1), Australia 250 (inn 2), India 80/2 after 25.4 overs in their second innings (inn 3): Kohli batted in both, Sharma is yet to bat in the second
  const test = {
    status: "live", fmt: "Test", start: KICK, teams: [{ name: "India", batting: true }, { name: "Australia", batting: false }],
    innings: [{ n: 1, team: "India", runs: 300, wkts: 10, overs: 90 }, { n: 2, team: "Australia", runs: 250, wkts: 10, overs: 80 }, { n: 3, team: "India", runs: 80, wkts: 2, overs: 25.4 }],
    card: [
      { n: 1, team: "India", batters: [{ name: "Virat Kohli", runs: 100, balls: 150 }, { name: "Rohit Sharma", runs: 20, balls: 40 }], yetToBat: [] },
      { n: 2, team: "Australia", batters: [{ name: "Steve Smith", runs: 70, balls: 120 }], yetToBat: [] },
      { n: 3, team: "India", batters: [{ name: "Virat Kohli", runs: 12, balls: 20 }], yetToBat: ["Rohit Sharma"] },
    ],
  };
  const kohli = scoreState(test, { kind: "player_runs", player: "V Kohli", line: 30.5 }, "x"), rohit = scoreState(test, { kind: "player_runs", player: "R Sharma", line: 20.5 }, "x"), smith = scoreState(test, { kind: "player_runs", player: "S Smith", line: 40.5 }, "x");
  assert.deepEqual([kohli.inn, kohli.score.b_runs, kohli.score.b_balls], [2, 12, 20]); // the second innings, not his 100 off 150
  assert.deepEqual([rohit.inn, rohit.score.b_runs, rohit.score.b_balls], [2, 0, 0]);
  assert.equal(smith.inn, 1); // Australia's first
  assert.deepEqual([kohli.score.cur_inn, kohli.score.runs, kohli.score.wkts, kohli.score.inn_balls], [3, 80, 2, 154]); // 25 x 6 + 4
});

test("a feed match finds its live match by the two sides (either way round) and the start; the live one wins", () => {
  const other = { ...T20, status: "final", start: "2026-11-02T05:00:00Z", teams: [{ name: "West Indies" }, { name: "Bangladesh" }] };
  const doc = { matches: [other, { ...T20, teams: [{ name: "West Indies" }, { name: "Bangladesh" }] }] };
  assert.equal(liveMatchOf(doc, M([])).status, "live");
  assert.equal(liveMatchOf({ matches: [other] }, M([])), null); // a week earlier: not this match
  assert.equal(liveMatchOf({ matches: [{ ...T20, start: "" }] }, { ...M([]), kickoff: null })?.status, "live");
  assert.equal(liveMatchOf(null, M([])), null);
});

test("every market is logged on its first read, the hidden ones too, with its score; a repeated read writes nothing", () => {
  const state = loaded();
  const lines = [
    rahim(33.5, 1.8, 1.9),
    rahim(33.5, 1.85, 1.85, "Other Book"), // the same line at another book is its own line
    { kind: "team_runs", team: "Bangladesh", inn: 2, line: 160.5, over: 1.9, under: 1.9 },
    { kind: "ou", market: "Runs in First 20 Overs", line: 68.5, over: 1.8, under: 1.9 },
    { kind: "pick", market: "Method of Dismissal 6-Way", outcomes: [{ label: "Caught", price: 2 }, { label: "Bowled", price: 3.5 }] },
  ];
  const r1 = planRound(state, [M(lines)], LIVE, AT);
  assert.equal(r1.rows.length, 5);
  assert.equal(r1.unchanged, 0);
  const row = r1.rows[0];
  assert.deepEqual(
    { at: row.at, match_key: row.match_key, pair: row.pair, home: row.home, away: row.away, league: row.league, kickoff: row.kickoff, fmt: row.fmt },
    { at: AT, match_key: KEY, pair: PAIR, home: "Bangladesh", away: "West Indies", league: "T20I Series", kickoff: "2026-11-09T05:00:00.000Z", fmt: "T20" },
  );
  assert.deepEqual(
    { book: row.book, kind: row.kind, market: row.market, subject: row.subject, line_key: row.line_key, inn: row.inn, line: row.line, over_price: row.over_price, under_price: row.under_price, outcomes: row.outcomes },
    { book: "bet365", kind: "player_runs", market: "M Rahim Innings Runs", subject: "M Rahim", line_key: "bet365|player_runs|m rahim|1|33.5", inn: 1, line: 33.5, over_price: 1.8, under_price: 1.9, outcomes: null },
  );
  assert.deepEqual([row.runs, row.wkts, row.overs, row.inn_balls, row.b_runs, row.b_balls, row.bat_team, row.cur_inn, row.score_at], [112, 3, 14.2, 86, 41, 30, "Bangladesh", 2, LIVE.asOf]);
  assert.equal(r1.rows[1].book, "Other Book");
  assert.deepEqual([r1.rows[2].market, r1.rows[2].subject, r1.rows[2].inn, r1.rows[2].line], ["Bangladesh 2nd Inns Runs", "Bangladesh", 2, 160.5]);
  assert.deepEqual([r1.rows[3].kind, r1.rows[3].market, r1.rows[3].subject, r1.rows[3].inn, r1.rows[3].line], ["ou", "Runs in First 20 Overs", null, null, 68.5]);
  assert.deepEqual([r1.rows[4].kind, r1.rows[4].line, r1.rows[4].over_price, r1.rows[4].outcomes], ["pick", null, null, [{ label: "Caught", price: 2 }, { label: "Bowled", price: 3.5 }]]);
  r1.commit(); r1.listed();
  const r2 = planRound(state, [M(lines)], LIVE, "2026-11-09T07:00:30.000Z");
  assert.deepEqual([r2.rows.length, r2.unchanged], [0, 5]);
});

test("a price that moves is a row, on the side or outcome that moved; the score on it is the score then", () => {
  const state = loaded();
  const base = [rahim(33.5, 1.8, 1.9), { kind: "pick", market: "Method of Dismissal 6-Way", outcomes: [{ label: "Caught", price: 2 }] }];
  const a = planRound(state, [M(base)], LIVE, AT); a.commit(); a.listed();
  const later = { ...LIVE, asOf: "2026-11-09T07:01:10.000Z", matches: [{ ...T20, innings: [T20.innings[0], { n: 2, team: "Bangladesh", runs: 118, wkts: 3, overs: 15 }], card: [T20.card[0], { ...T20.card[1], batters: [{ name: "Mushfiqur Rahim", runs: 47, balls: 33 }, T20.card[1].batters[1]] }] }] };
  const b = planRound(state, [M([rahim(33.5, 1.75, 1.9), base[1]])], later, "2026-11-09T07:01:15.000Z");
  assert.equal(b.rows.length, 1);
  assert.equal(b.unchanged, 1);
  assert.deepEqual([b.rows[0].over_price, b.rows[0].under_price, b.rows[0].runs, b.rows[0].inn_balls, b.rows[0].b_runs, b.rows[0].b_balls], [1.75, 1.9, 118, 90, 47, 33]);
  b.commit(); b.listed();
  const c = planRound(state, [M([rahim(33.5, 1.75, 1.9), { ...base[1], outcomes: [{ label: "Caught", price: 1.95 }] }])], later, "2026-11-09T07:01:30.000Z");
  assert.deepEqual([c.rows.length, c.rows[0].kind], [1, "pick"]);
});

test("a line that moves to a new number is a new line; one that comes back, while its book still lists others, is logged again", () => {
  const state = loaded();
  const go = (lines, at) => { const p = planRound(state, [M(lines)], LIVE, at); p.commit(); p.listed(); return p; };
  assert.equal(go([rahim(33.5, 1.8, 1.9)], "t1").rows.length, 1);
  assert.equal(go([rahim(34.5, 1.8, 1.9)], "t2").rows.length, 1); // the line moved: 34.5 appears for the first time
  const back = go([rahim(33.5, 1.8, 1.9)], "t3"); // 33.5 returns at the very price it last had: its book listed 34.5 meanwhile
  assert.equal(back.rows.length, 1);
  assert.equal(back.rows[0].line, 33.5);
  assert.equal(go([rahim(33.5, 1.8, 1.9)], "t4").rows.length, 0); // and stays quiet while it stays
});

test("a book that drops out for a round (a feed read that failed) and returns is not a storm of rows", () => {
  const state = loaded();
  const lines = [rahim(33.5, 1.8, 1.9), rahim(43.5, 2.6, 1.45), { kind: "ou", market: "Runs in First 20 Overs", line: 68.5, over: 1.8, under: 1.9, book: "Other Book" }];
  const go = (ls, at) => { const p = planRound(state, [M(ls)], LIVE, at); p.commit(); p.listed(); return p; };
  assert.equal(go(lines, "t1").rows.length, 3);
  assert.equal(go(lines.slice(2), "t2").rows.length, 0); // the price feed's lines are gone this round (the other book's are not)
  assert.equal(go(lines, "t3").rows.length, 0); // and back, unchanged: nothing to write
});

test("a failed insert leaves the state alone: the same changes are found again; a partial one keeps what went in", () => {
  const state = loaded();
  const lines = [rahim(30.5, 1.8, 1.9), rahim(31.5, 1.8, 1.9), rahim(32.5, 1.8, 1.9)];
  const a = planRound(state, [M(lines)], LIVE, "t1");
  assert.equal(a.rows.length, 3);
  a.commit(0); a.listed(); // the insert failed
  const b = planRound(state, [M(lines)], LIVE, "t2");
  assert.equal(b.rows.length, 3);
  b.commit(2); b.listed(); // two of three went in
  const c = planRound(state, [M(lines)], LIVE, "t3");
  assert.deepEqual(c.rows.map((r) => r.line), [32.5]);
});

test("the log is read back first: a line already logged with the same prices writes nothing, a match whose pair is not loaded is skipped", () => {
  const state = createState();
  const matches = [M([rahim(33.5, 1.8, 1.9), rahim(34.5, 2, 1.7)])];
  assert.deepEqual(pairsToLoad(state, matches), [PAIR]);
  assert.deepEqual(planRound(state, matches, LIVE, AT).rows, []); // not loaded: never write blind
  assert.equal(planRound(state, matches, LIVE, AT).skipped, 1);
  ingest(state, [PAIR], [
    { match_key: KEY, pair: PAIR, kickoff: "2026-11-09T05:00:00+00:00", line_key: "bet365|player_runs|m rahim|1|33.5", over_price: 1.8, under_price: 1.9, outcomes: null },
    { match_key: KEY, pair: PAIR, kickoff: "2026-11-09T05:00:00+00:00", line_key: "bet365|player_runs|m rahim|1|34.5", over_price: 2.1, under_price: 1.7, outcomes: null },
  ]);
  assert.deepEqual(pairsToLoad(state, matches), []);
  const p = planRound(state, matches, LIVE, AT);
  assert.deepEqual(p.rows.map((r) => [r.line, r.over_price]), [[34.5, 2]]); // 33.5 is as logged; 34.5 moved from 2.1 to 2
  assert.equal(p.unchanged, 1);
});

test("a match keeps the key its first row gave it: a start within 3 hours (or none) is the same match, a start 9 hours off is another", () => {
  const state = createState();
  assert.equal(matchKeyOf(state, M([]), AT), KEY);
  assert.equal(matchKeyOf(state, { ...M([]), kickoff: "2026-11-09T07:30:00Z" }, AT), KEY);
  assert.equal(matchKeyOf(state, { ...M([]), kickoff: null }, AT), KEY);
  assert.equal(matchKeyOf(state, { ...M([]), home: "West Indies", away: "Bangladesh" }, AT), KEY);
  assert.equal(matchKeyOf(state, { ...M([]), kickoff: "2026-11-09T14:00:00Z" }, AT), `${PAIR}@2026-11-09T14:00:00.000Z`);
  assert.equal(matchKeyOf(createState(), { ...M([]), kickoff: null }, "2026-11-09T07:00:00.000Z"), `${PAIR}@seen 2026-11-09`);
});

test("rows with no live score are still logged, with the score columns empty", () => {
  const state = loaded();
  const p = planRound(state, [M([rahim(33.5, 1.8, 1.9)])], null, AT);
  assert.equal(p.rows.length, 1);
  assert.deepEqual([p.rows[0].score_at, p.rows[0].runs, p.rows[0].b_runs, p.rows[0].inn, p.rows[0].fmt, p.rows[0].ctx], [null, null, null, null, null, null]);
});

// ---------- the writer's calls ----------

const KEYV = "sb_secret_abc";
const ok = (body = null, status = 200) => new Response(body == null ? null : JSON.stringify(body), { status });

test("rows go in as insert-only batches of BATCH, on the log table's own key, with the service key", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return ok(null, 201); };
  const rows = Array.from({ length: BATCH + 1 }, (_, i) => ({ n: i }));
  assert.equal(await insertRows({ base: "https://db.invalid", key: KEYV, rows, fetchImpl }), BATCH + 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://db.invalid/rest/v1/inplay_log?on_conflict=match_key,line_key,at");
  assert.equal(calls[0].init.headers.Prefer, "resolution=ignore-duplicates,return=minimal");
  assert.equal(calls[0].init.headers.apikey, KEYV);
  assert.equal(calls[0].init.headers.Authorization, undefined);
  assert.deepEqual([JSON.parse(calls[0].init.body).length, JSON.parse(calls[1].init.body).length], [BATCH, 1]);
  // a legacy JWT also goes as a bearer token; and a batch that is refused says how many went in before it
  let n = 0;
  const flaky = async () => (++n === 2 ? ok("no", 503) : ok(null, 201));
  await assert.rejects(insertRows({ base: "https://db.invalid", key: "a.b.c", rows, fetchImpl: flaky }), (e) => e.written === BATCH && /log insert HTTP 503/.test(e.message));
});

test("the read-back pages until an empty page and refuses to guess when it is cut short", async () => {
  const seen = [];
  const pages = [Array.from({ length: PAGE }, (_, i) => ({ line_key: `a${i}` })), [{ line_key: "last" }], []];
  const fetchImpl = async (url, init) => { seen.push({ url, body: JSON.parse(init.body) }); return ok(pages[seen.length - 1]); };
  const rows = await loadLatest({ base: "https://db.invalid", key: KEYV, pairs: [PAIR], since: "2026-11-02T00:00:00.000Z", fetchImpl });
  assert.equal(rows.length, PAGE + 1);
  assert.deepEqual(seen.map((s) => s.url), [0, 1, 2].map((p) => `https://db.invalid/rest/v1/rpc/inplay_log_latest?limit=${PAGE}&offset=${p * PAGE}`));
  assert.deepEqual(seen[0].body, { p_pairs: [PAIR], p_since: "2026-11-02T00:00:00.000Z" });
  await assert.rejects(loadLatest({ base: "https://db.invalid", key: KEYV, pairs: [PAIR], since: "x", fetchImpl: async () => ok("boom", 500) }), /log read-back HTTP 500/);
  await assert.rejects(loadLatest({ base: "https://db.invalid", key: KEYV, pairs: [PAIR], since: "x", fetchImpl: async () => ok(Array.from({ length: PAGE }, () => ({}))) }), /more than/);
});

test("the live scores are read from the site's own /api/live and unwrapped with the key when there is one", async () => {
  const urls = [];
  const plain = async (url) => { urls.push(url); return ok(LIVE); };
  assert.deepEqual(await readScores({ siteUrl: "https://site.invalid/", fetchImpl: plain }), LIVE);
  assert.deepEqual(urls, ["https://site.invalid/api/live"]);
  const wrapped = await wrap(LIVE, "k3y");
  assert.deepEqual(await readScores({ siteUrl: "https://site.invalid", wrapKey: "k3y", fetchImpl: async () => ok(wrapped) }), LIVE);
  await assert.rejects(readScores({ siteUrl: "https://site.invalid", fetchImpl: async () => ok(wrapped) }), /no matches list/);
  await assert.rejects(readScores({ siteUrl: "https://site.invalid", fetchImpl: async () => ok(null, 502) }), /live scores HTTP 502/);
});

// a Supabase stand-in: the latest rows it is asked for, and every row inserted
function mockDb({ latest = [], failInsert = 0, failLive = false } = {}) {
  const db = { inserted: [], calls: [], inserts: 0 };
  db.fetch = async (url, init) => {
    db.calls.push(String(url));
    if (/\/api\/live$/.test(url)) return failLive ? ok(null, 502) : ok(LIVE);
    if (/rpc\/inplay_log_latest/.test(url)) return ok(/offset=0/.test(url) ? latest : []);
    if (/rest\/v1\/inplay_log\?/.test(url)) { if (++db.inserts <= failInsert) return ok("down", 503); db.inserted.push(...JSON.parse(init.body)); return ok(null, 201); }
    throw new Error(`unexpected ${url}`);
  };
  return db;
}

test("the logger reads back once, then writes only what changed round after round", async () => {
  const db = mockDb({ latest: [{ match_key: KEY, pair: PAIR, kickoff: KICK, line_key: "bet365|player_runs|m rahim|1|33.5", over_price: 1.8, under_price: 1.9, outcomes: null }] });
  const logs = [];
  const record = createLogger({ base: "https://db.invalid", key: KEYV, siteUrl: "https://site.invalid", fetchImpl: db.fetch, log: (m) => logs.push(m) });
  const same = [rahim(33.5, 1.8, 1.9), { kind: "ou", market: "Runs in First 20 Overs", line: 68.5, over: 1.8, under: 1.9 }];
  assert.deepEqual(await record([M(same)], "t1"), { rows: 1, unchanged: 1, skipped: 0 }); // the rahim line was logged by an earlier run
  assert.deepEqual(await record([M(same)], "t2"), { rows: 0, unchanged: 2, skipped: 0 });
  assert.deepEqual(await record([M([rahim(33.5, 1.7, 2.1), same[1]])], "t3"), { rows: 1, unchanged: 1, skipped: 0 });
  assert.deepEqual(db.inserted.map((r) => [r.at, r.line_key, r.over_price]), [["t1", "bet365|ou|runs in first 20 overs|0|68.5", 1.8], ["t3", "bet365|player_runs|m rahim|1|33.5", 1.7]]);
  assert.equal(db.calls.filter((u) => /rpc\/inplay_log_latest/.test(u)).length, 2); // one page of rows and the empty one, once
  assert.deepEqual(logs, []);
});

test("a failing read-back writes nothing and tries again next round; a failing insert is a warning and the rows are retried", async () => {
  const logs = [];
  let down = true;
  const db = mockDb();
  const fetchImpl = async (url, init) => (down && /rpc\//.test(url) ? ok("down", 500) : db.fetch(url, init));
  const record = createLogger({ base: "https://db.invalid", key: KEYV, siteUrl: "https://site.invalid", fetchImpl, log: (m) => logs.push(m) });
  const ms = [M([rahim(33.5, 1.8, 1.9)])];
  assert.deepEqual(await record(ms, "t1"), { rows: 0, unchanged: 0, skipped: 1 });
  assert.equal(db.inserted.length, 0);
  assert.match(logs[0], /^::warning::in-play log: read-back failed/);
  down = false;
  const flaky = mockDb({ failInsert: 1 });
  const rec2 = createLogger({ base: "https://db.invalid", key: KEYV, siteUrl: "https://site.invalid", fetchImpl: flaky.fetch, log: (m) => logs.push(m) });
  assert.equal((await rec2(ms, "t1")).rows, 0);
  assert.match(logs[logs.length - 1], /insert failed, will retry/);
  assert.equal((await rec2(ms, "t2")).rows, 1); // the same line is a change again
  assert.equal(flaky.inserted[0].at, "t2");
});

test("without live scores (the call fails or no site address) rows are still written, with no score", async () => {
  const logs = [];
  const db = mockDb({ failLive: true });
  const record = createLogger({ base: "https://db.invalid", key: KEYV, siteUrl: "https://site.invalid", fetchImpl: db.fetch, log: (m) => logs.push(m) });
  assert.equal((await record([M([rahim(33.5, 1.8, 1.9)])], "t1")).rows, 1);
  assert.equal(db.inserted[0].runs, null);
  assert.match(logs[0], /live scores unavailable/);
  const db2 = mockDb();
  assert.equal((await createLogger({ base: "https://db.invalid", key: KEYV, fetchImpl: db2.fetch })([M([rahim(33.5, 1.8, 1.9)])], "t1")).rows, 1);
  assert.ok(!db2.calls.some((u) => /api\/live/.test(u)));
});

test("the snapshot run logs each round after saving it, never delays or fails a round, and counts what it logged", async () => {
  const saved = [], logged = [], logs = [];
  let t = Date.parse("2026-11-09T07:00:00Z");
  const matches = [M([rahim(33.5, 1.8, 1.9)])];
  let n = 0;
  const out = await run({
    read: async () => matches, save: async (b) => saved.push(b.asOf), sleep: async (ms) => { t += ms; }, now: () => new Date(t), log: (m) => logs.push(m),
    record: async (ms, at) => { logged.push([ms.length, at]); if (++n === 2) throw new Error("db down"); return { rows: 3, unchanged: 7 }; },
  });
  assert.deepEqual(out, { reads: 4, saved: 4, failed: 0, matches: 1, logged: 9, unchanged: 21 }); // three of four rounds logged 3 rows each
  assert.deepEqual(logged.map((x) => x[1]), saved);
  assert.match(logs[0], /^::warning::in-play log failed: db down/);
  // nothing in play: nothing to log
  const quiet = await run({ read: async () => [], save: async () => {}, record: async () => { throw new Error("must not be called"); }, sleep: async () => {} });
  assert.deepEqual(quiet, { reads: 1, saved: 1, failed: 0, matches: 0, logged: 0, unchanged: 0 });
});
