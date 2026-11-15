#!/usr/bin/env node
// Says whether a change can reach installed apps over the air (expo-updates) or needs a new APK.
//   node scripts/ota-check.mjs [base-ref]      (default origin/main; compares the current branch with it)
// OTA-safe: JavaScript and bundled assets (mobile/src, site/packages/engine|storage|tokens, other images). Needs a build: anything native.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Paths whose change alters the native app (or its fingerprint), so the runtime version changes and an OTA update is not delivered to old builds. */
const NATIVE = [
  /^mobile\/package(-lock)?\.json$/, // dependencies: a JS-only package is safe in practice, but a native one is not; treated as a build until a human says otherwise
  /^mobile\/app\.(json|config\.js)$/,
  /^mobile\/assets\/fonts\//,
  /^mobile\/assets\/images\/(icon|android-icon|splash|favicon)/,
  /^mobile\/(android|ios)\//,
  /^mobile\/(metro|babel)\.config\.js$/,
];
const BUNDLED = [/^mobile\/src\//, /^mobile\/assets\//, /^site\/packages\/(engine|storage|tokens)\//, /^site\/src\/lib\/(priority|home-phase)\.ts$/];

export function classify(paths) {
  const native = paths.filter((p) => NATIVE.some((r) => r.test(p)));
  const bundled = paths.filter((p) => !native.includes(p) && BUNDLED.some((r) => r.test(p)));
  return { kind: native.length ? "build" : bundled.length ? "ota" : "none", native, bundled };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const base = process.argv[2] || "origin/main";
  const paths = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" }).split("\n").filter(Boolean);
  const r = classify(paths);
  const label = { build: "NEEDS A NEW BUILD", ota: "OTA-SAFE (JavaScript / assets only)", none: "no app change" }[r.kind];
  console.log(label);
  if (r.native.length) console.log("native:\n  " + r.native.join("\n  "));
  if (r.bundled.length) console.log(`bundled (${r.bundled.length} files)`);
  process.exit(0);
}
