// Live tracking of a priced line against the scorecard, and the two "sharp tape" buckets.
// Numbers here are so-far / final from settleLines, never from a model. Decimal odds only.

/** Over price at or above this is a long shot (High Odds Hit when it clears). */
export const HIGH_ODDS = 2.5;
/** Over price at or below this is a heavy favourite (Low Odds Miss when it misses). */
export const LOW_ODDS = 1.4;

/**
 * How a book's quote moved between two snapshots: `line` / `odds` are -1, 0 or 1.
 * Odds down (shortening) is the usual "sharp into the over"; a line drop is the same idea on the mark.
 */
export function quoteMove(prev, next) {
  if (!prev || !next) return { line: 0, odds: 0 };
  const line = Math.sign((Number(next.line) || 0) - (Number(prev.line) || 0));
  const odds = Math.sign((Number(next.over) || 0) - (Number(prev.over) || 0));
  return { line, odds };
}

/** How much is still needed to clear an over line. Null once there is a verdict, or when either number is missing. */
export function stillNeed(value, line, verdict) {
  if (value == null || line == null || verdict) return null;
  const n = Math.round((line - value) * 10) / 10;
  return n > 0 ? n : 0;
}

/**
 * Long-shot overs that cleared, and heavy-favourite overs that missed.
 * `rows`: `{ over, verdict, ... }`. Sorted longest-shot first / shortest-priced first.
 */
export function marketTape(rows) {
  const hits = [], misses = [];
  for (const r of rows || []) {
    const o = r.over, v = r.verdict;
    if (!(o > 1) || !v) continue;
    if (v === "cleared" && o >= HIGH_ODDS) hits.push(r);
    else if (v === "missed" && o <= LOW_ODDS) misses.push(r);
  }
  hits.sort((a, b) => b.over - a.over);
  misses.sort((a, b) => a.over - b.over);
  return { hits, misses };
}
