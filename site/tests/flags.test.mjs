import test from "node:test";
import assert from "node:assert/strict";
import { flagCode } from "@cricket/engine/flags.js";

test("flagCode: nationals, Base USA spelling, parent strips for U19 / A / Champions", () => {
  assert.equal(flagCode("Afghanistan"), "af");
  assert.equal(flagCode("Afghanistan U19"), "af");
  assert.equal(flagCode("India A"), "in");
  assert.equal(flagCode("India (W)"), "in");
  assert.equal(flagCode("Australia Champions"), "au");
  assert.equal(flagCode("United States of America"), "us");
  assert.equal(flagCode("United States"), "us");
  assert.equal(flagCode("USA"), "us");
  assert.equal(flagCode("Costa Rica"), "cr");
  assert.equal(flagCode("Ivory Coast"), "ci");
  assert.equal(flagCode("Cameroon"), "cm");
  assert.equal(flagCode("Pakistan U19-Women"), "pk");
});

test("flagCode: clubs and composite XIs stay null (no invented flag)", () => {
  assert.equal(flagCode("Mumbai Indians"), null);
  assert.equal(flagCode("Africa XI"), null);
  assert.equal(flagCode("Nowhere XI"), null);
  assert.equal(flagCode(""), null);
});
