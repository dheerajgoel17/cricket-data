import test from "node:test";
import assert from "node:assert/strict";
import { identityIndex, NO_IDENTITY } from "@cricket/engine/identity.js";

const doc = { v: 1, s: { "470f446b": "DBT", "9550470d": "YL" }, b: { "5d1e7582": ["Kusal Mendis"] } };

test("the table answers in both directions and knows the names the books use", () => {
  const idn = identityIndex(doc);
  assert.equal(idn.sourceOf("470f446b"), "DBT");
  assert.equal(idn.pidOf("YL"), "9550470d");
  assert.equal(idn.isLinked("DBT"), true);
  assert.equal(idn.isLinked("N0"), false);
  assert.deepEqual(idn.bookNames("5d1e7582"), ["Kusal Mendis"]);
  assert.equal(idn.size, 2);
});

test("a player the table does not know, an empty id and a missing table all answer 'nobody'", () => {
  const idn = identityIndex(doc);
  assert.equal(idn.sourceOf("zzzzzzzz"), "");
  assert.equal(idn.pidOf("nope"), "");
  assert.equal(idn.isLinked(""), false);
  assert.deepEqual(idn.bookNames("zzzzzzzz"), []);
  for (const none of [NO_IDENTITY, identityIndex(undefined), identityIndex({})]) {
    assert.equal(none.sourceOf("470f446b"), "");
    assert.equal(none.isLinked("DBT"), false);
    assert.equal(none.size, 0);
  }
});
