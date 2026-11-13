/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The ground page's rules, with no DOM: which games count as "at this ground", the tour status, the result line,
 * and the ground KPI strip (1st/2nd inns, powerplay, chase/defend, boundaries, extras).
 * The site's `fixture-ground.tsx` and the app's `ground-page.tsx` both import this, so a fix lands in one place.
 */
import { ballsToOvers } from "@cricket/engine/live.js";
import { oversScore, venueIndices, venueStem } from "@cricket/engine/markets.js";
import { FORMATS, round } from "@cricket/engine/util.js";
import { matchDateLabel, pretty } from "./format";

/** Innings array layout (matches.json / markets.js): runs, 4s, 6s, extras. */
const IR = 1, IF4 = 4, IF6 = 5, IEX = 15;

export type GenderFilter = "" | "male" | "female";

/** Label on the Filters chip (same place Match Fancy shows L10). */
export function genderFilterLabel(g: GenderFilter): string {
  if (g === "female") return "Women";
  if (g === "male") return "Men";
  return "All";
}

export const slug = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const pairKey = (date: string, a: string, b: string) => `${String(date).slice(0, 10)}|${[slug(a), slug(b)].sort().join("|")}`;

export const MARKET_CHIPS: [string, string][] = [
  ["match_runs", "Match runs"], ["first_innings_runs", "1st innings"], ["match_sixes", "Match sixes"], ["match_fours", "Match fours"],
  ["match_50s", "50s"], ["match_extras", "Extras"], ["highest_over", "Highest runs in an over"], ["top_score", "Top score"], ["top_batter", "Top batter"],
];

/**
 * Powerplay length for the ground KPI (first-N overs of the 1st innings). T20/T10 → 6, ODI/O60 → 10;
 * Test / The Hundred have no single fielding-restriction block we can average the same way.
 */
export function powerplayOvers(fmt: string): number | null {
  if (fmt === "T20" || fmt === "T10") return 6;
  if (fmt === "ODI" || fmt === "O60") return 10;
  return null;
}

export type GroundHighestFirst = { runs: number; a: string; b: string; date: string; m: number };

/** Venue intelligence KPIs for the match indexes `ms` (same sample Markets uses: one format, void games out). */
export type GroundSummary = {
  counted: number;
  avgFirst: number | null;
  firstN: number;
  avgSecond: number | null;
  secondN: number;
  powerplayOvers: number | null;
  avgPowerplay: number | null;
  powerplayN: number;
  chaseWinPct: number | null;
  defendWinPct: number | null;
  decided: number;
  foursPerInns: number | null;
  sixesPerInns: number | null;
  boundaryRunPct: number | null;
  avgExtras: number | null;
  extrasN: number;
  highestFirst: GroundHighestFirst | null;
};

/**
 * Scoring at this ground for the filtered match list (qualified summary matches only for averages;
 * chase/defend uses every decided result, same rule as tournament `editionSummary`).
 */
