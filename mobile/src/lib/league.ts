/* eslint-disable @typescript-eslint/no-explicit-any */
// A competition's page, as the site's LeaguePage works it out (site/src/pages/Markets.tsx, a React page): its matches, the format most of them were played in, its seasons, the sides'
// records, the summary markets and the latest results. Pure over the store.
import { MATCH_MARKETS, marketReport, selectMatches } from "@cricket/engine/markets.js";
import { FORMATS } from "@cricket/engine/util.js";
import { num } from "@site/lib/format";

/** Competitions with at least this many matches are listed. */
export const MIN_MATCHES = 8;

/** Every competition and how many matches it has, the biggest first. */
export function competitions(store: any): [number, number][] {
  const cnt = new Map<number, number>();
  for (let m = 0; m < store.n; m++) { const e = store.M.e[m]; if (e) cnt.set(e, (cnt.get(e) || 0) + 1); }
  return [...cnt.entries()].filter(([, c]) => c >= MIN_MATCHES).sort((a, b) => b[1] - a[1]);
}

export function leagueData(store: any, e: number) {
  const ms: number[] = [];
  for (let m = 0; m < store.n; m++) if (store.M.e[m] === e) ms.push(m);
  const fc = FORMATS.map(() => 0);
  for (const m of ms) fc[store.M.f[m]]++;
  const fmt = fc.indexOf(Math.max(...fc)), fmtName = FORMATS[fmt];
  const vm = selectMatches(store, { fmt, event: [e] });
  const seasons = [...new Set(ms.map((m) => store.M.d[m].slice(0, 4)))].sort().reverse();
  const tt = new Map<number, { n: number; w: number; l: number }>();
  for (const m of ms) for (const t of [store.M.a[m], store.M.b[m]]) {
    const r = tt.get(t) || { n: 0, w: 0, l: 0 };
    r.n++;
    if (store.M.w[m] === t) r.w++; else if (store.M.w[m] >= 0) r.l++;
    tt.set(t, r);
  }
  const teams = [...tt.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 40);
  const markets = ["match_runs", "match_sixes", "match_fours", "match_50s", "highest_over", "top_score"].map((k) => {
    const r = marketReport(store, vm, k);
    return { label: (MATCH_MARKETS as any)[k].label as string, median: num(r.summary.median) as string, mean: num(r.summary.mean) as string, n: r.n as number };
  });
  const results = ms.slice(-15).reverse().map((m) => {
    const inn = store.M.inn[m], sc = (i: number) => (inn[i] ? `${inn[i][1]}/${inn[i][2]}` : "–");
    return { m, date: store.M.d[m] as string, match: `${store.teamName(store.M.a[m], true)} v ${store.teamName(store.M.b[m], true)}`, venue: store.venueName(store.M.v[m]) as string, score: inn.length ? `${sc(0)} · ${sc(1)}` : "–", winner: store.M.w[m] >= 0 ? (store.teamName(store.M.w[m], true) as string) : "–" };
  });
  return { ms, fmtName, seasons, teams, tt, markets, results };
}
