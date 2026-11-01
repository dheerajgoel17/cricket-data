import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "@cricket/engine/store.js";
import { MIN_BALLS, boards, editionRows, editionSummary, editionsOf, featuredEvents, oversText, seriesKey, trendSeries } from "@cricket/engine/tournament.js";

// A tiny league with numbers worked out by hand. Event 0 has a men's T20 season in March 2025 (matches 0, 2, 4), a women's match on 2 March (1) and a second men's
// block in September (5), 175 days after the first, so it is its own edition. Match 3 belongs to event 1.
const KINDS = ["", "bowled", "caught", "caught and bowled", "lbw", "stumped", "hit wicket", "run out", "retired out", "obstructing the field", "other", "retired hurt"];
const D = ["2025-03-01", "2025-03-02", "2025-03-05", "2025-03-06", "2025-03-10", "2025-09-01"];
const M = {
  id: ["m0", "m1", "m2", "m3", "m4", "m5"], d: D, f: [0, 0, 0, 0, 0, 0], g: [0, 1, 0, 0, 0, 0], e: [0, 0, 0, 1, 0, 0], a: [0, 0, 1, 0, 0, 0], b: [1, 1, 0, 1, 1, 1],
  w: [0, 0, 0, 0, 0, 0], r: [0, 0, 0, 0, 0, 0], q: [1, 1, 1, 1, 1, 1], fi: [0, 0, 1, 0, 0, 0], pv: [0, 0, 0, 0, 0, 0],
  inn: [
    [[0, 180, 5, 120, 10, 8], [1, 150, 10, 110, 9, 4]],
    [[0, 100, 3, 120, 5, 2], [1, 90, 10, 100, 4, 1]],
    [[1, 160, 8, 120, 12, 5], [0, 161, 4, 115, 11, 6]],
    [[0, 120, 10, 100, 6, 1], [1, 121, 2, 90, 7, 2]],
    [[0, 200, 6, 120, 15, 9], [1, 95, 10, 80, 6, 2]],
    [[0, 140, 7, 120, 8, 3], [1, 141, 3, 118, 9, 4]],
  ],
};
const names = ["A Opener", "B Mid", "C Fast", "D Spin", "E Keeper", "F Scraped"];
const index = { players: { id: names.map((_, i) => `0000000${i}`), nm: names }, teams: [{ n: "Reds", g: 0 }, { n: "Blues", g: 0 }], venues: [], events: ["League", "Other"], hosts: [], kinds: KINDS, formats: ["T20"], nshard: 2 };

const bat = (rows) => Object.fromEntries(["p", "m", "i", "t", "q", "o", "r", "b", "f", "s", "k", "tb", "mt"].map((c, j) => [c, rows.map((r) => [r[0], r[1], 1, r[2], 1 - r[2], 1, r[3], r[4], r[5], r[6], r[7], 0, 0][j])]));
const bowl = (rows) => Object.fromEntries(["p", "m", "i", "t", "q", "w", "c", "n"].map((c, j) => [c, rows.map((r) => [r[0], r[1], 1, r[2], 1 - r[2], r[3], r[4], r[5]][j])]));
const fld = (rows) => Object.fromEntries(["p", "m", "i", "t", "q", "ct", "st"].map((c, j) => [c, rows.map((r) => [r[0], r[1], 1, r[2], 1 - r[2], r[3], r[4]][j])]));
// [player, match, team, runs, balls, fours, sixes, dismissal kind]
const BAT = {
  0: [[0, 0, 0, 62, 40, 6, 3, 0], [0, 2, 0, 0, 2, 0, 0, 1], [0, 4, 0, 105, 60, 9, 5, 2], [4, 2, 0, 48, 30, 5, 2, 3], [4, 4, 0, 20, 14, 1, 1, 0], [0, 3, 0, 99, 60, 9, 9, 0]],
  1: [[1, 0, 1, 30, 20, 2, 1, 4], [1, 2, 1, 75, 50, 7, 2, 0], [1, 4, 1, 11, 9, 1, 0, 11], [3, 0, 1, 8, 6, 1, 0, 7], [3, 4, 1, 0, 3, 0, 0, 7], [5, 4, 1, 33, 20, 3, 1, -1], [0, 5, 0, 70, 50, 5, 3, 0]],
};
// [player, match, team, wickets, runs, balls]
const BOWL = { 0: [[2, 0, 1, 3, 22, 24], [2, 2, 0, 1, 35, 24], [2, 4, 1, 5, 18, 24], [2, 3, 0, 9, 9, 6]], 1: [[3, 0, 0, 2, 24, 24], [3, 2, 1, 0, 30, 24], [3, 4, 0, 4, 28, 24], [1, 2, 1, 2, 15, 12]] };
// [player, match, team, catches, stumpings]
const FLD = { 0: [[4, 0, 0, 2, 1], [4, 2, 0, 1, 0], [4, 4, 0, 0, 2]], 1: [[1, 0, 1, 1, 0]] };
const SHARDS = [0, 1].map((s) => ({ bat: bat(BAT[s]), bowl: bowl(BOWL[s]), fld: fld(FLD[s]) }));

