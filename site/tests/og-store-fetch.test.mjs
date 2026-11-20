import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

// L5 form must pull matches.json + one shard over HTTP (not from a bundled public/data/p tree).
test("fetchStoreJson reads /data over HTTP with the wrap-key header", async () => {
  const seen = [];
  const server = createServer((req, res) => {
    seen.push({ url: req.url, ua: req.headers["user-agent"], key: req.headers["x-cd-k"] });
    if (req.url === "/data/p/00.json") {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ bat: { p: [] }, bowl: {}, fld: {} }));
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise((r) => server.listen(0, r));
  const { port } = server.address();
  process.env.SHARE_DATA_BASE = `http://127.0.0.1:${port}`;
  process.env.DATA_WRAP_KEY = "test-wrap-key";
  try {
    const { fetchStoreJson, dataOrigin } = await import(`../api/og.js?storefetch=${Date.now()}`);
    assert.equal(dataOrigin(), `http://127.0.0.1:${port}`);
    const doc = await fetchStoreJson("p/00.json");
    assert.deepEqual(doc.bat, { p: [] });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].url, "/data/p/00.json");
    assert.equal(seen[0].ua, "fancy-cash-og/1.0");
    assert.equal(seen[0].key, "test-wrap-key");
  } finally {
    delete process.env.SHARE_DATA_BASE;
    delete process.env.DATA_WRAP_KEY;
    server.close();
  }
});

test("the data origin is the production domain, never the protected deployment address", async () => {
  const keep = { b: process.env.SHARE_DATA_BASE, p: process.env.VERCEL_PROJECT_PRODUCTION_URL, v: process.env.VERCEL_URL };
  try {
    delete process.env.SHARE_DATA_BASE;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "prod.example.test"; process.env.VERCEL_URL = "dep-abc.example.test";
    const { dataOrigin } = await import(`../api/og.js?origin=${Date.now()}`);
    assert.equal(dataOrigin(), "https://prod.example.test");
    process.env.SHARE_DATA_BASE = "https://set.example.test/";
    assert.equal(dataOrigin(), "https://set.example.test");
    delete process.env.SHARE_DATA_BASE; delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    assert.equal(dataOrigin(), "https://dep-abc.example.test");
  } finally {
    for (const [k, v] of [["SHARE_DATA_BASE", keep.b], ["VERCEL_PROJECT_PRODUCTION_URL", keep.p], ["VERCEL_URL", keep.v]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});
