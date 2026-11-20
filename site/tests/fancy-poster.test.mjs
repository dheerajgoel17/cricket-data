import test from "node:test";
import assert from "node:assert/strict";
import { parseCardLink, posterPath } from "@cricket/engine/card-link.js";

test("player links in every shape the site hands out", () => {
  assert.deepEqual(parseCardLink("https://x.test/player/12?stat=runs&line=24.5"), { kind: "player", p: 12, stat: "runs", line: 24.5 });
  assert.deepEqual(parseCardLink("/share/player/12/runs/24.5"), { kind: "player", p: 12, stat: "runs", line: 24.5 });
  assert.deepEqual(parseCardLink("https://x.test/card/v15/pid/0a1b2c3d/wickets/1.5.jpg"), { kind: "player", pid: "0a1b2c3d", stat: "wickets", line: 1.5 });
  assert.deepEqual(parseCardLink("/player/12"), { kind: "player", p: 12, stat: null, line: null });
  assert.equal(posterPath(parseCardLink("/player/12?stat=runs&line=24.5")), "/api/og?p=12&stat=runs&line=24.5&poster=1");
});

test("fancy links carry the market and the scope", () => {
  assert.deepEqual(parseCardLink("https://x.test/fixture/2026-11-02-a-v-b/fancy?fm=match_sixes&sc=-1&mw=10"), { kind: "fancy", f: "2026-11-02-a-v-b", fm: "match_sixes", sc: -1 });
  assert.deepEqual(parseCardLink("/fixture/id1/fancy?fm=team_total_runs:1&sc=0"), { kind: "fancy", f: "id1", fm: "team_total_runs:1", sc: 0 });
  assert.equal(posterPath(parseCardLink("/fixture/id1/fancy?fm=match_sixes")), "/api/og?f=id1&fm=match_sixes&sc=-1&poster=1");
});

test("anything else is not a card link", () => {
  for (const s of ["", "hello", "/fixture/id1", "/fixture/id1/fancy", "/venue/3", "/player/abc"]) assert.equal(parseCardLink(s), null, s);
});

import { writeFileSync } from "node:fs";
import { WINDOW } from "@cricket/engine/fancy-edge.js";
import { fancyPosterFields, renderFancyPoster } from "@cricket/engine/fancy-poster.js";
import { Store } from "@cricket/engine/store.js";

// Same synthetic league as fancy-edge.test.mjs: 20 T20s Alpha v Beta; the first 4 go over every line, the other 16 under.
function synthetic() {
  const ids = Array.from({ length: WINDOW }, (_, m) => m), over = (m) => m < 4;
  const inn = ids.map((m) => [[0, over(m) ? 180 : 150, 7, 0, 0, 8], [1, over(m) ? 170 : 140, 7, 0, 0, 0]]);
  const M = { id: ids.map((m) => `m${m}`), f: ids.map(() => 0), q: ids.map(() => 1), g: ids.map(() => 0), d: ids.map((m) => `2026-01-${String(m + 1).padStart(2, "0")}`),
    i: ids.map(() => 1), e: ids.map(() => 0), v: ids.map(() => 0), a: ids.map(() => 0), b: ids.map(() => 1), fi: ids.map(() => 0), pv: ids.map(() => 0), inn, ov: ids.map(() => []), h: ids.map(() => -1) };
  const index = { players: { nm: [], id: [] }, teams: [{ n: "Alpha", g: 0 }, { n: "Beta", g: 0 }], venues: ["Ground, City"], events: [], hosts: [], nshard: 0 };
  return new Store({}, index, M, async () => { throw new Error("no shards"); });
}
const fixtures = [{ id: "fx1", start: "2026-11-02T09:30Z", fmt: "T20", gender: "male", a: "Alpha", b: "Beta", venue: "Ground, City", series: "Series", a_ix: 0, b_ix: 1 }];
const doc = { lines: [], fancy: [{ match: "Alpha vs Beta", home: "Alpha", away: "Beta", start_utc: "2026-11-02T09:30:00Z", fmt: "T20", key: "match_runs", scope: "match", team: null, line: 300.5, over: 2, under: 1.8, source: "bet365", kind: "bookmaker" }] };

test("fancy poster fields come from the engine's market row, and the poster draws a 1080x1350 PNG", async () => {
  const f = fancyPosterFields(synthetic(), doc, fixtures, { id: "fx1", fm: "match_runs", sc: -1 });
  assert.equal(f.label, "Total runs");
  assert.equal(f.side, "under"); // 16 of 20 under (hand-computed in fancy-edge.test)
  assert.equal(f.line, 300.5);
  assert.equal(f.under, 1.8);
  assert.equal(f.last.length, 10);
  assert.equal(fancyPosterFields(synthetic(), doc, fixtures, { id: "nope", fm: "match_runs" }), null);
  assert.equal(fancyPosterFields(synthetic(), doc, fixtures, { id: "fx1", fm: "match_sixes" }), null); // not listed by any book
  const png = await renderFancyPoster(f, { fonts: { bold: "fonts/satoshi/Satoshi-Bold.woff", regular: "fonts/satoshi/Satoshi-Medium.woff", num: "node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff" } });
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  assert.equal(png.readUInt32BE(16), 1080);
  assert.equal(png.readUInt32BE(20), 1350);
  if (process.env.POSTER_OUT) writeFileSync(process.env.POSTER_OUT, png);
});

test("the bot route needs its key and a card link", async () => {
  const { default: card, keyOk } = await import("../api/card.js");
  const call = async (req) => { const out = { headers: {} }; await card({ headers: {}, query: {}, ...req }, { setHeader: (k, v) => (out.headers[k] = v), end: (b) => (out.body = b), set statusCode(v) { out.code = v; } }); return out; };
  delete process.env.CARD_API_KEY;
  assert.equal((await call({ query: { link: "/player/1" } })).code, 503);
  process.env.CARD_API_KEY = "s3cret";
  try {
    assert.equal((await call({ query: { link: "/player/1" } })).code, 401);
    assert.equal((await call({ query: { link: "/player/1", key: "nope" } })).code, 401);
    assert.equal((await call({ headers: { authorization: "Bearer s3cret" }, query: { link: "https://x.test/venue/3" } })).code, 400);
    assert.equal(keyOk("a", "ab"), false);
    assert.equal(keyOk("", ""), false);
    assert.equal(keyOk("s3cret", "s3cret"), true);
  } finally { delete process.env.CARD_API_KEY; }
});
