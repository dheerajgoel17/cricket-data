#!/usr/bin/env node
// One-shot: put FEEDG_API's hostname into the Worker secret RELAY_ALLOW_FEEDG (and optional odds-hub hosts).
// Usage (from relay/, with wrangler logged in and FEEDG_API in the env — never commit the host):
//   FEEDG_API='https://…' node sync-feedg-allow.mjs
//   FEEDG_API='https://…' FEEDG_ODDS_HUBS='hub1.example,hub2.example' node sync-feedg-allow.mjs
import { spawnSync } from "node:child_process";

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
const r = spawnSync("npx", ["wrangler", "secret", "put", "RELAY_ALLOW_FEEDG"], {
  input: value, encoding: "utf8", stdio: ["pipe", "inherit", "inherit"],
});
process.exit(r.status ?? 1);
