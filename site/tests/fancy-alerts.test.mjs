import test from "node:test";
import assert from "node:assert/strict";
import { FANCY_ALERTS_URL, FANCY_MAX_AGE_MS, MAX_FANCY, fancyAlerts, messages } from "@cricket/engine/alerts.js";
import { postAlerts } from "@cricket/engine/alert-post.js";
import worker from "../../state/worker.js";

const NOW = Date.parse("2026-11-01T10:30:00Z"), GEN = "2026-11-01T10:00:00Z";
const alert = (o = {}) => ({
  alert_id: "2026-11-02-alpha-v-beta|team_total_runs|Alpha|0|under", fixture_id: "2026-11-02-alpha-v-beta", match: "Alpha vs Beta", format: "T20", series: "Series",
  start_utc: "2026-11-02T09:30:00Z", start_ist: "2026-11-02 15:00 IST", key: "team_total_runs", team: "Alpha", inn: 0, side: "under", line: 160.5, best_odds: 1.9, best_source: "bet365",
  hits: 16, played: 20, window: 20, chance: 0.7041, edge: 0.3381, edge_pct: 33.8, bat_first: false, ...o,
});
const fdoc = (alerts = [alert()], generated_at_utc = GEN) => ({ generated_at_utc, alerts });

test("fancyAlerts: edge, market, line, listed price, record and sample size in stats wording, with no stake", () => {
  const [a] = fancyAlerts(fdoc(), NOW);
  assert.equal(a.kind, "fancy");
  assert.equal(a.key, "fancy|2026-11-02-alpha-v-beta|team_total_runs|Alpha|0|under");
  assert.equal(a.text, [
    "📊 <b>History edge +33.8%</b>",
    "Alpha total runs: under 160.5",
    "Alpha v Beta · T20 · 2026-11-02 15:00 IST",
    "Listed 1.90 (bet365) · under in 16 of 20 recent matches · history chance 70%",
  ].join("\n"));
  assert.doesNotMatch(a.text, /\b(stake|tip|bet|kelly)\b/i);
  const one = (o) => fancyAlerts(fdoc([alert(o)]), NOW)[0]?.text;
  assert.match(one({ bat_first: true }), /16 of 20 recent matches batting first/);
  assert.match(one({ key: "match_sixes", team: null, side: "over", line: 12.5 }), /\nMatch sixes: over 12\.5\n/);
  assert.match(one({ key: "team_total_runs", team: "Beta", inn: 2 }), /\nBeta total runs \(2nd innings\): under/);
  assert.match(one({ key: "overs_6", team: "Alpha" }), /\nAlpha first 6 overs runs: under/);
  assert.match(one({ team: "A <b> & B" }), /A &lt;b&gt; &amp; B total runs/); // names are escaped for Telegram's HTML
});

test("fancyAlerts: the biggest edge first; a started match, a bad price, side or id, and a stale or missing file give nothing", () => {
  const out = fancyAlerts(fdoc([alert({ alert_id: "a", edge: 0.2 }), alert({ alert_id: "b", edge: 0.4 }), alert({ alert_id: "c", edge: 0.3 })]), NOW);
  assert.deepEqual(out.map((x) => x.key), ["fancy|b", "fancy|c", "fancy|a"]);
  for (const bad of [{ start_utc: "2026-11-01T10:00:00Z" }, { best_odds: 1 }, { side: "yes" }, { alert_id: "" }, { line: null }, { edge: 0 }]) assert.deepEqual(fancyAlerts(fdoc([alert(bad)]), NOW), [], JSON.stringify(bad));
  assert.equal(fancyAlerts(fdoc(), Date.parse(GEN) + FANCY_MAX_AGE_MS - 1).length, 1);
  assert.deepEqual(fancyAlerts(fdoc(), Date.parse(GEN) + FANCY_MAX_AGE_MS + 1), []); // the hourly step has stopped: its prices are not posted
  assert.deepEqual(fancyAlerts(fdoc([alert()], null), NOW), []);
  assert.deepEqual(fancyAlerts({}, NOW), []);
  assert.deepEqual(fancyAlerts(undefined, NOW), []);
});

test("messages: one message per fancy edge, the footer says it is a past-data hit rate, and the site link follows", () => {
  const [m] = messages(fancyAlerts(fdoc(), NOW), { siteUrl: "https://site.test" });
  assert.deepEqual(m.keys, ["fancy|2026-11-02-alpha-v-beta|team_total_runs|Alpha|0|under"]);
  assert.equal(m.image, "");
  assert.match(m.text, /\n\nHit rate over recent matches, pulled toward the market price\. Past data, not advice\.\n<a href="https:\/\/site\.test">Open the site<\/a>$/);
});

