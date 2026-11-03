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
