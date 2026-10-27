/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Button } from "@/components/ui/button";
import { fancyFor } from "@/engine/lines.js";
import { MATCH_MARKETS, TEAM_TOTAL_MARKETS, marketReport, selectMatches, teamTotalReport, topBatters } from "@/engine/markets.js";
import { FORMATS } from "@/engine/util.js";
import { useData } from "@/lib/data";
import { loadLines } from "@/lib/feeds";
import { abbr, fixtureStart, num, odds, pc } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PlayerBadge, TeamBadge } from "./badges";
import { PillGroup } from "./pill-group";
import { ValueBars } from "./mini-bars";
import { Link } from "react-router-dom";
import { EmptyNote } from "./page";

const MATCH_KEYS: [string, string][] = [["match_runs", "Total runs"], ["first_innings_runs", "1st innings"], ["match_sixes", "Sixes"], ["match_fours", "Fours"], ["match_boundaries", "Boundaries"],
  ["match_wickets", "Wickets"], ["match_50s", "50s"], ["match_30s", "30s"], ["highest_over", "Top over"], ["top_score", "Top score"], ["top_batter", "Top batter"]];
const TEAM_KEYS: [string, string][] = [["team_total_runs", "Runs"], ["team_total_sixes", "Sixes"], ["team_total_fours", "Fours"], ["team_total_boundaries", "Boundaries"], ["team_total_wickets", "Wickets lost"], ["top_batter", "Top batter"]];
const WINDOWS = [10, 20, 30];
const report = marketReport as (store: any, ms: number[], key: string, line?: number | null) => any;
const topList = topBatters as (store: any, ms: number[], o: { team?: number | null; scope: string }) => { n: number; rows: any[] };
const teamReport = teamTotalReport as (store: any, ms: number[], team: number, key: string, line?: number | null) => any;
// the engine is plain JS: give its results the loose shape this view reads
const fancyLines = fancyFor as (doc: any, fixture: any, key: string, team?: string | null) => { line: number; over: number; under: number; source: string }[];
const stepOf = (key: string) => (/runs$|score$/.test(key) ? 5 : 1);

type Props = { fx: any; teams: [string, number][]; fmt: string; q: Record<string, string>; setQ: (p: Record<string, unknown>) => void };

/**
 * Match Fancy: whole-match and team-total markets (runs, sixes, fours, boundaries, 50s, top over, top score, top batter) over the teams' last N matches
 * in this format, with the bookmaker's line and prices when the books list the market. Scope is Match (both teams' matches together) or one team's own innings.
 */
