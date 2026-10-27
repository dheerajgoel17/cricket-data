import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

process.env.LIVE_SOURCE_BASE = "https://src.test";
const { default: liveHandler } = await import("../api/live.js");
const pageHtml = (payload) => `<script id="app-root-state">${JSON.stringify(payload).replace(/"/g, "&q;")}</script>`;
const nedOma = { team1: "Netherlands", team2: "Oman", t1SName: "NED", t2SName: "OMA", t1f: "N", t2f: "O", bf: "N", s1: "10-0", o1: "2.0", s2: "", o2: "", t: Date.parse("2026-10-27T09:00:00Z"), status: 1, statusText: "Live", fo: "ODI", mf: "14VC", link: "/cricket-live-score/ned-vs-oma-14VC" };
const u19 = { team1: "Oman U19", team2: "Afghanistan U19", s2: "421-5", o2: "50.0", t: Date.parse("2026-10-27T05:30:00Z"), status: 1, fo: "Youth ODI", mf: "14UU", link: "/cricket-live-score/oma-u19-vs-afg-u19-14UU" };
const SCHEDULE = pageHtml({ "https://src.test/fixture/getFixture": [nedOma, u19] });
const MATCH_PAGE = pageHtml({ "https://src.test/v3/getSV3": {
  team1_f_n: "Netherlands", team2_f_n: "Oman", team1short: "NED", team2short: "OMA", rt: "Netherlands", inning: 1, status: 1,
  score1: "19-0", over1: "3.1", score2: "", over2: "", comment1: "OMA opt to <b>Bowl</b>",
  player_full_name1: "Vikramjit Singh", run1: "6", ball1: "(8)", four1: "1", six1: "0", os1: 1, os2: 0,
  player_full_name2: "Michael Levitt", run2: "9", ball2: "(11)", four2: "1", six2: "0",
  bowler_full_name: "Bilal Khan", bwr: "0-11", bover: "2.0", partnerruns: 19, partnerballs: 19, crr: "6.00",
} });
const SCORECARD = pageHtml({
  "https://src.test/v3/getSC4": [{ c: "N", d: "19/0(19", e: "4.0.0.0.0", b: ["VS.6.8.1.0", "ML.9.11.1.0"], a: ["BK.11.12.0.0"] }],
  "https://src.test/mapping/getHomeMapData": { p: [{ f_key: "VS", n: "Vikramjit Singh" }, { f_key: "ML", n: "Michael Levitt" }, { f_key: "BK", n: "Bilal Khan" }], t: [{ f_key: "N", n: "Netherlands" }, { f_key: "O", n: "Oman" }] },
});
const BOOKS = { fancy: [{ match: "Netherlands vs Oman", start_utc: "2026-10-27T09:00:00Z" }] };

function callLive(method = "GET") {
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(o) { resolve({ code: this.code, headers: this.headers, body: o }); } };
    liveHandler({ method, headers: {}, socket: {} }, res);
  });
}

test("GET /api/live builds priced matches from the one source's pages, then reuses the snapshot", async () => {
  globalThis.fetch = async (url) => {
    seen.push({ url: String(url), init: {} });
    const u = String(url), html = (t) => ({ ok: true, status: 200, text: async () => t });
    if (u.includes("book_lines.json")) return { ok: true, status: 200, json: async () => BOOKS };
    if (u.includes("upcoming.csv")) return html("start_utc,match_id,series,format,gender,team_a,team_b,venue,status,url,result\n");
    if (u === "https://src.test/schedule") return html(SCHEDULE);
    if (u.endsWith("ned-vs-oma-14VC/match-scorecard")) return html(SCORECARD);
    if (u.endsWith("ned-vs-oma-14VC")) return html(MATCH_PAGE);
    return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
  };
  const r = await callLive();
  assert.equal(r.code, 200);
  assert.equal(r.body.source, "live");
  assert.ok(!JSON.stringify(r.body).includes("src.test"), "the public body carries no source URL");
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
  assert.ok(seen.every((s) => s.url.includes("src.test") || s.url.includes("book_lines.json") || s.url.includes("upcoming.csv")), "only the one source and our own book and schedule files");
  assert.ok(!seen.some((s) => s.url.includes("oma-u19")), "no pages for unpriced games");
  assert.match(r.headers["Cache-Control"], /s-maxage=15/);
  const n = seen.length;
  await callLive();
  assert.equal(seen.length, n);
  assert.equal((await callLive("POST")).code, 405);
});