const mkStore = (get) => new Store({}, index, M, get || (async (p) => SHARDS[Number(p.slice(2, 4))]));
const edition = (store, key) => editionsOf(store, 0).find((x) => x.key === key);

test("editions: split by gender and by calendar gaps, newest first, with unique keys and told-apart names", () => {
  const eds = editionsOf(mkStore(), 0);
  assert.deepEqual(eds.map((x) => [x.key, x.name, x.g, x.from, x.to, x.ms]), [
    ["2025-09", "2025 Sep", 0, "2025-09-01", "2025-09-01", [5]],
    ["2025w", "2025 (W)", 1, "2025-03-02", "2025-03-02", [1]],
    ["2025", "2025 Mar", 0, "2025-03-01", "2025-03-10", [0, 2, 4]],
  ]);
  assert.deepEqual(editionsOf(mkStore(), 1).map((x) => [x.key, x.ms]), [["2025", [3]]]);
  assert.deepEqual(editionsOf(mkStore(), 7), []);
});

test("an event that runs over New Year is one edition labelled 2024/25", () => {
  const store = mkStore();
  store.M = { ...M, d: ["2024-12-20", "2025-01-02", "2025-01-20", "2025-02-01", "2025-02-02", "2025-02-03"] };
  const eds = editionsOf(store, 0).filter((x) => x.g === 0);
  assert.equal(eds.length, 1);
  assert.deepEqual([eds[0].key, eds[0].label, eds[0].ms], ["2024", "2024/25", [0, 2, 4, 5]]);
});

test("a season paused for 138 days inside one year is one edition; a gap of 150 days across New Year is two", () => {
  const store = mkStore();
  store.M = { ...M, d: ["2021-05-01", "2021-05-04", "2021-09-19", "2021-09-20", "2021-10-01", "2022-03-25"] };
  assert.deepEqual(editionsOf(store, 0).filter((x) => x.g === 0).map((x) => [x.key, x.ms]), [["2022", [5]], ["2021", [0, 2, 4]]]);
  store.M = { ...M, d: ["2020-11-01", "2020-11-02", "2020-11-10", "2020-11-10", "2021-04-09", "2021-04-10"] }; // 150 days, then within a month
  assert.deepEqual(editionsOf(store, 0).filter((x) => x.g === 0).map((x) => [x.key, x.ms]), [["2021", [4, 5]], ["2020", [0, 2]]]);
});

test("rows of one edition only: every shard read, other matches left out, order does not depend on which shard lands first", async () => {
  const store = mkStore(), ed = edition(store, "2025"), seen = [];
  const rows = await editionRows(store, ed.ms, { onProgress: (d, n) => seen.push([d, n]) });
  assert.deepEqual(seen, [[1, 2], [2, 2]]);
  assert.equal(rows.bat.length, 11, "the rows of matches 3 and 5 are not in the edition");
  assert.ok(rows.bat.every((r) => ed.ms.includes(r.m)));
  assert.deepEqual(rows.bat.map((r) => [r.m, r.p]).slice(0, 4), [[0, 0], [0, 1], [0, 3], [2, 0]]);
  assert.equal(rows.bowl.length, 7);
  assert.equal(rows.fld.length, 4);
});

