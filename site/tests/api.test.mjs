import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

const FAKE = ["not", "a", "real", "key"].join("-");
process.env.GEMINI_API_KEY = FAKE;
process.env.ASK_PER_MINUTE = "3";
const { default: handler } = await import("../api/ask.js");

function call(body, { method = "POST", ip = "1.2.3.4" } = {}) {
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(o) { resolve({ code: this.code, body: o }); } };
    handler({ method, body, headers: { "x-forwarded-for": ip }, socket: {} }, res);
  });
}

let seen;
const realFetch = globalThis.fetch;
beforeEach(() => { seen = []; });
test.after(() => { globalThis.fetch = realFetch; });

function stub(reply, status = 200) {
  globalThis.fetch = async (url, init) => {
    seen.push({ url: String(url), init });
    return { ok: status === 200, status, json: async () => ({ candidates: [{ content: { parts: [{ text: reply }] } }] }) };
  };
}

test("returns a sanitised plan and keeps the key out of the URL", async () => {
  stub(JSON.stringify({ kind: "player_prop", player: "Harry Brook", stat: "sixes", line: 0.5, side: "over", hit_rate: 0.9, filters: { format: "ODI" } }));
  const r = await call({ question: "harry brook odi sixes over 0.5" }, { ip: "9.9.9.1" });
  assert.equal(r.code, 200);
  assert.equal(r.body.plan.stat, "sixes");
  assert.ok(!("hit_rate" in r.body.plan));
  assert.ok(!seen[0].url.includes(FAKE));
  assert.equal(seen[0].init.headers["x-goog-api-key"], FAKE);
  const sent = JSON.parse(seen[0].init.body);
  assert.match(sent.contents[0].parts[0].text, /harry brook odi sixes/);
  assert.equal(sent.generationConfig.temperature, 0);
});

test("tolerates fenced JSON and rejects junk with 502", async () => {
  stub("```json\n{\"kind\":\"partnership\",\"player\":\"Banton\",\"player2\":\"Duckett\",\"opening\":true}\n```");
  assert.equal((await call({ question: "q" }, { ip: "9.9.9.2" })).body.plan.kind, "partnership");
  stub("I think the answer is 42");
  const bad = await call({ question: "q" }, { ip: "9.9.9.3" });
  assert.equal(bad.code, 502);
});

test("falls back to the next model on HTTP errors, then gives up", async () => {
  stub("{}", 429);
  const r = await call({ question: "q" }, { ip: "9.9.9.4" });
  assert.equal(r.code, 502);
  assert.equal(seen.length, 2);
});

test("validates input and rate-limits per IP", async () => {
  stub("{\"kind\":\"unknown\"}");
  assert.equal((await call({}, { ip: "9.9.9.5" })).code, 400);
  assert.equal((await call({ question: "q" }, { method: "GET" })).code, 405);
  for (let i = 0; i < 3; i++) await call({ question: "q" }, { ip: "9.9.9.6" });
  assert.equal((await call({ question: "q" }, { ip: "9.9.9.6" })).code, 429);
});

test("xAI Grok is used when XAI_API_KEY is set (key in the header, plan sanitised)", async () => {
  process.env.XAI_API_KEY = ["xai", "fake", "key"].join("-");
  globalThis.fetch = async (url, init) => {
    seen.push({ url: String(url), init });
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ kind: "player_prop", player: "Brook", stat: "sixes", line: 0.5, side: "over", hit_rate: 1, filters: {} }) } }] }) };
  };
  const r = await call({ question: "brook sixes over 0.5" }, { ip: "9.9.9.8" });
  delete process.env.XAI_API_KEY;
  assert.equal(r.code, 200);
  assert.equal(r.body.plan.stat, "sixes");
  assert.ok(!("hit_rate" in r.body.plan));
  assert.match(seen[0].url, /api\.x\.ai\/v1\/chat\/completions/);
  assert.ok(seen[0].init.headers.authorization.startsWith("Bearer "));
  assert.ok(!seen[0].url.includes("fake"));
});

test("without a key the endpoint says so (the site then uses its built-in parser)", async () => {
  const k = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  assert.equal((await call({ question: "q" }, { ip: "9.9.9.7" })).code, 503);
  process.env.GEMINI_API_KEY = k;
});

