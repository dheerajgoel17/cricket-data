// Keeps the latest in-play lines in Supabase while a match is on. A GitHub run (the scheduler Worker starts it every minute, .github/workflows/inplay.yml) reads the price feed a few times,
// about 15 s apart, and each time replaces the one row of `inplay_lines` (service key; api/inplay.js reads it with the public key). Nothing is kept and nothing touches the pre-match files.
// Needs PRICE_FEED_URL, SUPABASE_URL and SUPABASE_SERVICE_KEY in the environment (never printed). With nothing in play it writes one empty body and stops, so a quiet minute is a short run.
// FEEDI_INPLAY_FILE, when set, is this book's live lines for the minute (written once by scripts/feedi_inplay.py) merged into every round.
import { readFileSync } from "node:fs";
import { mergeMatches, parseInplayFeed } from "../packages/engine/inplay-lines.js";

const UA = "Mozilla/5.0 (compatible; cricket-props-hub/0.2; +https://github.com/dheerajgoel17/cricket-data)";
export const ROUNDS = 4, GAP_MS = 15_000;

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

/** This book's live lines for the minute, or [] when the file is unset or unreadable. */
export function loadExtra(path, read = readFileSync) {
  if (!path) return [];
  try {
    const doc = JSON.parse(read(path, "utf8"));
    return Array.isArray(doc?.matches) ? doc.matches : [];
  } catch {
    return [];
  }
}

/** One read of the price feed, with this book's live lines merged in. A feed failure keeps the book's lines when it had any. */
export async function readRound(url, extra, fetchImpl = fetch, log = console.log) {
  try {
    return mergeMatches(await readFeed(url, fetchImpl), extra);
  } catch (e) {
    if (!extra.length) throw e;
    log(`::warning::price feed read failed, keeping this book's live lines: ${String(e.message || e).slice(0, 120)}`);
    return extra;
  }
}

/** One read of the feed, as the list of started matches with the lines we keep. */
export async function readFeed(url, fetchImpl = fetch) {
  const r = await fetchImpl(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`feed HTTP ${r.status}`);
  const doc = await r.json();
  return parseInplayFeed(Array.isArray(doc) ? doc[0] : doc);
}

/** Replaces the single row (id 1) with this body. */
export async function saveBody({ base, key, body, fetchImpl = fetch }) {
  const r = await fetchImpl(`${base}/rest/v1/inplay_lines?on_conflict=id`, {
    method: "POST", signal: AbortSignal.timeout(10_000),
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal", "User-Agent": UA },
    body: JSON.stringify([{ id: 1, as_of: body.asOf, body }]),
  });
  if (!r.ok) throw new Error(`save HTTP ${r.status}`);
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
  const extra = loadExtra(process.env.FEEDI_INPLAY_FILE || "");
  const out = await run({ read: () => readRound(url, extra), save: (body) => saveBody({ base, key, body }) });
  console.log(JSON.stringify(out));
}

if (import.meta.url === `file://${process.argv[1]}`) main().then(() => process.exit(0), (e) => { console.error(`inplay-snapshot failed: ${e.message}`); process.exit(1); });