test("GET /api/live reads a finished match from its own page when the schedule page has dropped it, and keeps it for ten minutes", async () => {
  const { default: fresh } = await import("../api/live.js?dropped"); // its own cache
  const start = new Date(Date.now() - 6 * 3600e3), iso = start.toISOString().slice(0, 16) + "Z";
  const books = { events: [{ match: "Pakistan vs Sri Lanka", start_utc: start.toISOString() }, { match: "Namibia vs Ireland", start_utc: start.toISOString() }] };
  const csv = ["start_utc,match_id,series,format,gender,team_a,team_b,venue,status,url,result",
    `${iso},pak-vs-sl-5th-odi,Tri Series,ODI,male,Pakistan,Sri Lanka,"Gaddafi Stadium, Lahore",Live,/cricket-live-score/pak-vs-sl-5th-odi,`,
    `${iso},nam-vs-ire-3rd-odi,League 2,ODI,male,Namibia,Ireland,Windhoek,Live,/cricket-live-score/nam-vs-ire-3rd-odi,`].join("\n");
  const page = pageHtml({ "https://src.test/v3/getSV3": { team1_f_n: "Sri Lanka", team2_f_n: "Pakistan", team1short: "SL", team2short: "PAK", inning: 2, status: 2, score1: "114-2", over1: "(18.1)",
    score2: "110-10", over2: "(25.3)", B: "Sri Lanka won by 8 wickets" } });
  const hits = [];
  globalThis.fetch = async (url) => {
    const u = String(url), html = (t) => ({ ok: true, status: 200, text: async () => t });
    hits.push(u);
    if (u.includes("book_lines.json")) return { ok: true, status: 200, json: async () => books };
    if (u.includes("upcoming.csv")) return html(csv);
    if (u === "https://src.test/schedule") return html(pageHtml({ "https://src.test/fixture/getFixture": [] }));
    if (u.endsWith("pak-vs-sl-5th-odi")) return html(page);
    return { ok: false, status: 404, json: async () => ({}), text: async () => "" }; // Namibia v Ireland's page is not served
  };
  const call = () => new Promise((resolve) => { const res = { setHeader() {}, status(c) { this.code = c; return this; }, json(o) { resolve({ code: this.code, body: o }); } }; fresh({ method: "GET" }, res); });
  const r = await call();
  assert.equal(r.code, 200);
  assert.equal(r.body.matches.length, 1, "Namibia v Ireland's page could not be read, so it is not shown as a match in play");
  const [m] = r.body.matches;
  assert.deepEqual([m.status, m.summary, m.teams[0].name, m.teams[1].display], ["final", "Sri Lanka won by 8 wickets", "Pakistan", "114/2 (18.1 ov)"]);
  assert.ok(!JSON.stringify(r.body).includes("src.test"), "no source URL in the public body");
  assert.ok(hits.some((u) => u.endsWith("pak-vs-sl-5th-odi/match-scorecard")), "the scorecard page is read too");
});

