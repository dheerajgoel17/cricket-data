// Who is who: playing names (scorecard / books / CREX) -> Cricsheet id, and fixtures with format.
// Data is identity.json (builder + hourly Supabase merge). Ids first; names only as the fallback.
import { canonFmt, norm as fold } from "./util.js";

const teamFold = (n) => fold(String(n || "").replace(/\(w\)/i, "").replace(/\bwomen\b/i, ""));
const sideKey = (n) => teamFold(n).replace(/ /g, "");

/** Unique Cricsheet id for a live/scorecard/book name, or null when missing or still ambiguous. */
export function playerIdFor(doc, raw, opts = {}) {
  const rows = doc?.p;
  if (!rows?.length || !raw) return null;
  const folded = fold(raw), last = folded.split(" ").pop();
  const hits = rows.filter((r) => r.f === folded || r.f === last || (last && r.f.endsWith(` ${last}`)));
  if (!hits.length) return null;
  const g = opts.gender;
  const gendered = g == null ? hits : hits.filter((r) => r.g == null || r.g === g);
  const wantT = opts.team != null ? teamFold(opts.team) : "";
  const teamed = wantT ? gendered.filter((r) => !r.t || r.t === wantT) : gendered;
  const pool = teamed.length ? teamed : gendered;
  const ids = [...new Set(pool.map((r) => r.id))];
  return ids.length === 1 ? ids[0] : null;
}

/** Format on the CREX fixture identity row for these two sides nearest `startMs`, or "". */
export function fixtureFmt(doc, fixture) {
  const a = sideKey(fixture?.a), b = sideKey(fixture?.b);
  if (!a || !b) return "";
  const t = Number.isFinite(fixture?.startMs) ? fixture.startMs : (fixture?.start ? Date.parse(fixture.start) : NaN);
  let best = "", bestD = Infinity;
  for (const r of doc?.fx || []) {
    const x = r.ak, y = r.bk;
    if (!((x === a && y === b) || (x === b && y === a))) continue;
    if (fixture?.fmt && canonFmt(r.fmt) !== canonFmt(fixture.fmt)) continue;
    const u = r.start ? Date.parse(r.start) : NaN;
    const d = Number.isFinite(t) && Number.isFinite(u) ? Math.abs(t - u) : 0;
    if (d < bestD) { bestD = d; best = r.fmt; }
  }
  return best;
}
