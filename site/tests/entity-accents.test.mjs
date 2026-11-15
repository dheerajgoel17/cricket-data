import test from "node:test";
import assert from "node:assert/strict";
import { accentKey, entityAccent } from "@cricket/engine/entity-accents.js";

test("accentKey folds women tags and SAME_SIDE aliases like teamKey", () => {
  assert.equal(accentKey("India (W)"), "india");
  assert.equal(accentKey("India Women"), "india");
  assert.equal(accentKey("UAE"), "unitedarabemirates");
  assert.equal(accentKey("Boland"), "rocks");
});

test("entityAccent returns curated hex for known sides", () => {
  assert.equal(entityAccent("India"), "#1B4F9C");
  assert.equal(entityAccent("India (W)"), "#1B4F9C");
  assert.equal(entityAccent("Mumbai Indians"), "#004BA0");
  assert.equal(entityAccent("Australia"), "#01875F");
});

test("entityAccent is null for unknown sides (UI may brand-wash)", () => {
  assert.equal(entityAccent("Nowhere XI"), null);
  assert.equal(entityAccent(""), null);
  assert.equal(entityAccent(null), null);
});

test("no curated accent is true black", () => {
  for (const name of ["India", "Australia", "New Zealand", "England", "Pakistan"]) {
    const hex = entityAccent(name);
    assert.ok(hex && hex.toLowerCase() !== "#000000" && hex.toLowerCase() !== "#000");
  }
});