test("batting boards: runs, average, strike rate, sixes, fours and 50+ scores by hand", async () => {
  const store = mkStore(), ed = edition(store, "2025");
  const b = boards(store, ed, await editionRows(store, ed.ms));
  const g = Object.fromEntries(b.groups.flatMap((x) => x.boards).map((x) => [x.id, x]));
  const rows = (id) => g[id].rows.map((r) => [r.p, r.v, ...r.cells]);
  // A Opener 62+0+105 off 102 (2 outs, 15 fours, 8 sixes), B Mid 30+75+11 off 79 (1 out: retired hurt is not an out), E Keeper 48+20 off 44, F Scraped 33 off 20, D Spin 8+0 off 9
  assert.deepEqual(rows("runs"), [[0, "167", "83.50", "163.7", "105", "3"], [1, "116", "116.00", "146.8", "75*", "3"], [4, "68", "68.00", "154.5", "48", "2"], [5, "33", "–", "165.0", "33", "1"], [3, "8", "4.00", "88.9", "8", "2"]]);
  assert.deepEqual(g.runs.rows.map((r) => r.rank), [1, 2, 3, 4, 5]);
  assert.deepEqual(g.runs.rows.map((r) => r.t), [0, 1, 0, 1, 1]);
  assert.deepEqual(rows("sixes").map((r) => [r[0], r[1]]), [[0, "8"], [1, "3"], [4, "3"], [5, "1"]], "B Mid and E Keeper tie on 3: more runs first");
  assert.deepEqual(rows("fours").map((r) => [r[0], r[1]]), [[0, "15"], [1, "10"], [4, "6"], [5, "3"], [3, "1"]]);
  assert.deepEqual(rows("fifties"), [[0, "2", "1", "1", "3"], [1, "1", "0", "1", "3"]]);
  // fewer than five players have 60 balls (only A Opener and B Mid), so everyone is ranked and the board says so
  assert.equal(b.minBalls, MIN_BALLS.T20);
  assert.deepEqual(rows("avg").map((r) => [r[0], r[1]]), [[1, "116.00"], [0, "83.50"], [4, "68.00"], [3, "4.00"]], "the scraped batter has no known outs, so no average");
  assert.match(g.avg.note, /Short series/);
  assert.deepEqual(rows("sr").map((r) => [r[0], r[1]]), [[5, "165.0"], [0, "163.7"], [4, "154.5"], [1, "146.8"], [3, "88.9"]]);
});

test("a minimum of balls is applied once enough players pass it", async () => {
  const store = mkStore(), ed = edition(store, "2025");
  const b = boards(store, ed, await editionRows(store, ed.ms), { minBalls: 40, minRanked: 3 });
  const g = Object.fromEntries(b.groups.flatMap((x) => x.boards).map((x) => [x.id, x]));
  assert.deepEqual(g.sr.rows.map((r) => [r.p, r.v]), [[0, "163.7"], [4, "154.5"], [1, "146.8"]], "F Scraped (20 balls) and D Spin (9) are below 40");
  assert.equal(g.sr.note, "Minimum 40 balls faced.");
  assert.deepEqual(g.avg.rows.map((r) => r.p), [1, 0, 4]);
  assert.match(g.avg.note, /^Minimum 40 balls faced\./);
});

test("highest scores keep a not-out star and rank a not-out above the same score", async () => {
  const store = mkStore(), ed = edition(store, "2025");
  const g = boards(store, ed, await editionRows(store, ed.ms)).groups[0].boards.find((x) => x.id === "hs");
  assert.deepEqual(g.rows.slice(0, 5).map((r) => [r.p, r.m, r.v, r.q, r.date, ...r.cells]), [
    [0, 4, "105", 1, "2025-03-10", "60", "175.0", "9", "5"],
    [1, 2, "75*", 0, "2025-03-05", "50", "150.0", "7", "2"],
    [0, 0, "62*", 1, "2025-03-01", "40", "155.0", "6", "3"],
    [4, 2, "48", 1, "2025-03-05", "30", "160.0", "5", "2"],
    [5, 4, "33", 0, "2025-03-10", "20", "165.0", "3", "1"],
  ]);
});

