/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MIN_SAMPLE, conditionalReport as conditional, inplayScopes, liveInnings, sideIndex, targetMarks } from "@cricket/engine/inplay.js";
import { liveBoard } from "@cricket/engine/live.js";
import { inplayFor, playerLine, teamLine } from "@cricket/engine/inplay-lines.js";
import { summarize as summarizeRaw } from "@cricket/engine/stats.js";
import { PLAYER_MIN_SAMPLE, PLAYER_RANGE, playerConditional as playerCond } from "@cricket/engine/player-inplay.js";
import { FORMATS } from "@cricket/engine/util.js";
import { PillGroup } from "@/components/app/pill-group";
import { useData } from "@/lib/data";
import { inplayQuery } from "@/lib/queries";
import { odds } from "@/lib/format";
import { cn } from "@/lib/utils";

type Side = [string, number];
type Row = { line: number; over: number; under: number; push: number; n: number };
const NOW = () => Date.now();
// the engine is plain JS: give its report the loose shape this view reads
const summarize = summarizeRaw as unknown as (values: number[], line: number) => Row;
const playerConditional = playerCond as (store: any, rows: any[], o: { fmt: number; state: { balls: number; runs: number } }) => any;
const conditionalReport = conditional as (store: any, ms: number[], o: { team?: number | null; innNo: number; state: { balls: number; runs: number }; target: { kind: string; n?: number } }) => any;

const overs = (o: number) => (Number.isInteger(o) ? o.toFixed(1) : String(o));

/** One ladder line: the line, how many similar innings went over it and how many under, as counts (never a model). */
type Listed = { line: number; over: number | null; under: number | null };

function LadderRow({ r, book }: { r: Row; book?: Listed }) {
  const live = r.over + r.under;
  const lean = r.over === r.under ? "" : r.over > r.under ? "over" : "under";
  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-snug gap-y-hair py-tight">
      <span className="font-condensed text-metric font-bold leading-none tabular-nums">{r.line}</span>
      <span className="flex h-2 overflow-hidden rounded-full bg-secondary" aria-hidden>
        {live > 0 && <span className="bg-primary/70" style={{ width: `${(r.over / live) * 100}%` }} />}
      </span>
      <span className="flex items-baseline gap-snug whitespace-nowrap text-callout tabular-nums">
        <span className={cn(lean === "over" ? "font-medium text-primary" : "text-muted-foreground")}>Over {r.over}/{r.n}</span>
        <span className={cn(lean === "under" ? "font-medium text-primary" : "text-muted-foreground")}>Under {r.under}/{r.n}</span>
      </span>
      {book && <span className="col-span-3 text-footnote text-muted-foreground">Book line now · Over {odds(book.over)} · Under {odds(book.under)}</span>}
    </li>
  );
}

/** The ladder to show: the book's live line first (scored on the same similar innings) with its prices, then the lines around the middle without a repeat of it. */
function withBook(report: any, book: Listed | null, take?: [number, number]): { r: Row; book?: Listed }[] {
  const base = (take ? (report.ladder as Row[]).slice(...take) : (report.ladder as Row[])).filter((r) => !book || r.line !== book.line).map((r) => ({ r }));
  return book && report.n > 0 ? [{ r: summarize(report.values, book.line), book }, ...base] : base;
}

/** One batter at the crease (10 to 30 balls in): his own past innings that were in the same spot, counted. Nothing shown when he is not in the data or has none like this. */
function BatterHistory({ b, teamIx, fmtIx, listed }: { b: any; teamIx: number; fmtIx: number; listed: any }) {
  const { store, rz } = useData();
  const idx = useMemo(() => {
    const hits = rz.players(b.name, teamIx >= 0 ? { team: teamIx } : {}, 2) as { idx: number; score: number }[];
    return hits.length && hits[0].score >= 8 ? hits[0].idx : null; // the resolver's own bar for "this is the player"
  }, [rz, b.name, teamIx]);
  const rows = useQuery({ queryKey: ["progression", idx], enabled: idx != null, staleTime: Infinity, queryFn: () => store.playerProgression(idx) });
  const r = useMemo(() => (rows.data ? playerConditional(store, rows.data, { fmt: fmtIx, state: { balls: b.balls, runs: b.runs } }) : null), [store, rows.data, fmtIx, b.balls, b.runs]);
  if (!r || r.n === 0) return null;
  const [lo, hi] = r.band as [number, number];
  return (
    <div className="flex flex-col gap-hair">
      <div className="flex items-baseline justify-between gap-snug">
        <h3 className="truncate text-body font-medium">{b.name}</h3>
        <span className="label-cap text-footnote text-muted-foreground">{b.runs} ({b.balls})</span>
      </div>
      <p className="text-callout text-muted-foreground">{r.n} of his {r.n === 1 ? "innings was" : "innings were"} between {lo} and {hi} after {b.balls} balls. His final scores:</p>
      <ul className="flex flex-col divide-y divide-border/60">{withBook(r, playerLine(listed, b.name) as Listed | null, [1, 4]).map((x) => <LadderRow key={x.r.line} {...x} />)}</ul>
      {r.low && <p className="text-footnote text-amber">Small sample: under {PLAYER_MIN_SAMPLE} innings.</p>}
    </div>
  );
}

