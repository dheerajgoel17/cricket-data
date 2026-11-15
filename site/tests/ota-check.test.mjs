import test from "node:test";
import assert from "node:assert/strict";
import { classify } from "../../scripts/ota-check.mjs";

test("a screen or engine change ships over the air", () => {
  assert.equal(classify(["mobile/src/ui/chips.tsx", "site/packages/engine/live.js"]).kind, "ota");
});
test("a dependency, plugin, font or icon change needs a new build", () => {
  assert.equal(classify(["mobile/src/ui/chips.tsx", "mobile/package.json"]).kind, "build");
  assert.equal(classify(["mobile/app.json"]).kind, "build");
  assert.equal(classify(["mobile/assets/fonts/Satoshi-Bold.ttf"]).kind, "build");
  assert.equal(classify(["mobile/assets/images/icon.png"]).kind, "build");
});
test("web-only and docs changes are not an app change", () => {
  assert.equal(classify(["site/src/pages/Player.tsx", "docs/SITE.md"]).kind, "none");
});
