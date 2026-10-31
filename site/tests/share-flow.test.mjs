import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The whole link-preview path, as a crawler walks it: GET the share page, read its tags, GET the card image it names.
const dir = mkdtempSync(join(tmpdir(), "share-"));
const put = (f, o) => writeFileSync(join(dir, f), JSON.stringify(o));
put("index.json", { players: { id: ["aaaa1111"], nm: ["Harry Brook"], tm: [0] }, teams: [{ n: "England", g: 0 }], venues: ["Ground, City"] });
put("photos.json", { p: {} });
put("lines.json", { lines: [{ pid: "aaaa1111", stat: "runs", line: 24.5, match: "England vs India", books: [{ source: "bet365", over: 1.83 }] }] });
put("fixtures.json", [{ id: "2026-10-29-a-v-b", a: "A", b: "B", start: "2026-10-29T14:30Z", venue: "Ground, City" }]);
process.env.SHARE_DATA_DIR = dir;
const { default: og } = await import("../api/og.js");
const { default: share } = await import("../api/share.js");

// the same routing vercel.json does: /share/<path> -> api/share, /api/og -> api/og
const server = createServer(async (req, rsp) => {
  const u = new URL(req.url, "http://localhost");
  const res = { setHeader: (k, v) => rsp.setHeader(k, v), end: (b) => rsp.end(b), set statusCode(v) { rsp.statusCode = v; }, get statusCode() { return rsp.statusCode; } };
  if (u.pathname.startsWith("/share/")) return share({ query: { path: u.pathname.slice(7) }, headers: req.headers, method: req.method }, res);
  if (u.pathname.startsWith("/card/")) return og({ query: { path: u.pathname.slice(6) }, headers: req.headers, method: req.method }, res);
  if (u.pathname === "/api/og") return og({ query: Object.fromEntries(u.searchParams), headers: req.headers, method: req.method }, res);
  rsp.statusCode = 404; rsp.end();
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
test.after(() => server.close());

test("a shared prop link gives the tags a preview needs, no redirect a crawler would follow, and a card image under 300 KB", async () => {
  const html = await (await fetch(`${base}/share/player/0/runs/24.5`)).text();
  assert.match(html, /<title>Harry Brook: runs over 24\.5 at 1\.83 \| Fancy\.cash<\/title>/);
  assert.match(html, /og:description" content="[^"]*listed 1\.83 at bet365 in England vs India/);
  assert.match(html, /og:image:type" content="image\/jpeg"/);
  assert.match(html, /og:image:width" content="1200"/);
  assert.match(html, /og:image:height" content="630"/);
  assert.match(html, /og:image:alt" content="Harry Brook: runs over 24\.5 at 1\.83"/);
  assert.match(html, /twitter:card" content="summary_large_image"/);
  assert.match(html, /theme-color" content="#27da8e"/);
  assert.doesNotMatch(html, /location\.replace|http-equiv="refresh"/i);
  assert.match(html, /<img src="[^"]*\/card\/v8\/player\/0\/runs\/24\.5\.jpg"/);
  assert.match(html, /rel="image_src" href="[^"]*\/card\/v8\/player\/0\/runs\/24\.5\.jpg"/);
  assert.match(html, /rel="canonical" href="[^"]*\/share\/player\/0\/runs\/24\.5"/);
  assert.ok(html.length < 32 * 1024); // Slack only reads the first 32 KB of the page
  assert.match(html, /og:url" content="[^"]*\/share\/player\/0\/runs\/24\.5"/);
  const image = /og:image" content="([^"]+)"/.exec(html)[1].replace(/&amp;/g, "&");
  assert.match(image, /\/card\/v8\/player\/0\/runs\/24\.5\.jpg$/); // version in the path: X ignores ?v= when it has cached a failed picture
  assert.equal(/twitter:image" content="([^"]+)"/.exec(html)[1].replace(/&amp;/g, "&"), image);
  const r = await fetch(`${base}${new URL(image).pathname}${new URL(image).search}`);
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "image/jpeg");
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  assert.match(r.headers.get("content-disposition") || "", /inline/);
  assert.deepEqual([...buf.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  assert.ok(buf.length < 300 * 1024); // WhatsApp large preview drops heavier pictures
});

test("a fixture link works the same way, and an unknown one goes to the home page", async () => {
  const html = await (await fetch(`${base}/share/fixture/2026-10-29-a-v-b`)).text();
  assert.match(html, /<title>A v B: stats, props/);
  assert.match(html, /og:image" content="[^"]*\/card\/v8\/fixture\/2026-10-29-a-v-b\.jpg"/);
  const r = await fetch(`${base}/share/fixture/nope`, { redirect: "manual" });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("location"), "/");
});

test("vercel.json sends /share and /card to the functions before the catch-all, and the plain /api/og query still works", async () => {
  const { readFileSync } = await import("node:fs");
  const rw = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")).rewrites.map((r) => r.source);
  assert.ok(rw.indexOf("/share/:path*") >= 0 && rw.indexOf("/card/:path*") >= 0);
  const spa = rw.find((s) => s.includes("?!api/") || s === "/(.*)");
  assert.ok(spa && rw.indexOf("/share/:path*") < rw.indexOf(spa) && rw.indexOf("/card/:path*") < rw.indexOf(spa));
  assert.ok(spa.includes("_vercel") || spa === "/(.*)");
  const r = await fetch(`${base}/api/og?p=0`);
  assert.equal(r.headers.get("content-type"), "image/jpeg");
  const head = await fetch(`${base}/card/v8/player/0/runs/24.5.jpg`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("content-type"), "image/jpeg");
  const miss = await fetch(`${base}/card/v8/player/999.jpg`);
  assert.equal(miss.headers.get("content-type"), "image/jpeg"); // never PNG from a .jpg URL: X drops a type mismatch
});
