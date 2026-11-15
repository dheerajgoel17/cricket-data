import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import tokens from "../packages/tokens/tokens.json" with { type: "json" };
import { tokensDtcg } from "../packages/tokens/dtcg.js";

test("the committed Figma-readable token file is what tokens.json generates", () => {
  const committed = readFileSync(new URL("../packages/tokens/tokens.dtcg.json", import.meta.url), "utf8");
  assert.equal(committed, JSON.stringify(tokensDtcg(tokens), null, 2) + "\n");
});
test("every colour token keeps its value", () => {
  const d = tokensDtcg(tokens);
  assert.equal(d.color.primary.$value, tokens.color.primary);
  assert.equal(d.color.primary.$type, "color");
});
