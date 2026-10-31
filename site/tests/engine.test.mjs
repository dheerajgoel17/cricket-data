import test from "node:test";
import assert from "node:assert/strict";
import { loadFixture, sum } from "./helpers.mjs";
import { runPlan } from "../src/engine/plan.js";
import { playerReport } from "../src/engine/props.js";
import { teamForm } from "../src/engine/form.js";
import { MATCH_MARKETS, marketReport, selectMatches, teamTotalReport, topBatters } from "../src/engine/markets.js";

const BROOK_F6 = [0, 2, 1, 0, 0, 3, 1, 0, 2, 0];

test("player report: hit rate over 0.5 sixes, split by format (T20 never feeds ODI)", async () => {
  const { store, idx } = await loadFixture();
  const brook = idx("HC Brook");
  const t20 = await playerReport(store, brook, { stat: "sixes", line: 0.5, fmt: 0, filters: { full: true } });
  assert.equal(t20.n, 10);
  assert.equal(t20.summary.over, 5);
  assert.equal(t20.summary.fairOver, 2);
  const odi = await playerReport(store, brook, { stat: "sixes", line: 0.5, fmt: 1, filters: {} });
  assert.equal(odi.n, 4);
  assert.equal(odi.summary.over, 4); // ODI: one six every game
  assert.equal(odi.summary.fairOver, 1);
  // the short rain-hit T20 still counts for player props when `full` is off
  const all = await playerReport(store, brook, { stat: "sixes", line: 0.5, fmt: 0, filters: {} });
  assert.equal(all.n, 11);
});

test("filters: away, batting first, position and last N", async () => {
  const { store, idx, exp } = await loadFixture();
  const brook = idx("HC Brook");
  const run = (filters) => playerReport(store, brook, { stat: "sixes", line: 0.5, fmt: 0, filters: { full: true, ...filters } });
  const away = await run({ venueType: "away" });
  const awayIdx = exp.t20.map((m, i) => (m.away ? i : -1)).filter((i) => i >= 0);
  assert.equal(away.n, awayIdx.length);
  assert.equal(away.summary.over, awayIdx.filter((i) => BROOK_F6[i] > 0).length);
  const first = await run({ innings: "first" });
  const firstIdx = exp.t20.map((m, i) => (m.alpha_first ? i : -1)).filter((i) => i >= 0);
  assert.equal(first.n, firstIdx.length);
  const opener = await run({ pos: [1, 1] });
  assert.equal(opener.n, exp.t20.filter((m) => m.brook_pos === 1).length);
  const last3 = await run({ lastN: 3 });
  assert.equal(last3.n, 3);
  assert.deepEqual(last3.last.map((r) => r.value).reverse(), BROOK_F6.slice(-3));
});

test("splits by venue type partition the sample", async () => {
  const { store, idx } = await loadFixture();
  const r = await playerReport(store, idx("HC Brook"), { stat: "runs", line: 24.5, fmt: 0, filters: {}, splits: ["venue_type", "innings", "position"] });
  assert.equal(sum(r.splits.venue_type.map((x) => x.n)), r.n);
  assert.equal(sum(r.splits.innings.map((x) => x.n)), r.n);
  assert.equal(sum(r.splits.position.map((x) => x.n)), r.n);
});

test("team markets use only valid matches and the team batting first", async () => {
  const { store, exp } = await loadFixture();
  const alpha = store.teams.findIndex((t) => t.n === "Alpha");
  const ms = selectMatches(store, { fmt: 0, team: alpha });
  assert.equal(ms.length, 10, "the 5-over game is void and must be left out");
  const sixes = marketReport(store, ms, "match_sixes", 4.5);
  assert.deepEqual(sixes.values.sort((a, b) => a - b), exp.t20.map((m) => m.sixes).sort((a, b) => a - b));
  assert.equal(sixes.summary.over, exp.t20.filter((m) => m.sixes > 4.5).length);
  const first = selectMatches(store, { fmt: 0, team: alpha, teamFirst: true });
  assert.equal(first.length, exp.t20.filter((m) => m.alpha_first).length);
  const tot = marketReport(store, first, "team_runs");
  assert.deepEqual(tot.values.sort((a, b) => a - b), exp.t20.filter((m) => m.alpha_first).map((m) => m.alpha_runs).sort((a, b) => a - b));
  const fifties = marketReport(store, ms, "match_50s");
  assert.equal(sum(fifties.values), sum(exp.t20.map((m) => m.n50)));
  const thirties = marketReport(store, ms, "match_30s");
  assert.equal(sum(thirties.values), sum(exp.t20.map((m) => m.n30)));
  assert.deepEqual(marketReport(store, ms, "top_score").values, exp.t20.map((m) => m.top));
  assert.ok(Object.keys(MATCH_MARKETS).includes("highest_over"));
});