test("bowling boards: wickets, best figures, average, economy, strike rate and 4+ hauls by hand", async () => {
  const store = mkStore(), ed = edition(store, "2025");
  const b = boards(store, ed, await editionRows(store, ed.ms));
  const g = Object.fromEntries(b.groups.flatMap((x) => x.boards).map((x) => [x.id, x]));
  const rows = (id) => g[id].rows.map((r) => [r.p, r.v, ...r.cells]);
  // C Fast 3+1+5 for 75 off 72 balls; D Spin 2+0+4 for 82 off 72; B Mid 2 for 15 off 12
  assert.deepEqual(rows("wkts"), [[2, "9", "8.33", "6.25", "5/18", "3", "12.0"], [3, "6", "13.67", "6.83", "4/28", "3", "12.0"], [1, "2", "7.50", "7.50", "2/15", "1", "2.0"]]);
  assert.deepEqual(g.best.rows.slice(0, 5).map((r) => [r.p, r.v, r.q, ...r.cells]), [[2, "5/18", 0, "4.0", "4.50"], [3, "4/28", 1, "4.0", "7.00"], [2, "3/22", 0, "4.0", "5.50"], [1, "2/15", 0, "2.0", "7.50"], [3, "2/24", 1, "4.0", "6.00"]]);
  assert.deepEqual(rows("bavg").map((r) => [r[0], r[1]]), [[1, "7.50"], [2, "8.33"], [3, "13.67"]]);
  assert.deepEqual(rows("econ").map((r) => [r[0], r[1]]), [[2, "6.25"], [3, "6.83"], [1, "7.50"]]);
  assert.deepEqual(rows("bsr").map((r) => [r[0], r[1]]), [[1, "6.0"], [2, "8.0"], [3, "12.0"]]);
  assert.deepEqual(rows("w4"), [[2, "1", "1", "9", "3"], [3, "1", "0", "6", "3"]]);
  assert.match(g.econ.note, /Short series/);
});

test("performance points: runs + 20 a wicket + 10 a catch + 25 a stumping, and the three leaders", async () => {
  const store = mkStore(), ed = edition(store, "2025");
  const b = boards(store, ed, await editionRows(store, ed.ms));
  const pts = b.groups.find((x) => x.id === "all").boards.find((x) => x.id === "pts");
  // C Fast 20 x 9 = 180; E Keeper 68 + 10 x 3 + 25 x 3 = 173; A Opener 167; B Mid 116 + 20 x 2 + 10 = 166; D Spin 8 + 20 x 6 = 128; F Scraped 33
  assert.deepEqual(pts.rows.map((r) => [r.p, r.v, ...r.cells]), [[2, "180", "0", "9", "0", "0"], [4, "173", "68", "0", "3", "3"], [0, "167", "167", "0", "0", "0"], [1, "166", "116", "2", "1", "0"], [3, "128", "8", "6", "0", "0"], [5, "33", "33", "0", "0", "0"]]);
  // Top performer (C Fast), most sixes (A Opener), best figures (C Fast) and highest score (A Opener) are all players already shown, so only two cards
  assert.deepEqual(b.leaders.map((l) => [l.id, l.row.p, l.row.v]), [["runs", 0, "167"], ["wkts", 2, "9"]]);
  // give E Keeper 20 more catches and he leads the points board: a different player, so he is the third card
  const more = boards(store, ed, { ...(await editionRows(store, ed.ms)), fld: [{ p: 4, m: 0, i: 1, t: 0, q: 1, ct: 20, st: 0 }] });
  assert.deepEqual(more.leaders.map((l) => [l.id, l.row.p, l.row.v]), [["runs", 0, "167"], ["wkts", 2, "9"], ["pts", 4, "268"]]); // 68 + 200

});

test("team totals: highest, and lowest among innings that ended all out", async () => {
  const store = mkStore(), ed = edition(store, "2025");
  const b = boards(store, ed, await editionRows(store, ed.ms));
  const all = b.groups.find((x) => x.id === "all").boards;
  const high = all.find((x) => x.id === "high"), low = all.find((x) => x.id === "low");
  assert.deepEqual(high.rows.map((r) => [r.v, r.t, r.q, r.m, r.cells[0]]), [["200/6", 0, 1, 4, "20.0"], ["180/5", 0, 1, 0, "20.0"], ["161/4", 0, 1, 2, "19.1"], ["160/8", 1, 0, 2, "20.0"], ["150", 1, 0, 0, "18.2"], ["95", 1, 0, 4, "13.2"]]);
  assert.deepEqual(low.rows.map((r) => [r.v, r.t, r.cells[0]]), [["95", 1, "13.2"], ["150", 1, "18.2"]]);
});

test("a board nobody qualifies for is left out, and a different edition sees only its own matches", async () => {
  const store = mkStore(), ed = edition(store, "2025-09");
  const b = boards(store, ed, await editionRows(store, ed.ms));
  const ids = b.groups.flatMap((x) => x.boards).map((x) => x.id);
  assert.deepEqual(b.groups[0].boards[0].rows.map((r) => [r.p, r.v]), [[0, "70"]], "match 5: A Opener 70 off 50");
  assert.ok(!ids.includes("wkts"), "no bowling rows in match 5");
  assert.deepEqual(b.leaders.map((l) => l.id), ["runs"], "no bowling rows, and the points and sixes leader is the same A Opener");
});

