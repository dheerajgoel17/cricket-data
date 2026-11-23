// Toss winner as plain functions of the book doc (no DOM, no history): a coin flip carries no edge, so nothing here scores it. The one definition for the web Match Fancy tab and the app's.
// A book that lists the toss is two fancy rows (`key: "toss_winner"`, one per side, `over` the side's decimal price; src/value_bets/fancy.py); with none listed both sides sit at TOSS_DEFAULT.
import { fancyFor } from "./lines.js";

export const TOSS_KEY = "toss_winner";
/** Decimal price of each side when no book lists the toss (an even coin with a margin). The UI says so: `default` is true. */
export const TOSS_DEFAULT = 1.95;

/**
 * The toss-winner market of a fixture `{a, b, fmt, startMs}`: `{ default, sides: [{ name, price, book }, { name, price, book }], books }` in the fixture's side order.
 * Only a book that prices both sides counts; each side shows the best price among them (`book` names it), `books` lists every such book with its two prices. No such book: both sides at
 * TOSS_DEFAULT, `book` null, `default` true. In-play lines are never read.
 */
export function tossMarket(doc, fx) {
  const names = [fx?.a, fx?.b];
  const per = names.map((n) => (n ? fancyFor(doc, fx, TOSS_KEY, n, 0, false) : []).filter((x) => x.over > 1));
  const sources = [...new Set(per[0].map((x) => x.source))].filter((s) => per[1].some((x) => x.source === s));
  if (!sources.length) return { default: true, sides: names.map((name) => ({ name, price: TOSS_DEFAULT, book: null })), books: [] };
  const priceOf = (i, s) => Math.max(...per[i].filter((x) => x.source === s).map((x) => x.over));
  const books = sources.map((source) => ({ source, prices: [priceOf(0, source), priceOf(1, source)] }));
  const sides = names.map((name, i) => {
    const best = books.reduce((b, x) => (x.prices[i] > b.prices[i] ? x : b));
    return { name, price: best.prices[i], book: best.source };
  });
  return { default: false, sides, books };
}

/**
 * A side's toss record over its last `lastN` matches in a format (`tw` / `td` of matches.json; a match whose toss is not recorded is not counted):
 * `{ n, won, bat }` = tosses on record, tosses won, and wins where it chose to bat. Null when the build carries no toss columns. History only: it says how the side's tosses went, not what the next one will be.
 */
export function tossRecord(store, team, { fmt, gender = 0, lastN = 10 } = {}) {
  const M = store?.M;
  if (!M?.tw || team == null || team < 0) return null;
  const hit = [];
  for (let m = 0; m < store.n; m++) {
    if (M.f[m] !== fmt || M.g[m] !== gender || (M.a[m] !== team && M.b[m] !== team) || M.tw[m] < 0) continue;
    hit.push(m);
  }
  const last = hit.slice(-lastN);
  return { n: last.length, won: last.filter((m) => M.tw[m] === team).length, bat: last.filter((m) => M.tw[m] === team && M.td[m] === 1).length };
}
