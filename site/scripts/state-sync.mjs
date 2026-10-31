// Writes the match-state table: reads the live feed the way api/live does (same source pages, same status rules), upserts one row per match and settles the
// phase of rows the feed no longer lists. Run by .github/workflows/state-sync.yml every few minutes. Needs LIVE_SOURCE_BASE, SUPABASE_URL and SUPABASE_SERVICE_KEY (secrets: never printed).
import { settlePhase, stateRow } from "@cricket/engine/state.js";

const headers = (key) => ({ apikey: key, "Content-Type": "application/json", "User-Agent": "cricket-props-hub-state/0.1 (server)", ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }) });

/** The live feed's matches, by running the same handler the site serves (no wrap key set: plain JSON). */
export async function readFeed(handler) {
  let body = null, status = 0;
  const res = { setHeader() {}, status(c) { status = c; return res; }, json(o) { body = o; return res; } };
  await handler({ method: "GET" }, res);
  if (status !== 200 || !Array.isArray(body?.matches)) throw new Error(`live feed unavailable (${status || "no response"})`);
  return body.matches;
}

/**
 * Upsert the feed's rows, then settle every row the feed did not list this time (a match that has dropped off the source's pages stays in play for its keep window,
 * then becomes final). `fetchImpl` is injectable for tests. Returns counts.
 */
export async function syncState({ matches, base, key, now = Date.now(), fetchImpl = fetch }) {
  const rows = matches.map(stateRow).filter(Boolean);
  const call = async (method, path, body, extra = {}) => {
    const r = await fetchImpl(`${base}/rest/v1/${path}`, { method, headers: { ...headers(key), ...extra }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) throw new Error(`${method} ${path.split("?")[0]} -> HTTP ${r.status}`);
    return r.status === 204 || method !== "GET" ? null : r.json();
  };
  const stamp = new Date(now).toISOString();
  if (rows.length) await call("POST", "match_state?on_conflict=match_key", rows.map((r) => ({ ...r, updated_at: stamp })), { Prefer: "resolution=merge-duplicates,return=minimal" });
  const seen = new Set(rows.map((r) => r.match_key));
  // rows not final yet and not in this feed: settle by the clock
  const open = (await call("GET", "match_state?select=match_key,phase,start_utc,fmt&phase=neq.final&limit=1000")) || [];
  let settled = 0;
  for (const r of open) {
    if (seen.has(r.match_key)) continue;
    const phase = settlePhase(r, now);
    if (phase !== r.phase) { await call("PATCH", `match_state?match_key=eq.${encodeURIComponent(r.match_key)}`, { phase, updated_at: stamp }, { Prefer: "return=minimal" }); settled += 1; }
  }
  return { listed: rows.length, settled };
}

async function main() {
  const base = String(process.env.SUPABASE_URL || "").replace(/\/+$/, ""), key = String(process.env.SUPABASE_SERVICE_KEY || "").trim();
  if (!base || !key || !process.env.LIVE_SOURCE_BASE) { console.log("state-sync: SUPABASE_URL / SUPABASE_SERVICE_KEY / LIVE_SOURCE_BASE not set, skipping"); return; }
  delete process.env.DATA_WRAP_KEY; // the writer wants the plain feed
  const { default: handler } = await import("../api/live.js");
  const matches = await readFeed(handler);
  console.log(JSON.stringify(await syncState({ matches, base, key })));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(`state-sync failed: ${e.message}`); process.exit(1); });