test("edition summary and season-by-season series (matches that count for summary markets)", () => {
  const store = mkStore(), eds = editionsOf(store, 0), ed = eds.find((x) => x.key === "2025");
  const s = editionSummary(store, ed);
  // matches 0, 2, 4: 1st innings 180, 160, 200; 2nd 150, 161, 95; sixes 12 + 11 + 11; fours 19 + 23 + 21; 946 runs off 665 balls; bat first won matches 0 and 4, not 2
  assert.deepEqual([s.matches, s.counted, s.avgFirst, s.avgSecond, s.sixesPerMatch, s.foursPerMatch, s.runRate, s.batFirstWinPct, s.decided],
    [3, 3, 180, 135.33, 11.33, 21, 8.54, 66.7, 3]);
  assert.deepEqual(s.highest, { t: 0, m: 4, runs: 200, wkts: 6 });
  assert.deepEqual(trendSeries(store, eds, ed).map((x) => x.key), ["2025"], "an edition needs three counted matches to be a point: the September match alone is not");
  const t = trendSeries(store, eds, ed, { minMatches: 1 });
  assert.deepEqual(t.map((x) => [x.key, x.counted, x.avgFirst]), [["2025", 3, 180], ["2025-09", 1, 140]], "the women's match is another series and is not mixed in");
  store.M = { ...M, q: [0, 1, 1, 1, 1, 1] };
  assert.equal(editionSummary(store, ed).counted, 2, "a void match is left out");
});

test("a shard that fails once is read again, and the failed read is not kept", async () => {
  let calls = 0;
  const store = mkStore(async (p) => { if (p === "p/01.json" && ++calls === 1) throw new Error("HTTP 503"); return SHARDS[Number(p.slice(2, 4))]; });
  const rows = await editionRows(store, edition(store, "2025").ms);
  assert.equal(calls, 2);
  assert.equal(rows.bat.length, 11);
  assert.equal(oversText(80), "13.2");
});

// Today is 1 Nov 2026. Each event is [name, [number of matches, first date, last date], ...] (one run per edition), matches spread evenly between the two dates.
const spread = (n, a, b) => Array.from({ length: n }, (_, i) => new Date(Date.parse(a) + ((Date.parse(b) - Date.parse(a)) * i) / Math.max(n - 1, 1)).toISOString().slice(0, 10));
function featured(events, opts = {}) {
  const d = [], e = [];
  events.forEach(([, ...runs], i) => runs.forEach(([n, a, b]) => spread(n, a, b).forEach((x) => { d.push(x); e.push(i + 1); })));
  const M2 = { id: d.map((_, i) => `x${i}`), d, e, f: d.map(() => 0), g: d.map(() => 0) };
  const store = new Store({}, { ...index, events: ["", ...events.map((x) => x[0])] }, M2, async () => ({}));
  return featuredEvents(store, { now: Date.parse("2026-11-01T00:00:00Z"), big: ["big bash", "indian premier", "pakistan super", "lanka premier"], pin: ["big bash"], ...opts });
}

test("featured competitions: Big Bash first (women's live, men's due), then other big events that are live or due, other live ones, then big ones that finished", () => {
  const out = featured([
    ["Indian Premier League", [12, "2026-03-28", "2026-05-20"]],
    ["Women's Big Bash League", [12, "2025-10-10", "2025-11-30"], [12, "2026-10-10", "2026-10-31"]], // live: last match yesterday
    ["Big Bash League", [44, "2025-12-14", "2026-01-25"]], // 14 Dec 2026 is 43 days away: due
    ["Nepal Premier League", [12, "2026-10-20", "2026-10-30"]], // live, not a big event
    ["Lanka Premier League", [20, "2025-12-01", "2026-01-05"], [20, "2026-10-12", "2026-10-30"]], // big and live, but not pinned
    ["Small Series", [3, "2026-10-28", "2026-10-31"]], // live but only three matches
    ["Old Cup", [12, "2024-01-01", "2024-02-01"]], // a year and more ago
    ["Local Cup", [12, "2026-08-01", "2026-08-15"]], // finished 78 days ago, not big
    ["Pakistan Super League", [14, "2026-02-10", "2026-03-20"]],
    ["Winter Cup", [12, "2026-01-10", "2026-03-01"]], // finished 8 months ago, not big: dropped
  ]);
  assert.deepEqual(out.map((x) => [x.name, x.tag]), [
    ["Women's Big Bash League", "live"], ["Big Bash League", "soon"], ["Lanka Premier League", "live"], ["Nepal Premier League", "live"],
    ["Pakistan Super League", ""], ["Indian Premier League", ""], ["Local Cup", ""],
  ]);
  assert.deepEqual(out.map((x) => x.big), [true, true, true, false, true, true, false]);
  assert.equal(out[0].size, 12);
  assert.equal(out[1].size, 44);
});

