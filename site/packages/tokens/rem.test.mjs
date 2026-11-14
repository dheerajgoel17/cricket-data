import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { remPx } from "./rem.js";

describe("remPx", () => {
  it("converts rem and px", () => {
    assert.equal(remPx("0.875rem"), 14);
    assert.equal(remPx("2.25rem"), 36);
    assert.equal(remPx("999px"), 999);
  });

  it("uses the max of a clamp()", () => {
    assert.equal(remPx("clamp(1.5rem, 1.35rem + 0.6vw, 1.75rem)"), 28);
  });
});
