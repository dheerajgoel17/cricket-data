import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createPropsFeed } from "../public/js/feeds.js";
import { adoptQuery, cleanQuery, hasQuery, hashFor, remember, scopeFor } from "../public/js/persist.js";
import { createStore } from "../public/js/engine/store.js";
import { fixtureDir } from "./helpers.mjs";
import { join } from "node:path";

test("shared links win over saved filters; an empty URL adopts them", () => {
  const saved = { fmt: "0", stat: "sixes", tab: "logs" };
  assert.deepEqual(adoptQuery({}, saved), saved);
  assert.deepEqual(adoptQuery({ stat: "runs" }, saved), { stat: "runs" });
  assert.equal(hasQuery({}), false);
  assert.equal(hasQuery({ line: "" }), false);
  assert.deepEqual(cleanQuery({ a: "1", b: "", c: null }), { a: "1" });
});

test("remember keeps the latest screens and drops the oldest past the cap", () => {
  let state = {};
  for (let i = 0; i < 42; i++) state = remember(state, `player:${i}`, { stat: "runs", tab: "props" });
  assert.equal(state.order.length, 40);
  assert.equal(state["player:0"], undefined);
  assert.equal(state["player:1"], undefined);
  assert.equal(state["player:41"].stat, "runs");
  state = remember(state, "player:41", { stat: "sixes" });
  assert.equal(state["player:41"].stat, "sixes");
  assert.equal(state.order.filter((s) => s === "player:41").length, 1);
});

test("scope and hash cover the screens whose filters should stick", () => {
  assert.equal(scopeFor("", []), "home");
  assert.equal(scopeFor("fixtures", []), "home");
  assert.equal(scopeFor("player", ["12"]), "player:12");
  assert.equal(scopeFor("fixture", ["2026-01-01-ind-v-aus"]), "fixture:2026-01-01-ind-v-aus");
  assert.equal(scopeFor("ask", []), null);
  assert.equal(hashFor("", [], { d: "2026-01-02", f: "T20" }), "#/?d=2026-01-02&f=T20");
  assert.equal(hashFor("player", ["3"], { stat: "sixes", line: "" }), "#/player/3?stat=sixes");
});

test("player rows and the props feed are fetched once and then reused", async () => {
  const base = join(fixtureDir, "data");
  let reads = 0;
  const store = await createStore({
    fetchJson: async (p) => {
      reads++;
      return JSON.parse(await readFile(join(base, p), "utf8"));
    },
  });
  const before = reads;
  store.prefetchPlayer(3);
  const a = await store.playerRows(3);
  const mid = reads;
  const b = await store.playerRows(3);
  assert.equal(reads, mid);
  assert.equal(a, b);
  assert.ok(mid > before);

  let calls = 0;
  const t0 = 1_000_000;
  const feed = createPropsFeed({
    now: () => t0,
    ttl: 1000,
    base: "data/props.json",
    raw: "https://example.test/value_bets_latest.json",
    fetchImpl: async (url) => {
      calls++;
      if (String(url).includes("props.json")) return { ok: true, json: async () => ({ generated_at_utc: "2026-01-01T00:00:00Z", value_bets: [{ id: "old" }], recent_alerts: [{ id: "a" }] }) };
      return { ok: true, json: async () => ({ generated_at_utc: "2026-01-02T00:00:00Z", value_bets: [{ id: "new" }] }) };
    },
  });
  const [first, second] = await Promise.all([feed.load(), feed.load()]);
  assert.equal(calls, 2); // bundled file + live file, not two of each
  assert.equal(first, second);
  assert.equal(first.live, true);
  assert.equal(first.snap.value_bets[0].id, "new");
  assert.equal(first.snap.recent_alerts[0].id, "a");
  assert.equal(feed.peek(), first);
  await feed.load();
  assert.equal(calls, 2);
});
