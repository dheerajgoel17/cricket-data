import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dataManifest, headScript } from "../scripts/data-manifest.mjs";

const dir = mkdtempSync(join(tmpdir(), "dm-"));
mkdirSync(join(dir, "p"));
writeFileSync(join(dir, "index.json"), '{"a":1}');
writeFileSync(join(dir, "p", "1.json"), '{"b":2}');
writeFileSync(join(dir, "meta.json"), '{"built":1}');
writeFileSync(join(dir, "robots.txt"), "x");

test("hashes every json file by relative path, not meta.json or other files", () => {
  const m = dataManifest(dir);
  assert.deepEqual(Object.keys(m), ["index.json", "p/1.json"]);
  assert.match(m["index.json"], /^[0-9a-f]{10}$/);
});

test("the hash follows the bytes: same bytes, same hash; a change, a new one", () => {
  const a = dataManifest(dir);
  assert.deepEqual(dataManifest(dir), a);
  writeFileSync(join(dir, "index.json"), '{"a":2}');
  const b = dataManifest(dir);
  assert.notEqual(b["index.json"], a["index.json"]);
  assert.equal(b["p/1.json"], a["p/1.json"], "an untouched file keeps its URL across deploys");
});

test("a missing folder gives an empty manifest, not an error", () => {
  assert.deepEqual(dataManifest(join(dir, "nope")), {});
});

test("the head script carries the manifest, starts the gate request, and cannot close its own tag", () => {
  const s = headScript({ "x</script>.json": "abc" });
  assert.match(s, /window\.__DV=/);
  assert.match(s, /fetch\("\/api\/gate"/);
  assert.equal(s.split("</script>").length, 2, "only the closing tag of the script itself");
});
