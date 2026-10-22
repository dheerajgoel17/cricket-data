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

test("without a key the endpoint says so (the site then uses its built-in parser)", async () => {
  const k = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  assert.equal((await call({ question: "q" }, { ip: "9.9.9.7" })).code, 503);
  process.env.GEMINI_API_KEY = k;
});
