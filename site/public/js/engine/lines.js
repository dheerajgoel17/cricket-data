// Bookmaker / exchange lines for a player (value_bets/out/book_lines.json): which line is "the" line and how the market prices it.
// All prices are decimal back prices as published; nothing here is computed by a model. Pure functions, unit-tested.

export const BOOK_NAMES = { moviodds_bet365: "bet365", smarkets: "Smarkets", betfair: "Betfair", matchbook: "Matchbook", polymarket: "Polymarket" };
export const bookName = (src) => BOOK_NAMES[src] || src;

/** The market's no-vig probability of the over, from one book's two prices (null if either is missing). */
export function overProb(over, under) {
  if (!(over > 1) || !(under > 1)) return null;
  const a = 1 / over, b = 1 / under;
  return a / (a + b);
}

/** Average no-vig over-probability across the books pricing a line. */
export function lineProb(books) {
  const ps = books.map((b) => overProb(b.over, b.under)).filter((p) => p != null);
  return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null;
}

/**
 * The lines on offer for this player and stat in this format, for the nearest match that has not started more than `graceMs` ago.
 * Returns null when there are none, else { match, competition, start_utc, lines: [{line, books, prob}], main } where `main` is the line
 * priced closest to evens (the line a book hangs as "the" line), ties going to the lower line.
 */
export function bookLinesFor(doc, pid, stat, fmt, now = Date.now(), graceMs = 3 * 3600e3) {
  const all = (doc?.lines || []).filter((l) => l.pid === pid && l.stat === stat && l.fmt === fmt && l.books?.length
    && (!l.start_utc || Date.parse(l.start_utc) > now - graceMs));
  if (!all.length) return null;
  const startOf = (l) => (l.start_utc ? Date.parse(l.start_utc) : Infinity);
  const first = Math.min(...all.map(startOf));
  const mine = all.filter((l) => startOf(l) === first).map((l) => ({ line: l.line, books: l.books, prob: lineProb(l.books) }))
    .sort((a, b) => a.line - b.line);
  const ref = all.find((l) => startOf(l) === first);
  const scored = mine.filter((l) => l.prob != null);
  const main = (scored.length ? scored : mine).reduce((best, l) => (best == null || Math.abs((l.prob ?? 0.5) - 0.5) < Math.abs((best.prob ?? 0.5) - 0.5) - 1e-9 ? l : best), null);
  return { match: ref.match, competition: ref.competition, start_utc: ref.start_utc, lines: mine, main };
}
