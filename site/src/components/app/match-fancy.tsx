/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronRight, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { lineVerdict, liveMarket } from "@/engine/live.js";
import { fancyByLine, fancyFor, fancyHeadline, lineProb } from "@/engine/lines.js";
import { BookBadge } from "./book-badge";
import { BookTable } from "./book-table";
import { sideEdge } from "@/engine/stats.js";
import { MATCH_MARKETS, TEAM_TOTAL_MARKETS, marketReport, selectMatches, teamTotalReport, topBatters, venueIndices } from "@/engine/markets.js";
import { FORMATS } from "@/engine/util.js";
import { useLiveMatch } from "@/hooks/useLive";
import { useData } from "@/lib/data";
import { linesQuery } from "@/lib/queries";
import { abbr, fixtureStart, num, odds, pc } from "@/lib/format";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { AnimatedHeight } from "./animated-height";
import { AnimatedNumber } from "./animated-number";
import { PlayerBadge, TeamBadge } from "./badges";
import { MiniBars, ValueBars } from "./mini-bars";
import { EmptyNote } from "./page";
import { PillGroup } from "./pill-group";
import { FancySkeleton } from "./skeletons";

export const MATCH_KEYS: [string, string][] = [["match_runs", "Total runs"], ["first_innings_runs", "1st innings"], ["match_sixes", "Sixes"], ["match_fours", "Fours"], ["match_boundaries", "Boundaries"],
  ["match_wickets", "Wickets"], ["match_50s", "50s"], ["match_30s", "30s"], ["highest_over", "Top over"], ["top_score", "Top score"], ["top_batter", "Top batter"]];
const TEAM_KEYS: [string, string][] = [["team_total_runs", "Runs"], ["team_total_sixes", "Sixes"], ["team_total_fours", "Fours"], ["team_total_boundaries", "Boundaries"], ["team_total_wickets", "Wickets lost"], ["top_batter", "Top batter"]];
const WINDOWS = [5, 10, 20, 30];
const HERE_MIN = 3;
const GROUND_MIN = 3; // fewest matches at the ground the overview rows say anything about // fewest matches at the ground worth saying anything about
const DIFFERS = 0.3; // how far (as a share of matches) the ground's hit rate must sit from the teams' form to be called out
const EASE = [0.22, 1, 0.36, 1] as const;
// the engine is plain JS: give its results the loose shape this view reads
const report = marketReport as (store: any, ms: number[], key: string, line?: number | null) => any;
const topList = topBatters as (store: any, ms: number[], o: { team?: number | null; scope: string }) => { n: number; rows: any[] };
const teamReport = teamTotalReport as (store: any, ms: number[], team: number, key: string, line?: number | null) => any;
const fancyLines = fancyFor as (doc: any, fixture: any, key: string, team?: string | null) => { line: number; over: number; under: number; source: string }[];
type BookLine = { line: number; over: number | null; under: number | null; books: { over: number | null; under: number | null; source: string }[] };
const byLine = fancyByLine as (entries: ReturnType<typeof fancyLines>) => BookLine[];
const stepOf = (key: string) => (/runs$|score$/.test(key) ? 5 : 1);
const pct1 = (r: number) => `${(r * 100).toFixed(1)}%`;

