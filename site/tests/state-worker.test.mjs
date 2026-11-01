import test from "node:test";
import assert from "node:assert/strict";
import worker from "../../state/worker.js";

const req = (key) => new Request("https://worker.test/", { headers: key ? { "x-state-key": key } : {} });

test("the Worker's manual trigger answers 404 without the write token and never runs", async () => {
  assert.equal((await worker.fetch(req(), { STATE_WRITE_TOKEN: "tok" })).status, 404);
  assert.equal((await worker.fetch(req("wrong"), { STATE_WRITE_TOKEN: "tok" })).status, 404);
  assert.equal((await worker.fetch(req("tok"), {})).status, 404); // no token configured: nothing can match
});

test("with the token it runs one sync and reports a missing setting as a 500 with the name, not a crash", async () => {
  const res = await worker.fetch(req("tok"), { STATE_WRITE_TOKEN: "tok" });
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /LIVE_SOURCE_BASE is not set/);
});

// A stand-in for every address the Worker calls: the source's pages are empty, the alert file has one pre-match alert, the claim table says everything is new, Telegram must not be reached.
function withFakeNetwork(fn) {
  const real = globalThis.fetch, urls = [];
  globalThis.fetch = async (url, init) => {
    url = String(url); urls.push(url);
    if (url.includes("new_alerts.json")) return Response.json({ alerts: [{ alert_id: "x1", selection: "A B under 1.5", market: "A B - Over/Under 1.5 Fours", match: "C vs D", format: "T20", start_utc: new Date(Date.now() + 36e5).toISOString(), start_ist: "soon", best_odds: 1.9, fair_odds: 1.8, edge_pct: 6, why: "w" }] });
    if (url.includes("book_lines.json")) return Response.json({ lines: [], fancy: [] });
    if (url.includes("/rpc/claim_alerts")) return Response.json(JSON.parse(init.body).keys);
    if (url.includes("/rest/v1/match_state")) return Response.json([]);
    if (url.includes("/rpc/apply_match_state")) return Response.json({ upserted: 0 });
    if (url.includes("api.telegram.org")) throw new Error("the preview must not post");
    return new Response("", { status: 200 });
  };
  return fn(urls).finally(() => { globalThis.fetch = real; });
}
const env = { STATE_WRITE_TOKEN: "tok", LIVE_SOURCE_BASE: "https://src.test", SUPABASE_URL: "https://db.test", SUPABASE_ANON_KEY: "k" };

test("the manual trigger previews the channel alerts by default: the messages are in the answer, nothing is sent", () => withFakeNetwork(async (urls) => {
  const body = await (await worker.fetch(req("tok"), env)).json();
  assert.equal(body.ok, true);
  assert.equal(body.written, 0); // the state table was written as before
  assert.deepEqual([body.alerts.candidates, body.alerts.fresh, body.alerts.sent], [1, 1, 0]);
  assert.match(body.alerts.messages[0].text, /Model edge \+6\.0%/);
  assert.ok(!urls.some((u) => u.includes("api.telegram.org")));
}));

test("?alerts=post without a bot and a channel posts nothing and says the alerts are off; ?alerts=off skips the alert file too", () => withFakeNetwork(async (urls) => {
  const post = await (await worker.fetch(new Request("https://worker.test/?alerts=post", { headers: { "x-state-key": "tok" } }), env)).json();
  assert.deepEqual(post.alerts, { off: true });
  const off = await (await worker.fetch(new Request("https://worker.test/?alerts=off", { headers: { "x-state-key": "tok" } }), { ...env, TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "@c" })).json();
  assert.deepEqual(off.alerts, { off: true });
  assert.ok(!urls.some((u) => u.includes("new_alerts.json") || u.includes("api.telegram.org")));
}));

test("an alert problem never stops the state table: a refused claim shows up under alerts and the sync still reports", () => withFakeNetwork(async () => {
  const fake = globalThis.fetch;
  globalThis.fetch = async (url, init) => (String(url).includes("/rpc/claim_alerts") ? new Response("no", { status: 404 }) : fake(url, init));
  const body = await (await worker.fetch(req("tok"), env)).json();
  assert.equal(body.ok, true);
  assert.equal(body.written, 0);
  assert.match(body.alerts.error, /claim failed/);
}));