export function MatchFancy({ fx, teams, fmt, q, setQ }: Props) {
  const { store } = useData();
  const doc = useQuery({ queryKey: ["lines"], queryFn: loadLines, staleTime: 10 * 60_000 });
  const scope = teams.some(([, i]) => String(i) === q.sc) ? Number(q.sc) : -1; // -1 = whole match
  const team = teams.find(([, i]) => i === scope);
  const keys = scope < 0 ? MATCH_KEYS : TEAM_KEYS;
  const key = keys.some(([k]) => k === q.fm) ? q.fm : keys[0][0];
  const win = WINDOWS.includes(Number(q.mw)) ? Number(q.mw) : 20;
  const fmtIdx = FORMATS.indexOf(fmt);

  const ms = useMemo(() => {
    const sets = (scope < 0 ? teams : teams.filter(([, i]) => i === scope)).map(([, i]) => selectMatches(store, { fmt: fmtIdx, team: i, lastN: win }) as number[]);
    return [...new Set(sets.flat())].sort((a, b) => a - b);
  }, [store, teams, scope, fmtIdx, win]);

  const book = useMemo(() => (key === "top_batter" ? [] : fancyLines(doc.data, { a: fx.a, b: fx.b, startMs: fixtureStart(fx).getTime() }, key, team?.[0] ?? null)), [doc.data, fx, key, team]);
  const base: any = useMemo(() => (key === "top_batter" ? null : scope < 0 ? report(store, ms, key) : teamReport(store, ms, scope, key)), [store, ms, key, scope]);
  const line = q.ml !== undefined && q.ml !== "" && Number.isFinite(Number(q.ml)) ? Number(q.ml) : book[0]?.line ?? base?.ladder[2]?.line ?? base?.ladder[0]?.line ?? 0.5;
  const rep: any = useMemo(() => (key === "top_batter" || !base ? null : scope < 0 ? report(store, ms, key, line) : teamReport(store, ms, scope, key, line)), [base, store, ms, key, scope, line]);
  // ladder rows: the engine's lines around the median plus the bookmaker's own line(s), computed on the same matches
  const ladder = useMemo(() => {
    if (!rep) return [];
    const have = new Set(rep.ladder.map((l: any) => l.line));
    const extra = book.filter((b) => !have.has(b.line)).map((b) => (scope < 0 ? report(store, ms, key, b.line) : teamReport(store, ms, scope, key, b.line)).summary);
    return [...rep.ladder, ...extra].sort((a: any, b: any) => a.line - b.line);
  }, [rep, book, store, ms, key, scope]);
  const label = key === "top_batter" ? "Top batter" : (scope < 0 ? (MATCH_MARKETS as any)[key] : (TEAM_TOTAL_MARKETS as any)[key]).label;
  const set = (p: Record<string, unknown>) => setQ({ ...p, ...(p.sc !== undefined || p.fm !== undefined ? { ml: "" } : {}) });
  const bookHere = book.find((b: any) => b.line === line);

  return (
    <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3">
      <PillGroup segmented layoutId="fancy-scope" label="Scope" value={String(scope)} onChange={(v) => set({ sc: v === "-1" ? "" : v })} className="sm:w-96"
        items={[["-1", "Match"], ...teams.map(([name, i]) => [String(i), <span key={i} className="flex items-center gap-1.5"><TeamBadge name={name} size="xs" />{abbr(name)}</span>] as [string, React.ReactNode])]} />
      <PillGroup layoutId="fancy-market" label="Market" value={key} onChange={(v) => set({ fm: v })} items={keys} />
      <div className="flex items-center gap-3">
        <PillGroup segmented layoutId="fancy-window" label="Matches" value={String(win)} onChange={(v) => set({ mw: v })} items={WINDOWS.map((n) => [String(n), `L${n}`])} className="w-44 shrink-0" />
        <span className="min-w-0 truncate text-xs text-muted-foreground">{ms.length} {fmt} matches{scope >= 0 ? ` of ${team?.[0]}` : ""}</span>
      </div>

      {!ms.length ? <EmptyNote>No {fmt} matches to base this on.</EmptyNote> : key === "top_batter" ? <TopBatters ms={ms} scope={scope} teamName={team?.[0]} /> : rep && (
        <>
          <section className="rounded-2xl bg-card p-4 ring-1 ring-white/5">
            <div className="flex items-baseline justify-between gap-2"><h2 className="text-lg font-semibold">{label}</h2><span className="text-xs text-muted-foreground">last {rep.n} matches</span></div>
            <div className="mt-3 flex items-end gap-6">
              <div><div className="text-xs text-muted-foreground">Median</div><div className="text-[40px] font-bold leading-none tracking-tight tabular-nums">{num(rep.summary.median)}</div></div>
              <div><div className="text-xs text-muted-foreground">Mean</div><div className="text-xl font-semibold tabular-nums">{num(rep.summary.mean)}</div></div>
              <div><div className="text-xs text-muted-foreground">Range</div><div className="text-xl font-semibold tabular-nums">{num(rep.summary.min)}–{num(rep.summary.max)}</div></div>
            </div>
            <div className="mt-4"><ValueBars values={rep.values} line={line} /></div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="flex h-9 items-center rounded-full bg-background ring-1 ring-white/5">
                <Button variant="ghost" size="icon" aria-label="Lower the line" className="size-9 rounded-full" onClick={() => set({ ml: Math.max(0, Math.round((line - stepOf(key)) * 2) / 2) })}><Minus /></Button>
                <span className="min-w-[4.5rem] text-center text-sm font-semibold tabular-nums">O/U {line}</span>
                <Button variant="ghost" size="icon" aria-label="Raise the line" className="size-9 rounded-full" onClick={() => set({ ml: Math.round((line + stepOf(key)) * 2) / 2 })}><Plus /></Button>
              </div>
              {book.filter((b: any) => b.line !== line).map((b: any) => <Button key={b.line} variant="secondary" size="sm" className="rounded-full" onClick={() => set({ ml: b.line })}>bet365 line {b.line}</Button>)}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["over", "under"] as const).map((side) => {
                const p = rep.summary[side === "over" ? "pOver" : "pUnder"], fair = rep.summary[side === "over" ? "fairOver" : "fairUnder"], hit = rep.summary[side];
                return (
                  <div key={side} className="rounded-xl bg-background p-3 ring-1 ring-white/5">
                    <div className="text-xs font-medium capitalize text-muted-foreground">{side} {line}</div>
                    <div className={cn("text-2xl font-bold tabular-nums", side === "over" ? "text-primary" : "text-foreground")}>{pc(p)}</div>
                    <div className="text-xs text-muted-foreground">{hit} of {rep.n} · fair {odds(fair)}</div>
                    {bookHere && <div className="mt-1.5 border-t border-white/10 pt-1.5 text-xs">bet365 <b className="tabular-nums">{odds(bookHere[side])}</b></div>}
                  </div>);
              })}
            </div>
            {!book.length && <p className="mt-3 text-xs text-muted-foreground">The books have no line for this market yet. Prices above are fair prices from the matches shown.</p>}
            {rep.n < 10 && <p className="mt-2 text-xs text-amber">Small sample ({rep.n} matches): treat these with caution.</p>}
          </section>

          <section className="overflow-hidden rounded-2xl bg-card ring-1 ring-white/5" aria-label="Line ladder">
            <div className="grid grid-cols-[1fr_1fr_1fr] px-4 py-2.5 text-xs font-medium text-muted-foreground"><span>Line</span><span className="text-right">Over</span><span className="text-right">Under</span></div>
            {ladder.map((l: any) => (
              <button key={l.line} type="button" onClick={() => set({ ml: l.line })} className={cn("grid w-full grid-cols-[1fr_1fr_1fr] items-center border-t border-white/5 px-4 py-3 text-left text-[15px] transition-colors active:bg-accent", l.line === line && "bg-accent/60")}>
                <span className="flex items-center gap-2 font-semibold tabular-nums">{l.line}{book.some((b: any) => b.line === l.line) && <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">bet365</span>}</span>
                <span className="text-right tabular-nums"><b className="text-primary">{pc(l.pOver)}</b> <span className="text-xs text-muted-foreground">{odds(l.fairOver)}</span></span>
                <span className="text-right tabular-nums"><b>{pc(l.pUnder)}</b> <span className="text-xs text-muted-foreground">{odds(l.fairUnder)}</span></span>
              </button>))}
          </section>
        </>)}
    </div>
  );
}

