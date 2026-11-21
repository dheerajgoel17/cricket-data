import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../cloudflare/worker.js";
import wwwRedirect from "../cloudflare/www-redirect.js";

test("the www alias redirects to the canonical host and preserves the URL", () => {
  const response = wwwRedirect.fetch(new Request("https://www.fancy.cash/fixture/example?tab=props"));
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://fancy.cash/fixture/example?tab=props");
});

test("fallback protects site data and keeps shared player links usable", async () => {
  const prior = process.env.DATA_WRAP_KEY;
  const key = "test-only";
  const origin = "https://fallback.example";
  const cardRequests = [];
  const env = {
    DATA_WRAP_KEY: key,
    ASSETS: { fetch: () => Response.json({ ok: true }) },
    CARDS: { getByName: () => ({ fetch: (url) => {
      cardRequests.push(new URL(url));
      return new Response("jpeg", { headers: { "Content-Type": "image/jpeg" } });
    } }) },
  };
  const browser = { "user-agent": "Mozilla/5.0 Chrome/120.0", "sec-fetch-site": "same-origin" };
  const fetch = (path, headers = browser, bindings = env) => worker.fetch(new Request(origin + path, { headers }), bindings);
  try {
    delete process.env.DATA_WRAP_KEY;
    assert.equal((await fetch("/data/index.json")).status, 503);
    process.env.DATA_WRAP_KEY = key;
    assert.equal((await fetch("/data/index.json")).status, 403);
    assert.equal((await fetch("/data/meta.json")).status, 200);
    const gate = await fetch("/api/gate");
    assert.equal(gate.status, 200);
    assert.equal(gate.headers.get("x-cd-k"), key);
    const cookie = gate.headers.get("set-cookie").split(";")[0];
    const data = await fetch("/data/index.json?v=123", { ...browser, cookie });
    assert.equal(data.status, 200);
    assert.equal(data.headers.get("cache-control"), "private, max-age=31536000, immutable");
    assert.equal((await fetch("/data/index.json", { ...browser, cookie: cookie + "a" })).status, 403);
    assert.equal((await fetch("/api/unknown")).status, 404);
    assert.equal((await fetch("/card/v9/pid/1/runs/20.5.jpg")).status, 404);
    const card = await fetch("/card/v15/player/1/runs/20.5.jpg");
    assert.equal(card.headers.get("content-type"), "image/jpeg");
    await fetch("/api/og?f=match&fm=team_runs%3A2&sc=1&poster=1");
    assert.equal(cardRequests.at(-1).searchParams.get("fm"), "team_runs:2");
    assert.equal((await fetch("/api/card", browser, { ...env, CARD_API_KEY: "test-bot" })).status, 401);
    const share = await fetch("/share/player/1/runs/20.5", { ...browser, "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" });
    assert.equal(share.headers.get("location"), "/player/1?stat=runs&line=20.5");
  } finally {
    if (prior === undefined) delete process.env.DATA_WRAP_KEY;
    else process.env.DATA_WRAP_KEY = prior;
  }
});
