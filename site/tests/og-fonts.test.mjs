import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// The share-card function draws with these font files and vercel.json ships them with it: the web app's own fonts changed once and the dependency went with them.
test("the share card's font files are installed and listed for the function", () => {
  const og = readFileSync(new URL("../api/og.js", import.meta.url), "utf8");
  const files = [...og.matchAll(/"(node_modules\/@fontsource\/[^"]+\.woff)"/g)].map((m) => m[1]);
  assert.ok(files.length >= 2, "og.js names its fonts");
  for (const f of files) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `${f} is installed (is its package in package.json?)`);
  const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.match(vercel.functions["api/og.js"].includeFiles, /@fontsource\/barlow-condensed\/files/);
});
