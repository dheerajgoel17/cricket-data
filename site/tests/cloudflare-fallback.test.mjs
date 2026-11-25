import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../cloudflare/worker.js";
import wwwRedirect from "../cloudflare/www-redirect.js";

test("the www alias redirects to the canonical host and preserves the URL", () => {
  const response = wwwRedirect.fetch(new Request("https://www.fancy.cash/fixture/example?tab=props"));
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://fancy.cash/fixture/example?tab=props");
});

/** The assets layer with `not_found_handling: "none"`: a file that exists is served, anything else is a 404. */
function assets(files) {
  return { fetch: (req) => {
    const body = files[new URL(req.url).pathname];
    return Promise.resolve(body === undefined ? new Response("Not found", { status: 404 }) : new Response(body, { headers: { "content-type": "text/html" } }));
  } };
}

test("fallback protects site data and keeps shared player links usable", async () => {
  const prior = process.env.DATA_WRAP_KEY;
  const key = "test-only";
  const origin = "https://fallback.example";
  const cardRequests = [];
  const env = {
    DATA_WRAP_KEY: key,
    ASSETS: assets({ "/data/index.json": "{}", "/data/meta.json": "{}", "/data-manifest.json": JSON.stringify({ "index.json": "123" }) }),
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
    const card = await fetch("/card/v16/player/1/runs/20.5.jpg");
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

test("a missing asset is a real uncacheable 404, a page route still gets the app shell", async () => {
  const prior = process.env.DATA_WRAP_KEY;
  process.env.DATA_WRAP_KEY = "test-only";
  try {
    const env = { DATA_WRAP_KEY: "test-only", ASSETS: assets({ "/": "<html>shell</html>" }) };
    const get = (path) => worker.fetch(new Request("https://fallback.example" + path, { headers: { "user-agent": "Mozilla/5.0 Chrome/120.0" } }), env);
    for (const path of ["/assets/Chunk-abc123.js", "/assets/x.css?v=1", "/books/none.png", "/favicon.ico", "/.well-known/x"]) {
      const res = await get(path);
      assert.equal(res.status, 404, path);
      assert.equal(res.headers.get("cache-control"), "no-store", path);
      assert.doesNotMatch(await res.text(), /shell/, path);
    }
    for (const path of ["/props", "/fancy", "/leagues", "/player/123?stat=runs", "/fixture/9"]) {
      const res = await get(path);
      assert.equal(res.status, 200, path);
      assert.equal(await res.text(), "<html>shell</html>");
      assert.equal(res.headers.get("cache-control"), "public, max-age=0, must-revalidate");
    }
    assert.equal((await worker.fetch(new Request("https://fallback.example/assets/a.js", { method: "POST" }), env)).status, 404);
  } finally {
    if (prior === undefined) delete process.env.DATA_WRAP_KEY;
    else process.env.DATA_WRAP_KEY = prior;
  }
});

test("a hashed data URL is immutable only when it names this deploy's bytes", async () => {
  const prior = process.env.DATA_WRAP_KEY;
  process.env.DATA_WRAP_KEY = "test-only";
  try {
    const env = { DATA_WRAP_KEY: "test-only", ASSETS: assets({ "/data/index.json": "{}", "/data-manifest.json": JSON.stringify({ "index.json": "new1" }) }) };
    const get = (path) => worker.fetch(new Request("https://fallback.example" + path, { headers: { "user-agent": "Mozilla/5.0 Chrome/120.0", "sec-fetch-site": "same-origin", "x-cd-k": "test-only" } }), env);
    assert.equal((await get("/data/index.json?v=new1")).headers.get("cache-control"), "private, max-age=31536000, immutable");
    assert.equal((await get("/data/index.json?v=old0")).headers.get("cache-control"), "no-store");
    assert.equal((await get("/data/index.json")).headers.get("cache-control"), "private, max-age=120");
    const missing = await get("/data/gone.json?v=new1");
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get("cache-control"), "no-store");
    const none = { DATA_WRAP_KEY: "test-only", ASSETS: assets({ "/data/index.json": "{}" }) };
    const res = await worker.fetch(new Request("https://fallback.example/data/index.json?v=new1", { headers: { "user-agent": "Mozilla/5.0 Chrome/120.0", "sec-fetch-site": "same-origin", "x-cd-k": "test-only" } }), none);
    assert.equal(res.headers.get("cache-control"), "no-store");
  } finally {
    if (prior === undefined) delete process.env.DATA_WRAP_KEY;
    else process.env.DATA_WRAP_KEY = prior;
  }
});
