// What a prop row and the Home teaser say and which rows they list: one copy for the web site and the app (they used to keep their own). Plain ESM, no DOM.
import { sideEdge } from "./stats.js";

/**
 * The model's projection for a row: the edge of the over and of the under, each priced at the best any book offers for that side against the market's own no-vig chance for it, and the
 * better of the two. `rate` is the player's record over the window shown (`{hits, played}`, hits = games that cleared the line, so the under's record is the rest: pushes are not told apart
 * and a line at a whole number counts them as unders). With no edge on either side (under 10 games, no market chance, no price) the row has none and stays on the over.
 * @returns {{edge: number | null, side: "over" | "under"}}
 */
export function modelSide(rate, prior, over, under) {
  const { hits, played } = rate;
  const o = sideEdge(hits, played, prior, over);
  const u = sideEdge(played - hits, played, prior == null ? null : 1 - prior, under);
  if (o == null && u == null) return { edge: null, side: "over" };
  const useUnder = u != null && (o == null || u > o);
  return { edge: useUnder ? u : o, side: useUnder ? "under" : "over" };
}

/** The hit rate on the side the model leans to: an under ranks by how often the line was NOT cleared. */
export const sideRate = (p, side) => (p == null ? null : side === "under" ? 1 - p : p);

/** What the label under a model edge says: the side when there is an edge, "No edge" when even the better side is below the price, nothing without a figure. */
export const edgeTag = (edge, side) => (edge == null ? "" : edge > 0 ? (side === "under" ? "Under" : "Over") : "No edge");

/** His record at the match's ground, as a note: from `GROUND_MIN_GAMES`, with a tone when it is lopsided (75% or better: `good`, 25% or worse: `bad`). Null before then. */
export const GROUND_MIN_GAMES = 2;
export function groundNote(ven) {
  if (!ven || !(ven.played >= GROUND_MIN_GAMES)) return null;
  const p = ven.p ?? ven.hits / ven.played;
  return { hits: ven.hits, played: ven.played, tone: p >= 0.75 ? "good" : p <= 0.25 ? "bad" : "plain" };
}

/** How long a match lasts from its start, rounded up (a Test's line is priced day by day, so a Test is one day's play). */
const LENGTH_MS = { T10: 3 * 3600e3, T20: 4 * 3600e3, Hundred: 4 * 3600e3, ODI: 8 * 3600e3, O60: 8 * 3600e3, Test: 9 * 3600e3, FC: 9 * 3600e3 };
export const expectedEnd = (r) => Date.parse(r.start) + (LENGTH_MS[r.fmt] ?? 4 * 3600e3);

/** The Home teaser: rows shown at least, at most, and how long a line that has resulted stays after its match is expected to be over. */
export const HOME_BASE = 4, HOME_MAX = 10, RESULTED_KEEP_MS = 12 * 3600e3;

/**
 * The prop rows the Home teaser lists. `rows` are in Home order, each with its model `edge`. Undecided rows come first and keep their order; a resulted row (`standingOf(r).state === "final"`)
 * follows and stays only until `keepMs` after its match is expected to have finished. The first `base` are shown, and past them any further undecided row that has an edge (more than the
 * price asks) is shown too, up to `max`.
 */
export function homeProps(rows, standingOf, { now = Date.now(), base = HOME_BASE, max = HOME_MAX, keepMs = RESULTED_KEEP_MS } = {}) {
  const pending = [], resulted = [];
  for (const r of rows) {
    if (standingOf(r)?.state !== "final") pending.push(r);
    else if (now < expectedEnd(r) + keepMs) resulted.push(r);
  }
  const ordered = pending.concat(resulted), isPending = new Set(pending);
  const extra = ordered.slice(base).filter((r) => isPending.has(r) && (r.edge ?? 0) > 0);
  return ordered.slice(0, base).concat(extra).slice(0, max);
}

/**
 * The series chips for the matches under a bucket, as `[name, matches]`: a series the books price comes before one with no props, then the one with more priced matches, then the one with
 * more matches listed, then by name. `priced(item)` says whether the books price that match.
 */
export function seriesChips(items, nameOf, priced) {
  const total = new Map(), pr = new Map();
  for (const i of items) {
    const n = nameOf(i);
    total.set(n, (total.get(n) || 0) + 1);
    if (priced(i)) pr.set(n, (pr.get(n) || 0) + 1);
  }
  return [...total.entries()].sort((a, b) => (pr.get(b[0]) || 0) - (pr.get(a[0]) || 0) || b[1] - a[1] || a[0].localeCompare(b[0]));
}
