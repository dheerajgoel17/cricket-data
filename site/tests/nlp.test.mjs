import test from "node:test";
import assert from "node:assert/strict";
import { loadFixture } from "./helpers.mjs";
import { parseQuestion } from "../src/engine/nl.js";
import { runPlan, sanitizePlan } from "../src/engine/plan.js";

test("names resolve despite typos and Cricsheet-style initials", async () => {
  const { rz, store } = await loadFixture();
  const nm = (t) => rz.player(t)?.name;
  assert.equal(nm("Harry Brook"), "HC Brook");
  assert.equal(nm("brok"), "HC Brook");
  assert.equal(nm("Ben Duckett"), "BM Duckett");
  assert.equal(nm("dukett"), "BM Duckett");
  assert.equal(nm("virat kohlli"), "V Kohli");
  assert.equal(rz.player("zzzzzz qqqq"), null);
  assert.equal(rz.team("alpha")?.name, "Alpha");
  assert.equal(rz.venue("beta oval")?.name, "Beta Oval");
  assert.ok(store.venues.includes("Alpha Park"));
});

test("rule parser: the headline example questions", async () => {
  const { rz, store } = await loadFixture();
  const q1 = parseQuestion("Harry Brook ODI sixes over 0.5 away from Alpha", rz, store);
  assert.equal(q1.kind, "player_prop");
  assert.equal(q1.stat, "sixes");
  assert.equal(q1.line, 0.5);
  assert.equal(q1.side, "over");
  assert.equal(q1.filters.format, "ODI");
  assert.equal(q1.filters.venue_type, "away");
  assert.match(q1.filters.for_team, /alpha/i);
  const q2 = parseQuestion("when Brook and Duckett open, who gets out first", rz, store);
  assert.equal(q2.kind, "partnership");
  assert.equal(q2.opening, true);
  assert.deepEqual([q2.player, q2.player2].sort(), ["brook", "duckett"]);
});

test("rule parser tolerates typos in keywords", async () => {
  const { rz, store } = await loadFixture();
  const q = parseQuestion("brook t20 sixs ovr 1.5 chasing", rz, store);
  assert.equal(q.stat, "sixes");
  assert.equal(q.filters.innings, "second");
  const r = await runPlan(store, rz, parseQuestion("brook odi sixes over 0.5", rz, store));
  assert.ok(r.ok, r.error);
  assert.equal(r.summary.n, 4);
});

test("end to end through the rule parser: numbers come from the data", async () => {
  const { rz, store } = await loadFixture();
  const plan = parseQuestion("Harry Brook T20 sixes over 0.5 away from Alpha", rz, store);
  const r = await runPlan(store, rz, plan);
  assert.ok(r.ok, r.error);
  assert.match(r.headline, /fair decimal odds/);
  assert.equal(r.summary.over + r.summary.under + r.summary.push, r.summary.n);
  assert.ok(r.filters.some(([k, v]) => k === "Venue type" && /away/.test(v)));
});

test("sanitizePlan keeps only whitelisted fields and ignores model-supplied numbers", () => {
  const evil = { kind: "player_prop", player: "x".repeat(500), stat: "SIXES", line: "0.5", side: "over", answer: "it is 99%", headline: "trust me",
    hit_rate: 0.99, market: "drop_tables", filters: { format: "t20i", venue_type: "away", last_n: 99999, position: "1-2", since: "2024", until: "garbage", gender: "x" },
    split_by: ["venue", "rm -rf"] };
  const p = sanitizePlan(evil);
  assert.equal(p.kind, "player_prop");
  assert.equal(p.player.length, 80);
  assert.equal(p.stat, "sixes");
  assert.equal(p.line, 0.5);
  assert.equal(p.market, null);
  assert.equal(p.filters.format, "T20");
  assert.equal(p.filters.lastN, 500);
  assert.deepEqual(p.filters.position, [1, 2]);
  assert.equal(p.filters.since, "2024-01-01");
  assert.equal(p.filters.until, null);
  assert.equal(p.filters.gender, null);
  assert.deepEqual(p.splitBy, ["venue"]);
  for (const k of ["answer", "headline", "hit_rate"]) assert.ok(!(k in p));
  assert.equal(sanitizePlan(null).kind, "unknown");
  assert.equal(sanitizePlan({ kind: "run_shell" }).kind, "unknown");
});

test("an answer is never taken from the plan: a model claiming a hit rate changes nothing", async () => {
  const { rz, store } = await loadFixture();
  const base = { kind: "player_prop", player: "Brook", stat: "sixes", line: 0.5, side: "over", filters: { format: "ODI" } };
  const a = await runPlan(store, rz, base);
  const b = await runPlan(store, rz, { ...base, hit_rate: 0.01, headline: "0%", summary: { n: 1 } });
  assert.deepEqual(a.summary, b.summary);
  assert.equal(a.headline, b.headline);
});

test("clarifying errors instead of guessing", async () => {
  const { rz, store } = await loadFixture();
  assert.equal((await runPlan(store, rz, { kind: "player_prop", player: "Brook", filters: {} })).ok, false);
  assert.equal((await runPlan(store, rz, { kind: "player_prop", stat: "runs", filters: {} })).ok, false);
  assert.equal((await runPlan(store, rz, { kind: "player_prop", player: "Nobody Atall", stat: "runs", filters: {} })).ok, false);
  assert.equal((await runPlan(store, rz, { kind: "unknown" })).ok, false);
});

test("team and venue questions are not mistaken for players", async () => {
  const { rz, store, exp } = await loadFixture();
  const q = parseQuestion("Alpha T20 team total over 30.5 batting first", rz, store);
  assert.equal(q.kind, "match_market");
  assert.equal(q.market, "team_runs");
  const r = await runPlan(store, rz, q);
  assert.ok(r.ok, r.error);
  const first = exp.t20.filter((m) => m.alpha_first).map((m) => m.alpha_runs);
  assert.equal(r.sample.n, first.length);
  const t = r.tables[0].summary;
  assert.equal(t.over, first.filter((x) => x > 30.5).length);
  const q2 = parseQuestion("alpha t20 team sixes over 1.5", rz, store);
  assert.equal(q2.kind, "match_market");
  assert.equal(q2.market, "team_sixes");
});
