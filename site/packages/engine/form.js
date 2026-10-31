// A team's recent results in one format. Pure functions over the store, unit-tested; every value comes from matches.json.

const IR = 1, IW = 2; // innings array layout: [team, runs, wickets, ...] (see markets.js / src/cricket_site/parse.py)
const score = (inns) => (inns.length ? inns.map((i) => `${i[IR]}/${i[IW]}`).join(" & ") : null);

/**
 * The last `n` results of `team` in format `fmt`, oldest first: { m, date, opp, result, event, own, theirs }.
 * result: W / L, T (tie or eliminator), D (draw), NR (no result). Formats are never mixed. Scraped (provisional) matches without a known
 * winner are skipped: they tell us nothing about the result.
 */
export function teamForm(store, team, fmt, n = 5) {
  const M = store.M, out = [];
  for (let m = store.n - 1; m >= 0 && out.length < n; m--) {
    if (M.f[m] !== fmt || (M.a[m] !== team && M.b[m] !== team)) continue;
    if (M.pv[m] && M.w[m] < 0) continue;
    const r = M.r[m];
    const result = r === 0 ? (M.w[m] === team ? "W" : "L") : r === 1 ? "T" : r === 3 ? "D" : "NR";
    const opp = M.a[m] === team ? M.b[m] : M.a[m];
    const inns = M.inn[m] || [];
    out.push({ m, date: M.d[m], opp, result, event: M.e[m], own: score(inns.filter((i) => i[0] === team)), theirs: score(inns.filter((i) => i[0] === opp)) });
  }
  return out.reverse();
}
