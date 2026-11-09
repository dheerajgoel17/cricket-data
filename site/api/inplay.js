// GET /api/inplay -> {asOf, source: "inplay", matches[]} (wrapped with DATA_WRAP_KEY when set), cached ~15 s with one read in flight at a time.
// The in-play lines the price feed lists for matches that have started (player innings runs, a side's innings total). A GitHub run keeps the latest copy in Supabase while a match is on
// (scripts/inplay-snapshot.mjs, started every minute by the scheduler Worker); this route only reads that row with the project's public key, so the feed's address never leaves GitHub.
// A copy older than STALE_MS is not shown (an old price is worse than none), and without SUPABASE_URL / SUPABASE_ANON_KEY the list is empty. Nothing is stored here or in the pre-match files.
import { LIVE_TTL_MS } from "@cricket/engine/live.js";
import { wire } from "@cricket/engine/wrap.js";

const UA = "cricket-props-hub-inplay/0.1 (server)";
const FETCH_MS = 6000;
/** A snapshot is written about every 15 s while a match is on; past this it is a dead writer, not a live price. */
export const STALE_MS = 90_000;

let last = null, inflight = null;
const empty = (extra = {}) => ({ asOf: new Date().toISOString(), source: "inplay", matches: [], ...extra });

/** The row as the route serves it: its matches while fresh, an empty list when the copy is stale or missing. */
export function fromRow(row, now = Date.now()) {
  const at = Date.parse(row?.as_of || "");
  if (!Number.isFinite(at) || now - at > STALE_MS || !Array.isArray(row?.body?.matches)) return empty();
  return { asOf: new Date(at).toISOString(), source: "inplay", matches: row.body.matches };
}

async function readRow(now) {
  const base = String(process.env.SUPABASE_URL || "").replace(/\/+$/, ""), key = String(process.env.SUPABASE_ANON_KEY || "").trim();
  if (!base || !key) return empty();
  const r = await fetch(`${base}/rest/v1/inplay_lines?select=as_of,body&id=eq.1`, { headers: { apikey: key, Accept: "application/json", "User-Agent": UA }, signal: AbortSignal.timeout(FETCH_MS) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return fromRow((await r.json())[0], now);
}

/** One read at a time and a body no older than the cache window: a burst of viewers is one request to Supabase. */
export async function snapshot(now = Date.now()) {
  if (last && now - last.t < LIVE_TTL_MS) return last.body;
  inflight ||= readRow(now).then((body) => { last = { t: now, body }; return body; }).finally(() => { inflight = null; });
  return inflight;
}
export const lastBody = () => last?.body || null;

async function send(res, status, body) {
  return res.status(status).json(await wire(body, process.env.DATA_WRAP_KEY));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", `public, s-maxage=${LIVE_TTL_MS / 1000}, stale-while-revalidate=45`);
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  try {
    return await send(res, 200, await snapshot());
  } catch (e) {
    if (lastBody()) return send(res, 200, { ...lastBody(), stale: true });
    const msg = e.name === "TimeoutError" ? "timeout" : String(e.message || "unavailable").slice(0, 80);
    return send(res, 502, empty({ error: msg }));
  }
}
