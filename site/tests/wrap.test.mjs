import test from "node:test";
import assert from "node:assert/strict";
import { isWrapped, unwrap, wrap } from "../src/engine/wrap.js";

test("plain JSON is left alone", async () => {
  const doc = { p: [], fx: [] };
  assert.equal(isWrapped(doc), false);
  assert.deepEqual(await unwrap(doc, "k"), doc);
});

test("wrap then unwrap round-trips", async () => {
  const doc = { p: [{ f: "athapaththu", id: "ac56b5a7" }], fx: [] };
  const w = await wrap(doc, "ci-test-key");
  assert.equal(isWrapped(w), true);
  assert.deepEqual(await unwrap(w, "ci-test-key"), doc);
  await assert.rejects(() => unwrap(w, "wrong"));
});
