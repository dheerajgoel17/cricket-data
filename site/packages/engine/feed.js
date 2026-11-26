// The live feed as a function of its inputs, with no runtime in it (no fs, no process.env): `createFeed` is run by the Vercel function api/live.js (every request, cached
// ~15 s) and by the Cloudflare Worker that writes the match-state table (every minute). Both read the same source pages with the same rules, so they agree.
import { bookFixtures, buildMatch, cardFetchList, cardPageUrl, keepGapRow, LIVE_TTL_MS, mergeSchedule, parseFixtureCsv, parseMatchPage, parseSchedule, parseCardPage, pricedLive, settleLines, unlistedRows } from "./live.js";

export const BOOKS_URL = "https://raw.githubusercontent.com/dheerajgoel17/cricket-data/main/value_bets/out/book_lines.json";
export const SCHEDULE_URL = "https://raw.githubusercontent.com/dheerajgoel17/cricket-data/main/data/fixtures/upcoming.csv"; // our own schedule: the match pages of games the source's schedule no longer list
const FINAL_TTL_MS = 10 * 60e3; // a finished match does not change: its pages are read once in ten minutes, not every 15 seconds
const UPCOMING_TTL_MS = 2 * 60e3; // an upcoming match's card (XIs, toss) changes slowly: read once in two minutes
const UPCOMING_LEAD_MS = 30 * 60e3; // ... and only from half an hour before the start
const STALE_LIVE_MS = 5 * 60e3; // a live card that could not be read this round is shown from the last good read for up to this long, marked `stale`
/** Page reads are paced so a day with 25 live and 30+ upcoming neither floods the source nor passes a runtime's subrequest limit. Every match is still read: live ones each round, the rest oldest-read first. */
export const READ_BUDGET = 60; // matches read per snapshot (2 page fetches each); live ones always, the others fill what is left and roll to the next round
export const POOL = 8; // page reads in flight at once
export const PAGE_MS = 3000; // one page read; a slower one counts as failed and the last good read is kept
export const LIVE_WAIT_MS = 4000; // the response waits this long, at most, for the live cards; late ones land in the cache for the next snapshot
/** How long a user-facing snapshot waits for cards that are not live. The match-state writer passes Infinity and reads every card. */
export const CARD_BUDGET_MS = 700;

/**
 * `base()` is the source's address (throws when it is not configured); `getJson` / `getText` / `getHtml` fetch a URL (and throw on a bad status); `loadIdentity()` gives the
 * player-identity index (a function, because where the table lives differs by runtime). Returns `snapshot()`: the body of /api/live, cached for ttlMs, one read in flight at a time.
 */
