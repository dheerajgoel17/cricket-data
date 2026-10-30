import test from "node:test";
import assert from "node:assert/strict";
import { playerIdFor, fixtureFmt } from "../src/engine/identity.js";
import { Resolver } from "../src/engine/resolve.js";

const doc = {
  p: [
    { f: "athapaththu", r: "Athapaththu", id: "ac56b5a7", g: 1, t: "sri lanka", src: "csv" },
    { f: "athapaththu", r: "Athapaththu", id: "ac56b5a7", g: 1, t: "hobart hurricanes", src: "csv" },
    { f: "r athapaththu", r: "R Athapaththu", id: "3465e307", g: 0, t: "", src: "crex" },
  ],
  fx: [
    { id: "t", a: "Afghanistan", b: "Zimbabwe", ak: "afghanistan", bk: "zimbabwe", fmt: "Test", g: "male", start: "2026-11-05T06:00:00Z" },
    { id: "x", a: "Afghanistan", b: "Zimbabwe", ak: "afghanistan", bk: "zimbabwe", fmt: "T20", g: "male", start: "2026-11-01T14:30:00Z" },
  ],
};

test("playerIdFor uses gender so Chamari is not the Romanian namesake", () => {
  assert.equal(playerIdFor(doc, "Athapaththu", { gender: 1 }), "ac56b5a7");
  assert.equal(playerIdFor(doc, "Athapaththu", { gender: 1, team: "Hobart Hurricanes" }), "ac56b5a7");
  assert.equal(playerIdFor(doc, "R Athapaththu", { gender: 0 }), "3465e307");
  assert.equal(playerIdFor(doc, "Athapaththu"), null, "bare surname without gender is both Chamari and the Romanian");
});

test("fixtureFmt keeps the Test and the T20 on the same sides apart", () => {
  assert.equal(fixtureFmt(doc, { a: "Afghanistan", b: "Zimbabwe", fmt: "Test", start: "2026-11-05T06:00Z" }), "Test");
  assert.equal(fixtureFmt(doc, { a: "Afghanistan", b: "Zimbabwe", fmt: "T20", start: "2026-11-01T14:30Z" }), "T20");
});

test("Resolver unique identity hit beats a namesake", () => {
  const P = { id: ["3465e307", "ac56b5a7"], nm: ["R Athapaththu", "AC Jayangani"], g: [0, 1], n: [11, 645], last: ["2024-06-15", "2026-09-22"], tm: [1, 0], fm: [1, 1] };
  const store = {
    P, index: { aliases: {} }, n: 0, M: { v: [], a: [], b: [] }, venues: [],
    teams: [{ n: "Sri Lanka", g: 1 }, { n: "Romania", g: 0 }],
    meta: { newest_cricsheet: "2026-10-01" },
    teamName(i) { return this.teams[i]?.n || "?"; },
  };
  const rz = new Resolver(store, doc);
  assert.equal(rz.player("Athapaththu", { gender: 1 })?.name, "AC Jayangani");
});
