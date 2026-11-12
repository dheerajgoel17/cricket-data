import { fancyFm } from "@cricket/engine/fancy-edge.js";

/** Path to one fancy market's page (like `/player/:id` for a prop). Query carries the market, scope, sample window and ground switch. */
export function fancyMarketPath(id: string, o: { fm: string; sc?: number | string | null; mw?: number | string | null; mv?: string | null; ml?: number | string | null }) {
  const q = new URLSearchParams();
  if (o.fm) q.set("fm", o.fm);
  if (o.sc != null && o.sc !== "" && String(o.sc) !== "-1") q.set("sc", String(o.sc));
  if (o.mw != null && o.mw !== "" && Number(o.mw) !== 10) q.set("mw", String(o.mw));
  if (o.mv === "1") q.set("mv", "1");
  if (o.ml != null && o.ml !== "") q.set("ml", String(o.ml));
  const s = q.toString();
  return `/fixture/${encodeURIComponent(id)}/fancy${s ? `?${s}` : ""}`;
}


/** Open the market on the line the row shows (the better side's own line when over and under sit on different lines). */
export function fancyRowPath(id: string, row: {
  key: string; inn?: number; scope: number; line: number;
  side?: "over" | "under" | null; overLine?: number | null; underLine?: number | null;
}, filters?: { mw?: number; mv?: string }) {
  const split = row.overLine != null && row.underLine != null && row.overLine !== row.underLine;
  const ml = split ? (row.side === "under" ? row.underLine : row.overLine) : row.line;
  return fancyMarketPath(id, { ...filters, fm: fancyFm(row.key, row.inn || 0), sc: row.scope, ml });
}