export function createFeed({ base, getJson, getText, getHtml, loadIdentity, now = () => Date.now(), booksUrl = BOOKS_URL, scheduleUrl = SCHEDULE_URL, cardBudgetMs = CARD_BUDGET_MS, ttlMs = LIVE_TTL_MS, readBudget = READ_BUDGET, pool = POOL, pageMs = PAGE_MS, liveWaitMs = LIVE_WAIT_MS }) {
  let inflight = null;
  const cache = new Map(); // match page URL -> { t, pages }: the last good read of a match (any status)
  let memo = { t: 0, body: null, books: null };

  let discovery;

  async function snapshot() {
    const t0 = now();
    if (memo.body && t0 - memo.t < ttlMs) return memo.body;
    if (inflight) return inflight;
    inflight = (async () => {
      if (!discovery || t0 - discovery.t >= LIVE_TTL_MS) {
        const inputs = await Promise.all([
          getJson(booksUrl).catch(() => ({})),
          getHtml(`${base()}/`).catch(() => ""),
          getHtml(`${base()}/schedule`),
          getText(scheduleUrl).catch(() => ""),
          loadIdentity(),
        ]);
        discovery = { t: now(), inputs };
      }
      const [booksDoc, homeHtml, schedule, ours, idn] = discovery.inputs;
      const books = bookFixtures(booksDoc), listed = pricedLive(mergeSchedule(parseSchedule(homeHtml, base()), parseSchedule(schedule, base())), books);
      const gaps = unlistedRows(listed, books, parseFixtureCsv(ours), base());
      const rows = [...listed, ...gaps];
      const pages = new Map(), fresh = new Set();
      const timed = (p) => { let id; return Promise.race([p, new Promise((_, rej) => { id = setTimeout(() => rej(new Error("timeout")), pageMs); })]).finally(() => clearTimeout(id)); };
      let timedOut = 0;
      // One match's two pages. A read that gives nothing (slow, failed) leaves the last good read in the cache; a late one still lands there for the next snapshot.
      const loadCard = async (m) => {
        const [live, card] = await Promise.all([timed(getHtml(m.url)).catch(() => ""), timed(getHtml(cardPageUrl(m.url))).catch(() => "")]);
        const got = { live: parseMatchPage(live), card: parseCardPage(card) };
        if (!got.live && !got.card) return void timedOut++;
        cache.set(m.url, { t: now(), pages: got });
        pages.set(m, got);
        fresh.add(m);
      };
      const run = (items) => { let i = 0; return Promise.allSettled(Array.from({ length: Math.min(pool, items.length) }, async () => { while (i < items.length) await loadCard(items[i++]).catch(() => {}); })); };
      const urls = new Set(rows.map((m) => m.url));
      for (const u of cache.keys()) if (!urls.has(u)) cache.delete(u);
      const ageOf = (m) => (cache.has(m.url) ? now() - cache.get(m.url).t : Infinity);
      const wanted = cardFetchList(rows, now());
      const liveCards = wanted.filter((m) => m.status === "live");
      // the rest: a finished match once in ten minutes, an upcoming one from 30 minutes before the start once in two; never-read first, then oldest-read, within what the budget leaves
      const due = wanted.filter((m) => m.status !== "live" && ageOf(m) >= (m.status === "final" ? FINAL_TTL_MS : UPCOMING_TTL_MS) && (m.status === "final" || Date.parse(m.start) - now() < UPCOMING_LEAD_MS))
        .sort((a, b) => (a.status === b.status ? 0 : a.status === "final" ? -1 : 1) || ageOf(b) - ageOf(a));
      const rest = due.slice(0, Math.max(0, readBudget - liveCards.length));
      // Live cards are the score on the rail: the response waits for them, but not past liveWaitMs. A finished or upcoming card is included when it arrives inside the budget.
      const doneLive = run(liveCards);
      let waitId;
      if (liveWaitMs === Infinity) await doneLive; else await Promise.race([doneLive, new Promise((r) => { waitId = setTimeout(r, liveWaitMs); })]).finally(() => clearTimeout(waitId));
      const restDone = run(rest);
      if (cardBudgetMs === Infinity) await restDone;
      else await Promise.race([restDone, new Promise((r) => setTimeout(r, cardBudgetMs))]);
      // a match not read this round shows its last good read: a finished or upcoming card cannot have changed much, a live one for up to five minutes, marked `stale`
      const stale = new Set();
      for (const m of rows) {
        if (pages.has(m) || !m.url) continue;
        const k = cache.get(m.url);
        if (!k || (m.status === "live" && now() - k.t >= STALE_LIVE_MS)) continue;
        pages.set(m, k.pages);
        if (m.status === "live") stale.add(m);
      }
      // the public body names no source: match URLs stay on the server. A match the schedule no longer lists is kept when its own page was read, or while it is still live,
      // and each match carries where its priced lines stand (the books' player lines, settled with the identity table)
      const priorById = new Map((memo.body?.matches || []).map((x) => [String(x.id), x]));
      const matches = rows.filter((m) => !gaps.includes(m) || keepGapRow(m, pages.get(m)?.live)).map((m) => {
        const prior = priorById.get(String(m.id));
        const { url, ...pub } = pages.has(m) ? buildMatch(m, pages.get(m).live, pages.get(m).card, prior) : m;
        if (stale.has(m)) pub.stale = true;
        return { ...pub, lines: settleLines(pub, booksDoc.lines, idn) };
      });
      const reads = { live: liveCards.length, read: fresh.size, held: wanted.length - liveCards.length - due.length, skipped: due.length - rest.length, timedOut };
      const body = { asOf: new Date().toISOString(), source: "live", delaySec: ttlMs / 1000, linked: idn.size, reads, matches };
      memo = { t: now(), body, books: booksDoc };
      return body;
    })().finally(() => { inflight = null; });
    return inflight;
  }

  return { snapshot, last: () => memo.body, /** the book lines file the last snapshot was settled against (the price of each line, for the alerts) */ books: () => memo.books };
}