test("a team's 2nd innings is not its match total (hand-computed)", () => {
  const row = (team, runs) => { const a = Array(16).fill(0); a[0] = team; a[1] = runs; return a; };
  const store = { M: { inn: [[row(0, 360), row(1, 200), row(0, 250), row(1, 100)], [row(0, 400), row(1, 150)]] } };
  assert.deepEqual(teamTotalReport(store, [0, 1], 0, "team_total_runs").values, [610, 400], "both of team 0's innings, then the one-innings match");
  assert.deepEqual(teamTotalReport(store, [0, 1], 0, "team_total_runs", null, 1).values, [360, 400]);
  assert.deepEqual(teamTotalReport(store, [0, 1], 0, "team_total_runs", null, 2).values, [250], "the match where they only batted once is left out, not scored as 0");
  assert.equal(teamTotalReport(store, [0], 0, "team_total_runs", 500.5).summary.over, 1, "610 over 500.5");
  assert.equal(teamTotalReport(store, [0], 0, "team_total_runs", 500.5, 2).summary.over, 0, "250 is under 500.5");
});

test("match fancy: boundaries, first-innings score and a team's own innings", async () => {
  const { store, exp } = await loadFixture();
  const alpha = store.teams.findIndex((t) => t.n === "Alpha");
  const ms = selectMatches(store, { fmt: 0, team: alpha });
  const byId = exp.t20;
  assert.deepEqual(marketReport(store, ms, "match_boundaries").values, byId.map((m) => m.fours + m.sixes));
  assert.deepEqual(marketReport(store, ms, "first_innings_runs").values, byId.map((m) => (m.alpha_first ? m.alpha_runs : m.beta_runs)));
  const own = teamTotalReport(store, ms, alpha, "team_total_runs", 30.5);
  assert.deepEqual(own.values, byId.map((m) => m.alpha_runs), "the team's runs whether it batted first or second");
  assert.equal(own.summary.over, byId.filter((m) => m.alpha_runs > 30.5).length);
  const sixes = teamTotalReport(store, ms, alpha, "team_total_sixes").values, all = marketReport(store, ms, "match_sixes").values;
  assert.ok(sixes.every((v, i) => v <= all[i]), "a team's sixes never exceed the match's");
});

test("team form: last results in one format, oldest first", async () => {
  const { store } = await loadFixture();
  const alpha = store.teams.findIndex((t) => t.n === "Alpha"), beta = store.teams.findIndex((t) => t.n === "Beta");
  const a = teamForm(store, alpha, 0, 5), b = teamForm(store, beta, 0, 5);
  assert.equal(a.length, 5);
  assert.deepEqual(a.map((x) => x.result), ["W", "W", "W", "W", "W"], "the fixture's Alpha wins every game");
  assert.deepEqual(b.map((x) => x.result), ["L", "L", "L", "L", "L"]);
  assert.deepEqual(a.map((x) => x.date), [...a.map((x) => x.date)].sort(), "oldest to newest");
  assert.ok(a.every((x) => x.opp === beta) && b.every((x) => x.opp === alpha));
  assert.ok(a.every((x) => /^\d+\/\d+/.test(x.own) && /^\d+\/\d+/.test(x.theirs)), "scores come from the innings");
  assert.equal(teamForm(store, alpha, 0, 3).length, 3, "closed headline is last 3");
  assert.deepEqual(teamForm(store, alpha, 3, 5), [], "no Hundred matches, and formats are never mixed");
});

test("top batter counts sole vs tied", async () => {
  const { store, exp } = await loadFixture();
  const ms = selectMatches(store, { fmt: 0 });
  const t = topBatters(store, ms, { scope: "match" });
  const brook = t.rows.find((r) => r.name === "HC Brook");
  assert.equal(brook.sole, exp.t20.filter((m) => m.top_name === "brook").length);
});

test("partnership: who gets out first, opening pair", async () => {
  const { store, rz, exp } = await loadFixture();
  const res = await runPlan(store, rz, { kind: "partnership", player: "Brook", player2: "Duckett", opening: true, filters: { format: "T20" } });
  assert.ok(res.ok, res.error);
  const s = res.summary;
  assert.equal(s.n, 11); // ten full games plus the short one: partnerships do not need the game to be valid
  const brookFirst = exp.t20.filter((m) => m.first_out === "brook").length + 1; // + the short game (Brook first)
  const duckFirst = exp.t20.filter((m) => m.first_out === "duckett").length;
  const [x, y] = s.nameA === "HC Brook" ? [s.aOut, s.bOut] : [s.bOut, s.aOut];
  assert.deepEqual([x, y], [brookFirst, duckFirst]);
  assert.equal(s.ended, 11);
  const px = s.nameA === "HC Brook" ? s.fairFirstOutA : s.fairFirstOutB;
  assert.equal(px, Math.round((100 * 11) / brookFirst) / 100);
  assert.ok(res.headline.includes("11 stands"));
  // formats are reported separately and never pooled
  const fm = Object.fromEntries(res.splits.format.map((f) => [f.label, f.n]));
  assert.deepEqual(fm, { T20: 11, ODI: 4 });
});

