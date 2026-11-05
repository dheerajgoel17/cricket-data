import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "@cricket/engine/store.js";

const index = { players: { id: ["aa"], nm: ["A"] }, nshard: 1, teams: [], venues: [], events: [] };

test("deferMatches returns the index before matches.json and attaches it on ready", async () => {
  let sawMatches = false;
  const fetchJson = async (p) => {
    if (p === "matches.json") {
      sawMatches = true;
      await new Promise((r) => setTimeout(r, 40));
      return { id: ["m1"] };
    }
    if (p === "meta.json") return {};
    if (p === "index.json") return index;
    return [];
  };
  const t0 = Date.now();
  const store = await createStore({ fetchJson, deferMatches: true });
  assert.ok(Date.now() - t0 < 30, "createStore waited for matches.json");
  assert.equal(sawMatches, true);
  assert.equal(store.n, 0);
  await store.ready;
  assert.equal(store.n, 1);
  assert.equal(store.M.id[0], "m1");
});
