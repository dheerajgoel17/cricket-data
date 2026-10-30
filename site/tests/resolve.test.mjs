import test from "node:test";
import assert from "node:assert/strict";
import { Resolver } from "../src/engine/resolve.js";

function miniStore(players) {
  const P = { id: [], nm: [], g: [], n: [], last: [], tm: [], fm: [] };
  const aliases = {};
  players.forEach((p, i) => {
    P.id.push(p.id || String(i));
    P.nm.push(p.nm);
    P.g.push(p.g ?? 0);
    P.n.push(p.n ?? 1);
    P.last.push(p.last ?? "2026-01-01");
    P.tm.push(p.tm ?? 0);
    P.fm.push(p.fm ?? 1);
    if (p.aliases) aliases[i] = p.aliases;
  });
  const teams = [{ n: "Sri Lanka", g: 1 }, { n: "Romania", g: 0 }, { n: "Hobart Hurricanes", g: 1 }];
  return {
    P, index: { aliases }, n: 0, M: { v: [], a: [], b: [] }, venues: [], teams,
    meta: { newest_cricsheet: "2026-10-01" },
    teamName(i) { return teams[i]?.n || "?"; },
  };
}

test("Athapaththu on a scorecard is Chamari (AC Jayangani), not the Romanian namesake", () => {
  const rz = new Resolver(miniStore([
    { nm: "R Athapaththu", g: 0, n: 11, last: "2024-06-15", tm: 1, id: "3465e307" },
    { nm: "AC Jayangani", g: 1, n: 645, last: "2026-09-22", tm: 0, id: "ac56b5a7" },
    { nm: "MS Atapattu", g: 0, n: 78, last: "2007-11-16", tm: 0, id: "8a686d30" },
  ]));
  assert.equal(rz.player("Athapaththu")?.name, "AC Jayangani");
  assert.equal(rz.player("Athapaththu", { gender: 1 })?.name, "AC Jayangani");
  assert.equal(rz.player("Chamari Athapaththu", { gender: 1 })?.name, "AC Jayangani");
  assert.equal(rz.player("R Athapaththu")?.name, "R Athapaththu");
  assert.equal(rz.player("Athapaththu", { gender: 0 })?.name, "R Athapaththu", "men's match: the Romanian, not Chamari");
});
