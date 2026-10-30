import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/geo.js";

function call(headers) {
  let status = 0, body = "", hdrs = {};
  const res = { setHeader(k, v) { hdrs[k] = v; }, status(n) { status = n; return this; }, json(o) { body = JSON.stringify(o); } };
  handler({ headers }, res);
  return { status, body: JSON.parse(body), hdrs };
}

test("geo reads the country from the edge request and does not cache it", () => {
  const r = call({ "x-vercel-ip-country": "sg", "x-vercel-ip-country-region": "01" });
  assert.deepEqual(r.body, { country: "SG", region: "01" });
  assert.equal(r.status, 200);
  assert.match(r.hdrs["Cache-Control"], /no-store/);
});

test("geo falls back to the Cloudflare country header", () => {
  assert.equal(call({ "cf-ipcountry": "GB" }).body.country, "GB");
  assert.equal(call({}).body.country, "");
});
