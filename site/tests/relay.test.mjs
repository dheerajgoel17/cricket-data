import test from "node:test";
import assert from "node:assert/strict";
import worker, { allowed, same } from "../../relay/worker.js";

const envOf = () => ({ RELAY_KEY: process.env.RELAY_KEY, RELAY_ALLOW: process.env.RELAY_ALLOW, RELAY_ALLOW_EXTRA: process.env.RELAY_ALLOW_EXTRA });
const call = async (req, fetchImpl) => {
  const url = new URL("https://relay.invalid/");
  if (req.query?.u) url.searchParams.set("u", req.query.u);
  const headers = new Headers(req.headers || {});
  const r = new Request(url, { method: req.method || "GET", headers, body: req.body });
  const res = await worker.fetch(r, envOf(), { fetch: fetchImpl });
  return { code: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) };
};
const answer = (status, text, type = "application/json") => async () => new Response(text, { status, headers: { "content-type": type } });

test.beforeEach(() => {
  process.env.RELAY_KEY = "k-123";
  process.env.RELAY_ALLOW = "book.example, hub.example";
  delete process.env.RELAY_ALLOW_EXTRA;
});

test("the key and the host list are the only way in: no key, a wrong key, an unlisted host and a non-https address are refused before anything is fetched", async () => {
  let fetched = 0;
  const f = async () => { fetched++; return new Response("x"); };
  const url = "https://api.book.example/a";
  assert.equal((await call({ headers: {}, query: { u: url } }, f)).code, 403);
  assert.equal((await call({ headers: { "x-relay-key": "nope" }, query: { u: url } }, f)).code, 403);
  assert.equal((await call({ headers: { "x-relay-key": "k-123" }, query: { u: "https://evil.example/a" } }, f)).code, 403);
  assert.equal((await call({ headers: { "x-relay-key": "k-123" }, query: { u: "https://book.example.evil.example/a" } }, f)).code, 403);
  assert.equal((await call({ headers: { "x-relay-key": "k-123" }, query: { u: "http://api.book.example/a" } }, f)).code, 403);
  assert.equal((await call({ headers: { "x-relay-key": "k-123" }, query: { u: "not a url" } }, f)).code, 400);
  delete process.env.RELAY_KEY;
  assert.equal((await call({ headers: { "x-relay-key": "" }, query: { u: url } }, f)).code, 403, "no key configured: nothing is allowed");
  assert.equal(fetched, 0);
});

test("a listed host (and its subdomains) is fetched and answered as it came, with its status", async () => {
  const ok = await call({ headers: { "x-relay-key": "k-123" }, query: { u: "https://api.book.example/list" } }, answer(200, '{"a":1}'));
  assert.equal(ok.code, 200); assert.equal(ok.body.toString(), '{"a":1}'); assert.match(ok.headers["content-type"], /json/); assert.equal(ok.headers["cache-control"], "no-store");
  assert.equal((await call({ headers: { "x-relay-key": "k-123" }, query: { u: "https://hub.example/x" } }, answer(403, "blocked", "text/html"))).code, 403, "the book's own refusal is passed on");
  assert.equal((await call({ headers: { "x-relay-key": "k-123" }, query: { u: "https://hub.example/x" } }, async () => { throw new Error("down"); })).code, 502);
});

test("a POST carries its body and content type to the book", async () => {
  let seen;
  const f = async (u, init) => { seen = { u: String(u), init }; return new Response("[]", { status: 200 }); };
  const res = await call({ method: "POST", headers: { "x-relay-key": "k-123", "content-type": "application/x-www-form-urlencoded" }, query: { u: "https://hub.example/ws/getMarketDataNew" }, body: "market_ids[]=1&market_ids[]=2" }, f);
  assert.equal(res.code, 200);
  assert.equal(seen.init.method, "POST"); assert.equal(Buffer.from(seen.init.body).toString(), "market_ids[]=1&market_ids[]=2"); assert.equal(seen.init.headers["Content-Type"], "application/x-www-form-urlencoded");
});

test("allowed() and same() compare as they should", () => {
  assert.ok(allowed("a.b.example", "b.example") && allowed("b.example", "b.example") && !allowed("xb.example", "b.example") && !allowed("b.example", ""));
  assert.ok(same("abc", "abc") && !same("abc", "abd") && !same("abc", "ab"));
});

test("RELAY_ALLOW_EXTRA admits a host that is not on RELAY_ALLOW", async () => {
  process.env.RELAY_ALLOW_EXTRA = "other.example";
  assert.equal((await call({ headers: { "x-relay-key": "k-123" }, query: { u: "https://api.other.example/x" } }, answer(200, "{}"))).code, 200);
  assert.equal((await call({ headers: { "x-relay-key": "k-123" }, query: { u: "https://evil.example/x" } }, answer(200, "{}"))).code, 403);
});
