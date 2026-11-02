/* eslint-disable @typescript-eslint/no-explicit-any */
// The Player page's data, as the site's PlayerScreen works it out (site/src/pages/Player.tsx, a React page and so not importable): which formats and stats he has, what the books price,
// the plan the engine runs for the stat and filters on show, and the match he plays next. `deriveChart` is the pure part: the windows, the tally and the headline numbers.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TEST_KEEP_MS, bookFormatFor, bookLinesFor, bookScopesFor, bookStatsFor, keepMsFor, sameFixture, teamKey } from "@cricket/engine/lines.js";
import { liveForFixture } from "@cricket/engine/live.js";
import { venueStem } from "@cricket/engine/markets.js";
import { matchPhase, pickPricedMatch } from "@cricket/engine/next-match.js";
import { runPlan } from "@cricket/engine/plan.js";
import { SPLITS } from "@cricket/engine/props.js";
import { STATS } from "@cricket/engine/rules.js";
import { FORMATS, fmtIndex } from "@cricket/engine/util.js";
import { barState, windowRates } from "@cricket/engine/windows.js";
import { storeQuery } from "@/lib/data";
import { fixturesQuery, linesQuery, liveQuery } from "@/lib/queries";
import { fixtureStart } from "@/lib/rail";

export interface Filters { opp?: string; venue?: string; vt?: string; inn?: string; pos?: string; lvl?: string; last?: string }
export interface PlayerQuery { stat?: string; fmt?: number; scope?: number; line?: number; filters: Filters }
export const STAT_OPTIONS: [string, string][] = Object.entries(STATS).map(([k, v]: any) => [k, v.label]);

/** The page's state for a player: stat, format, innings scope, the line the link carried, and the filters. */
export function usePlayerScreen(idx: number, q: PlayerQuery) {
  const stats = useQuery(storeQuery), lines = useQuery(linesQuery), fixtures = useQuery(fixturesQuery), live = useQuery(liveQuery);
  const store = stats.data?.store, rz = stats.data?.rz;
  const ok = !!store && idx >= 0 && idx < store.P.id.length;
  const rawName: string = ok ? store.playerName(idx) : "";
  const team: string = ok ? store.teamName(store.P.tm[idx]) : "";
  const pid: string = ok ? store.P.id[idx] : "";
  const fm: number = ok ? store.P.fm[idx] : 0;
  const fmts = useMemo(() => FORMATS.map((f: string, i: number) => [i, f] as [number, string]).filter(([i]) => (fm >> i) & 1), [fm]);
  const doc = lines.data;
  const bookName = (doc?.lines || []).find((l: any) => l.pid === pid && l.book_name)?.book_name as string | undefined;
  const short = /^[0-9a-f]{8}$/.test(rawName) ? bookName || rawName : rawName;
  const name = stats.data?.names?.[pid] || short; // the full name when the data has one ("Jason Smith"), else the scorecard's ("JF Smith")
  const askedStat = q.stat || "";
  const pricedIn = doc ? fmtIndex(bookFormatFor(doc, pid, askedStat, undefined, TEST_KEEP_MS) ?? "") : -1; // a link with no format opens where a book has a line out
  const fmtVal = q.fmt ?? (fmts.some(([i]) => i === pricedIn) ? pricedIn : fmts.length ? fmts[0][0] : 0);
  const fmt: string = FORMATS[fmtVal];
  const keep = keepMsFor(fmt);
  const pricedStats: string[] = doc ? bookStatsFor(doc, pid, fmt, undefined, keep) : [];
  const stat = pricedStats.includes(askedStat) || (STATS as any)[askedStat] ? askedStat : pricedStats[0] || "runs";
  // a Test batter has three views, each its own lines and chart, never mixed: both innings combined, his side's 1st innings, its 2nd (scope 0, 1, 2)
  const testBat = fmt === "Test" && (STATS as any)[stat]?.side === "bat";
  const pricedScopes: number[] = doc && testBat ? bookScopesFor(doc, pid, stat, fmt, undefined, keep) : [];
  const scope = !testBat ? 0 : q.scope != null && [0, 1, 2].includes(q.scope) ? q.scope : pricedScopes.length && !pricedScopes.includes(0) ? pricedScopes[0] : 0;
  const book = doc ? bookLinesFor(doc, pid, stat, fmt, undefined, keep, scope) : null;
  const bookDefault = !!book && q.line === undefined;
  const f = q.filters;
  const plan = {
    kind: "player_prop", stat, line: q.line !== undefined ? q.line : bookDefault ? book.main.line : null, side: "over", competition: null, split_by: SPLITS,
    filters: { format: fmt, opposition: f.opp || null, venue_type: f.vt || null, innings: f.inn || null, position: f.pos || null, since: null, until: null,
      last_n: f.last ? Number(f.last) : null, international: f.lvl === "intl" ? true : f.lvl === "club" ? false : null, team_innings: scope || null },
    venue: f.venue || null,
  };
  const res = useQuery({
    queryKey: ["player-plan", idx, JSON.stringify(plan)],
    enabled: ok && !lines.isLoading,
    staleTime: 10 * 60_000,
    placeholderData: (prev: any) => prev,
    queryFn: (): Promise<any> => runPlan(store, rz, plan, { playerIdx: idx }),
  });
  const lastGame = res.data?.ok ? res.data.chart?.entries?.at(-1) : undefined;
  const next = useMemo(() => nextMatchOf({ store, doc, pid, idx, fmt, team, lastGame, fixtures: fixtures.data || [], live: live.data }), [store, doc, pid, idx, fmt, team, lastGame, fixtures.data, live.data]);
  return { ok, loadingStore: stats.isLoading, storeError: stats.isError, store, idx, pid, name, short, team, fmts, fmtVal, fmt, stat, pricedStats, testBat, scope, book, bookDefault, plan, res, next, lines, live, identity: stats.data?.identity };
}

