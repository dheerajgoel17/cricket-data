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

test("batched unwrap round-trips more than one SHA block", async () => {
  const doc = { n: 0, s: "x".repeat(4000), a: [1, 2, 3] };
  assert.deepEqual(await unwrap(await wrap(doc, "ci-test-key"), "ci-test-key"), doc);
});