test("a competition's season is due when last year's start falls within 60 days ahead, and only the largest run counts for its size", () => {
  const soonOf = (start, now) => featured([["Big Bash League", [20, start, "2026-01-30"]]], { now: Date.parse(now) })[0]?.tag;
  assert.equal(soonOf("2025-12-14", "2026-10-14T00:00:00Z"), "", "14 Dec 2026 is 61 days after 14 Oct");
  assert.equal(soonOf("2025-12-14", "2026-10-15T00:00:00Z"), "soon", "60 days is inside the limit");
  assert.equal(soonOf("2025-12-14", "2026-12-20T00:00:00Z"), "soon", "a few days into the new season with no match in the data yet");
  assert.equal(soonOf("2025-12-14", "2027-01-10T00:00:00Z"), "", "well past it");
  assert.equal(featured([["Cup", [6, "2026-10-10", "2026-10-31"], [14, "2025-10-10", "2025-11-20"]]])[0].size, 14, "the earlier, complete season counts: the new one has just started");
  assert.deepEqual(featured([["Cup", [20, "2026-10-10", "2026-10-31"]]], { limit: 0 }), []);
});

test("the schedule says what is on: a fixture within three days makes a competition live, one in the next two weeks makes it soon", () => {
  const events = [
    ["Women's Big Bash League", [12, "2025-10-10", "2025-11-30"]], // the data has no match of this season yet (it lags), 335 days since the last
    ["The Hundred Men's Competition", [34, "2026-08-05", "2026-08-31"]],
    ["Winter Cup", [12, "2025-12-01", "2026-01-15"]], // due on the calendar? 1 Dec 2026 is 30 days away: soon without any fixture
  ];
  const tags = (fixtures) => Object.fromEntries(featured(events, { fixtures }).map((x) => [x.name, x.tag]));
  assert.deepEqual(tags([]), { "Women's Big Bash League": "", "The Hundred Men's Competition": "", "Winter Cup": "soon" });
  const fx = [
    { series: "Women's Big Bash League 2026-27", gender: "female", start: "2026-10-31T09:00Z" },
    { series: "The Hundred Men's Competition 2026", gender: "male", start: "2026-11-08T12:00Z", status: "Upcoming" },
    { series: "Winter Cup 2026-27", gender: "male", start: "2026-11-30T05:00Z" }, // a month ahead: no change
  ];
  assert.deepEqual(tags(fx), { "Women's Big Bash League": "live", "The Hundred Men's Competition": "soon", "Winter Cup": "soon" });
  assert.equal(featured(events, { fixtures: [{ series: "Women's Big Bash League", gender: "female", start: "2026-11-20T00:00Z", status: "Live" }] })[0].tag, "live", "a Live status counts at any distance");
});

test("series names meet the data's event names: seasons, men's and women's, and the usual short forms", () => {
  assert.equal(seriesKey("Women's Big Bash League 2026-27"), seriesKey("Women's Big Bash League"));
  assert.equal(seriesKey("Big Bash League 2026-27", true), seriesKey("Women's Big Bash League"), "a women's fixture of a series that does not say so");
  assert.notEqual(seriesKey("Big Bash League 2026-27"), seriesKey("Women's Big Bash League"));
  assert.equal(seriesKey("WBBL 2026"), seriesKey("Women's Big Bash League"));
  assert.equal(seriesKey("IPL 2026"), seriesKey("Indian Premier League"));
  assert.equal(seriesKey("Syed Mushtaq Ali Trophy 2026-27"), seriesKey("Syed Mushtaq Ali Trophy"));
  assert.equal(seriesKey("Big Bash League Women 2026"), seriesKey("Women's Big Bash League"), "women first, wherever it is written");
  assert.notEqual(seriesKey("India tour of England, 2026"), seriesKey("England tour of India, 2026"), "the order of the other words counts");
});