function TopBatters({ ms, scope, teamName }: { ms: number[]; scope: number; teamName?: string }) {
  const { store } = useData();
  const t = useMemo(() => (scope < 0 ? topList(store, ms, { scope: "match" }) : topList(store, ms, { team: scope, scope: "team" })), [store, ms, scope]);
  return (
    <section className="rounded-2xl bg-card ring-1 ring-white/5">
      <div className="px-4 py-3"><h2 className="text-lg font-semibold">Top batter</h2><span className="text-xs text-muted-foreground">{scope < 0 ? `highest score in the match, last ${t.n} matches` : `${teamName} batting first, last ${t.n} matches`}</span></div>
      {t.rows.map((r: any) => (
        <Item key={r.player} asChild size="sm" className="rounded-none border-0 border-t border-white/5 px-4 py-3 transition-colors active:bg-accent">
          <Link to={`/player/${r.player}`}>
            <ItemMedia><PlayerBadge idx={r.player} size="sm" /></ItemMedia>
            <ItemContent className="min-w-0 gap-0.5"><ItemTitle className="max-w-full"><span className="truncate">{r.name}</span></ItemTitle><ItemDescription className="text-[13px]">{r.sole} sole{r.tied ? ` + ${r.tied} tied` : ""} of {t.n}</ItemDescription></ItemContent>
            <ItemActions className="grid justify-items-end text-right"><b className="text-base font-semibold tabular-nums text-primary">{pc(r.pSole)}</b><span className="text-[11px] text-muted-foreground">fair {odds(r.fairSole)}</span></ItemActions>
          </Link>
        </Item>))}
      {!t.rows.length && <p className="px-4 pb-4 text-sm text-muted-foreground">Not enough matches.</p>}
    </section>
  );
}
