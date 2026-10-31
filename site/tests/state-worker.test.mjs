import test from "node:test";
import assert from "node:assert/strict";
import worker from "../../state/worker.js";

const req = (key) => new Request("https://worker.test/", { headers: key ? { "x-state-key": key } : {} });

test("the Worker's manual trigger answers 404 without the write token and never runs", async () => {
  assert.equal((await worker.fetch(req(), { STATE_WRITE_TOKEN: "tok" })).status, 404);
  assert.equal((await worker.fetch(req("wrong"), { STATE_WRITE_TOKEN: "tok" })).status, 404);
  assert.equal((await worker.fetch(req("tok"), {})).status, 404); // no token configured: nothing can match
});

test("with the token it runs one sync and reports a missing setting as a 500 with the name, not a crash", async () => {
  const res = await worker.fetch(req("tok"), { STATE_WRITE_TOKEN: "tok" });
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /LIVE_SOURCE_BASE is not set/);
});
