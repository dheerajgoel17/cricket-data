// GET /api/state -> {asOf, updatedAt, source: "state", matches[]}: the match-state table (one row, one phase per match) in the shape of /api/live's `matches[]`, so the
// browser finds a match with the same lookup. Written every few minutes by scripts/state-sync.mjs; read here with the project's public (anon) key. Without SUPABASE_URL and
// SUPABASE_ANON_KEY it answers 503 and the site keeps working the phase out itself, as before. Wrapped with DATA_WRAP_KEY when set, like the other feeds.
import { toLiveShape } from "@cricket/engine/state.js";
import { wire } from "@cricket/engine/wrap.js";

const TTL_S = 10;
const WINDOW_DAYS = 8; // matches that have started in the last week and a bit, plus everything still open
const UA = "cricket-props-hub-state/0.1 (server)";

async function send(res, status, body) {
  return res.status(status).json(await wire(body, process.env.DATA_WRAP_KEY));
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const base = String(process.env.SUPABASE_URL || "").replace(/\/+$/, ""), key = String(process.env.SUPABASE_ANON_KEY || "").trim();
  if (!base || !key) {
    res.setHeader("Cache-Control", "no-store");
    return send(res, 503, { error: "not configured", asOf: new Date().toISOString(), source: "state", matches: [] });
  }
  res.setHeader("Cache-Control", `public, s-maxage=${TTL_S}, stale-while-revalidate=30`);
  try {
    const since = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString();
    const q = new URLSearchParams({ select: "*", order: "start_utc.desc", limit: "500", or: `(phase.neq.final,start_utc.gte.${since})` });
    const r = await fetch(`${base}/rest/v1/match_state?${q}`, { headers: { apikey: key, Accept: "application/json", "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const rows = await r.json();
    const updatedAt = rows.reduce((m, x) => (x.updated_at > m ? x.updated_at : m), "");
    return send(res, 200, { asOf: new Date().toISOString(), updatedAt: updatedAt || null, source: "state", matches: rows.map(toLiveShape) });
  } catch (e) {
    return send(res, 502, { error: String(e.message || "unavailable").slice(0, 80), asOf: new Date().toISOString(), source: "state", matches: [] });
  }
}
