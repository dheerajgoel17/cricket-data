// Player prop analysis: hit rates over/under any line, median, form, fair decimal price, and splits.
import { applyFilters, aggregateByMatch, assertSingleFormat } from "./filters.js";
import { STATS } from "./rules.js";
import { fairOdds, summarize, suggestLines } from "./stats.js";
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
  const { rows: chartRows } = applyFilters(base, { ...f, lastN: null }, store);
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
  if (kept.some((r) => r.pv)) notes.push(`${kept.filter((r) => r.pv).length} of these rows come from provisional (scraped) matches that the base data does not have yet.`);
  for (const [k, v] of Object.entries(dropped)) if (v) notes.push(`${v} rows left out of this view: ${k.replace(/_/g, " ")}.`);
  const chart = buildChart(store, base.filter((r) => r.fmt === fmt), chartRows, def, f, fmt, { line: q.line ?? lineForSplit, side: q.side || "over", aggregate: fmt === 2, pidx, xi: all.xi });
  const corr = q.line != null || lineForSplit != null ? correlated(rows, q.stat, q.line ?? lineForSplit, q.side || "over") : null;
  return { ok: true, chart, corr, pidx, name: store.playerName(pidx), stat: q.stat, statLabel: def.label, fmt, fmtName: FORMATS[fmt], scope,
    n: rows.length, line: q.line ?? null, lineForSplit, summary, ladder, splits, last, notes, filters: f,
    rawMedian: median(values), mean: round(summary.mean, 2) };
}


const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

export const WINDOWS = [5, 10, 20, 30, 50, 0]; // 0 = every fixture

/**
 * Form chart over the player's team fixtures (not just the games he played): a fixture where he did not feature
 * (not in the XI, did not bat/bowl) is kept as unavailable (value null) and excluded from hit rates.
 * `base` = all rows of that side in this format, `rows` = filtered rows (without lastN).
 */
export function buildChart(store, base, rows, def, f, fmt, { line, side = "over", aggregate, pidx = null, xi = null }) {
  const span = new Map();
  for (const r of base) {
    const s = span.get(r.t);
    if (!s) span.set(r.t, [r.date, r.date]);
    else { if (r.date < s[0]) s[0] = r.date; if (r.date > s[1]) s[1] = r.date; }
  }
  // A player who is still active keeps appearing in his side's later fixtures as DNP / VOID. "Active" is judged in THIS format only: the team
  // he last played for in this format, with that last innings no more than 120 days before the newest match in the data. (Otherwise a Test-only
  // player would show a long run of T20 DNPs, and a player who moved clubs would be blamed for his old club's fixtures.)
  const newest = store.M.d[store.n - 1];
  let curTeam = null;
  for (const [t, sp] of span) if (curTeam == null || sp[1] > span.get(curTeam)[1]) curTeam = t;
  if (curTeam != null && daysBetween(span.get(curTeam)[1], newest) <= 120) span.get(curTeam)[1] = newest;
  const byMatch = new Map();
  const auxKey = def.side === "bat" ? "b" : "n";
  for (const r of (aggregate ? aggregateByMatch(rows, [def.key, auxKey]) : rows)) byMatch.set(r.m, r);
  const M = store.M;
  const entries = [];
  const wantVenue = f.venue == null ? null : Array.isArray(f.venue) ? f.venue : [f.venue];
  for (let m = 0; m < store.n; m++) {
    if (M.f[m] !== fmt) continue;
    for (const t of [M.a[m], M.b[m]]) {
      const sp = span.get(t);
      if (!sp || M.d[m] < sp[0] || M.d[m] > sp[1]) continue;
      const opp = M.a[m] === t ? M.b[m] : M.a[m];
      const hit = byMatch.get(m);
      if (!hit || hit.t !== t) {
        // fixture filters (a DNP row has no stats, so only fixture-level filters can apply)
        if (f.pos) continue;
        if (f.since && M.d[m] < f.since) continue;
        if (f.until && M.d[m] > f.until) continue;
        if (f.intl != null && M.i[m] !== f.intl) continue;
        if (f.event && !f.event.includes(M.e[m])) continue;
        if (wantVenue && !wantVenue.includes(M.v[m])) continue;
        if (f.opp != null && !(Array.isArray(f.opp) ? f.opp : [f.opp]).includes(opp)) continue;
        if (f.venueType && store.venueType(m, t) !== f.venueType) continue;
        if (f.innings) { const bf = store.battedFirst(m, t); if (bf == null || (f.innings === "first") !== bf) continue; }
        if (f.full && M.q[m] !== 1) continue;
        if (f.gender != null && M.g[m] !== f.gender) continue;
        // in the named XI but never batted / bowled: player bets are VOID (stake returned); not named at all: DNP
        // XI not recorded reliably for this match (xq = 0): neither DNP nor VOID can be claimed, so it is unknown (n/a) and kept out of every count
        const unknown = M.xq ? M.xq[m] === 0 : false;
        entries.push({ m, date: M.d[m], opp, value: null, void: !unknown && !!xi?.has(m), unknown, venue: M.v[m] });
      } else entries.push({ m, date: M.d[m], opp, value: hit[def.key], aux: hit[auxKey], pos: hit.o || null, pv: M.pv[m], venue: M.v[m] });
      break;
    }
  }
  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.m - b.m));
  const windows = WINDOWS.map((n) => {
    const w = n ? entries.slice(-n) : entries;
    const vals = w.filter((e) => e.value != null).map((e) => e.value);
    const sm = summarize(vals, line);
    const k = side === "over" ? sm.over : sm.under;
    const p = side === "over" ? sm.pOver : sm.pUnder;
    return { n, label: n ? `Last ${n}` : "All", fixtures: w.length, played: vals.length, dnp: w.filter((e) => e.value == null && !e.void && !e.unknown).length, voided: w.filter((e) => e.void).length, unknown: w.filter((e) => e.unknown).length, hits: k ?? null,
      pHit: p ?? null, avg: sm.mean, median: sm.median, fair: side === "over" ? sm.fairOver : sm.fairUnder };
  });
  return { entries, windows, line, side, auxLabel: def.side === "bat" ? "Balls faced" : "Balls bowled" };
}


const CORR = {
  bat: [["runs", [19.5, 29.5, 49.5]], ["balls", [19.5, 29.5]], ["fours", [0.5, 1.5, 2.5]], ["sixes", [0.5, 1.5]]],
  bowl: [["wickets", [0.5, 1.5, 2.5]], ["runs_conceded", [24.5, 34.5]], ["balls_bowled", [11.5, 23.5]]],
};

/** "When this prop clears, how often do the player's other props clear?" vs their normal rate (same rows, one format). */
export function correlated(rows, stat, line, side = "over") {
  const def = STATS[stat];
  const main = (r) => (side === "over" ? r[def.key] > line : r[def.key] < line);
  const hit = rows.filter(main);
  if (hit.length < 5 || !rows.length) return null;
  const out = [];
  for (const [st, lines] of CORR[def.side]) {
    if (st === stat) continue;
    const k = STATS[st].key;
    for (const l of lines) {
      const base = rows.filter((r) => r[k] > l).length / rows.length;
      const cond = hit.filter((r) => r[k] > l).length / hit.length;
      out.push({ stat: st, label: STATS[st].label, line: l, base: round(base, 4), cond: round(cond, 4), lift: round(cond - base, 4) });
    }
  }
  return { n: hit.length, of: rows.length, rows: out };
}
