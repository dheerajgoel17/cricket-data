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

test("a failed index does not leave matches.json as an unhandled rejection", async () => {
  const fetchJson = async (p) => {
    if (p === "matches.json") return Promise.reject(new Error("no data origin"));
    if (p === "meta.json") return Promise.reject(new Error("no data origin"));
    if (p === "index.json") return Promise.reject(new Error("no data origin"));
    return [];
  };
  await assert.rejects(() => createStore({ fetchJson }), /no data origin/);
  await new Promise((r) => setImmediate(r));
});

test("on-demand history starts only when requested and shares one download", async () => {
  const requests = [];
  const store = await createStore({
    deferMatches: "on-demand",
    fetchJson: async (path) => {
      requests.push(path);
      return path === "index.json" ? index : path === "matches.json" ? { id: ["m1"] } : {};
    },
  });
  assert.deepEqual(requests, ["meta.json", "index.json"]);
  assert.equal(store.n, 0);
  const first = store.ready;
  assert.equal(store.ready, first);
  await first;
  assert.equal(store.n, 1);
  assert.deepEqual(requests, ["meta.json", "index.json", "matches.json"]);
});
