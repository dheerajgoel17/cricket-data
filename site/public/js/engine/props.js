// Player prop analysis: hit rates over/under any line, median, form, fair decimal odds, and splits.
import { applyFilters, aggregateByMatch, assertSingleFormat } from "./filters.js";
import { STATS } from "./rules.js";
import { summarize, suggestLines } from "./stats.js";
import { FORMATS, median, round } from "./util.js";

const LADDERS = {
  runs: [9.5, 19.5, 29.5, 39.5, 49.5, 74.5, 99.5],
  balls: [9.5, 14.5, 19.5, 29.5, 39.5, 49.5],
  fours: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5],
  sixes: [0.5, 1.5, 2.5, 3.5],
  wickets: [0.5, 1.5, 2.5, 3.5],
  runs_conceded: [14.5, 19.5, 24.5, 29.5, 34.5, 39.5, 49.5],
  balls_bowled: [11.5, 17.5, 23.5, 29.5, 59.5],
};

export const SPLITS = ["opposition", "venue", "venue_type", "innings", "position", "year", "competition"];

function splitKey(store, r, kind) {
  switch (kind) {
    case "opposition": return store.teamName(r.opp, true);
    case "venue": return store.venueName(r.v);
    case "venue_type": return r.home ?? "unknown";
    case "innings": return r.bf == null ? "unknown" : r.bf ? "batting first" : "chasing";
    case "position": return r.o ? `No. ${r.o}` : "unknown";
    case "year": return r.date.slice(0, 4);
    case "competition": return store.events[r.e] || "(bilateral / other)";
    default: return "all";
  }
}

/** Pick the format with the most rows when the user did not say (never mixed). */
export function dominantFormat(rows) {
  const c = FORMATS.map(() => 0);
  for (const r of rows) c[r.fmt]++;
  const m = Math.max(...c);
  return m ? c.indexOf(m) : null;
}

/**
 * q: { stat, line, fmt, filters, splits[], lastN (form window), scope: 'innings'|'match' }
 * Returns everything the UI/chat needs, every number computed from rows.
 */
export async function playerReport(store, pidx, q) {
  const def = STATS[q.stat];
  if (!def) throw new Error(`unknown stat ${q.stat}`);
  const all = await store.playerRows(pidx);
  const base = def.side === "bat" ? all.bat : all.bowl;
  const notes = [];
  let fmt = q.fmt;
  if (fmt == null) {
    fmt = dominantFormat(base);
    if (fmt != null) notes.push(`No format given, using ${FORMATS[fmt]} (the format with most of this player's ${def.side === "bat" ? "innings" : "spells"}). Formats are never mixed.`);
  }
  if (fmt == null) return { ok: false, error: `No ${def.side === "bat" ? "batting" : "bowling"} data for this player.` };
  const f = { ...(q.filters || {}), fmt };
  const { rows: kept, dropped } = applyFilters(base, f, store);
  assertSingleFormat(kept);
  const scope = q.scope === "match" && fmt === 2 ? "match" : "innings";
  const rows = scope === "match" ? aggregateByMatch(kept, [def.key]) : kept;
  const values = rows.map((r) => r[def.key]);
  const summary = summarize(values, q.line ?? null);
  const lines = LADDERS[q.stat] ? LADDERS[q.stat] : suggestLines(values, 1, 5);
  const ladder = lines.map((l) => summarize(values, l));
  const lineForSplit = q.line ?? (values.length ? suggestLines(values, 1, 1)[0] : null);
  const splits = {};
  for (const kind of q.splits || []) {
    const g = new Map();
    for (const r of rows) {
      const k = splitKey(store, r, kind);
      (g.get(k) || g.set(k, []).get(k)).push(r[def.key]);
    }
    const order = [...g.entries()];
    if (kind === "year" || kind === "position") order.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    else order.sort((a, b) => b[1].length - a[1].length);
    splits[kind] = order.slice(0, 15).map(([label, v]) => ({ label, ...summarize(v, lineForSplit) }));
  }
  const last = rows.slice(-(q.lastN || 10)).reverse().map((r) => ({ date: r.date, opp: store.teamName(r.opp, true),
    venue: store.venueName(r.v), value: r[def.key], home: r.home, innings: r.bf == null ? null : r.bf ? "1st" : "2nd" }));
  if (kept.some((r) => r.pv)) notes.push(`${kept.filter((r) => r.pv).length} of these rows come from provisional (scraped) matches that Cricsheet has not published yet.`);
  for (const [k, v] of Object.entries(dropped)) if (v) notes.push(`${v} rows left out of this view: ${k.replace(/_/g, " ")}.`);
  return { ok: true, pidx, name: store.playerName(pidx), stat: q.stat, statLabel: def.label, fmt, fmtName: FORMATS[fmt], scope,
    n: rows.length, line: q.line ?? null, lineForSplit, summary, ladder, splits, last, notes, filters: f,
    rawMedian: median(values), mean: round(summary.mean, 2) };
}
