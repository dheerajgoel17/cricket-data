import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WINDOW, collectOverview, fancyEdgeAlerts, fancyFm, fancyInputs, fancyOverview, fancySample, innTag, istLabel, marketRow, parseFm, peerFancyFm } from "@cricket/engine/fancy-edge.js";
import { Store } from "@cricket/engine/store.js";
import { FORMATS } from "@cricket/engine/util.js";
import { buildDoc } from "../scripts/fancy-alerts.mjs";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);

// Twenty T20s between Alpha (team 0) and Beta (team 1) at one ground. Alpha always bats first.
// Matches 0-3: Alpha 180 + Beta 170 = 350 runs ("over" every line below); matches 4-19: Alpha 150 + Beta 140 = 290 ("under").
// So every line below is under in 16 of 20 matches and over in 4, and the four over matches are the OLDEST (the last ten at the ground are all under).
// Wickets: 11 matches with 14 in the match (over 12.5), 9 with 10. Alpha's sixes are known for only 14 matches (the other six are scrapes without them).
function synthetic({ fi = (m) => 0 } = {}) {
  const ids = Array.from({ length: WINDOW }, (_, m) => m), over = (m) => m < 4;
  const aRuns = (m) => (over(m) ? 180 : 150), bRuns = (m) => (over(m) ? 170 : 140);
  const wk = (m) => (m % 20 < 11 ? [7, 7] : [5, 5]);
  const inn = ids.map((m) => [[0, aRuns(m), wk(m)[0], 0, 0, m >= 6 ? 8 : null], [1, bRuns(m), wk(m)[1], 0, 0, 0]]);
  const M = { id: ids.map((m) => `m${m}`), f: ids.map(() => 0), q: ids.map(() => 1), g: ids.map(() => 0), d: ids.map((m) => `2026-01-${String(m + 1).padStart(2, "0")}`),
    i: ids.map(() => 1), e: ids.map(() => 0), v: ids.map(() => 0), a: ids.map(() => 0), b: ids.map(() => 1), fi: ids.map(fi), pv: ids.map(() => 0), inn, ov: ids.map(() => []), h: ids.map(() => -1) };
  const index = { players: { nm: [], id: [] }, teams: [{ n: "Alpha", g: 0 }, { n: "Beta", g: 0 }], venues: ["Ground, City"], events: [], hosts: [], nshard: 0 };
  return new Store({}, index, M, async () => { throw new Error("no shards"); });
}

const START = "2026-11-02T09:30:00Z", NOW = Date.parse("2026-11-01T10:00:00Z");
const fixture = (o = {}) => ({ id: "2026-11-02-alpha-v-beta", start: "2026-11-02T09:30Z", fmt: "T20", gender: "male", a: "Alpha", b: "Beta", venue: "Ground, City", series: "Series", a_ix: 0, b_ix: 1, ...o });
// one book, over 2.00 and the given under price: the no-vig chance of the under is (1/under) / (1/2 + 1/under)
const row = (key, line, under, o = {}) => ({ match: "Alpha vs Beta", home: "Alpha", away: "Beta", start_utc: START, fmt: "T20", key, scope: o.team ? "team" : "match", team: null, line, over: 2, under, source: "bet365", kind: "bookmaker", ...o });
const doc = (...fancy) => ({ lines: [], fancy });

test("a market row is the better side's shrunk chance x best price - 1, hand-computed", () => {
  const store = synthetic(), f = fixture(), { ms, ground, teams } = fancyInputs(store, f);
  assert.equal(ms.length, 20);
  assert.equal(ground.length, 10);
  assert.deepEqual(teams, [["Alpha", 0], ["Beta", 1]]);
  // under 1.80 / over 2.00: the market's chance of the under is 10/19; 16 of 20 under, so (16 + 10 x 10/19) / 30 = 404/570 and the edge 404/570 x 1.8 - 1
  const r = marketRow({ store, doc: doc(row("match_runs", 300.5, 1.8)), fxInfo: { a: "Alpha", b: "Beta", fmt: "T20", startMs: Date.parse(START) }, ms, scope: -1, teamName: null, key: "match_runs", ground });
  assert.equal(r.side, "under");
  assert.deepEqual([r.hits, r.played, r.line, r.underLine, r.under, r.underBook], [16, 20, 300.5, 300.5, 1.8, "bet365"]);
  near(r.chance, 404 / 570);
  near(r.edge, (404 / 570) * 1.8 - 1); // 0.275789
  near(r.edge, 0.275789, 1e-6); // the over (4 of 20 against a market chance of 9/19) is a loss, so the under is the side shown
  assert.deepEqual(r.at, { n: 10, over: 0, under: 10, side: "under" }); // the last ten at the ground, all under
  assert.deepEqual(r.last.map((x) => x.s), Array(10).fill("miss"));
  assert.equal(r.batFirst, false);
});

