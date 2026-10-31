// GET /api/live -> {asOf, source, matches[]} (wrapped with DATA_WRAP_KEY when set). Source A only, cached ~15 s.
// The source's home list still shows a Test at stumps after the schedule page (live and upcoming only, cached ~5 min) has dropped it; both pages give match URLs and scores. Only matches the books price are kept.
// A finished match drops off those pages soon after the end; a priced one that began in the keep window (24 h, 6 days for a Test, including close of play) is then read from its own match page (the path is in our schedule file).
// For live ones (and ones about to start) the match page (max-age 10 s) adds fresh scores, the current pair, partnership and run rates,
// and the match-scorecard page (getSC4) adds every innings. All three are HTML pages ($LIVE_SOURCE_BASE robots Allow); we never hit $LIVE_SOURCE_BASE/api.
// Each match also carries `lines`: where every line the books priced for it stands (value, state, Cleared / Missed / Push, Not in XI), settled here with the identity table
// so the browser does no matching of its own. While a match is on that is "so far"; a "final" state in a finished match is its result (the archive job stores those).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { LIVE_TTL_MS } from "@cricket/engine/live.js";
import { createFeed } from "@cricket/engine/feed.js";
import { identityIndex, NO_IDENTITY } from "@cricket/engine/identity.js";
import { wire } from "@cricket/engine/wrap.js";

// Where the pages live is configuration, not code: LIVE_SOURCE_BASE (no trailing slash) comes from the deployment's environment variables.
const base = () => {
  const b = String(process.env.LIVE_SOURCE_BASE || "").replace(/\/+$/, "");
  if (!b) throw new Error("LIVE_SOURCE_BASE is not set");
  return b;
};
const UA = "Mozilla/5.0 (compatible; cricket-props-hub/0.2; +https://github.com/dheerajgoel17/cricket-data)";
const HTML_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FETCH_MS = 8000;
const IDENTITY_FILE = "public/data/identity.json"; // the player-identity table of this deployment, shipped with the function (vercel.json includeFiles)
const IDENTITY_TTL_MS = 30 * 60e3;
const IDENTITY_RETRY_MS = 60e3;

let identity = { t: 0, ttl: 0, idx: NO_IDENTITY };

async function getJson(url) {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(FETCH_MS) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function getText(url) {
  const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(FETCH_MS) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

async function getHtml(url) {
  const r = await fetch(url, { headers: { "user-agent": HTML_UA, accept: "text/html" }, signal: AbortSignal.timeout(FETCH_MS) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

/**
 * The player-identity table (our id <-> the source's id, the names the books use), from the file shipped with this deployment, else from IDENTITY_URL or the site's own
 * production domain. Without it names decide, as before: a missing table costs matches, never a wrong number.
 */
async function loadIdentity() {
  if (Date.now() - identity.t < identity.ttl) return identity.idx;
  let doc = await readFile(join(process.cwd(), IDENTITY_FILE), "utf8").then(JSON.parse).catch(() => null);
  const url = process.env.IDENTITY_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/data/identity.json` : "");
  if (!doc && url) doc = await getJson(url).catch(() => null);
  const idx = identityIndex(doc);
  identity = { t: Date.now(), ttl: idx.size ? IDENTITY_TTL_MS : IDENTITY_RETRY_MS, idx };
  return idx;
}

const feed = createFeed({ base, getJson, getText, getHtml, loadIdentity });
const snapshot = () => feed.snapshot();

async function send(res, status, body) {
  const out = await wire(body, process.env.DATA_WRAP_KEY);
  return res.status(status).json(out);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", `public, s-maxage=${LIVE_TTL_MS / 1000}, stale-while-revalidate=45`);
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  try {
    return send(res, 200, await snapshot());
  } catch (e) {
    if (feed.last()) return send(res, 200, { ...feed.last(), stale: true });
    const msg = e.name === "TimeoutError" ? "timeout" : String(e.message || "unavailable").slice(0, 80);
    return send(res, 502, { error: msg, asOf: new Date().toISOString(), source: "live", matches: [] });
  }
}
