// Keeps the latest in-play lines in Supabase while a match is on. A GitHub run (the scheduler Worker starts it every minute, .github/workflows/inplay.yml) reads the price feed a few times,
// about 15 s apart, and each time replaces the one row of `inplay_lines` (service key; api/inplay.js reads it with the public key). Nothing is kept and nothing touches the pre-match files.
// INPLAY_EXTRA_FILE, when set, holds the other books' started matches for the minute (written once by scripts/inplay_extra.py) and is merged into every round.
// Needs PRICE_FEED_URL, SUPABASE_URL and SUPABASE_SERVICE_KEY in the environment (never printed). With nothing in play it writes one empty body and stops, so a quiet minute is a short run.
// INPLAY_LOG=storage archives changes as compressed files; INPLAY_LOG=1 selects the SQL log.
import { readFileSync } from "node:fs";
import { mergeMatches, parseInplayFeed, stampFirst } from "../packages/engine/inplay-lines.js";
import { historyStorage } from "./inplay-storage.mjs";
import { createLogger, dbHeaders } from "./inplay-log.mjs";

const UA = "Mozilla/5.0 (compatible; cricket-props-hub/0.2; +https://github.com/dheerajgoel17/cricket-data)";
// Supabase refuses a secret key from anything that looks like a browser ("Forbidden use of secret API key in browser"), so its calls carry a plain server agent (DB_UA), not the feed read's Mozilla one.
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
    headers: { ...dbHeaders(key), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ id: 1, as_of: body.asOf, body }]),
  });
  if (!r.ok) throw new Error(`save HTTP ${r.status} ${String(await r.text().catch(() => "")).slice(0, 120)} (key: ${describeKey(key)})`.trim());
}

/** The first-seen lines the last run kept in the row (`body.firsts`), or {} when there is none or it cannot be read: a failure only loses "first line" for lines already live, never a round. */
export async function loadFirsts({ base, key, fetchImpl = fetch }) {
  try {
    const r = await fetchImpl(`${base}/rest/v1/inplay_lines?select=body&id=eq.1`, { headers: dbHeaders(key), signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return {};
    const f = (await r.json())?.[0]?.body?.firsts;
    return f && typeof f === "object" && !Array.isArray(f) ? f : {};
  } catch {
    return {};
  }
}

/**
 * `rounds` reads `gapMs` apart. A round with nothing in play is written (so the row says "nothing on" and is fresh) and ends the run; a failed round is logged and the next one tries again.
 * `record(matches, at)`, when given, appends the round to the log after the row is saved; it runs while the next gap is slept, and a failure in it is a warning, never a failed round.
 * `firsts` is what the last run remembered of where each live batter's / side's line first stood (`stampFirst`): every round stamps it on the lines (`first`) and keeps it in the row, so a line that opened in play, with no pre-match line, still has its first value however far it has moved.
 * Returns what it did: { reads, saved, failed, matches } (the last count of started matches), plus { logged, unchanged } with a log.
 */
export async function run({ read, save, record = null, sleep = sleepMs, rounds = ROUNDS, gapMs = GAP_MS, now = () => new Date(), log = console.log, firsts: firsts0 = {} }) {
  const out = { reads: 0, saved: 0, failed: 0, matches: 0, ...(record ? { logged: 0, unchanged: 0 } : {}) };
  let logging = Promise.resolve(), firsts = firsts0;
  const logRound = (matches, at) => record(matches, at).then((r) => { out.logged += r.rows; out.unchanged += r.unchanged; }, (e) => log(`::warning::in-play log failed: ${String(e.message || e).slice(0, 120)}`));
  for (let i = 0; i < rounds; i++) {
    if (i > 0) await Promise.all([sleep(gapMs), logging]);
    else await logging;
    out.reads++;
    try {
      const matches = await read(), at = now().toISOString(), stamped = stampFirst(matches, firsts, Date.parse(at));
      await save({ asOf: at, source: "inplay", matches: stamped.matches, firsts: stamped.firsts });
      firsts = stamped.firsts;
      out.saved++;
      out.matches = matches.length;
      if (record && matches.length) logging = logRound(matches, at);
      if (!matches.length) break; // nothing on: no point reading again this minute
    } catch (e) {
      out.failed++;
      log(`::warning::in-play round ${i + 1} failed: ${String(e.message || e).slice(0, 120)}`);
    }
  }
  await logging;
  return out;
}

async function main() {
  const url = String(process.env.PRICE_FEED_URL || ""), base = String(process.env.SUPABASE_URL || "").replace(/\/+$/, ""), key = String(process.env.SUPABASE_SERVICE_KEY || "").trim();
  if (!url || !base || !key) { console.log("inplay-snapshot: PRICE_FEED_URL / SUPABASE_URL / SUPABASE_SERVICE_KEY not set, skipping"); return; }
  const extra = loadExtra(process.env.INPLAY_EXTRA_FILE || "");
  // Enable the file archive with INPLAY_LOG=storage after applying the bucket migration.
  const storage = process.env.INPLAY_LOG === "storage" ? historyStorage({ base, key }) : null;
  const record = storage || process.env.INPLAY_LOG === "1" ? createLogger({ base, key, load: storage?.load, append: storage?.append, siteUrl: String(process.env.SITE_URL || ""), wrapKey: String(process.env.DATA_WRAP_KEY || "").trim() }) : null;
  const out = await run({ read: () => readRound(url, extra), save: (body) => saveBody({ base, key, body }), record, firsts: await loadFirsts({ base, key }) });
  console.log(JSON.stringify(out));
}

if (import.meta.url === `file://${process.argv[1]}`) main().then(() => process.exit(0), (e) => { console.error(`inplay-snapshot failed: ${e.message}`); process.exit(1); });
