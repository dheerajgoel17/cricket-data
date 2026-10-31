// The live feed as a function of its inputs, with no runtime in it (no fs, no process.env): `createFeed` is run by the Vercel function api/live.js (every request, cached
// ~15 s) and by the Cloudflare Worker that writes the match-state table (every minute). Both read the same source pages with the same rules, so they agree.
import { bookFixtures, buildMatch, cardFetchList, cardPageUrl, keepGapRow, LIVE_TTL_MS, mergeSchedule, parseFixtureCsv, parseMatchPage, parseSchedule, parseCardPage, pricedLive, settleLines, unlistedRows } from "./live.js";

export const BOOKS_URL = "https://raw.githubusercontent.com/dheerajgoel17/cricket-data/main/value_bets/out/book_lines.json";
export const SCHEDULE_URL = "https://raw.githubusercontent.com/dheerajgoel17/cricket-data/main/data/fixtures/upcoming.csv"; // our own schedule: the match pages of games the source's schedule no longer list
const MAX_CARDS = 12;
const FINAL_TTL_MS = 10 * 60e3; // a finished match does not change: its pages are read once in ten minutes, not every 15 seconds

/**
 * `base()` is the source's address (throws when it is not configured); `getJson` / `getText` / `getHtml` fetch a URL (and throw on a bad status); `loadIdentity()` gives the
 * player-identity index (a function, because where the table lives differs by runtime). Returns `snapshot()`: the body of /api/live, cached for LIVE_TTL_MS, one read in flight at a time.
 */
export function createFeed({ base, getJson, getText, getHtml, loadIdentity, now = () => Date.now(), booksUrl = BOOKS_URL, scheduleUrl = SCHEDULE_URL }) {
  let inflight = null;
  const finals = new Map(); // match page URL -> { t, pages }
  let memo = { t: 0, body: null };

  async function snapshot() {
    const t0 = now();
    if (memo.body && t0 - memo.t < LIVE_TTL_MS) return memo.body;
    if (inflight) return inflight;
    inflight = (async () => {
      const [booksDoc, homeHtml, schedule, ours, idn] = await Promise.all([
        getJson(booksUrl).catch(() => ({})),
        getHtml(`${base()}/`).catch(() => ""),
        getHtml(`${base()}/schedule`),
        getText(scheduleUrl).catch(() => ""),
        loadIdentity(),
      ]);
      const books = bookFixtures(booksDoc), listed = pricedLive(mergeSchedule(parseSchedule(homeHtml, base()), parseSchedule(schedule, base())), books);
      const gaps = unlistedRows(listed, books, parseFixtureCsv(ours), base());
      const rows = [...listed, ...gaps];
      const pages = new Map();
      await Promise.allSettled(cardFetchList(rows, MAX_CARDS).map(async (m) => {
        const kept = finals.get(m.url);
        if (kept && now() - kept.t < FINAL_TTL_MS) return void pages.set(m, kept.pages);
        const [live, card] = await Promise.all([getHtml(m.url).catch(() => ""), getHtml(cardPageUrl(m.url)).catch(() => "")]);
        const got = { live: parseMatchPage(live), card: parseCardPage(card) };
        pages.set(m, got);
        if (got.live && (got.live.status === "final" || m.status === "final")) finals.set(m.url, { t: now(), pages: got });
      }));
      // the public body names no source: match URLs stay on the server. A match the schedule no longer lists is kept when its own page was read, or while it is still live,
      // and each match carries where its priced lines stand (the books' player lines, settled with the identity table)
      const matches = rows.filter((m) => !gaps.includes(m) || keepGapRow(m, pages.get(m)?.live)).map((m) => { const { url, ...pub } = pages.has(m) ? buildMatch(m, pages.get(m).live, pages.get(m).card) : m; return { ...pub, lines: settleLines(pub, booksDoc.lines, idn) }; });
      const body = { asOf: new Date().toISOString(), source: "live", delaySec: LIVE_TTL_MS / 1000, linked: idn.size, matches };
      memo = { t: now(), body };
      return body;
    })().finally(() => { inflight = null; });
    return inflight;
  }

  return { snapshot, last: () => memo.body };
}
