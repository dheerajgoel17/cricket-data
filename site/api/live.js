// GET /api/live -> {asOf, source, matches[]}. CREX only, cached ~15 s.
// The schedule page lists live and upcoming games with their match URLs and scores (CREX caches it ~5 min); only matches the books price are kept.
// For live ones (and ones about to start) the match page (max-age 10 s) adds fresh scores, the current pair, partnership and run rates,
// and the match-scorecard page (getSC4) adds every innings. All three are HTML pages (crex.com robots Allow); we never hit crex.com/api.
// "So far" numbers only — the site never settles a prop from this feed.
import { bookFixtures, crexMatch, crexScorecardUrl, LIVE_TTL_MS, parseCrexLive, parseCrexSchedule, parseCrexScorecard, pricedLive, wantsCard } from "../src/engine/live.js";

const BOOKS = "https://raw.githubusercontent.com/dheerajgoel17/cricket-data/main/value_bets/out/book_lines.json";
const CREX = "https://crex.com/schedule";
const UA = "Mozilla/5.0 (compatible; cricket-props-hub/0.2; +https://github.com/dheerajgoel17/cricket-data)";
const HTML_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const MAX_CARDS = 8;
const FETCH_MS = 8000;

let inflight = null;
let memo = { t: 0, body: null };

async function getJson(url) {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(FETCH_MS) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function getHtml(url) {
  const r = await fetch(url, { headers: { "user-agent": HTML_UA, accept: "text/html" }, signal: AbortSignal.timeout(FETCH_MS) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

async function snapshot() {
  const now = Date.now();
  if (memo.body && now - memo.t < LIVE_TTL_MS) return memo.body;
  if (inflight) return inflight;
  inflight = (async () => {
    const [booksDoc, schedule] = await Promise.all([getJson(BOOKS).catch(() => ({})), getHtml(CREX)]);
    const rows = pricedLive(parseCrexSchedule(schedule), bookFixtures(booksDoc));
    const pages = new Map();
    await Promise.allSettled(rows.filter((m) => m.url && wantsCard(m)).slice(0, MAX_CARDS).map(async (m) => {
      const [live, card] = await Promise.all([getHtml(m.url).catch(() => ""), getHtml(crexScorecardUrl(m.url)).catch(() => "")]);
      pages.set(m, { live: parseCrexLive(live), card: parseCrexScorecard(card) });
    }));
    const body = { asOf: new Date().toISOString(), source: "crex", delaySec: LIVE_TTL_MS / 1000, matches: rows.map((m) => (pages.has(m) ? crexMatch(m, pages.get(m).live, pages.get(m).card) : m)) };
    memo = { t: Date.now(), body };
    return body;
  })().finally(() => { inflight = null; });
  return inflight;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", `public, s-maxage=${LIVE_TTL_MS / 1000}, stale-while-revalidate=45`);
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  try {
    return res.status(200).json(await snapshot());
  } catch (e) {
    if (memo.body) return res.status(200).json({ ...memo.body, stale: true });
    const msg = e.name === "TimeoutError" ? "timeout" : String(e.message || "unavailable").slice(0, 80);
    return res.status(502).json({ error: msg, asOf: new Date().toISOString(), source: "crex", matches: [] });
  }
}