/**
 * "From here": for the innings being batted right now, how past innings that were in the same spot went on (`engine/inplay.js`). Counts only: 60 after 6 overs, 6 of the 9 innings
 * within 54-66 at that point passed 190.5. Hidden when the match is not live, is a Test or The Hundred, or the side's history is not in the data.
 */
export function InplayHistory({ match, fmt, gender, teams }: { match: any; fmt: string; gender: string; teams: Side[] }) {
  const { store } = useData();
  const fmtIx = FORMATS.indexOf(fmt);
  const inn = useMemo(() => liveInnings(match, fmtIx), [match, fmtIx]);
  const feed = useQuery({ ...inplayQuery, enabled: !!inn });
  const names = (match?.teams ?? []).map((t: any) => t.name);
  const listed = inn && feed.data ? inplayFor(feed.data, { a: names[0], b: names[1] }) : null;
  const [scope, setScope] = useState<"team" | "wide">("wide");
  const [target, setTarget] = useState("total");
  const teamIx = inn ? sideIndex(teams, inn.team) : -1;
  const scopes = useMemo(() => (inn && store.M ? inplayScopes(store, { fmt: fmtIx, gender: gender === "female" ? 1 : 0, team: teamIx >= 0 ? teamIx : null, now: NOW() }) : null), [store, inn, fmtIx, gender, teamIx]);
  const targets = useMemo(() => {
    if (!inn) return [] as [string, string][];
    return [["total", "Innings"], ...(targetMarks(inn) as number[]).map((n) => [`o${n}`, `${n} ov`])] as [string, string][];
  }, [inn]);
  const t = targets.some(([k]) => k === target) ? target : "total";
  const report = useMemo(() => {
    if (!inn || !scopes) return null;
    const ms = scope === "team" ? scopes.team : scopes.wide;
    return conditionalReport(store, ms, { team: scope === "team" && teamIx >= 0 ? teamIx : null, innNo: inn.innNo, state: { balls: inn.balls, runs: inn.runs }, target: t === "total" ? { kind: "total" } : { kind: "overs", n: Number(t.slice(1)) } });
  }, [store, inn, scopes, scope, teamIx, t]);
  const batters = useMemo(() => (inn ? ((liveBoard(match)?.batters ?? []) as any[]).filter((b) => b.balls >= PLAYER_RANGE[0] && b.balls <= PLAYER_RANGE[1]) : []), [match, inn]);
  if (!inn || !report) return null;
  const [lo, hi] = report.band as [number, number];
  const what = t === "total" ? "finished with" : `had after ${t.slice(1)} overs`;
  return (
    <section className="flex flex-col gap-snug" aria-label="From here">
      <div className="flex items-baseline justify-between gap-snug">
        <h2 className="text-title font-bold tracking-tight">From here</h2>
        <span className="label-cap text-footnote text-muted-foreground">{inn.runs}/{inn.wkts} · {overs(inn.overs)} ov</span>
      </div>
      <p className="text-callout text-muted-foreground">
        {report.n === 0 ? `No past ${fmt} innings were between ${lo} and ${hi} after ${overs(inn.overs)} overs in this history.` : `${report.n} past ${fmt} innings were between ${lo} and ${hi} after ${overs(inn.overs)} overs. This is what they ${what}.`}
      </p>
      <div className="flex flex-wrap items-center gap-snug">
        {teamIx >= 0 && <PillGroup segmented layoutId="inplay-scope" label="History" value={scope} onChange={(v) => setScope(v as "team" | "wide")} items={[["wide", `All ${fmt}`], ["team", "This side"]]} />}
        {targets.length > 1 && <PillGroup segmented layoutId="inplay-target" label="Line on" value={t} onChange={setTarget} items={targets} />}
      </div>
      {report.n > 0 && (
        <ul className="flex flex-col divide-y divide-border/60">
          {withBook(report, t === "total" && listed ? (teamLine(listed, inn.team, inn.innNo) as Listed | null) : null).map((x) => <LadderRow key={x.r.line} {...x} />)}
        </ul>
      )}
      {report.n > 0 && report.low && <p className="text-footnote text-amber">Small sample: under {MIN_SAMPLE} innings, so read the counts loosely.</p>}
      {batters.map((b) => <BatterHistory key={b.name} b={b} teamIx={teamIx} fmtIx={fmtIx} listed={listed} />)}
    </section>
  );
}
