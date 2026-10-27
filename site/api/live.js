// GET /api/live -> {asOf, source, matches[]}. ESPN public cricket JSON, cached ~15 s.
// Only matches the books price (player props, event markets, or fancy). Empty ESPN games are dropped.
// When ESPN leaves scores blank, the CREX match page (max-age 10 s, robots Allow) fills them in.
// Full batting/bowling tables come from ESPN's summary or the CREX match-scorecard page (getSC4).
// The schedule page is only used for match URLs (it is cached ~5 min). We never hit crex.com/api.
// "So far" numbers only — the site never settles a prop from this feed.
import { attachCrexUrls, bookFixtures, buildLive, crexScorecardUrl, hasCard, LIVE_TTL_MS, overlayCrex, parseCrexLive, parseCrexSchedule, parseCrexScorecard, parseHeader, pricedLive, wantsCard } from "../src/engine/live.js";

const HEADER = "https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket";
const BOOKS = "https://raw.githubusercontent.com/dheerajgoel17/cricket-data/main/value_bets/out/book_lines.json";
const CREX = "https://crex.com/schedule";
const summaryUrl = (leagueId, eventId) => `https://site.web.api.espn.com/apis/site/v2/sports/cricket/${encodeURIComponent(leagueId)}/summary?event=${encodeURIComponent(eventId)}`;
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
    const [header, booksDoc, crexHtml] = await Promise.all([
      getJson(HEADER),
      getJson(BOOKS).catch(() => ({})),
      getHtml(CREX).catch(() => ""),
    ]);
    const books = bookFixtures(booksDoc);
    const crex = parseCrexSchedule(crexHtml);
    const priced = attachCrexUrls(pricedLive(parseHeader(header), books), crex);
    const live = priced.filter(wantsCard).slice(0, MAX_CARDS);
    const scored = (m) => (m.teams || []).some((t) => t.display);
    const summaries = {};
    await Promise.allSettled(live.filter((m) => m.leagueId && scored(m)).map(async (m) => { summaries[m.id] = await getJson(summaryUrl(m.leagueId, m.id)); }));
    const body = buildLive(header, summaries, new Date().toISOString());
    body.matches = attachCrexUrls(pricedLive(body.matches, books), crex);
    const needCrex = body.matches.filter((m) => wantsCard(m) && m.url && (!scored(m) || !(m.players || []).length || !hasCard(m))).slice(0, MAX_CARDS);
    const extra = {};
    await Promise.allSettled(needCrex.map(async (m) => {
      const [liveHtml, cardHtml] = await Promise.all([
        !scored(m) || !(m.players || []).length ? getHtml(m.url).catch(() => "") : Promise.resolve(""),
        !hasCard(m) ? getHtml(crexScorecardUrl(m.url)).catch(() => "") : Promise.resolve(""),
      ]);
      const bits = [];
      if (liveHtml) { const x = parseCrexLive(liveHtml); if (x) bits.push(x); }
      if (cardHtml) { const x = parseCrexScorecard(cardHtml); if (x) bits.push({ ...x, teams: m.teams, start: m.start }); }
      if (bits.length) extra[m.id] = bits.reduce((row, bit) => overlayCrex([row], [bit])[0], m);
    }));
    body.matches = body.matches.map((m) => extra[m.id] || m);
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
    return res.status(502).json({ error: msg, asOf: new Date().toISOString(), source: "espn", matches: [] });
  }
}