test("available over and under lines: over@4.5 with under@3.5 when that is how the books list them", () => {
  const store = synthetic(), { ms, ground } = fancyInputs(store, fixture()), fxInfo = { a: "Alpha", b: "Beta", fmt: "T20", startMs: Date.parse(START) };
  const d = doc(
    { match: "Alpha vs Beta", home: "Alpha", away: "Beta", start_utc: START, fmt: "T20", key: "match_runs", scope: "match", team: null, line: 4.5, over: 1.9, under: null, source: "fancy", kind: "bookmaker" },
    { match: "Alpha vs Beta", home: "Alpha", away: "Beta", start_utc: START, fmt: "T20", key: "match_runs", scope: "match", team: null, line: 3.5, over: null, under: 1.85, source: "fancy", kind: "bookmaker" },
    { match: "Alpha vs Beta", home: "Alpha", away: "Beta", start_utc: START, fmt: "T20", key: "match_runs", scope: "match", team: null, line: 4.5, over: 1.9, under: null, source: "other", kind: "bookmaker" },
  );
  const r = marketRow({ store, doc: d, fxInfo, ms, scope: -1, teamName: null, key: "match_runs", ground });
  assert.equal(r.overLine, 4.5);
  assert.equal(r.underLine, 3.5);
  assert.equal(r.over, 1.9);
  assert.equal(r.under, 1.85);
  assert.equal(r.overBook, "fancy", "one face book when two quote the same over price");
  assert.ok(r.books.some((b) => b.source === "other"), "the twin stays in books for +N");
});

test("the other side wins when the history is over; a market the books do not list, or too few games, give no edge", () => {
  const store = synthetic(), { ms, ground } = fancyInputs(store, fixture()), fxInfo = { a: "Alpha", b: "Beta", fmt: "T20", startMs: Date.parse(START) };
  // match wickets over 12.5: 11 of 20 over; both at 1.90 (the no-vig chance is 1/2): (11 + 5) / 30 x 1.9 - 1 = 0.01333
  const w = marketRow({ store, doc: doc(row("match_wickets", 12.5, 1.9, { over: 1.9 })), fxInfo, ms, scope: -1, teamName: null, key: "match_wickets", ground });
  assert.equal(w.side, "over");
  near(w.edge, (16 / 30) * 1.9 - 1);
  assert.deepEqual([w.hits, w.played], [11, 20]);
  assert.equal(marketRow({ store, doc: doc(), fxInfo, ms, scope: -1, teamName: null, key: "match_runs", ground }), null);
  // fewer than ten played games: no edge is claimed (Alpha's sixes are known for 14 matches here; with only 9 of the 20 matches in the sample there are 9)
  const few = marketRow({ store, doc: doc(row("team_total_sixes", 7.5, 1.9, { team: "Alpha", over: 1.9 })), fxInfo, ms: ms.slice(-9), scope: 0, teamName: "Alpha", key: "team_total_sixes", ground });
  assert.equal(few.played, 9);
  assert.equal(few.edge, null);
});

test("a line that voids when the side bowls first is scored on the matches it batted first only", () => {
  const store = synthetic({ fi: (m) => (m < 8 ? 1 : 0) }), { ms, ground } = fancyInputs(store, fixture()), fxInfo = { a: "Alpha", b: "Beta", fmt: "T20", startMs: Date.parse(START) };
  const r = marketRow({ store, doc: doc(row("team_total_runs", 160.5, 1.9, { team: "Alpha", bat_first: true })), fxInfo, ms, scope: 0, teamName: "Alpha", key: "team_total_runs", ground });
  assert.equal(r.batFirst, true);
  assert.deepEqual([r.hits, r.played], [12, 12]); // matches 8-19, all under 160.5
  near(r.edge, (12 + 10 * (20 / 39)) / 22 * 1.9 - 1); // 0.4791
});

test("fancyOverview ranks every market of both sides, best edge first", () => {
  const store = synthetic(), f = fixture();
  const d = doc(row("match_runs", 300.5, 1.8), row("team_total_runs", 160.5, 1.9, { team: "Alpha" }), row("team_total_runs", 150.5, 1.7, { team: "Beta" }), row("match_wickets", 12.5, 1.9, { over: 1.9 }));
  const rows = fancyOverview({ store, doc: d, fxInfo: { a: "Alpha", b: "Beta", fmt: "T20", startMs: Date.parse(START) }, ...fancyInputs(store, f) });
  assert.deepEqual(rows.map((r) => [r.key, r.team, r.side]), [["team_total_runs", "Alpha", "under"], ["match_runs", null, "under"], ["team_total_runs", "Beta", "under"], ["match_wickets", null, "over"]]);
  near(rows[0].edge, (16 + 10 * (20 / 39)) / 30 * 1.9 - 1); // 0.338121
  near(rows[2].edge, (16 + 10 * (20 / 37)) / 30 * 1.7 - 1); // 0.212973
});

