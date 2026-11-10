import assert from "node:assert/strict";
import test from "node:test";
import { identityIndex } from "../packages/engine/identity.js";
import { gradeOffers } from "../scripts/grade-inplay.mjs";
import { historyStorage } from "../scripts/inplay-storage.mjs";

test("a compressed history chunk survives a new worker and is readable for grading", async () => {
  const objects = new Map();
  const fetchImpl = async (url, opts) => {
    const path = url.split("/object/")[1];
    if (path.startsWith("list/")) {
      const { prefix, offset } = JSON.parse(opts.body);
      return Response.json(offset ? [] : [...objects.keys()].filter((key) => key.startsWith(`inplay-history/${prefix}/`)).map((key) => ({ name: key.split("/").at(-1) })));
    }
    if (opts.method === "POST") {
      if (objects.has(path) && !opts.headers["x-upsert"]) return new Response(null, { status: 409 });
      objects.set(path, opts.body);
      return new Response(null, { status: 200 });
    }
    const found = objects.get(path.replace(/^authenticated\//, ""));
    return found ? new Response(found) : Response.json({ statusCode: "404" }, { status: 400 });
  };
  const opts = { base: "https://db.invalid", key: "sb_secret_test", fetchImpl };
  const pair = "alpha|beta", at = "2026-11-10T09:00:00.000Z";
  const row = { pair, at, match_key: "match", line_key: "line", kind: "player_runs", over_price: 1.85 };
  const worker = historyStorage(opts);
  assert.deepEqual(await worker.load({ pairs: [pair], since: at }), []);
  assert.equal(await worker.append({ rows: [row] }), 1);
  await worker.append({ rows: [row] });
  const next = historyStorage(opts);
  assert.equal((await next.load({ pairs: [pair], since: at }))[0].over_price, 1.85);
  const chunks = [];
  for await (const rows of next.chunks("2026-11-10")) chunks.push(...rows);
  assert.deepEqual(chunks, [row]);
});

test("grading isolates formats, skips void or ambiguous matches and counts the earliest offer once", () => {
  const at = "2026-11-10T09:00:00Z";
  const offer = { at, kickoff: at, score_at: at, kind: "player_runs", inn: 1, cur_inn: 1, ctx: { status: "live" },
    pair: "alpha|beta", fmt: "T20", bat_team: "Alpha", subject: "J Smith", b_runs: 32, b_balls: 20, line: 49.5, line_key: "a" };
  const match = { index: 0, gender: 0, qualified: true };
  const players = new Map([[0, [{ pid: "p", name: "John Smith", team: "Alpha", inn: 1, runs: 50, balls: 34 }]]]);
  const matches = new Map([["alpha|beta|T20|2026-11-10", [match]]]);
  const identity = identityIndex(null);
  const later = { ...offer, line: 51, at: "2026-11-10T09:00:15Z" };
  assert.deepEqual(gradeOffers([later, offer, offer, { ...offer, fmt: "ODI" }], matches, players, identity),
    { "T20|0|3|6|3": { over: 1, under: 0, push: 0 } });
  assert.deepEqual(gradeOffers([{ ...offer, line: 50 }], matches, players, identity),
    { "T20|0|3|6|3": { over: 0, under: 0, push: 1 } });
  match.qualified = false;
  assert.deepEqual(gradeOffers([offer], matches, players, identity), {});
  match.qualified = true;
  matches.values().next().value.push({ ...match, index: 1 });
  assert.deepEqual(gradeOffers([offer], matches, players, identity), {});
});
