#!/usr/bin/env node
// One-shot: put FEEDG_API's hostname into RELAY_ALLOW_FEEDG on the Cloudflare Worker and (when linked) the Vercel bom1 project.
// Usage (from relay/, wrangler + vercel logged in, FEEDG_API in the env — never commit the host):
//   FEEDG_API='https://…' node sync-feedg-allow.mjs
//   FEEDG_API='https://…' FEEDG_ODDS_HUBS='hub1.example,hub2.example' node sync-feedg-allow.mjs
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const api = (process.env.FEEDG_API || "").trim();
let host;
try { host = new URL(api).hostname.toLowerCase(); } catch { host = ""; }
if (!host) {
  console.error("Set FEEDG_API to the book API root (https://…)");
  process.exit(1);
}
const hubs = (process.env.FEEDG_ODDS_HUBS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const value = [...new Set([host, ...hubs])].join(",");
console.log(`Writing RELAY_ALLOW_FEEDG (${value.split(",").length} host(s), api labels=${host.split(".").length})…`);

const wr = spawnSync("npx", ["wrangler", "secret", "put", "RELAY_ALLOW_FEEDG"], {
  input: value, encoding: "utf8", stdio: ["pipe", "inherit", "inherit"],
});
if ((wr.status ?? 1) !== 0) process.exit(wr.status ?? 1);

// Vercel: add/update Production secret without printing the value.
const tmp = join(tmpdir(), `relay-allow-feedg-${process.pid}.txt`);
writeFileSync(tmp, value, "utf8");
try {
  const rm = spawnSync("npx", ["vercel", "env", "rm", "RELAY_ALLOW_FEEDG", "production", "-y"], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
  void rm;
  const add = spawnSync("npx", ["vercel", "env", "add", "RELAY_ALLOW_FEEDG", "production"], {
    input: value + "\n", encoding: "utf8", stdio: ["pipe", "inherit", "inherit"],
  });
  if ((add.status ?? 1) !== 0) {
    console.error("Worker updated; Vercel RELAY_ALLOW_FEEDG failed — set it in the Vercel dashboard if needed.");
    process.exit(add.status ?? 1);
  }
} finally {
  try { unlinkSync(tmp); } catch { /* ignore */ }
}
console.log("Worker + Vercel Production RELAY_ALLOW_FEEDG updated.");
