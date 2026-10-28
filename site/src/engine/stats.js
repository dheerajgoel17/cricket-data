// Hit rates, medians and fair decimal price. Every number shown on the site comes from here.
import { median, mean, round } from "./util.js";

/** Decimal price that make the bet fair for probability p (no margin). null when p is 0. */
export function fairOdds(p) {
  return p > 0 ? round(1 / p, 2) : null;
}

/** Wilson score interval for k/n (z=1.645 → 90%). */
export function wilson(k, n, z = 1.645) {
  if (!n) return { lo: null, hi: null };
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return { lo: Math.max(0, c - h), hi: Math.min(1, c + h) };
}

/**
 * Summarise `values` (numbers, oldest first) against an optional line.
 * Over = value > line, Under = value < line, Push = value === line (only possible on whole-number lines;
 * pushes are void, so fair price use over / (over + under)).
 */
export function summarize(values, line = null) {
  const n = values.length;
  const out = { n, mean: round(mean(values), 3), median: median(values), min: n ? Math.min(...values) : null,
    max: n ? Math.max(...values) : null, line };
  if (line == null || !n) return out;
  let over = 0, under = 0, push = 0;
  for (const v of values) (v > line ? over++ : v < line ? under++ : push++);
  const live = over + under;
  const pOver = live ? over / live : null;
  const pUnder = live ? under / live : null;
  const ci = wilson(over, live);
  return { ...out, over, under, push, pOver: round(pOver, 4), pUnder: round(pUnder, 4),
    fairOver: fairOdds(pOver), fairUnder: fairOdds(pUnder),
    fairOverBest: ci.hi ? fairOdds(ci.hi) : null, fairOverWorst: ci.lo ? fairOdds(ci.lo) : null,
    pOverLo: round(ci.lo, 4), pOverHi: round(ci.hi, 4) };
}

/** Over/under table across several lines (used for "any line" views). */
export function lineLadder(values, lines) {
  return lines.map((l) => summarize(values, l));
}

/** Sensible lines around the median for a stat (half-lines). */
export function suggestLines(values, step = 1, count = 5) {
  if (!values.length) return [];
  const m = Math.floor(median(values));
  const start = Math.max(0.5, m - Math.floor(count / 2) * step + 0.5);
  return Array.from({ length: count }, (_, i) => round(start + i * step, 1));
}

export const lastN = (arr, n) => (n > 0 ? arr.slice(-n) : arr);


/** Games' worth of weight the market's chance gets against the player's own record when the two are put together (see `shrunkProb`). */
export const PRIOR_GAMES = 10;
/** An edge is shown only from this many played games (pushes, DNP and VOID not counted). */
export const MIN_EDGE_GAMES = 10;

/**
 * The chance of a side once the player's record is pulled toward the market: (hits + m * prior) / (played + m). `prior` is the market's no-vig chance of that side, so the
 * market counts as `m` extra games; a short record moves little (8 of 10 against an even market is 0.65, not 0.80), a long one barely at all (40 of 60 is 0.643, not 0.667).
 * Null with no games or no prior.
 */
export function shrunkProb(hits, played, prior, m = PRIOR_GAMES) {
  return played > 0 && prior != null && Number.isFinite(prior) ? (hits + m * prior) / (played + m) : null;
}

/**
 * Expected profit per unit staked on a side at `price` (decimal, the best any book offers for it): shrunkProb * price - 1. Null under `minGames` played, with a price
 * of 1 or less, or with no prior: no edge is claimed from a handful of games. Not a stake size and not a promise: a price the books have got right gives about minus their margin.
 */
export function sideEdge(hits, played, prior, price, minGames = MIN_EDGE_GAMES, m = PRIOR_GAMES) {
  if (!(played >= minGames) || !(price > 1)) return null;
  const p = shrunkProb(hits, played, prior, m);
  return p == null ? null : p * price - 1;
}
