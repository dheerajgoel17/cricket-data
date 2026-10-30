import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../src/engine/store.js";
import { Resolver } from "../src/engine/resolve.js";

const TEAMS = [{ n: "Sri Lanka", g: 1 }, { n: "Other", g: 0 }];
const data = {
  "meta.json": { schema: 1, built_at: "2026-10-28T00:00Z", matches: 1, players: 2, newest_base: "2026-10-20", provisional_matches: 0, newest_provisional: "", provisional_included: false },
  "index.json": {
    players: { id: ["ac56b5a7", "deadbeef"], nm: ["AC Jayangani", "R Athapaththu"], g: [1, 0], last: ["2026-10-20", "2024-01-01"], n: [40, 2], tm: [0, 1], fm: [1, 1] },
    aliases: { 0: ["Chamari Athapaththu"] },
    teams: TEAMS, venues: ["Ground"], events: ["Series"],
    hosts: ["Sri Lanka"], kinds: [""], formats: ["T20", "ODI", "Test", "Hundred", "T10", "O60"], nshard: 1,
  },
  "matches.json": { id: ["t0"], d: ["2026-10-01"], f: [0], g: [1], i: [1], e: [0], v: [0], a: [0], b: [1],
    w: [0], r: [0], o: [20], dy: [5], h: [0], fi: [0], pv: [0], q: [1], ho: [0], mc: [0], ts: [0], xq: [1], inn: [] },
  "p/00.json": { bat: {}, bowl: {}, pt: {}, xi: {} },
};

const load = async () => createStore({ fetchJson: async (p) => structuredClone(data[p]) });

test("Athapaththu (playing name) resolves to AC Jayangani, not a namesake", async () => {
  const rz = new Resolver(await load());
  const hit = rz.player("Chamari Athapaththu", { gender: 1 });
  assert.equal(hit?.name, "AC Jayangani");
  assert.equal(rz.player("Athapaththu", { gender: 1 })?.name, "AC Jayangani");
  assert.equal(rz.player("Jayangani", { gender: 1 })?.name, "AC Jayangani");
});
