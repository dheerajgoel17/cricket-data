import test from "node:test";
import assert from "node:assert/strict";
import { readFeed, syncState } from "../scripts/state-sync.mjs";

const feed = (o = {}) => ({ teams: [{ name: "India" }, { name: "Australia" }], start: "2026-10-31T09:00:00Z", fmt: "T20", status: "live", ...o });

function fakeDb(open = []) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: url.replace(/^https?:\/\/[^/]+/, ""), method: init.method, body: init.body ? JSON.parse(init.body) : null, headers: init.headers });
    if (init.method === "GET") return { ok: true, status: 200, json: async () => open };
    return { ok: true, status: 201, json: async () => null };
  };
  return { fetchImpl, calls };
}

test("upserts one row per feed match and uses the service key", async () => {
  const db = fakeDb();
  const out = await syncState({ matches: [feed(), feed({ teams: [{ name: "England" }] })], base: "https://x.test", key: "sb_secret_abc", now: Date.parse("2026-10-31T10:00:00Z"), fetchImpl: db.fetchImpl });
  assert.deepEqual(out, { listed: 1, settled: 0 }); // the second has no two sides
  const post = db.calls.find((c) => c.method === "POST");
  assert.match(post.url, /^\/rest\/v1\/match_state\?on_conflict=match_key/);
  assert.equal(post.body[0].phase, "live");
  assert.equal(post.headers.apikey, "sb_secret_abc");
  assert.equal(post.headers.Authorization, undefined); // a new-style secret key goes only in apikey
});

test("a row the feed no longer lists is settled by the clock, and a listed one is left to the feed", async () => {
  const now = Date.parse("2026-11-02T10:00:00Z");
  const open = [
    { match_key: "old", phase: "live", start_utc: "2026-10-31T09:00:00Z", fmt: "T20" }, // 49 h ago: over
    { match_key: "recent", phase: "live", start_utc: "2026-11-02T06:00:00Z", fmt: "T20" }, // 4 h ago: still in play
  ];
  const db = fakeDb(open);
  const out = await syncState({ matches: [], base: "https://x.test", key: "legacy.jwt.key", now, fetchImpl: db.fetchImpl });
  assert.deepEqual(out, { listed: 0, settled: 1 });
  const patch = db.calls.find((c) => c.method === "PATCH");
  assert.match(patch.url, /match_key=eq\.old/);
  assert.equal(patch.body.phase, "final");
  assert.equal(patch.headers.Authorization, "Bearer legacy.jwt.key");
});

test("a failed write is an error, not a silent skip", async () => {
  await assert.rejects(syncState({ matches: [feed()], base: "https://x.test", key: "k", fetchImpl: async () => ({ ok: false, status: 401 }) }), /HTTP 401/);
});

test("readFeed returns the matches of a 200 response and refuses anything else", async () => {
  assert.equal((await readFeed(async (_q, res) => res.status(200).json({ matches: [feed()] }))).length, 1);
  await assert.rejects(readFeed(async (_q, res) => res.status(502).json({ matches: [] })), /unavailable/);
});
