#!/usr/bin/env node
// One-shot: put FEEDI_URL's hostname into RELAY_ALLOW_FEEDI on the Cloudflare Worker.
// Usage (from relay/, wrangler logged in, FEEDI_URL in the env — never commit the host):
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
console.log("Worker RELAY_ALLOW_FEEDI updated.");
