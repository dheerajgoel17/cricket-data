// By-hand run of the match-state writer (the scheduled one is the Cloudflare Worker in state/). Reads the live feed with the same code the site uses and writes the table through
// apply_match_state. Needs LIVE_SOURCE_BASE, SUPABASE_URL, SUPABASE_ANON_KEY and STATE_WRITE_TOKEN in the environment (never printed).
import { createFeed } from "@cricket/engine/feed.js";
import { syncState } from "@cricket/engine/state-sync.js";

export { syncState };

/** The live feed's matches, by running the same handler the site serves (no wrap key set: plain JSON). */
export async function readFeed(handler) {
  let body = null, status = 0;
  const res = { setHeader() {}, status(c) { status = c; return res; }, json(o) { body = o; return res; } };
  await handler({ method: "GET" }, res);
  if (status !== 200 || !Array.isArray(body?.matches)) throw new Error(`live feed unavailable (${status || "no response"})`);
  return body.matches;
}

async function main() {
  const base = String(process.env.SUPABASE_URL || "").replace(/\/+$/, ""), key = String(process.env.SUPABASE_ANON_KEY || "").trim(), token = String(process.env.STATE_WRITE_TOKEN || "").trim();
  if (!base || !key || !token || !process.env.LIVE_SOURCE_BASE) { console.log("state-sync: SUPABASE_URL / SUPABASE_ANON_KEY / STATE_WRITE_TOKEN / LIVE_SOURCE_BASE not set, skipping"); return; }
  delete process.env.DATA_WRAP_KEY; // the writer wants the plain feed
  const { default: handler } = await import("../api/live.js");
  const matches = await readFeed(handler);
  console.log(JSON.stringify(await syncState({ matches, base, key, token })));
}

if (import.meta.url === `file://${process.argv[1]}`) main().then(() => process.exit(0), (e) => { console.error(`state-sync failed: ${e.message}`); process.exit(1); });
void createFeed;