/** Every market the books price on these matches, scored on the same matches and ranked by the better side's edge: one row per market with the book's line(s), the edge, and the last ten results against the line. */
export function buildOverview({ store, doc, fxInfo, ms, scope, teamName, keys, label, liveMatch, ground }: { store: any; doc: any; fxInfo: any; ms: number[]; scope: number; teamName: string | null; keys: [string, string][]; label: (k: string) => string; liveMatch?: any; ground?: number[] }) {
  if (!ms.length || !doc) return [];
  const rows = keys.filter(([k]) => k !== "top_batter").flatMap(([k]) => {
    const all = byLine(fancyLines(doc, fxInfo, k, teamName));
    // the first line both sides are priced on; else (an exchange quotes Yes and No on lines a gap apart) the first line with an over price and the first with an under price, each on its own line
    const { over: lo, under: lu } = fancyHeadline(all), b = lo ?? lu;
    if (!b) return [];
    const run = (line: number) => (scope < 0 ? report(store, ms, k, line) : teamReport(store, ms, scope, k, line));
    const so = lo ? run(lo.line).summary : null, su = lu ? run(lu.line).summary : null, base = so ?? su;
    if (!base || !base.n) return [];
    const eo = lo && so ? sideEdge(so.over, so.over + so.under, lineProb(lo.books), lo.over) : null;
    const eu = lu && su ? sideEdge(su.under, su.over + su.under, lineProb(lu.books) == null ? null : 1 - (lineProb(lu.books) as number), lu.under) : null;
    const side = (eu ?? -9) > (eo ?? -9) ? "under" : "over";
    const soFar = liveMarket(liveMatch, k, teamName);
    const src = (l: BookLine | undefined, sd: "over" | "under") => (l && l[sd] != null ? l.books.find((x) => x[sd] === l[sd])?.source : undefined);
    const shownBooks = [...new Map([...(lo?.books ?? []), ...(lu?.books ?? [])].map((x) => [x.source, x])).values()];
    const rep = run(b.line);
    // the same line scored on the matches at the ground alone: how the market has gone there (a ground can sit far from the sides' form)
    const gs = ground && ground.length >= GROUND_MIN ? (scope < 0 ? report(store, ground, k, b.line) : teamReport(store, ground, scope, k, b.line)).summary : null;
    const at = gs && gs.n >= GROUND_MIN ? { n: gs.n, over: gs.over, under: gs.under, side: gs.under > gs.over ? "under" : "over" } : null;
    return [{ key: k, label: label(k), line: b.line, overLine: lo?.line ?? null, underLine: lu?.line ?? null, over: lo?.over ?? null, under: lu?.under ?? null, books: shownBooks, overBook: src(lo, "over"), underBook: src(lu, "under"), side, edge: side === "over" ? eo : eu, soFar, at, last: (rep.values as number[]).slice(-10).map((v) => ({ v, s: v > b.line ? "hit" : v < b.line ? "miss" : "push" })) }];
  });
  return rows.sort((x, y) => (y.edge ?? -9) - (x.edge ?? -9));
}

/** One market's row, in the props-list style: the label and the book's line and price(s), the better side's edge, and the last ten results as bars. */
export function OverviewRow({ r, onOpen, active, sub }: { r: any; onOpen: () => void; active?: boolean; sub?: string }) {
  return (
    <button type="button" onClick={onOpen} aria-label={`Open ${r.label}`}
      className={cn("grid min-h-row w-full grid-cols-[minmax(0,1fr)_3.5rem_auto_1rem] items-center gap-tight px-gutter py-snug text-left transition-colors active:bg-card", active && "bg-card")}>
    <span className="grid min-w-0 gap-hair">
                          <span className="truncate text-body font-semibold leading-snug">{r.label}</span>{sub && <span className="truncate text-footnote text-muted-foreground">{sub}</span>}
                          {r.at && <span className="text-footnote text-muted-foreground">At the ground · <b className={cn("font-semibold", r.at.side === r.side && r.edge != null ? "text-primary" : "text-foreground")}>{r.at.side === "over" ? r.at.over : r.at.under} of {r.at.n} {r.at.side}</b></span>}
                          <span className="line-clamp-2 text-callout text-primary">{r.overLine != null && r.underLine != null && r.overLine !== r.underLine ? <>O {r.overLine}<span className="text-muted-foreground"> · <span className="whitespace-nowrap">{r.overBook && <><BookBadge source={r.overBook} />{" "}</>}{odds(r.over)}</span> · </span>U {r.underLine}<span className="text-muted-foreground"> · <span className="whitespace-nowrap">{r.underBook && <><BookBadge source={r.underBook} />{" "}</>}{odds(r.under)}</span></span></> : <>O/U {r.line} <span className="text-muted-foreground">· <span className="whitespace-nowrap">{r.overBook && <><BookBadge source={r.overBook} />{" "}</>}O {odds(r.over)}</span> · <span className="whitespace-nowrap">{r.underBook && r.underBook !== r.overBook && <><BookBadge source={r.underBook} />{" "}</>}U {odds(r.under)}</span></span></>}{r.soFar != null && <span className={lineVerdict(r.soFar, r.line) ? "text-primary" : "text-muted-foreground"}> · {r.soFar} so far{lineVerdict(r.soFar, r.line) && <b className="font-semibold"> · Over cleared</b>}</span>}</span>
                        </span>
                        <span className="grid justify-items-end text-right">
                          <span className="text-caption font-semibold tracking-wider text-muted-foreground">{r.edge == null ? "EDGE" : r.side === "over" ? "OVER" : "UNDER"}</span>
                          <span className={cn("text-body font-semibold tabular-nums", r.edge == null ? "text-muted-foreground" : r.edge > 0 ? "text-primary" : "text-miss")}>{r.edge == null ? "–" : `${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(0)}%`}</span>
                        </span>
                        <MiniBars last={r.last} line={r.line} />
                        <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  );
}