export function groundSummary(store: any, ms: number[], fmt: string): GroundSummary {
  const M = store.M;
  const ppN = powerplayOvers(fmt);
  let counted = 0, first = 0, firstN = 0, second = 0, secondN = 0;
  let f4 = 0, f6 = 0, runs = 0, innsN = 0, extras = 0, extrasN = 0;
  let ppSum = 0, powerplayN = 0, decided = 0, batFirstWins = 0;
  let highestFirst: GroundHighestFirst | null = null;
  for (const m of ms) {
    if (M.r[m] === 0 && M.w[m] >= 0 && M.fi[m] >= 0) {
      decided++;
      if (M.w[m] === M.fi[m]) batFirstWins++;
    }
    const inn = M.inn?.[m] || [];
    if (M.q[m] !== 1 || !inn.length) continue;
    counted++;
    if (inn[0]) {
      const r0 = inn[0][IR] || 0;
      first += r0; firstN++;
      if (!highestFirst || r0 > highestFirst.runs) {
        highestFirst = {
          runs: r0, m, date: M.d[m],
          a: store.teamName(M.a[m]), b: store.teamName(M.b[m]),
        };
      }
      if (ppN) {
        const v = oversScore(M.ov?.[m]?.[0], inn[0], ppN);
        if (v != null) { ppSum += v; powerplayN++; }
      }
    }
    if (inn[1]) { second += inn[1][IR] || 0; secondN++; }
    let exKnown = inn.length > 0;
    for (const x of inn) {
      if (x[IEX] == null) exKnown = false;
      f4 += x[IF4] || 0; f6 += x[IF6] || 0; runs += x[IR] || 0; innsN++;
    }
    if (exKnown) { extras += inn.reduce((s: number, x: any) => s + (x[IEX] || 0), 0); extrasN++; }
  }
  const per = (x: number, n: number) => (n ? round(x / n, 2) : null);
  const defend = decided ? round((100 * batFirstWins) / decided, 1) : null;
  const chase = decided ? round((100 * (decided - batFirstWins)) / decided, 1) : null;
  const boundaryRuns = 4 * f4 + 6 * f6;
  return {
    counted, avgFirst: per(first, firstN), firstN, avgSecond: per(second, secondN), secondN,
    powerplayOvers: ppN, avgPowerplay: per(ppSum, powerplayN), powerplayN,
    chaseWinPct: chase, defendWinPct: defend, decided,
    foursPerInns: per(f4, innsN), sixesPerInns: per(f6, innsN),
    boundaryRunPct: runs ? round((100 * boundaryRuns) / runs, 1) : null,
    avgExtras: per(extras, extrasN), extrasN, highestFirst,
  };
}

/** Stadium + city from a "Ground, City, …" venue string. */
export function venueParts(v: string) {
  const parts = String(v || "").split(",").map((s) => s.trim()).filter(Boolean);
  return { ground: parts[0] || v || "Ground", city: parts.slice(1).join(", ") };
}

export type TourStatus = "Upcoming" | "In progress" | "Completed";

/**
 * Status of this series' games at this ground (not the whole tour elsewhere).
 * Priority: any still live/started → In progress; else any not yet started → Upcoming;
 * else only finished games (history rows, or status completed/final) → Completed.
 */
export function tourStatusAtGround(games: { start: string; status?: string; source?: string }[], now = Date.now()): TourStatus {
  let anyLive = false, anyUpcoming = false, anyDone = false;
  for (const g of games) {
    const st = String(g.status || "").toLowerCase();
    const done = g.source === "history" || st === "completed" || st === "final";
    if (done) { anyDone = true; continue; }
    const started = g.start.length > 10 ? Date.parse(g.start) <= now : false;
    if (st === "live" || st === "started" || started) anyLive = true;
    else anyUpcoming = true;
  }
  if (anyLive) return "In progress";
  if (anyUpcoming) return "Upcoming";
  if (anyDone) return "Completed";
  return "Upcoming";
}

/** Date span of series games at this ground: "11 Sep" or "11 Sep – 2 Nov". */
export function tourDatesAtGround(games: { start: string }[], refYear = new Date().getFullYear()) {
  if (!games.length) return "";
  const starts = games.map((g) => g.start).filter(Boolean).sort();
  const a = matchDateLabel(starts[0], refYear), b = matchDateLabel(starts[starts.length - 1], refYear);
  return a === b ? a : `${a} – ${b}`;
}

export const seriesName = (f: { series?: string; gender?: string }) => (
  f.series ? (f.series.includes(" ") ? f.series : pretty(f.series.replace(/-\d{4}$/, ""))) : `${f.gender === "female" ? "Women's" : "Men's"} cricket`
);

function sideScore(inn: any[] | undefined, teamIx: number) {
  const rows = (inn || []).filter((r: any) => r && r[0] === teamIx);
  if (!rows.length) return null;
  const bit = (row: any) => {
    const runs = row[1], wkts = row[2];
    if (runs == null) return "";
    return wkts != null && wkts < 10 ? `${runs}/${wkts}` : String(runs);
  };
  const parts = rows.map(bit).filter(Boolean);
  if (!parts.length) return null;
  const last = rows[rows.length - 1];
  return { display: parts.join(" & "), runs: last[1], wkts: last[2], overs: ballsToOvers(last[3]) };
}

