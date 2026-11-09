// Keeps the latest in-play lines in Supabase while a match is on. A GitHub run (the scheduler Worker starts it every minute, .github/workflows/inplay.yml) reads the price feed a few times,
// about 15 s apart, and each time replaces the one row of `inplay_lines` (service key; api/inplay.js reads it with the public key). Nothing is kept and nothing touches the pre-match files.
// INPLAY_EXTRA_FILE, when set, holds the other books' started matches for the minute (written once by scripts/inplay_extra.py) and is merged into every round.
// Needs PRICE_FEED_URL, SUPABASE_URL and SUPABASE_SERVICE_KEY in the environment (never printed). With nothing in play it writes one empty body and stops, so a quiet minute is a short run.
import { readFileSync } from "node:fs";
import { mergeMatches, parseInplayFeed } from "../packages/engine/inplay-lines.js";

const UA = "Mozilla/5.0 (compatible; cricket-props-hub/0.2; +https://github.com/dheerajgoel17/cricket-data)";
// Supabase refuses a secret key from anything that looks like a browser ("Forbidden use of secret API key in browser"), so its calls carry a plain server agent, not the feed read's Mozilla one.
const DB_UA = "cricket-props-hub-inplay/0.1 (server)";
export const ROUNDS = 4, GAP_MS = 15_000;

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

/** The other books' started matches for the minute, or [] when the file is unset or unreadable. */
export function loadExtra(path, read = readFileSync) {
  if (!path) return [];
  try {
    const doc = JSON.parse(read(path, "utf8"));
    return Array.isArray(doc?.matches) ? doc.matches : [];
  } catch {
    return [];
  }
}

/** One read of the price feed with the other books' matches merged in. A feed failure keeps the other books' matches when there are any (and says so), else it is the round's failure. */
export async function readRound(url, extra, fetchImpl = fetch, log = console.log) {
  try {
    return mergeMatches(await readFeed(url, fetchImpl), extra);
  } catch (e) {
    if (!extra.length) throw e;
    log(`::warning::price feed read failed, keeping the other books' matches: ${String(e.message || e).slice(0, 120)}`);
    return mergeMatches(extra);
  }
}

/** One read of the feed, as the list of started matches with the lines we keep. */
export async function readFeed(url, fetchImpl = fetch) {
  const r = await fetchImpl(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`feed HTTP ${r.status}`);
  const doc = await r.json();
  return parseInplayFeed(Array.isArray(doc) ? doc[0] : doc);
}

/** What kind of key this is, never the key itself: a wrong secret is the usual reason a save is refused (same idea as assets_sync.describe_key). */
export function describeKey(key) {
  if (key.startsWith("sb_publishable_")) return "a publishable key (read-only: use the secret key)";
  if (key.startsWith("sb_secret_")) return `a secret key, length ${key.length}`;
  const parts = key.split(".");
  if (parts.length === 3) {
    try { const c = JSON.parse(Buffer.from(parts[1], "base64url").toString()); return `a JWT with role ${c.role}`; } catch { /* not a JWT after all */ }
  }
  return `an unrecognised key, length ${key.length}`;
}

/** Replaces the single row (id 1) with this body. */
export async function saveBody({ base, key, body, fetchImpl = fetch }) {
  const r = await fetchImpl(`${base}/rest/v1/inplay_lines?on_conflict=id`, {
    method: "POST", signal: AbortSignal.timeout(10_000),
    // a new-style secret key (sb_secret_...) goes only in `apikey`; a legacy service_role JWT also goes in Authorization (same rule as src/cricket_site/assets_sync.py)
    headers: { apikey: key, ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal", "User-Agent": DB_UA },
    body: JSON.stringify([{ id: 1, as_of: body.asOf, body }]),
  });
  if (!r.ok) throw new Error(`save HTTP ${r.status} ${String(await r.text().catch(() => "")).slice(0, 120)} (key: ${describeKey(key)})`.trim());
}

/**
 * `rounds` reads `gapMs` apart. A round with nothing in play is written (so the row says "nothing on" and is fresh) and ends the run; a failed round is logged and the next one tries again.
 * Returns what it did: { reads, saved, failed, matches } (the last count of started matches).
 */
export async function run({ read, save, sleep = sleepMs, rounds = ROUNDS, gapMs = GAP_MS, now = () => new Date(), log = console.log }) {
  const out = { reads: 0, saved: 0, failed: 0, matches: 0 };
  for (let i = 0; i < rounds; i++) {
    if (i > 0) await sleep(gapMs);
    out.reads++;
    try {
      const matches = await read();
      await save({ asOf: now().toISOString(), source: "inplay", matches });
      out.saved++;
      out.matches = matches.length;
      if (!matches.length) break; // nothing on: no point reading again this minute
    } catch (e) {
      out.failed++;
      log(`::warning::in-play round ${i + 1} failed: ${String(e.message || e).slice(0, 120)}`);
    }
  }
  return out;
}

async function main() {
  const url = String(process.env.PRICE_FEED_URL || ""), base = String(process.env.SUPABASE_URL || "").replace(/\/+$/, ""), key = String(process.env.SUPABASE_SERVICE_KEY || "").trim();
  if (!url || !base || !key) { console.log("inplay-snapshot: PRICE_FEED_URL / SUPABASE_URL / SUPABASE_SERVICE_KEY not set, skipping"); return; }
  const extra = loadExtra(process.env.INPLAY_EXTRA_FILE || "");
  const out = await run({ read: () => readRound(url, extra), save: (body) => saveBody({ base, key, body }) });
  console.log(JSON.stringify(out));
}

if (import.meta.url === `file://${process.argv[1]}`) main().then(() => process.exit(0), (e) => { console.error(`inplay-snapshot failed: ${e.message}`); process.exit(1); });
