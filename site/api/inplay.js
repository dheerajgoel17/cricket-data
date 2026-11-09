// GET /api/inplay -> {asOf, source: "inplay", matches[]} (wrapped with DATA_WRAP_KEY when set), cached ~15 s with one fetch in flight at a time.
// The in-play lines the price feed lists for matches that have started (player innings runs, a side's innings total), as `parseInplayFeed` reads them. Nothing is stored:
// pre-match lines and the archive stay as the hourly pipeline writes them, an in-play price is only ever shown while it is live.
// Where the feed lives is configuration, not code: PRICE_FEED_URL comes from the deployment's environment variables; without it the body is an empty list.
import { LIVE_TTL_MS } from "@cricket/engine/live.js";
import { parseInplayFeed } from "@cricket/engine/inplay-lines.js";
import { wire } from "@cricket/engine/wrap.js";

const UA = "Mozilla/5.0 (compatible; cricket-props-hub/0.2; +https://github.com/dheerajgoel17/cricket-data)";
const FETCH_MS = 8000;

let last = null, inflight = null;

async function fetchFeed() {
  const url = String(process.env.PRICE_FEED_URL || "");
  if (!url) return { asOf: new Date().toISOString(), source: "inplay", matches: [] };
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(FETCH_MS) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const doc = await r.json();
  return { asOf: new Date().toISOString(), source: "inplay", matches: parseInplayFeed(Array.isArray(doc) ? doc[0] : doc) };
}

/** One fetch at a time and a body no older than the cache window: a burst of viewers is one request to the feed. */
export async function snapshot(now = Date.now()) {
  if (last && now - last.t < LIVE_TTL_MS) return last.body;
  inflight ||= fetchFeed().then((body) => { last = { t: now, body }; return body; }).finally(() => { inflight = null; });
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
    return send(res, 502, { error: msg, asOf: new Date().toISOString(), source: "inplay", matches: [] });
  }
}