test("partnership picks the pair's busiest format and explains when there is nothing", async () => {
  const { store, rz } = await loadFixture();
  const auto = await runPlan(store, rz, { kind: "partnership", player: "Brook", player2: "Duckett", opening: true, filters: {} });
  assert.ok(auto.ok && auto.notes.some((n) => n.includes("No format given")));
  assert.equal(auto.summary.n, 11);
  const none = await runPlan(store, rz, { kind: "partnership", player: "Brook", player2: "Kohli", opening: true, filters: { format: "T20" } });
  assert.ok(none.ok);
  assert.equal(none.summary.n, 0);
  assert.ok(none.notes.some((n) => n.includes("never batted for the same team")));
});

test("freshness is reported on every answer", async () => {
  const { store, rz } = await loadFixture();
  const res = await runPlan(store, rz, { kind: "player_prop", player: "Brook", stat: "sixes", line: 0.5, side: "over", filters: { format: "T20" } });
  assert.match(res.freshness, /Newest match in the base data: 2025-04-05/);
  assert.match(res.freshness, /No provisional matches included/);
  assert.equal(res.sample.n, res.summary.n);
  assert.ok(res.filters.some(([k]) => k === "Format"));
});

test("venueIndices finds a ground under every spelling the data holds, and nothing for a different or missing one", async () => {
  const { venueIndices } = await import("../src/engine/markets.js");
  const store = { venues: ["Sharjah Cricket Association Stadium", "Sharjah Cricket Stadium", "Sharjah Cricket Stadium, Sharjah", "Dubai International Cricket Stadium", "Sharjah Oval"] };
  assert.deepEqual(venueIndices(store, "Sharjah Cricket Stadium, Sharjah"), [0, 1, 2]);
  assert.deepEqual(venueIndices(store, "Dubai International Cricket Stadium, Dubai"), [3]);
  assert.deepEqual(venueIndices(store, "Nowhere Ground"), []);
  assert.deepEqual(venueIndices(store, ""), []);
  assert.deepEqual(venueIndices(store, undefined), []);
});

test("Match Fancy includes a withheld T20 that qualified, not women's matches, and not a totals-only scrape", () => {
  // Zimbabwe men (0) last Base T20 is 6 Sep; Afghanistan men never appear in Base; the Oct Sharjah T20s are scraped.
  const ZIM_M = 0, ZIM_W = 1, AFG_M = 2, IND_W = 3, SA_M = 4;
  const inn = (f4) => [[0, 140, 6, 120, f4, 5, 0, 0, 0, 0, 0, 0, 12, 20, 40]];
  const M = {
    f:  [0, 0, 0, 0],
    g:  [0, 1, 0, 0],
    pv: [0, 0, 1, 1],
    q:  [1, 1, 1, -1],
    d:  ["2026-09-06", "2026-10-20", "2026-10-27", "2026-10-29"],
    a:  [ZIM_M, ZIM_W, AFG_M, AFG_M],
    b:  [SA_M, IND_W, ZIM_M, ZIM_M],
    i:  [1, 1, 1, 1], e: [0, 0, 0, 0], v: [0, 0, 1, 1], fi: [0, 0, 0, -1],
    inn: [inn(12), inn(20), inn(18), []],
    ho: [16, 18, 20, 0], mc: [30, 32, 40, 0],
  };
  const store = { n: 4, M, teams: [{ n: "Zimbabwe", g: 0 }, { n: "Zimbabwe", g: 1 }, { n: "Afghanistan", g: 0 }, { n: "India", g: 1 }, { n: "South Africa", g: 0 }], venues: ["Windhoek", "Sharjah"] };
  const zimMen = selectMatches(store, { fmt: 0, gender: 0, team: ZIM_M, lastN: 20 });
  assert.deepEqual(zimMen, [0, 2], "6 Sep Base + 27 Oct withheld; not the 20 Oct women's game and not the totals-only 29 Oct scrape");
  const afgMen = selectMatches(store, { fmt: 0, gender: 0, team: AFG_M, lastN: 20 });
  assert.deepEqual(afgMen, [2]);
  const sample = [...new Set([...zimMen, ...afgMen])].sort((a, b) => a - b);
  assert.deepEqual(marketReport(store, sample, "match_fours").values, [12, 18]);
  assert.equal(store.M.d[sample[sample.length - 1]], "2026-10-27");
});