test("GET /api/live settles each match's priced lines with the identity table, and a finished match's numbers are final", async () => {
  const { default: fresh } = await import("../api/live.js?settled"); // its own cache and identity
  const dir = await mkdtemp(join(tmpdir(), "live-identity-")), here = process.cwd();
  await mkdir(join(dir, "public", "data"), { recursive: true });
  await writeFile(join(dir, "public", "data", "identity.json"), JSON.stringify({ v: 1, s: { aa11: "SOO", bb22: "ZED" }, b: {} }));
  process.chdir(dir); // the table is read from public/data/identity.json, where the deployment ships it
  const start = new Date(Date.now() - 6 * 3600e3), iso = start.toISOString().slice(0, 16) + "Z";
  const priced = (pid, player, team, stat, line) => ({ pid, player, team, fmt: "ODI", stat, line, match: "Pakistan vs Sri Lanka", start_utc: start.toISOString(), books: [{ source: "bet365", kind: "bookmaker", over: 1.9, under: 1.9 }] });
  const books = { lines: [priced("aa11", "V Suryavanshi", "Sri Lanka", "runs", 49.5), priced("aa11", "V Suryavanshi", "Sri Lanka", "sixes", 2), priced("cc33", "Not Playing", "Pakistan", "runs", 9.5)] };
  const csv = ["start_utc,match_id,series,format,gender,team_a,team_b,venue,status,url,result", `${iso},pak-vs-sl-5th-odi,Tri Series,ODI,male,Pakistan,Sri Lanka,Lahore,Completed,/cricket-live-score/pak-vs-sl-5th-odi,`].join("\n");
  // the source calls him Vaibhav Sooryavanshi (id SOO); our data and the books call him V Suryavanshi, which no name rule joins
  const live = pageHtml({ "https://src.test/v3/getSV3": { team1_f_n: "Sri Lanka", team2_f_n: "Pakistan", inning: 2, status: 2, score1: "114-2", over1: "(18.1)", score2: "110-10", over2: "(25.3)", B: "Sri Lanka won by 8 wickets",
    player_full_name1: "Vaibhav Sooryavanshi", run1: "62", ball1: "(60)", four1: "6", six1: "2", os1: 1 } });
  const card = pageHtml({ "https://src.test/v3/getSC4": [{ c: "SL", d: "114/2(109", e: "0.0.0.0.0", b: ["SOO.62.60.6.2"], a: [] }],
    "https://src.test/mapping/getHomeMapData": { p: [{ f_key: "SOO", n: "Vaibhav Sooryavanshi" }], t: [{ f_key: "SL", n: "Sri Lanka" }, { f_key: "PK", n: "Pakistan" }] } });
  globalThis.fetch = async (url) => {
    const u = String(url), html = (t) => ({ ok: true, status: 200, text: async () => t });
    if (u.includes("book_lines.json")) return { ok: true, status: 200, json: async () => books };
    if (u.includes("upcoming.csv")) return html(csv);
    if (u === "https://src.test/schedule") return html(pageHtml({ "https://src.test/fixture/getFixture": [] }));
    if (u.endsWith("pak-vs-sl-5th-odi/match-scorecard")) return html(card);
    if (u.endsWith("pak-vs-sl-5th-odi")) return html(live);
    return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
  };
  try {
    const r = await new Promise((resolve) => { const res = { setHeader() {}, status(c) { this.code = c; return this; }, json(o) { resolve({ code: this.code, body: o }); } }; fresh({ method: "GET" }, res); });
    assert.equal(r.code, 200);
    assert.equal(r.body.linked, 2, "the table was read");
    const [m] = r.body.matches;
    assert.equal(m.status, "final");
    assert.deepEqual(m.lines.map(({ pid, stat, line, value, state, verdict }) => [pid, stat, line, value, state, verdict]), [
      ["aa11", "runs", 49.5, 62, "final", "cleared"], // 62 off 60 against a line of 49.5
      ["aa11", "sixes", 2, 2, "final", "push"], // 2 sixes against a line of exactly 2
    ], "found by id; the player with no row on the card has no entry");
    assert.ok(!JSON.stringify(r.body).includes("src.test"));
  } finally { process.chdir(here); await rm(dir, { recursive: true, force: true }); }
});
