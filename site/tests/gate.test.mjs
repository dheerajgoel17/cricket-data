import test from "node:test";
import assert from "node:assert/strict";
import { sign, verify } from "../api/gate.js";

test("gate cookie HMAC verifies and expires", () => {
  const secret = "ci-test-key";
  const ok = sign(secret, Math.floor(Date.now() / 1000) + 60);
  assert.equal(verify(secret, ok), true);
  assert.equal(verify("other", ok), false);
  assert.equal(verify(secret, sign(secret, Math.floor(Date.now() / 1000) - 10)), false);
});
