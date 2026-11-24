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
 * A side's last tosses in a format, oldest to newest: `{ m, won, bat, vs, date }` (`bat` is true when it won and chose to bat, false when it won and chose to field, null when it lost or the choice is not recorded;
 * `vs` the other side's index). Only matches whose toss is recorded (`tw` of matches.json); optionally against one opponent (`opp`, a team index) or at a ground (`venue`, venue indices). Null when the build carries no toss columns.
 */
export function tossMarks(store, team, { fmt, gender = 0, lastN = 10, opp = null, venue = null } = {}) {
  const M = store?.M;
  if (!M?.tw || team == null || team < 0) return null;
  const venues = venue == null ? null : Array.isArray(venue) ? venue : [venue];
  const hit = [];
  for (let m = 0; m < store.n; m++) {
    if (M.f[m] !== fmt || M.g[m] !== gender || (M.a[m] !== team && M.b[m] !== team) || M.tw[m] < 0) continue;
    if (opp != null && M.a[m] !== opp && M.b[m] !== opp) continue;
    if (venues && !venues.includes(M.v[m])) continue;
    const won = M.tw[m] === team;
    hit.push({ m, won, bat: won && M.td[m] >= 0 ? M.td[m] === 1 : null, vs: M.a[m] === team ? M.b[m] : M.a[m], date: M.d?.[m] ?? null });
  }
  return lastN > 0 ? hit.slice(-lastN) : hit;
}

/**
 * A side's toss record over its last `lastN` matches in a format (`tw` / `td` of matches.json; a match whose toss is not recorded is not counted), optionally against one
 * opponent (`opp`, a team index) or at a ground (`venue`, venue indices): `{ n, won, bat, form }` = tosses on record, tosses won, wins where it chose to bat, and
 * `form`, "W" / "L" per toss, oldest to newest. Null when the build carries no toss columns. History only: it says how the side's tosses went, not what the next one will be.
 */
export function tossRecord(store, team, opts = {}) {
  const hit = tossMarks(store, team, opts);
  if (!hit) return null;
  return { n: hit.length, won: hit.filter((x) => x.won).length, bat: hit.filter((x) => x.bat === true).length, form: hit.map((x) => (x.won ? "W" : "L")) };
}

/**
 * The toss as two rows for the Match Fancy list, one per side, shaped like the other fancy rows so the list draws them (`kind: "toss"`, `static`: nothing to open, `edge` null: a coin flip has no edge to show).
 * `over` is the side's price (a book's, else the 1.95 default; `default` says which), `form` its last tosses as W / L, `hits` / `played` its toss wins of the last ten, `vsOpp` and `atGround` the same count
 * against the other side and at this ground (null with no toss on record). `teams` is [[name, team index]], `venue` the ground's venue indices.
 */
export function tossRows(store, doc, fx, { teams = [], fmt, gender = 0, venue = null } = {}) {
  const market = tossMarket(doc, fx);
  const ix = (n) => teams.find(([name]) => name === n)?.[1];
  return market.sides.map((s, i) => {
    const me = ix(s.name), other = market.sides[1 - i].name, oppIx = ix(other);
    const rec = tossRecord(store, me, { fmt, gender });
    const vs = oppIx != null ? tossRecord(store, me, { fmt, gender, opp: oppIx }) : null;
    const at = venue?.length ? tossRecord(store, me, { fmt, gender, venue }) : null;
    return {
      id: `${TOSS_KEY}:${s.name}`, key: TOSS_KEY, scope: -1, inn: 0, label: "Toss winner", team: s.name, kind: "toss", static: true, line: null, side: "over",
      over: s.price, under: null, overBook: s.book, default: market.default, edge: null, last: [],
      form: rec?.form ?? [], hits: rec?.won ?? 0, played: rec?.n ?? 0,
      vsOpp: vs?.n ? { n: vs.n, won: vs.won, opp: other } : null, atGround: at?.n ? { n: at.n, won: at.won } : null,
    };
  });
}
