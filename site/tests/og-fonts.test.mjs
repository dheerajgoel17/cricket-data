import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const CARD_DATA = ["public/data/index.json", "public/data/photos.json", "public/data/lines.json", "public/data/fixtures.json"];

// Share card: Satoshi for names, Barlow Condensed for figures / brand; vercel.json ships those woff files with the function.
test("the share card's font files are installed and listed for the function", () => {
  const og = readFileSync(new URL("../api/og.js", import.meta.url), "utf8");
  const satoshi = [...og.matchAll(/"(fonts\/satoshi\/[^"]+\.woff)"/g)].map((m) => m[1]);
  const condensed = [...og.matchAll(/"(node_modules\/@fontsource\/barlow-condensed\/[^"]+\.woff)"/g)].map((m) => m[1]);
  assert.ok(satoshi.length >= 2, "og.js names Satoshi for names/body");
  assert.ok(condensed.length >= 2, "og.js names Barlow Condensed for figures and brand");
  for (const f of [...satoshi, ...condensed]) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `${f} is installed`);
  const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const inc = vercel.functions["api/og.js"].includeFiles;
  assert.match(inc, /fonts\/satoshi\/Satoshi-/);
  assert.match(inc, /barlow-condensed/);
});

// Player shards (~36 MB) must not ship inside the function: Hobby Functions Storage fills up when hourly deploys re-bundle them.
test("og and share includeFiles ship only the four card JSON files, never p/ or a data/*.json glob", () => {
  const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  for (const name of ["api/og.js", "api/share.js"]) {
    const inc = vercel.functions[name].includeFiles;
    assert.ok(inc, `${name} has includeFiles`);
    assert.doesNotMatch(inc, /data\/p\/|p\/\*\.json/);
    assert.doesNotMatch(inc, /public\/data\/\*\.json/);
    for (const f of CARD_DATA) assert.match(inc, new RegExp(f.replace(/\./g, "\\.")));
  }
  const share = readFileSync(new URL("../api/share.js", import.meta.url), "utf8");
  assert.match(share, /from ["']\.\/load-data\.js["']/);
  assert.doesNotMatch(share, /from ["']\.\/og\.js["']/);
});
