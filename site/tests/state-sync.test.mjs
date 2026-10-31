import test from "node:test";
import assert from "node:assert/strict";
import { readFeed, syncState } from "../scripts/state-sync.mjs";

const feed = (o = {}) => ({ teams: [{ name: "India" }, { name: "Australia" }], start: "2026-10-31T09:00:00Z", fmt: "T20", status: "live", ...o });

function fakeDb(open = [], { rpcStatus = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: url.replace(/^https?:\/\/[^/]+/, ""), method: init.method, body: init.body ? JSON.parse(init.body) : null, headers: init.headers });
    if (init.method === "GET") return { ok: true, status: 200, json: async () => open };
    return { ok: rpcStatus === 200, status: rpcStatus, json: async () => ({ upserted: 1, phased: 0 }) };
  };
  return { fetchImpl, calls };
}

test("writes the feed's rows in one database call with the public key and the write token", async () => {
  const db = fakeDb();
  const out = await syncState({ matches: [feed(), feed({ teams: [{ name: "England" }] })], base: "https://x.test", key: "public-key", token: "tok", now: Date.parse("2026-10-31T10:00:00Z"), fetchImpl: db.fetchImpl });
  assert.deepEqual(out, { listed: 1, settled: 0, written: 1 }); // the second has no two sides
  const rpc = db.calls.find((c) => c.method === "POST");
  assert.equal(rpc.url, "/rest/v1/rpc/apply_match_state");
  assert.equal(rpc.body.token, "tok");
  assert.equal(rpc.body.upserts[0].phase, "live");
  assert.equal(rpc.headers.apikey, "public-key");
  assert.equal(db.calls.filter((c) => c.method !== "GET").length, 1);
});

test("a row the feed no longer lists is settled by the clock in the same call, and a listed one is left to the feed", async () => {
  const now = Date.parse("2026-11-02T10:00:00Z");
  const open = [
    { match_key: "old", phase: "live", start_utc: "2026-10-31T09:00:00Z", fmt: "T20" }, // 49 h ago: over
    { match_key: "recent", phase: "live", start_utc: "2026-11-02T06:00:00Z", fmt: "T20" }, // 4 h ago: still in play
  ];
  const db = fakeDb(open);
  const out = await syncState({ matches: [], base: "https://x.test", key: "k", token: "t", now, fetchImpl: db.fetchImpl });
  assert.equal(out.settled, 1);
  assert.deepEqual(db.calls.find((c) => c.method === "POST").body.phases, [{ match_key: "old", phase: "final" }]);
});

test("a refused write (wrong token, database down) is an error, not a silent skip", async () => {
  await assert.rejects(syncState({ matches: [feed()], base: "https://x.test", key: "k", token: "bad", fetchImpl: fakeDb([], { rpcStatus: 401 }).fetchImpl }), /HTTP 401/);
});

test("readFeed returns the matches of a 200 response and refuses anything else", async () => {
  assert.equal((await readFeed(async (_q, res) => res.status(200).json({ matches: [feed()] }))).length, 1);
  await assert.rejects(readFeed(async (_q, res) => res.status(502).json({ matches: [] })), /unavailable/);
});