function resultOf(store: any, m: number): string {
  const r = store.M.r[m], w = store.M.w[m];
  if (r === 1) return "Match tied";
  if (r === 3) return "Match drawn";
  if (r === 2 || w < 0) return "No result";
  return `${store.teamName(w)} won`;
}

/** Past matches at this ground from the stats store, shaped like schedule fixtures for a fixture card. */
export function historyAtVenue(store: any, venue: string): any[] {
  const ixs = venueIndices(store, venue);
  if (!ixs.length) return [];
  const want = new Set(ixs);
  const out: any[] = [];
  for (let m = 0; m < store.n; m++) {
    if (!want.has(store.M.v[m])) continue;
    const aIx = store.M.a[m], bIx = store.M.b[m];
    const a = store.teamName(aIx), b = store.teamName(bIx);
    const date = store.M.d[m];
    const e = store.M.e[m];
    out.push({
      id: `${date.slice(0, 10)}-${slug(a)}-v-${slug(b)}`,
      start: date,
      a, b, a_ix: aIx, b_ix: bIx,
      fmt: FORMATS[store.M.f[m]] || "T20",
      gender: store.M.g[m] ? "female" : "male",
      venue: store.venueName(store.M.v[m]),
      series: e != null && e >= 0 ? store.events[e] : "",
      status: "Completed",
      result: resultOf(store, m),
      noProps: true,
      source: "history",
      cardScores: [sideScore(store.M.inn[m], aIx), sideScore(store.M.inn[m], bIx)],
      _key: pairKey(date, a, b),
    });
  }
  return out.sort((x, y) => (x.start < y.start ? 1 : x.start > y.start ? -1 : 0));
}

/** The venue's most-played stats index, its display label, and every game there: scheduled/live first (newest first), then history not already scheduled. */
export function groundGames(store: any, fixtures: any[] | undefined, venue?: string) {
  const ixs: number[] = venue ? venueIndices(store, venue) : [];
  let primary = -1, bestN = -1;
  if (ixs.length) {
    const counts = new Map<number, number>(ixs.map((i) => [i, 0]));
    for (let m = 0; m < store.n; m++) { const v = store.M.v[m]; if (counts.has(v)) counts.set(v, counts.get(v)! + 1); }
    for (const [i, n] of counts) if (n > bestN) { bestN = n; primary = i; }
  }
  const label = primary >= 0 ? store.venues[primary] : (venue || "");
  const want = venueStem(venue || "");
  const scheduled = want
    ? (fixtures || []).filter((f: any) => venueStem(f.venue) === want).map((f: any) => ({ ...f, _key: pairKey(f.start, f.a, f.b), source: f.source || "schedule" }))
    : [];
  const seen = new Set(scheduled.map((f: any) => f._key));
  const past = (venue ? historyAtVenue(store, venue) : []).filter((f) => !seen.has(f._key));
  const liveish = scheduled.slice().sort((a: any, b: any) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0));
  const atGround = [...liveish, ...past];
  return { primary, venueIndices: ixs, label, known: primary >= 0 || atGround.length > 0, atGround };
}

/** The format with most games at the ground (the page opens on it). */
export function majorityFormat(games: any[]) {
  const c = new Map<string, number>();
  for (const f of games) { const k = f.fmt || "T20"; c.set(k, (c.get(k) || 0) + 1); }
  return FORMATS.filter((f) => c.has(f)).sort((a, b) => (c.get(b)! - c.get(a)!))[0] || "T20";
}

export function filterGames(fx: any[], fmt: string, gender: GenderFilter) {
  return fx.filter((f) =>
    (!fmt || (f.fmt || "T20") === fmt)
    && (!gender || f.gender === gender || (!f.gender && gender === "male")));
}

export function fixtureHasGround(store: any, venue?: string): boolean {
  return !!(venue && (venueIndices(store, venue).length || venueStem(venue)));
}
