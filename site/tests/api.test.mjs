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
const HEADER = {
  sports: [{ leagues: [{ id: "19439", events: [{
    id: "1", date: "2026-10-27T09:00:00Z", eventType: "ODI", class: { eventType: "ODI", generalClassCard: "ODI" },
    status: "in", fullStatus: { summary: "NED 10/0", battingTeamId: 7, type: { state: "in" } },
    competitors: [
      { id: 7, displayName: "Netherlands", abbreviation: "NED", score: "10/0 (2.0 ov)" },
      { id: 8, displayName: "Oman", abbreviation: "OMA", score: "" },
    ],
  }, {
    id: "2", date: "2026-10-27T05:30:00Z", eventType: "ODI", class: { eventType: "ODI", generalClassCard: "ODI" },
    status: "in", fullStatus: { summary: "Starts at 09:30 local time", type: { state: "in" } },
    competitors: [
      { id: 9, displayName: "Oman Under-19s", abbreviation: "Omn19", score: "" },
      { id: 10, displayName: "Afghanistan Under-19s", abbreviation: "AFG19", score: "" },
    ],
  }] }] }],
};
const BOOKS = { fancy: [{ match: "Netherlands vs Oman", start_utc: "2026-10-27T09:00:00Z" }] };
const SUMMARY = { matchcards: [{ headline: "Batting", typeID: "11", inningsNumber: 1, teamName: "Netherlands", runs: "10", total: "(0 wkts; 2 ovs)",
  playerDetails: [{ playerID: "1", playerName: "Vikramjit Singh", dismissal: "not out", runs: "6", ballsFaced: "8", fours: "1", sixes: "0" }] }] };

function callLive(method = "GET") {
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(o) { resolve({ code: this.code, headers: this.headers, body: o }); } };
    liveHandler({ method, headers: {}, socket: {} }, res);
  });
}

test("GET /api/live returns compact scores and player so-far, then reuses the snapshot", async () => {
  globalThis.fetch = async (url) => {
    seen.push({ url: String(url), init: {} });
    const u = String(url);
    if (u.includes("scoreboard/header")) return { ok: true, status: 200, json: async () => HEADER };
    if (u.includes("book_lines.json")) return { ok: true, status: 200, json: async () => BOOKS };
    if (u.includes("/summary?")) return { ok: true, status: 200, json: async () => SUMMARY };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const r = await callLive();
  assert.equal(r.code, 200);
  assert.equal(r.body.source, "espn");
  assert.equal(r.body.matches.length, 1);
  assert.equal(r.body.matches[0].teams[0].name, "Netherlands");
  assert.equal(r.body.matches[0].teams[0].runs, 10);
  assert.equal(r.body.matches[0].players[0].runs, 6);
  assert.ok(seen.some((s) => s.url.includes("event=1")));
  assert.ok(!seen.some((s) => s.url.includes("event=2")));
  assert.match(r.headers["Cache-Control"], /s-maxage=15/);
  assert.ok(seen.some((s) => s.url.includes("scoreboard/header")));
  const n = seen.length;
  await callLive();
  assert.equal(seen.length, n);
  assert.equal((await callLive("POST")).code, 405);
});
