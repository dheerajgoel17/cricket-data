// Partnership statistics for a pair of batters: who gets dismissed first, and how big the stands are.
import { summarize, fairOdds, wilson } from "./stats.js";
import { median, round } from "./util.js";

/** rows: Store.pairRows(); a/b are the two player indices (a<b in the data). */
export function pairSummary(rows, nameA, nameB) {
  const n = rows.length;
  const aOut = rows.filter((r) => r.x === 1).length;
  const bOut = rows.filter((r) => r.x === 2).length;
  const none = n - aOut - bOut;
  const ended = aOut + bOut;
  const runs = rows.map((r) => r.r);
  const pA = ended ? aOut / ended : null;
  const pB = ended ? bOut / ended : null;
  return {
    n, ended, aOut, bOut, notBroken: none,
    pFirstOutA: round(pA, 4), pFirstOutB: round(pB, 4),
    fairFirstOutA: fairOdds(pA), fairFirstOutB: fairOdds(pB),
    ciA: wilson(aOut, ended),
    runs: summarize(runs),
    avgRuns: round(runs.reduce((s, x) => s + x, 0) / (n || 1), 1),
    medianRuns: median(runs),
    avgBalls: round(rows.reduce((s, r) => s + r.n, 0) / (n || 1), 1),
    stand50: rows.filter((r) => r.r >= 50).length,
    nameA, nameB,
  };
}

/** Split a pair's stands by a key function; keeps the biggest groups. */
export function splitPairs(rows, keyFn, names, min = 1, top = 12) {
  const g = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (k == null) continue;
    (g.get(k) || g.set(k, []).get(k)).push(r);
  }
  return [...g.entries()].filter(([, v]) => v.length >= min).sort((a, b) => b[1].length - a[1].length).slice(0, top)
    .map(([k, v]) => ({ label: k, ...pairSummary(v, names[0], names[1]) }));
}

export function filterPairs(rows, f, store) {
  return rows.filter((r) => {
    if (f.fmt != null && r.fmt !== f.fmt) return false;
    if (f.gender != null && r.g !== f.gender) return false;
    if (f.opening && !r.open) return false;
    if (f.wicket != null && r.w !== f.wicket) return false;
    if (f.opp != null && r.opp !== f.opp) return false;
    if (f.venue != null && r.v !== f.venue) return false;
    if (f.since && r.date < f.since) return false;
    if (f.until && r.date > f.until) return false;
    if (f.venueType && r.home !== f.venueType) return false;
    if (f.innings && (r.bf == null || (f.innings === "first") !== r.bf)) return false;
    if (f.intl != null && r.intl !== f.intl) return false;
    if (f.event && !f.event.includes(r.e)) return false;
    return true;
  });
}
