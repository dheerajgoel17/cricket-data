import test from "node:test";
import assert from "node:assert/strict";
import { isWrapped, unwrap, wire, wrap } from "@cricket/engine/wrap.js";

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

test("wire wraps only when a key is set, so a Network-tab body is not readable JSON", async () => {
  const doc = { asOf: "2026-10-30", source: "live", matches: [{ id: "a" }] };
  assert.deepEqual(await wire(doc, ""), doc);
  const w = await wire(doc, "ci-test-key");
  assert.equal(isWrapped(w), true);
  assert.equal(w.matches, undefined);
  assert.deepEqual(await unwrap(w, "ci-test-key"), doc);
});

test("wrapSync (the Node functions' wrap) is byte-identical to wrap for the same iv, at every block edge, and unwrap reads it", async () => {
  const { wrapSync, wireSync } = await import("@cricket/engine/wrap-node.js");
  const iv = new Uint8Array(16).map((_, i) => i * 7 + 1);
  for (const n of [0, 1, 30, 31, 32, 33, 63, 64, 65, 2047, 2048, 2049, 100_000]) {
    const doc = { s: "é✓x".repeat(Math.ceil(n / 3)).slice(0, n) };
    const a = await wrap(doc, "ci-test-key", iv), b = wrapSync(doc, "ci-test-key", iv);
    assert.deepEqual(b, a, `size ${n}`);
    assert.deepEqual(await unwrap(b, "ci-test-key"), doc);
  }
  const doc = { asOf: "x", matches: [{ id: "a" }] };
  assert.deepEqual(wireSync(doc, ""), doc);
  assert.deepEqual(wireSync(doc, "  "), doc);
  assert.deepEqual(await unwrap(wireSync(doc, " ci-test-key "), "ci-test-key"), doc);
  assert.notDeepEqual(wrapSync(doc, "ci-test-key"), wrapSync(doc, "ci-test-key"), "a fresh iv each time");
});