/**
 * The match the page shows: the nearest booked line still in the keep window (upcoming, in play, or just finished), else the schedule's next unpriced match of his team in
 * this format. The opponent and ground are the schedule's spelling. Null when there is none.
 */
export function nextMatchOf({ store, doc, pid, idx, fmt, team, lastGame, fixtures, live, now = Date.now() }: { store: any; doc: any; pid: string; idx: number; fmt: string; team: string; lastGame?: any; fixtures: any[]; live: any; now?: number }) {
  if (!store) return null;
  const priced = pickPricedMatch(doc, pid, fmt, now);
  let match: string, start: string, competition: string, club = "", row: any, phase: "upcoming" | "live" | "final" = "upcoming";
  // the side he last played for in this format (his profile team is often his country, and his next club game is the one that matters)
  let lastSide = "";
  const booked = (doc?.lines || []).filter((l: any) => l.pid === pid && l.fmt === fmt && l.team && l.start_utc).sort((x: any, y: any) => Date.parse(y.start_utc) - Date.parse(x.start_utc))[0];
  if (booked) lastSide = booked.team;
  else if (lastGame?.m != null) { const x = store.teamName(store.M.a[lastGame.m], true), y = store.teamName(store.M.b[lastGame.m], true); lastSide = teamKey(x) === teamKey(lastGame.opp) ? y : x; }
  if (priced) {
    match = priced.match; start = priced.start_utc; competition = priced.competition || ""; club = priced.team || "";
    row = fixtures.find((f: any) => sameFixture({ match, start_utc: start, fmt }, f));
    const [h, w] = String(match).split(/\s+vs\s+/i);
    phase = matchPhase(start, now, liveForFixture(live, { a: h, b: w, start, fmt })?.status, fmt);
  } else {
    const women = store.P.g[idx] === 1;
    row = fixtures.filter((f: any) => f.fmt === fmt && (f.gender === "female") === women && (teamKey(f.a) === teamKey(lastSide || team) || teamKey(f.b) === teamKey(lastSide || team)) && fixtureStart(f).getTime() > now)
      .sort((x: any, y: any) => (x.start < y.start ? -1 : 1))[0];
    if (!row) return null;
    match = `${row.a} vs ${row.b}`; start = fixtureStart(row).toISOString(); competition = row.series || "";
  }
  const [a, b] = String(match).split(/\s+vs\s+/i);
  const other = (t: string) => (teamKey(t) === teamKey(a) ? b : teamKey(t) === teamKey(b) ? a : "");
  const mineRaw = club || lastSide || team;
  const oppRaw = other(club) || other(lastSide) || other(team); // the book's side first: a club player's profile team is often his country
  const listed = (t: string) => [row?.a, row?.b].find((x) => x && teamKey(x) === teamKey(t)) || t;
  const ground = String(row?.venue || "");
  const known = ground ? (store.venues as string[]).find((n) => venueStem(n) === venueStem(ground)) : undefined; // the data spells a ground several ways
  return { match, start, competition, team: listed(mineRaw), opp: listed(oppRaw), ground, known, priced: !!priced, phase };
}

/** Every number the chart block shows for a line, a side and a look-back window: the windows, the one on show, the tally of every game, and the headline over the whole sample. */
export function deriveChart({ entries, line, side, win, summary, sameLine }: { entries: any[]; line: number; side: string; win: number; summary?: any; sameLine?: boolean }) {
  const ws: any[] = entries.length ? windowRates(entries, line, side) : [];
  const cur = ws.find((w) => w.n === win) || ws[ws.length - 1];
  // every game on the chart, counted with the same bar states the chart draws (hit / miss / push; void and not-played are left out), so it agrees with the engine's headline
  const tally = { hit: 0, miss: 0, push: 0 };
  for (const e of entries) { const s = barState(e, line, side) as string; if (s === "hit" || s === "miss" || s === "push") tally[s] += 1; }
  const nAll = tally.hit + tally.miss + tally.push;
  // the engine's own summary is the authority while the line is the one it ran; once the line is stepped here, the tally is used
  const all = sameLine && summary?.n ? { hits: side === "over" ? summary.over : summary.under, played: summary.n, p: side === "over" ? summary.pOver : summary.pUnder } : nAll ? { hits: tally.hit, played: nAll, p: tally.hit / nAll } : null;
  const shown = cur ? (cur.n ? entries.slice(-cur.n) : entries) : [];
  const played = shown.filter((e) => e.value != null);
  const auxAvg = played.length ? played.reduce((t, e) => t + (e.aux || 0), 0) / played.length : null;
  const mix = { hit: 0, miss: 0, push: 0, out: 0 };
  for (const e of shown) { const s = barState(e, line, side) as string; if (s === "hit") mix.hit += 1; else if (s === "miss") mix.miss += 1; else if (s === "push") mix.push += 1; else mix.out += 1; }
  return { ws, cur, tally, all, shown, auxAvg, mix };
}
