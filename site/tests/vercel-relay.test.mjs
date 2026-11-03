import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import handler, { allowed, same } from "../../relay/api/relay.js";

const env = (over = {}) => {
  process.env.RELAY_KEY = over.RELAY_KEY ?? "k-123";
  process.env.RELAY_ALLOW = over.RELAY_ALLOW ?? "book.example, hub.example";
  if (over.RELAY_ALLOW_EXTRA != null) process.env.RELAY_ALLOW_EXTRA = over.RELAY_ALLOW_EXTRA;
  else delete process.env.RELAY_ALLOW_EXTRA;
};

const call = async (req, fetchImpl) => {
  const out = { statusCode: 0, headers: {}, body: Buffer.alloc(0) };
  const res = {
    statusCode: 200,
    setHeader(k, v) { out.headers[k.toLowerCase()] = v; },
    end(b) { out.statusCode = res.statusCode; out.body = Buffer.isBuffer(b) ? b : Buffer.from(String(b ?? "")); },
  };
  const headers = { ...(req.headers || {}) };
  let bodyStream;
  if (req.body != null) {
    bodyStream = Readable.from([Buffer.from(req.body)]);
    Object.assign(bodyStream, { headers, method: req.method || "GET", query: req.query || {} });
    await handler(bodyStream, res, fetchImpl);
  } else {
    await handler({ method: req.method || "GET", headers, query: req.query || {} }, res, fetchImpl);
  }
  return { code: out.statusCode || res.statusCode, headers: out.headers, body: out.body };
};

const answer = (status, text, type = "application/json") => async () => new Response(text, { status, headers: { "content-type": type } });

test.beforeEach(() => env());

test("Vercel relay: key and allow list gate every call", async () => {
  let fetched = 0;
  const f = async () => { fetched++; return new Response("x"); };
  const url = "https://api.book.example/a";
  assert.equal((await call({ headers: {}, query: { u: url } }, f)).code, 403);
  assert.equal((await call({ headers: { "x-relay-key": "nope" }, query: { u: url } }, f)).code, 403);
  assert.equal((await call({ headers: { "x-relay-key": "k-123" }, query: { u: "https://evil.example/a" } }, f)).code, 403);
  assert.match((await call({ headers: { "x-relay-key": "k-123" }, query: { u: "https://evil.example/a" } }, f)).body.toString(), /^host not allowed:evil\.example$/);
  assert.equal((await call({ headers: { "x-relay-key": "k-123" }, query: { u: "http://api.book.example/a" } }, f)).code, 400);
  assert.equal(fetched, 0);
});

test("Vercel relay: listed host is fetched and answered as it came", async () => {
  const ok = await call({ headers: { "x-relay-key": "k-123" }, query: { u: "https://api.book.example/list" } }, answer(200, '{"a":1}'));
  assert.equal(ok.code, 200);
  assert.equal(ok.body.toString(), '{"a":1}');
  assert.equal((await call({ headers: { "x-relay-key": "k-123" }, query: { u: "https://hub.example/x" } }, answer(403, "blocked", "text/html"))).code, 403);
});

test("Vercel relay: POST body and browser-like Origin reach the book", async () => {
  let seen;
  const f = async (u, init) => { seen = { u: String(u), init }; return new Response("[]", { status: 200 }); };
  const res = await call({
    method: "POST",
    headers: { "x-relay-key": "k-123", "content-type": "application/x-www-form-urlencoded" },
    query: { u: "https://hub.example/ws/getMarketDataNew" },
    body: "market_ids[]=1",
  }, f);
  assert.equal(res.code, 200);
  assert.equal(seen.init.method, "POST");
  assert.equal(Buffer.from(seen.init.body).toString(), "market_ids[]=1");
  assert.match(seen.init.headers["User-Agent"], /Chrome\/131/);
  assert.equal(seen.init.headers.Origin, "https://hub.example");
  assert.equal(seen.init.headers["Accept-Language"], "en-IN,en;q=0.9,hi;q=0.8");
});

test("allowed() and same() for the Vercel hop", () => {
  assert.ok(allowed("a.b.example", "b.example") && !allowed("xb.example", "b.example"));
  assert.ok(same("abc", "abc") && !same("abc", "abd"));
});
