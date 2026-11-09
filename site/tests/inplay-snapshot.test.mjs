import test from "node:test";
import assert from "node:assert/strict";
import { GAP_MS, ROUNDS, describeKey, loadExtra, readFeed, readRound, run, saveBody } from "../scripts/inplay-snapshot.mjs";

const q = (group_name, label, handicap, odds_dec) => ({ group_name, label, line: handicap, side: label, handicap, odds_dec });
const DOC = { matches: [
  { home: "Bangladesh", away: "West Indies", in_play: true, quotes: [q("M Rahim Innings Runs", "Over", "33.5", 1.8), q("M Rahim Innings Runs", "Under", "33.5", 1.9)] },
  { home: "India", away: "Australia", in_play: false, quotes: [q("A Innings Runs", "Over", "10.5", 2)] },
] };
const json = (body, status = 200) => async () => new Response(JSON.stringify(body), { status });

test("the feed read keeps only the matches that have started, with the lines we read", async () => {
  const ms = await readFeed("http://feed.invalid/", json(DOC));
  assert.equal(ms.length, 1);
  assert.deepEqual([ms[0].home, ms[0].lines[0].player, ms[0].lines[0].line, ms[0].lines[0].over, ms[0].lines[0].under], ["Bangladesh", "M Rahim", 33.5, 1.8, 1.9]);
  assert.deepEqual(await readFeed("http://feed.invalid/", json([DOC])), ms); // the feed may wrap its body in a list
  await assert.rejects(readFeed("http://feed.invalid/", json({}, 503)), /feed HTTP 503/);
});

test("the row is replaced through the REST upsert with the service key, and a refusal throws", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return new Response(null, { status: 201 }); };
  const body = { asOf: "2026-11-09T07:00:00.000Z", source: "inplay", matches: [] };
  await saveBody({ base: "https://db.invalid", key: "svc", body, fetchImpl });
  assert.equal(calls[0].url, "https://db.invalid/rest/v1/inplay_lines?on_conflict=id");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.apikey, "svc");
  assert.equal(calls[0].init.headers.Authorization, "Bearer svc");
  assert.equal(calls[0].init.headers.Prefer, "resolution=merge-duplicates,return=minimal");
  assert.ok(!/mozilla/i.test(calls[0].init.headers["User-Agent"])); // a secret key from a browser-looking agent is refused by Supabase
  assert.deepEqual(JSON.parse(calls[0].init.body), [{ id: 1, as_of: "2026-11-09T07:00:00.000Z", body }]);
  await assert.rejects(saveBody({ base: "https://db.invalid", key: "svc", body, fetchImpl: async () => new Response(null, { status: 401 }) }), /save HTTP 401 .* \(key: an unrecognised key, length 3\)/);
  // a new-style secret key is sent as `apikey` only: as a bearer token the API refuses it
  await saveBody({ base: "https://db.invalid", key: "sb_secret_abc", body, fetchImpl });
  assert.equal(calls[1].init.headers.apikey, "sb_secret_abc");
  assert.equal(calls[1].init.headers.Authorization, undefined);
});

test("a match is on: four reads fifteen seconds apart, each one written", async () => {
  const sleeps = [], saved = [], matches = [{ home: "A", away: "B", lines: [] }];
  let t = Date.parse("2026-11-09T07:00:00Z");
  const out = await run({ read: async () => matches, save: async (b) => saved.push(b), sleep: async (ms) => { sleeps.push(ms); t += ms; }, now: () => new Date(t) });
  assert.deepEqual(out, { reads: ROUNDS, saved: ROUNDS, failed: 0, matches: 1 });
  assert.deepEqual(sleeps, [GAP_MS, GAP_MS, GAP_MS]);
  assert.deepEqual(saved.map((b) => b.asOf), ["07:00:00", "07:00:15", "07:00:30", "07:00:45"].map((x) => `2026-11-09T${x}.000Z`));
  assert.ok(saved.every((b) => b.source === "inplay" && b.matches === matches));
  assert.equal(ROUNDS * GAP_MS, 60_000);
});

