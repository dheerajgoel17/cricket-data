// Writing the match-state table (runtime-neutral: fetch only). The writer holds the project's PUBLIC key and a write token; the table can only be changed through the database
// function apply_match_state(token, upserts, phases), which checks the token's hash. Run by the Cloudflare Worker (every minute) and by scripts/state-sync.mjs (by hand).
import { settlePhase, stateRow } from "./state.js";

/**
 * Upsert the feed's rows, then settle every open row the feed did not list this time by the clock (in play for the keep window, then final), in ONE database call.
 * `fetchImpl` is injectable for tests. Returns { listed, settled, written }.
 */
export async function syncState({ matches, base, key, token, now = Date.now(), fetchImpl = fetch }) {
  const rows = matches.map(stateRow).filter(Boolean);
  const headers = { apikey: key, "Content-Type": "application/json", "User-Agent": "cricket-props-hub-state/0.2 (server)" };
  const get = await fetchImpl(`${base}/rest/v1/match_state?select=match_key,phase,start_utc,fmt&phase=neq.final&limit=1000`, { method: "GET", headers });
  if (!get.ok) throw new Error(`GET match_state -> HTTP ${get.status}`);
  const open = await get.json();
  const seen = new Set(rows.map((r) => r.match_key));
  const phases = [];
  for (const r of open) {
    if (seen.has(r.match_key)) continue;
    const phase = settlePhase(r, now);
    if (phase !== r.phase) phases.push({ match_key: r.match_key, phase });
  }
  const res = await fetchImpl(`${base}/rest/v1/rpc/apply_match_state`, { method: "POST", headers, body: JSON.stringify({ token, upserts: rows, phases }) });
  if (!res.ok) throw new Error(`apply_match_state -> HTTP ${res.status}`);
  const out = await res.json().catch(() => ({}));
  return { listed: rows.length, settled: phases.length, written: out.upserted ?? null };
}