type Props = { fx: any; teams: [string, number][]; fmt: string; q: Record<string, string>; setQ: (p: Record<string, unknown>) => void; doc?: any };

/**
 * Match Fancy: whole-match and team-total markets (runs, sixes, fours, boundaries, 50s, top over, top score, top batter) over the teams' last N matches
 * in this format. A "Bookmaker lines" list shows every market the books price, one row each in the props-list style; the market chips open any market
 * in a detail panel with the median, a chart of every recent match against the line, over / under shares and fair prices, and a tappable line ladder.
 */
export function MatchFancy({ fx, teams, fmt, q, setQ, doc: given }: Props) {
  const { store } = useData();
  const { match: liveMatch } = useLiveMatch(fx);
  const reduce = useReducedMotion();
  const lines = useQuery(linesQuery);
  const doc = { data: given ?? lines.data, isLoading: lines.isLoading }; // the fixture page passes the book doc with the archive added when the live file has let the match go
  const panelRef = useRef<HTMLDivElement>(null);
  const fxInfo = useMemo(() => ({ a: fx.a, b: fx.b, fmt: fx.fmt, startMs: fixtureStart(fx).getTime() }), [fx]);
  const booked = (k: string, teamName: string | null) => k !== "top_batter" && fancyLines(doc.data, fxInfo, k, teamName).length > 0;
  const scopes = [["-1", "Match", MATCH_KEYS.some(([k]) => booked(k, null))] as const, ...teams.map(([name, i]) => [String(i), name, TEAM_KEYS.some(([k]) => booked(k, name))] as const)].filter(([, , on]) => on);
  const wantSc = q.sc === "" || q.sc == null ? "-1" : q.sc;
  const scope = scopes.some(([v]) => v === wantSc) ? Number(wantSc) : scopes.length ? Number(scopes[0][0]) : -1;
  const team = teams.find(([, i]) => i === scope);
  const keys = (scope < 0 ? MATCH_KEYS : TEAM_KEYS).filter(([k]) => booked(k, team?.[0] ?? null));
  const key = keys.some(([k]) => k === q.fm) ? q.fm : keys[0]?.[0] || "";
  const win = WINDOWS.includes(Number(q.mw)) ? Number(q.mw) : 20;
  const fmtIdx = FORMATS.indexOf(fmt);
  const marketLabel = (k: string) => (k === "top_batter" ? "Top batter" : (scope < 0 ? (MATCH_MARKETS as any)[k] : (TEAM_TOTAL_MARKETS as any)[k]).label as string);
  const run = (k: string, line?: number | null, ms_ = ms) => (scope < 0 ? report(store, ms_, k, line) : teamReport(store, ms_, scope, k, line));

  // the ground: the matches played there (the data spells one ground several ways), for the sample switch and the note under the over / under cards
  const venueIdx = useMemo(() => (venueIndices as (s: any, n: string) => number[])(store, fx.venue), [store, fx.venue]);
  const gender = fx.gender === "female" ? 1 : 0;
  const venueName = String(fx.venue || "").split(",")[0].trim();
  const here = q.mv === "1" && venueIdx.length > 0;
  const hereMatches = (n: number) => (scope < 0 ? selectMatches(store, { fmt: fmtIdx, gender, venue: venueIdx, lastN: n }) : selectMatches(store, { fmt: fmtIdx, gender, venue: venueIdx, team: scope, lastN: n })) as number[];
  const ms = useMemo(() => {
    if (here) return hereMatches(win);
    const sets = (scope < 0 ? teams : teams.filter(([, i]) => i === scope)).map(([, i]) => selectMatches(store, { fmt: fmtIdx, team: i, lastN: win }) as number[]);
    return [...new Set(sets.flat())].sort((a, b) => a - b);
  }, [store, teams, scope, fmtIdx, win, here, venueIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // every market the books price, scored on the same matches and ranked by the better side's edge (like the props list ranks by hit rate)
  const overview = useMemo(() => buildOverview({ store, doc: doc.data, fxInfo, ms, scope, teamName: team?.[0] ?? null, keys, label: marketLabel, liveMatch, ground: venueIdx.length ? hereMatches(10) : undefined }), [doc.data, ms, keys, fxInfo, team, scope, store, liveMatch, venueIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const book = useMemo(() => (!key || key === "top_batter" ? [] : byLine(fancyLines(doc.data, fxInfo, key, team?.[0] ?? null))), [doc.data, fxInfo, key, team]);
  const base: any = useMemo(() => (!key || key === "top_batter" ? null : run(key)), [store, ms, key, scope]); // eslint-disable-line react-hooks/exhaustive-deps
  const line = q.ml !== undefined && q.ml !== "" && Number.isFinite(Number(q.ml)) ? Number(q.ml) : (book.find((l) => l.over != null && l.under != null) ?? book.find((l) => l.over != null) ?? book[0])?.line ?? base?.ladder[2]?.line ?? base?.ladder[0]?.line ?? 0.5;
  const rep: any = useMemo(() => (key === "top_batter" || !base ? null : run(key, line)), [base, store, ms, key, scope, line]); // eslint-disable-line react-hooks/exhaustive-deps
  // ladder rows: the engine's lines around the median plus the bookmaker's own line(s), computed on the same matches
  const ladder = useMemo(() => {
    if (!rep) return [];
    const have = new Set(rep.ladder.map((l: any) => l.line));
    const extra = book.filter((b) => !have.has(b.line)).map((b) => run(key, b.line).summary);
    return [...rep.ladder, ...extra].sort((a: any, b: any) => a.line - b.line);
  }, [rep, book, store, ms, key, scope]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Record<string, unknown>) => setQ({ ...p, ...(p.sc !== undefined || p.fm !== undefined ? { ml: "" } : {}) });
  const bookHere = book.find((b) => b.line === line); // every book's prices at the line being looked at
  // how this market has gone at the ground, set against the sample on screen: a ground can sit far from the teams' form (a small, slow one)
  const ground = useMemo(() => {
    if (!rep || key === "top_batter" || venueIdx.length === 0) return null;
    const vms = hereMatches(10);
    if (vms.length < HERE_MIN) return null;
    const r = run(key, line, vms).summary, n = vms.length;
    const share = (hit: number, total: number) => (total ? hit / total : 0);
    return { n, under: r.under, over: r.over, max: r.max, differs: !here && Math.abs(share(r.under, n) - share(rep.summary.under, rep.n)) >= DIFFERS };
  }, [rep, key, line, venueIdx, scope, fmtIdx, store, here]); // eslint-disable-line react-hooks/exhaustive-deps
  // the date and the sides of each match under its bar (the values are the matches of `ms`, oldest first)
  const barLabels = useMemo(() => ms.map((m) => {
    const M = store.M, a = M.a[m], b = M.b[m];
    const d = new Date(`${M.d[m]}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    const opp = scope >= 0 ? (a === scope ? b : a) : -1;
    return { date: d, text: scope >= 0 ? `v ${abbr(store.teamName(opp, true))}` : `${abbr(store.teamName(a, true))} v ${abbr(store.teamName(b, true))}` };
  }), [ms, store, scope]);
  const open = (k: string) => { track("fancy_market", { market: k }); set({ fm: k }); requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })); };

  return (
    <div className="flex min-w-0 flex-col gap-stack">
      <div className="flex min-w-0 flex-col gap-snug">
        {scopes.length > 1 && (
          <PillGroup segmented layoutId="fancy-scope" label="Scope" value={String(scope)} onChange={(v) => set({ sc: v === "-1" ? "" : v })}
            items={scopes.map(([v, label]) => [v, v === "-1" ? "Match" : <span key={v} className="flex items-center gap-tight"><TeamBadge name={label} size="xs" />{abbr(label)}</span>] as [string, React.ReactNode])} />
        )}
        <div className="flex items-center gap-snug">
          <PillGroup segmented layoutId="fancy-window" label="Matches" value={String(win)} onChange={(v) => set({ mw: v })} items={WINDOWS.map((n) => [String(n), `L${n}`])} className="shrink-0" />
          <span className="min-w-0 truncate text-footnote text-muted-foreground">{ms.length} {fmt} matches{here ? ` at ${venueName}` : scope >= 0 ? ` of ${team?.[0]}` : ""}</span>
        </div>
        {venueIdx.length > 0 && (
          <PillGroup segmented layoutId="fancy-sample" label="Matches from" value={here ? "1" : "0"} onChange={(v) => set({ mv: v === "1" ? "1" : "" })}
            items={[["0", "Teams' form"], ["1", `At ${venueName}`]]} />
        )}
      </div>

      {doc.isLoading ? <FancySkeleton /> : !ms.length ? <EmptyNote>No {fmt} matches to base this on.</EmptyNote> : (
        <>
          {overview.length > 0 && (
            <section className="flex flex-col gap-snug" aria-label="Bookmaker lines">
              <h2 className="text-title font-bold">Bookmaker lines</h2>
              {liveMatch?.status === "live" && <p className="text-footnote text-muted-foreground">So far this match, delayed up to about 20 seconds. Not used for settlement.</p>}
              <ul className="-mx-gutter">
                <AnimatePresence mode="popLayout" initial={false}>
                  {overview.map((r, i) => (
                    <motion.li key={r.key} layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      transition={{ layout: { type: "spring", stiffness: 420, damping: 38 }, delay: Math.min(i, 6) * 0.03, duration: 0.3, ease: EASE }}
                      className="border-t border-white/5 first:border-t-0">
                      <OverviewRow r={r} onOpen={() => open(r.key)} active={r.key === key} />
                      <BookTable books={r.books} shown={[r.overBook, r.underBook]} className="px-gutter pb-snug" />
                    </motion.li>))}
                </AnimatePresence>
              </ul>
            </section>)}

          <div ref={panelRef} className="flex min-w-0 scroll-mt-24 flex-col gap-snug">
            {keys.length > 1 && <PillGroup layoutId="fancy-market" label="Market" value={key} onChange={(v) => set({ fm: v })} items={keys} />}
            <AnimatedHeight>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={`${scope}-${key}-${win}`} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: EASE }} className="flex min-w-0 flex-col gap-stack">
                {key === "top_batter" ? <TopBatters ms={ms} scope={scope} teamName={team?.[0]} /> : rep && (
                  <>
                    <section className="flex flex-col gap-stack rounded-2xl bg-card p-inset ring-1 ring-white/5">
                      <div className="flex items-baseline justify-between gap-snug"><h2 className="text-body font-semibold">{marketLabel(key)}</h2><span className="text-footnote text-muted-foreground">last {rep.n} matches</span></div>
                      <div className="flex items-end gap-group">
                        <div><div className="text-footnote text-muted-foreground">Median</div><AnimatedNumber className="text-stat font-bold tracking-tight tabular-nums" value={rep.summary.median} format={(n) => (Number.isInteger(rep.summary.median) ? String(Math.round(n)) : n.toFixed(1))} /></div>
                        <div><div className="text-footnote text-muted-foreground">Mean</div><AnimatedNumber className="text-title font-semibold tabular-nums" value={rep.summary.mean} format={(n) => n.toFixed(1)} /></div>
                        <div><div className="text-footnote text-muted-foreground">Range</div><span className="text-title font-semibold tabular-nums"><AnimatedNumber value={rep.summary.min} format={(n) => String(Math.round(n))} />–<AnimatedNumber value={rep.summary.max} format={(n) => String(Math.round(n))} /></span></div>
                      </div>
                      <ValueBars values={rep.values} line={line} labels={barLabels} />
                      <div className="flex flex-wrap items-center gap-snug">
                        <div className="flex h-control items-center rounded-[var(--chip-radius)] bg-background">
                          <Button variant="ghost" size="icon" aria-label="Lower the line" className="size-control rounded-full" onClick={() => set({ ml: Math.max(0, Math.round((line - stepOf(key)) * 2) / 2) })}><Minus /></Button>
                          <span className="min-w-[5rem] text-center text-callout font-semibold tabular-nums">O/U {line}</span>
                          <Button variant="ghost" size="icon" aria-label="Raise the line" className="size-control rounded-full" onClick={() => set({ ml: Math.round((line + stepOf(key)) * 2) / 2 })}><Plus /></Button>
                        </div>
                        {book.filter((b) => b.line !== line).map((b) => <Button key={b.line} variant="secondary" size="sm" className="rounded-full" onClick={() => set({ ml: b.line })}>{b.books.map((x) => <BookBadge key={x.source} source={x.source} />)} line {b.line}</Button>)}
                      </div>
                      <div className="grid grid-cols-2 gap-snug">
                        {(["over", "under"] as const).map((side) => {
                          const p: number | null = rep.summary[side === "over" ? "pOver" : "pUnder"], fair = rep.summary[side === "over" ? "fairOver" : "fairUnder"], hit = rep.summary[side];
                          return (
                            <div key={side} className="flex flex-col gap-tight rounded-xl bg-background p-snug ring-1 ring-white/5">
                              <div className="text-footnote font-medium capitalize text-muted-foreground">{side} {line}</div>
                              <AnimatedNumber className={cn("text-title font-bold tabular-nums", side === "over" ? "text-primary" : "text-foreground")} value={p} format={pct1} />
                              <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div className={cn("h-full rounded-full", side === "over" ? "bg-primary" : "bg-foreground/70")} initial={reduce ? false : { width: 0 }} animate={{ width: `${(p ?? 0) * 100}%` }} transition={{ duration: 0.5, ease: EASE }} /></div>
                              <div className="text-footnote text-muted-foreground">{hit} of {rep.n} · fair {odds(fair)}</div>
                              {bookHere && (() => { const b = bookHere[side] != null ? bookHere.books.find((x: any) => x[side] === bookHere[side]) : null; return b && (
                                <div className="flex items-baseline justify-between gap-tight border-t border-white/10 pt-tight text-footnote">
                                  <span className="min-w-0 truncate text-muted-foreground"><BookBadge source={b.source} /></span>
                                  <b className="tabular-nums text-primary">{odds(b[side])}</b>
                                </div>); })()}
                            </div>);
                        })}
                      </div>
                      {ground && (
                        <p className={cn("text-footnote", ground.differs ? "text-amber" : "text-muted-foreground")}>
                          {ground.differs && <b className="font-semibold">Ground differs. </b>}At {venueName}, last {ground.n} {fmt} {scope >= 0 ? `of ${team?.[0]}` : "matches"}: {ground.under} under {line}, {ground.over} over{ground.max != null ? ` · highest ${ground.max}` : ""}
                          {here ? "" : ` (teams' form: ${rep.summary.under} of ${rep.n} under)`}.
                        </p>)}
                      {bookHere && <BookTable books={bookHere.books} shown={(["over", "under"] as const).map((side) => (bookHere[side] != null ? bookHere.books.find((x: any) => x[side] === bookHere[side])?.source : undefined))} />}
                      {rep.n < 10 && <p className="text-footnote text-amber">Small sample ({rep.n} matches): treat these with caution.</p>}
                    </section>

                    <section className="overflow-hidden rounded-2xl bg-card ring-1 ring-white/5" aria-label="Line ladder">
                      <div className="grid grid-cols-[1fr_1fr_1fr] px-inset py-tight text-footnote font-medium text-muted-foreground"><span>Line</span><span className="text-right">Over</span><span className="text-right">Under</span></div>
                      {ladder.map((l: any, i: number) => (
                        <motion.button key={l.line} type="button" onClick={() => set({ ml: l.line })} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 7) * 0.03, duration: 0.3, ease: EASE }}
                          className="relative grid w-full grid-cols-[1fr_1fr_1fr] items-center border-t border-white/5 px-inset py-snug text-left text-body transition-colors active:bg-accent">
                          {l.line === line && <motion.span layoutId="ladder-sel" aria-hidden className="absolute inset-0 bg-accent/60" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }} />}
                          <span className="relative flex items-center gap-tight font-semibold tabular-nums">{l.line}{book.find((b) => b.line === l.line)?.books.map((x) => <BookBadge key={x.source} source={x.source} />)}</span>
                          <span className="relative text-right tabular-nums"><b className="text-primary">{pc(l.pOver)}</b> <span className="text-footnote text-muted-foreground">{odds(l.fairOver)}</span></span>
                          <span className="relative text-right tabular-nums"><b>{pc(l.pUnder)}</b> <span className="text-footnote text-muted-foreground">{odds(l.fairUnder)}</span></span>
                        </motion.button>))}
                    </section>
                  </>)}
              </motion.div>
            </AnimatePresence>
            </AnimatedHeight>
          </div>
        </>)}
    </div>
  );
}