// ---------------------------------------------------------------------------------------------- the run, with a fake claim table and a fake Telegram
const TOKEN = "123456:SECRET-bot-token", DB = { base: "https://db.test", key: "pub", token: "write-tok" };
function world() {
  const sent = new Set(), posts = [], w = { sent, posts };
  w.fetchImpl = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    if (url.startsWith("https://api.telegram.org/")) { posts.push(body); return { ok: true, status: 200, json: async () => ({}) }; }
    if (url.endsWith("/claim_alerts")) { const fresh = [...new Set(body.keys)].filter((k) => !sent.has(k)); if (!body.dry) fresh.forEach((k) => sent.add(k)); return { ok: true, status: 200, json: async () => fresh }; }
    if (url.endsWith("/release_alerts")) { body.keys.forEach((k) => sent.delete(k)); return { ok: true, status: 200, json: async () => ({}) }; }
    throw new Error(`unexpected ${url}`);
  };
  return w;
}
const run = (w, fancyDoc, o = {}) => postAlerts({ matches: [], booksDoc: {}, propsDoc: {}, fancyDoc, telegram: { token: TOKEN, chat: "@chan" }, db: DB, now: NOW, fetchImpl: w.fetchImpl, ...o });

test("a fancy edge is posted once: the next run with the same file posts nothing, and a new id is new", async () => {
  const w = world();
  assert.deepEqual(await run(w, fdoc()), { candidates: 1, fresh: 1, sent: 1 });
  assert.equal(w.posts.length, 1);
  assert.equal(w.posts[0].chat_id, "@chan");
  assert.match(w.posts[0].text, /History edge \+33\.8%/);
  assert.deepEqual(await run(w, fdoc([alert({ line: 165.5, best_odds: 1.85 })], "2026-11-01T10:20:00Z")), { candidates: 1, fresh: 0, sent: 0 }); // the line moved: same id, same alert
  assert.equal(w.posts.length, 1);
  assert.equal((await run(w, fdoc([alert({ alert_id: "other|market" })]))).sent, 1);
  assert.equal(w.posts.length, 2);
});

test("a long list drips out at four messages a run, the biggest edge first, and nothing is left unposted or posted twice", async () => {
  const w = world(), many = fdoc([1, 2, 3, 4, 5].map((n) => alert({ alert_id: `m${n}`, edge: n / 10, edge_pct: n * 10 })));
  assert.deepEqual(await run(w, many), { candidates: 5, fresh: 5, sent: 4 });
  assert.deepEqual(w.posts.map((p) => /\+(\d+)\.0%/.exec(p.text)[1]), ["50", "40", "30", "20"]);
  assert.equal(w.sent.size, 4); // the fifth was handed back
  assert.deepEqual(await run(w, many), { candidates: 5, fresh: 1, sent: 1 });
  assert.match(w.posts[4].text, /\+10\.0%/);
  assert.deepEqual(await run(w, many), { candidates: 5, fresh: 0, sent: 0 });
  assert.equal(w.posts.length, 5);
  assert.ok(MAX_FANCY >= 5 * 3); // the candidate cap is only a safety net
});

test("a missing or stale fancy file adds no candidates and does not stop the other kinds", async () => {
  const w = world();
  assert.deepEqual(await run(w, undefined), { candidates: 0, fresh: 0, sent: 0 });
  assert.deepEqual(await run(w, fdoc([alert()], "2026-10-30T00:00:00Z")), { candidates: 0, fresh: 0, sent: 0 });
  assert.equal(w.posts.length, 0);
});

// ---------------------------------------------------------------------------------------------- the Worker reads the file next to the pipeline's
function withFakeNetwork(fn, fancy) {
  const real = globalThis.fetch, urls = [];
  globalThis.fetch = async (url, init) => {
    url = String(url); urls.push(url);
    if (url === FANCY_ALERTS_URL) return fancy === "down" ? new Response("no", { status: 404 }) : Response.json(fancy);
    if (url.includes("new_alerts.json")) return Response.json({ alerts: [] });
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
const call = () => worker.fetch(new Request("https://worker.test/", { headers: { "x-state-key": "tok" } }), env).then((r) => r.json());

test("the Worker's preview includes the fancy edge from the file, and a file that cannot be read is just no edges", () => {
  const future = alert({ start_utc: new Date(Date.now() + 36e5).toISOString() });
  return withFakeNetwork(async (urls) => {
    const body = await call();
    assert.equal(body.ok, true);
    assert.deepEqual([body.alerts.candidates, body.alerts.fresh, body.alerts.sent], [1, 1, 0]);
    assert.match(body.alerts.messages[0].text, /History edge \+33\.8%/);
    assert.ok(urls.includes(FANCY_ALERTS_URL));
  }, fdoc([future], new Date().toISOString()))
    .then(() => withFakeNetwork(async () => {
      const body = await call();
      assert.equal(body.ok, true);
      assert.equal(body.alerts.candidates, 0);
    }, "down"));
});
