/* eslint-disable @typescript-eslint/no-explicit-any */
import { sideEdge } from "@cricket/engine/stats.js";
import type { Row } from "@/lib/hot";

/**
 * The model's projection for a row: the edge of the over and of the under (each priced at the best any book offers for that side, against the market's own no-vig chance for it) and the
 * better of the two. The row is scored on the over; the under's record is the games that did not clear the line. A row with no edge on either side has none and stays on the over.
 */
export function withModelSide(r: Row): Row {
  const { hits, played } = r.l10;
  const over = sideEdge(hits, played, r.prior, r.over) as number | null;
  const under = sideEdge(played - hits, played, r.prior == null ? null : 1 - r.prior, r.under) as number | null;
  if (over == null && under == null) return { ...r, edge: null, side: "over" };
  const useUnder = under != null && (over == null || under > over);
  return { ...r, edge: useUnder ? under : over, side: useUnder ? "under" : "over" };
}

/** The hit rate on the side the model leans to (what the home order uses): an under row ranks by how often the line was NOT cleared. */
export const sideRate = (r: Row): number | null => (r.l10.p == null ? null : r.side === "under" ? 1 - r.l10.p : r.l10.p);