const ALERT_DOC = () => doc(
  row("match_runs", 300.5, 1.8), row("team_total_runs", 160.5, 1.9, { team: "Alpha" }), row("team_total_runs", 150.5, 1.7, { team: "Beta" }),
  row("first_innings_runs", 160.5, 2.0), // 16 of 20 under at 2.00 / 2.00: (16 + 5) / 30 x 2 - 1 = 0.40, the biggest
  row("match_wickets", 12.5, 1.9, { over: 1.9 }), // 1.3%: not clearly positive
  row("team_total_sixes", 7.5, 1.9, { team: "Alpha", over: 1.9 }), // 14 played games: a good-looking record but under the 15 an alert needs
);

test("alerts: the edges that clear the bar, biggest first, three at most per match, with a stable id and the side's own line and price", () => {
  const store = synthetic(), out = fancyEdgeAlerts({ store, doc: ALERT_DOC(), fixtures: [fixture()], now: NOW });
  assert.deepEqual(out.map((a) => [a.key, a.team, a.side, a.line, a.best_odds]), [
    ["first_innings_runs", null, "under", 160.5, 2],
    ["team_total_runs", "Alpha", "under", 160.5, 1.9],
    ["match_runs", null, "under", 300.5, 1.8],
  ]); // Beta's team total (0.2130) is the fourth: left to the next run if one above it falls away
  const [a] = out;
  assert.equal(a.alert_id, "2026-11-02-alpha-v-beta|first_innings_runs||0|under");
  assert.equal(out[1].alert_id, "2026-11-02-alpha-v-beta|team_total_runs|Alpha|0|under");
  assert.deepEqual([a.hits, a.played, a.window, a.chance, a.edge, a.edge_pct], [16, 20, 20, 0.7, 0.4, 40]);
  assert.deepEqual([a.match, a.format, a.series, a.start_utc, a.start_ist, a.best_source, a.bat_first], ["Alpha vs Beta", "T20", "Series", "2026-11-02T09:30:00Z", "2026-11-02 15:00 IST", "bet365", false]);
  assert.equal(out[1].edge_pct, 33.8);
  assert.equal(out[2].edge_pct, 27.6);
  // the same data gives the same ids on the next run, and the line moving does not change them
  const moved = ALERT_DOC();
  moved.fancy[0].line = 305.5;
  assert.deepEqual(fancyEdgeAlerts({ store, doc: moved, fixtures: [fixture()], now: NOW + 3600e3 }).map((x) => x.alert_id), out.map((x) => x.alert_id));
});

test("alerts: a match that has started, an unknown side, no fancy lines or no time are left out", () => {
  const store = synthetic(), d = ALERT_DOC(), go = (fx, now = NOW) => fancyEdgeAlerts({ store, doc: d, fixtures: [fx], now });
  assert.equal(go(fixture()).length, 3);
  assert.deepEqual(go(fixture(), Date.parse(START) + 1), []); // under way
  assert.deepEqual(go(fixture({ b_ix: -1 })), []); // a side the data does not know
  assert.deepEqual(go(fixture({ start: "2026-11-02" })), []); // no time: cannot say it has not started
  assert.deepEqual(go(fixture({ noProps: true })), []);
  assert.deepEqual(go(fixture({ a: "Gamma", b: "Delta", id: "x" })), []); // no lines for these sides
  assert.deepEqual(fancyEdgeAlerts({ store, doc: doc(), fixtures: [fixture()], now: NOW }), []);
  assert.deepEqual(fancyEdgeAlerts({ store, doc: d, fixtures: undefined, now: NOW }), []);
});

test("alerts: an edge above the ceiling is held back as a likely stale line", () => {
  const store = synthetic();
  // under 4.00 / over 1.30: the market's chance of the under is 1 - (1/1.3) / (1/1.3 + 1/4) = 0.2453; 16 of 20 under gives (16 + 2.453) / 30 x 4 - 1 = 1.46
  const d = doc(row("match_runs", 300.5, 4, { over: 1.3 }));
  const [r] = fancyOverview({ store, doc: d, fxInfo: { a: "Alpha", b: "Beta", fmt: "T20", startMs: Date.parse(START) }, ...fancyInputs(store, fixture()) });
  near(r.edge, 1.4604, 1e-3); // the site would list it
  assert.deepEqual(fancyEdgeAlerts({ store, doc: d, fixtures: [fixture()], now: NOW }), []); // the channel does not
});