test("nothing in play: one empty body is written and the run ends, no waiting", async () => {
  const sleeps = [], saved = [];
  const out = await run({ read: async () => [], save: async (b) => saved.push(b), sleep: async (ms) => sleeps.push(ms) });
  assert.deepEqual(out, { reads: 1, saved: 1, failed: 0, matches: 0 });
  assert.deepEqual(sleeps, []);
  assert.deepEqual(saved[0].matches, []);
});

test("a round that fails is logged as a warning and the next one tries again", async () => {
  const logs = [], saved = [];
  let n = 0;
  const out = await run({ read: async () => { if (++n === 2) throw new Error("feed HTTP 502"); return [{ home: "A", away: "B", lines: [] }]; }, save: async (b) => saved.push(b), sleep: async () => {}, log: (m) => logs.push(m) });
  assert.deepEqual(out, { reads: 4, saved: 3, failed: 1, matches: 1 });
  assert.equal(logs.length, 1);
  assert.match(logs[0], /^::warning::in-play round 2 failed: feed HTTP 502/);
  // a save that fails counts the same way and does not stop the run
  const bad = await run({ read: async () => [{ home: "A", away: "B", lines: [] }], save: async () => { throw new Error("save HTTP 500"); }, sleep: async () => {}, log: () => {} });
  assert.deepEqual([bad.reads, bad.saved, bad.failed], [4, 0, 4]);
});

test("a refused save says what the key is and what Supabase answered, never the key", async () => {
  const refuse = async () => new Response('{"message":"Invalid API key"}', { status: 401 });
  await assert.rejects(saveBody({ base: "https://db.invalid", key: "sb_publishable_xyz", body: {}, fetchImpl: refuse }), (e) => /Invalid API key/.test(e.message) && /publishable key/.test(e.message) && !e.message.includes("xyz"));
  assert.equal(describeKey("sb_secret_abcdef"), "a secret key, length 16");
  const jwt = `h.${Buffer.from('{"role":"service_role"}').toString("base64url")}.s`;
  assert.equal(describeKey(jwt), "a JWT with role service_role");
});

const EXTRA = [{ home: "Bangladesh", away: "West Indies", league: "", kickoff: null, lines: [{ kind: "team_runs", team: "Bangladesh", inn: 1, line: 250.5, over: 1.9, under: 1.8, book: "BookK" }] }];

test("the other books' file is read when it is there and is [] when unset, unreadable or not a list", () => {
  assert.deepEqual(loadExtra("", () => { throw new Error("must not be read"); }), []);
  assert.deepEqual(loadExtra("x.json", () => JSON.stringify({ matches: EXTRA })), EXTRA);
  assert.deepEqual(loadExtra("x.json", () => { throw new Error("ENOENT"); }), []);
  assert.deepEqual(loadExtra("x.json", () => "not json"), []);
  assert.deepEqual(loadExtra("x.json", () => JSON.stringify({ matches: "no" })), []);
});

test("a round is the price feed's matches with the other books' joined in; a failing feed keeps theirs with a warning, and fails when there is nothing else", async () => {
  const both = await readRound("http://feed.invalid/", EXTRA, json(DOC));
  assert.equal(both.length, 1); // the same match once
  assert.deepEqual(both[0].lines.map((l) => [l.kind, l.book || ""]), [["player_runs", ""], ["team_runs", "BookK"]]); // the feed's batter line, joined with BookK's innings line
  const logs = [];
  const kept = await readRound("http://feed.invalid/", EXTRA, json({}, 503), (m) => logs.push(m));
  assert.equal(kept.length, 1);
  assert.match(logs[0], /^::warning::price feed read failed, keeping the other books' matches: feed HTTP 503/);
  await assert.rejects(readRound("http://feed.invalid/", [], json({}, 503)), /feed HTTP 503/);
});