function TopBatters({ ms, scope, teamName }: { ms: number[]; scope: number; teamName?: string }) {
  const { store } = useData();
  const reduce = useReducedMotion();
  const t = useMemo(() => (scope < 0 ? topList(store, ms, { scope: "match" }) : topList(store, ms, { team: scope, scope: "team" })), [store, ms, scope]);
  const max = Math.max(...t.rows.map((r: any) => r.pSole), 0.0001);
  return (
    <section className="overflow-hidden rounded-2xl bg-card ring-1 ring-white/5">
      <div className="flex flex-col gap-hair px-inset py-snug"><h2 className="text-body font-semibold">Top batter</h2><span className="text-footnote text-muted-foreground">{scope < 0 ? `highest score in the match, last ${t.n} matches` : `${teamName} batting first, last ${t.n} matches`}</span></div>
      <ul>
        {t.rows.map((r: any, i: number) => (
          <motion.li key={r.player} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.3, ease: EASE }} className="relative border-t border-white/5">
            <motion.span aria-hidden className="absolute inset-y-0 left-0 bg-primary/10" initial={reduce ? false : { width: 0 }} animate={{ width: `${(r.pSole / max) * 100}%` }} transition={{ duration: 0.6, delay: Math.min(i, 8) * 0.03, ease: EASE }} />
            <Item asChild size="sm" className="relative rounded-none border-0 px-inset py-snug transition-colors active:bg-accent">
              <Link to={`/player/${r.player}`}>
                <ItemMedia><PlayerBadge idx={r.player} size="sm" /></ItemMedia>
                <ItemContent className="min-w-0 gap-hair"><ItemTitle className="max-w-full text-body font-semibold"><span className="truncate">{r.name}</span></ItemTitle><ItemDescription className="text-callout">{r.sole} sole{r.tied ? ` + ${r.tied} tied` : ""} of {t.n}</ItemDescription></ItemContent>
                <ItemActions className="grid justify-items-end text-right"><AnimatedNumber className="text-body font-semibold tabular-nums text-primary" value={r.pSole} format={pct1} /><span className="text-footnote text-muted-foreground">fair {odds(r.fairSole)}</span></ItemActions>
              </Link>
            </Item>
          </motion.li>))}
      </ul>
      {!t.rows.length && <p className="px-inset pb-snug text-callout text-muted-foreground">Not enough matches.</p>}
    </section>
  );
}