test("istLabel spells a time the way the pipeline's alert file does", () => {
  assert.equal(istLabel(Date.parse("2026-11-01T08:10:00Z")), "2026-11-01 13:40 IST");
  assert.equal(istLabel(Date.parse("2026-11-01T20:00:00Z")), "2026-11-02 01:30 IST");
});

test("the script reads the built data files and the book file and writes the same alerts", async () => {
  const store = synthetic(), dir = await mkdtemp(join(tmpdir(), "fancy-")), data = join(dir, "data");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(data);
  const put = (name, v) => writeFile(join(data, name), JSON.stringify(v));
  await Promise.all([put("meta.json", {}), put("index.json", store.index), put("matches.json", store.M), put("fixtures.json", [fixture()])]);
  await writeFile(join(dir, "book_lines.json"), JSON.stringify(ALERT_DOC()));
  const out = await buildDoc({ dataDir: data, linesPath: join(dir, "book_lines.json"), now: NOW });
  assert.deepEqual(out.alerts, fancyEdgeAlerts({ store, doc: ALERT_DOC(), fixtures: [fixture()], now: NOW }));
  assert.equal(out.generated_at_utc, "2026-11-01T10:00:00Z");
  assert.deepEqual([out.window, out.min_edge, out.max_edge, out.min_games, out.per_match], [20, 0.15, 0.6, 15, 3]); // the bar is written into the file
  // no fixtures in the data means the build was empty: the step fails rather than write an empty file over good alerts
  await put("fixtures.json", []);
  await assert.rejects(buildDoc({ dataDir: data, linesPath: join(dir, "book_lines.json"), now: NOW }), /no fixtures/);
  assert.match(await readFile(join(dir, "book_lines.json"), "utf8"), /match_runs/);
});

test("a market's link id carries its innings and reads back; a Test side's innings is named", () => {
  assert.equal(fancyFm("match_runs"), "match_runs");
  assert.equal(fancyFm("team_total_runs", 2), "team_total_runs:2");
  assert.deepEqual(parseFm("team_total_runs:2"), { key: "team_total_runs", inn: 2 });
  assert.deepEqual(parseFm("match_runs"), { key: "match_runs", inn: 0 });
  assert.deepEqual(parseFm("match_runs:7"), { key: "match_runs", inn: 0 }); // only 1 and 2 are innings
  assert.deepEqual(parseFm(undefined), { key: "", inn: 0 });
  assert.deepEqual([innTag(0), innTag(1), innTag(2)], ["", "1st inns", "2nd inns"]);
});

test("peerFancyFm keeps Fours when switching Match ↔ team; fancySample caps Match L10 at ten", () => {
  const matchList = [["match_fours", "Fours"], ["match_sixes", "Sixes"], ["match_runs", "Total runs"]];
  const teamList = [["team_total_fours", "Fours"], ["team_total_sixes", "Sixes"], ["team_total_runs:1", "1st inns · Runs"]];
  assert.equal(peerFancyFm("team_total_fours", matchList), "match_fours");
  assert.equal(peerFancyFm("match_fours", teamList), "team_total_fours");
  assert.equal(peerFancyFm("team_total_runs:2", matchList), "match_runs");
  assert.equal(peerFancyFm("overs_5", matchList), null);
  assert.equal(peerFancyFm("overs_5", [["overs_5", "5 overs"]]), "overs_5");
  assert.equal(peerFancyFm("missing", matchList), null);
  const store = synthetic(), f = fixture(), teams = [[f.a, f.a_ix], [f.b, f.b_ix]];
  const fmt = FORMATS.indexOf("T20");
  const uncapped = fancySample(store, { fmt, gender: 0, teams, scope: -1, lastN: 20 });
  const capped = fancySample(store, { fmt, gender: 0, teams, scope: -1, lastN: 10 });
  assert.ok(uncapped.length > 10);
  assert.equal(capped.length, 10);
  assert.deepEqual(capped, uncapped.slice(-10));
  assert.ok(fancySample(store, { fmt, gender: 0, teams, scope: 0, lastN: 10 }).length <= 10);
});

test("the labelled overview names each market and puts the side's short name in front of a team total", () => {
  const store = synthetic(), f = fixture(), { ms, ground, teams } = fancyInputs(store, f);
  const fxInfo = { a: "Alpha", b: "Beta", fmt: "T20", startMs: Date.parse(START) };
  const rows = collectOverview({ store, doc: doc(row("match_runs", 300.5, 1.8), row("team_total_sixes", 7.5, 1.9, { team: "Alpha", over: 1.9 })), fxInfo, ms, teams, ground });
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  assert.equal(byKey.match_runs.label, "Total runs");
  assert.equal(byKey.match_runs.id, "-1:match_runs");
  assert.equal(byKey.team_total_sixes.label, "ALP · Sixes");
  assert.equal(byKey.team_total_sixes.id, "0:team_total_sixes");
});