const { default: liveHandler } = await import("../api/live.js");
const crexHtml = (payload) => `<script id="app-root-state">${JSON.stringify(payload).replace(/"/g, "&q;")}</script>`;
const nedOma = { team1: "Netherlands", team2: "Oman", t1SName: "NED", t2SName: "OMA", t1f: "N", t2f: "O", bf: "N", s1: "10-0", o1: "2.0", s2: "", o2: "", t: Date.parse("2026-10-27T09:00:00Z"), status: 1, statusText: "Live", fo: "ODI", mf: "14VC", link: "/cricket-live-score/ned-vs-oma-14VC" };
const u19 = { team1: "Oman U19", team2: "Afghanistan U19", s2: "421-5", o2: "50.0", t: Date.parse("2026-10-27T05:30:00Z"), status: 1, fo: "Youth ODI", mf: "14UU", link: "/cricket-live-score/oma-u19-vs-afg-u19-14UU" };
const SCHEDULE = crexHtml({ "https://stats.crickapi.com/fixture/getFixture": [nedOma, u19] });
const MATCH_PAGE = crexHtml({ "https://api.goscorer.com/api/v3/getSV3": {
  team1_f_n: "Netherlands", team2_f_n: "Oman", team1short: "NED", team2short: "OMA", rt: "Netherlands", inning: 1, status: 1,
  score1: "19-0", over1: "3.1", score2: "", over2: "", comment1: "OMA opt to <b>Bowl</b>",
  player_full_name1: "Vikramjit Singh", run1: "6", ball1: "(8)", four1: "1", six1: "0", st: "1",
  player_full_name2: "Michael Levitt", run2: "9", ball2: "(11)", four2: "1", six2: "0",
  bowler_full_name: "Bilal Khan", bwr: "0-11", bover: "2.0", partnerruns: 19, partnerballs: 19, crr: "6.00",
} });
const SCORECARD = crexHtml({
  "https://api.goscorer.com/api/v3/getSC4": [{ c: "N", d: "19/0(19", e: "4.0.0.0.0", b: ["VS.6.8.1.0", "ML.9.11.1.0"], a: ["BK.11.12.0.0"] }],
  "https://oc.crickapi.com/mapping/getHomeMapData": { p: [{ f_key: "VS", n: "Vikramjit Singh" }, { f_key: "ML", n: "Michael Levitt" }, { f_key: "BK", n: "Bilal Khan" }], t: [{ f_key: "N", n: "Netherlands" }, { f_key: "O", n: "Oman" }] },
});
const BOOKS = { fancy: [{ match: "Netherlands vs Oman", start_utc: "2026-10-27T09:00:00Z" }] };

function callLive(method = "GET") {
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(o) { resolve({ code: this.code, headers: this.headers, body: o }); } };
    liveHandler({ method, headers: {}, socket: {} }, res);
  });
}

test("GET /api/live builds priced matches from the CREX pages only, then reuses the snapshot", async () => {
  globalThis.fetch = async (url) => {
    seen.push({ url: String(url), init: {} });
    const u = String(url), html = (t) => ({ ok: true, status: 200, text: async () => t });
    if (u.includes("book_lines.json")) return { ok: true, status: 200, json: async () => BOOKS };
    if (u === "https://crex.com/schedule") return html(SCHEDULE);
    if (u.endsWith("ned-vs-oma-14VC/match-scorecard")) return html(SCORECARD);
    if (u.endsWith("ned-vs-oma-14VC")) return html(MATCH_PAGE);
    return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
  };
  const r = await callLive();
  assert.equal(r.code, 200);
  assert.equal(r.body.source, "live");
  assert.ok(!JSON.stringify(r.body).toLowerCase().includes("crex"), "the public body names no source and carries no source URL");
  assert.ok(!("url" in r.body.matches[0]));
  assert.equal(r.body.matches.length, 1, "the unpriced under-19 game is dropped");
  const [m] = r.body.matches;
  assert.equal(m.teams[0].name, "Netherlands");
  assert.equal(m.teams[0].display, "19/0 (3.1 ov)", "the match page is fresher than the schedule's 10/0");
  assert.equal(m.summary, "OMA opt to Bowl");
  assert.equal(m.fmt, "ODI");
  assert.equal(m.players.find((p) => p.name === "Vikramjit Singh").runs, 6);
  assert.equal(m.players.find((p) => p.name === "Vikramjit Singh").strike, true);
  assert.equal(m.card.length, 1);
  assert.deepEqual(m.partnership, { runs: 19, balls: 19 });
  assert.ok(seen.some((s) => s.url.endsWith("ned-vs-oma-14VC")) && seen.some((s) => s.url.endsWith("/match-scorecard")));
  assert.ok(!seen.some((s) => s.url.includes("oma-u19") || s.url.includes("espn")), "no ESPN, and no pages for unpriced games");
  assert.match(r.headers["Cache-Control"], /s-maxage=15/);
  const n = seen.length;
  await callLive();
  assert.equal(seen.length, n);
  assert.equal((await callLive("POST")).code, 405);
});
