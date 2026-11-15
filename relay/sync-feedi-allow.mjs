#!/usr/bin/env node
// One-shot: put FEEDI_URL's hostname into RELAY_ALLOW_FEEDI on the Cloudflare Worker and (when linked) the Vercel bom1 project.
// Usage (from relay/, wrangler + vercel logged in, FEEDI_URL in the env — never commit the host):
//   FEEDI_URL='https://…' node sync-feedi-allow.mjs
import { spawnSync } from "node:child_process";

const api = (process.env.FEEDI_URL || "").trim();
let host;
try { host = new URL(api).hostname.toLowerCase(); } catch { host = ""; }
if (!host) {
  console.error("Set FEEDI_URL to the sportsbook root (https://…)");
  process.exit(1);
}
console.log(`Writing RELAY_ALLOW_FEEDI (1 host, labels=${host.split(".").length})…`);

const wr = spawnSync("npx", ["wrangler", "secret", "put", "RELAY_ALLOW_FEEDI"], {
  input: host, encoding: "utf8", stdio: ["pipe", "inherit", "inherit"],
});
if ((wr.status ?? 1) !== 0) process.exit(wr.status ?? 1);

const rm = spawnSync("npx", ["vercel", "env", "rm", "RELAY_ALLOW_FEEDI", "production", "-y", "--scope", "dheerajgoel1710s-projects"], {
  encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
});
void rm;
const add = spawnSync(
  "npx",
  ["vercel", "env", "add", "RELAY_ALLOW_FEEDI", "production", "--scope", "dheerajgoel1710s-projects", "--value", host, "--sensitive"],
  { encoding: "utf8", stdio: ["ignore", "inherit", "inherit"] },
);
if ((add.status ?? 1) !== 0) {
  // Older CLI: pipe value
  const add2 = spawnSync("npx", ["vercel", "env", "add", "RELAY_ALLOW_FEEDI", "production", "--scope", "dheerajgoel1710s-projects"], {
    input: host + "\n", encoding: "utf8", stdio: ["pipe", "inherit", "inherit"],
  });
  if ((add2.status ?? 1) !== 0) {
    console.error("Worker updated; Vercel RELAY_ALLOW_FEEDI failed — set it on feed-relay-5381 if needed.");
    process.exit(0); // Worker is enough for FEEDH_RELAY; Vercel is the alt hop
  }
}
console.log("Worker + Vercel Production RELAY_ALLOW_FEEDI updated.");
