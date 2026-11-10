// Appends in-play lines to the Supabase table `inplay_log` (supabase/migrations/20261110_inplay_log.sql), for later statistical grading. Called by inplay-snapshot.mjs after each round when INPLAY_LOG=1.
// DATA ONLY: settlement, the archive and the site never read it, and nothing here updates or deletes a row. A line is written when it first appears or its price moves (engine/inplay-log.js),
// with the score at that moment read from the site's own /api/live (SITE_URL, the same ~15 s cached body everyone reads: no second source, no new service).
// A failure here is a warning, never a failed snapshot. The log's service key and the site's address come from the environment and are never printed.
import { createState, ingest, pairsToLoad, planRound } from "../packages/engine/inplay-log.js";
import { unwrap } from "../packages/engine/wrap.js";

const UA = "Mozilla/5.0 (compatible; cricket-props-hub/0.2; +https://github.com/dheerajgoel17/cricket-data)";
// Supabase refuses a secret key from anything that looks like a browser, so its calls carry a plain server agent.
export const DB_UA = "cricket-props-hub-inplay/0.1 (server)";
/** Rows per insert request, the page size of the read-back, how far back the read-back looks (a Test is on for up to 6 days), and the most pages it reads. */
export const BATCH = 400, PAGE = 1000, LOOKBACK_MS = 7 * 864e5, MAX_PAGES = 60;

/** Headers for a service-key call: a new-style secret key (sb_secret_...) goes only in `apikey`; a legacy service_role JWT also goes in Authorization. */
export const dbHeaders = (key) => ({ apikey: key, ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }), "Content-Type": "application/json", "User-Agent": DB_UA });

const fail = async (what, r) => new Error(`${what} HTTP ${r.status} ${String(await r.text().catch(() => "")).slice(0, 120)}`.trim());

/** The site's live scores (`/api/live`), unwrapped when DATA_WRAP_KEY is set. */
export async function readScores({ siteUrl, wrapKey = "", fetchImpl = fetch }) {
  const r = await fetchImpl(`${siteUrl.replace(/\/+$/, "")}/api/live`, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
  if (!r.ok) throw await fail("live scores", r);
  const doc = await unwrap(await r.json(), wrapKey);
  if (!Array.isArray(doc?.matches)) throw new Error("live scores: no matches list (a wrapped body needs DATA_WRAP_KEY)");
  return doc;
}

/** The latest logged value of every line of these sides since `since`, read back so a repeated read writes nothing. Pages until an empty page; more pages than MAX_PAGES is an error, not a partial answer. */
export async function loadLatest({ base, key, pairs, since, fetchImpl = fetch }) {
  const out = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await fetchImpl(`${base}/rest/v1/rpc/inplay_log_latest?limit=${PAGE}&offset=${page * PAGE}`, { method: "POST", headers: dbHeaders(key), body: JSON.stringify({ p_pairs: pairs, p_since: since }), signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw await fail("log read-back", r);
    const rows = await r.json();
    if (!Array.isArray(rows)) throw new Error("log read-back: not a list");
    if (!rows.length) return out;
    out.push(...rows);
  }
  throw new Error(`log read-back: more than ${MAX_PAGES * PAGE} lines`);
}

/** Inserts rows in batches (insert only: a row already there, same match, line and time, is left alone). Returns how many went in; a failed batch throws after the earlier ones were written, with `written` on the error. */
export async function insertRows({ base, key, rows, fetchImpl = fetch }) {
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const part = rows.slice(i, i + BATCH);
    const r = await fetchImpl(`${base}/rest/v1/inplay_log?on_conflict=match_key,line_key,at`, { method: "POST", headers: { ...dbHeaders(key), Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(part), signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw Object.assign(await fail("log insert", r), { written });
    written += part.length;
  }
  return written;
}

/**
 * The per-round writer: `record(matches, at)` with the round's started matches (as the snapshot read them). Reads each pair's latest values back once per run, reads the live scores once per round,
 * and inserts what changed. Returns `{ rows, unchanged, skipped }` (skipped: matches left alone this round because the read-back failed).
 */
export function createLogger({ base, key, siteUrl = "", wrapKey = "", fetchImpl = fetch, now = () => Date.now(), log = console.log, load = loadLatest, append = insertRows }) {
  const state = createState();
  const warn = (what, e) => log(`::warning::in-play log: ${what}: ${String(e?.message || e).slice(0, 140)}`);
  return async function record(matches, at) {
    const out = { rows: 0, unchanged: 0, skipped: 0 };
    if (!matches.length) return out;
    const need = pairsToLoad(state, matches);
    if (need.length) {
      try { ingest(state, need, await load({ base, key, pairs: need, since: new Date(now() - LOOKBACK_MS).toISOString(), fetchImpl })); } catch (e) { warn("read-back failed, nothing logged for these matches this round", e); }
    }
    let liveDoc = null;
    if (siteUrl) { try { liveDoc = await readScores({ siteUrl, wrapKey, fetchImpl }); } catch (e) { warn("live scores unavailable, rows carry no score", e); } }
    const plan = planRound(state, matches, liveDoc, at);
    out.unchanged = plan.unchanged;
    out.skipped = plan.skipped;
    if (plan.rows.length) {
      try { out.rows = await append({ base, key, rows: plan.rows, fetchImpl }); plan.commit(out.rows); } catch (e) { out.rows = e.written || 0; plan.commit(out.rows); warn("insert failed, will retry the rest next round", e); }
    }
    plan.listed();
    return out;
  };
}
