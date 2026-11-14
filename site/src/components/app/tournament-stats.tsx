/* eslint-disable @typescript-eslint/no-explicit-any */
import { useId, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChartBarIcon, ChevronDownIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { editionRows, editionSummary, editionsOf, boards as tournamentBoards, trendSeries, TREND_METRICS } from "@cricket/engine/tournament.js";
import { resolvePlayerLabel } from "@cricket/engine/player-label.js";
import { useData } from "@/lib/data";
import { track } from "@/lib/analytics";
import { abbr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnimatedHeight } from "./animated-height";
import { PlayerBadge, TeamBadge } from "./badges";
import { EmptyState } from "./empty-state";
import { PillGroup } from "./pill-group";
import { PlayerName } from "./player-name";
import { PlayerAvatar } from "./portrait";
import { LeagueSkeleton } from "./skeletons";

const SHOWN = 5;
const SPACE = " ", DASH = `${SPACE}–${SPACE}`;
const day = (d: string, year: boolean) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) }).replace(/ /g, SPACE);
const range = (a: string, b: string) => (a === b ? day(a, true) : `${day(a, a.slice(0, 4) !== b.slice(0, 4))}${DASH}${day(b, true)}`);

type Row = { rank: number; p?: number; t: number; q?: number; m?: number; date?: string; v: string; n: number; cells: string[] };
type Board = { id: string; title: string; head: string; cols: string[]; rows: Row[]; note: string };
type Leader = { id: string; label: string; head: string; cols: string[]; row: Row };

const CARD = "rounded-2xl bg-card ring-1 ring-hairline";
/** Denser league-board header (caption). Props/research tables use `TABLE_HEAD` (footnote) instead. */
export const BOARD_HEAD = "label-cap text-caption font-copy text-muted-foreground";
const HEAD = BOARD_HEAD;

/** A small "i" that opens a few words of explanation, so the page itself carries none. */
function Info({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger aria-label={label} className={cn("grid size-control shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", className)}>
        <InformationCircleIcon className="size-5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-64 flex-col gap-tight text-footnote">{children}</PopoverContent>
    </Popover>
  );
}

/** The stats of one league or series: the season picker, the season in four numbers, the leaders, the lists (batting, bowling, overall) and the same measures season by season. */
export function TournamentStats({ eventIdx, season, onSeason }: { eventIdx: number; season: string; onSeason: (key: string) => void }) {
  const { store } = useData();
  const eds = useMemo(() => editionsOf(store, eventIdx), [store, eventIdx]);
  const ed = eds.find((x: any) => x.key === season) ?? eds[0];
  const summary = useMemo(() => (ed ? editionSummary(store, ed) : null), [store, ed]);
  const trend = useMemo(() => (ed ? trendSeries(store, eds, ed) : []), [store, eds, ed]);
  const [read, setRead] = useState<[number, number]>([0, store.nshard]);
  const rows = useQuery({
    queryKey: ["edition-rows", eventIdx, ed?.key], enabled: !!ed, staleTime: Infinity, retry: 1,
    queryFn: () => { setRead([0, store.nshard]); return editionRows(store, ed.ms, { onProgress: (d: number, n: number) => setRead([d, n]) }); },
  });
  const result = useMemo(() => (ed && rows.data ? tournamentBoards(store, ed, rows.data) : null), [store, ed, rows.data]);
  if (!ed) return <p className={cn(CARD, "p-inset text-callout text-muted-foreground")}>No matches in the data for this competition.</p>;
  const scraped = ed.ms.filter((m: number) => store.M.pv?.[m]).length;
  return (
    <div className="flex flex-col gap-stack">
      <div className="flex items-center gap-snug">
        {eds.length > 1 && <SeasonSelect eds={eds} value={ed.key} onChange={(k) => { track("stats_season", { season: k }); onSeason(k); }} />}
        <Badge variant="secondary" className="h-control px-snug text-callout font-copy">{ed.fmt}</Badge>
        <Badge variant="secondary" className="h-control min-w-0 px-snug text-callout font-copy"><span className="truncate">{range(ed.from, ed.to)}</span></Badge>
        <Info label="About these stats" className="ml-auto">
          <p>{ed.fmt} matches only, never mixed with another format.</p>
          <p>Super overs are ignored. Retired hurt is not an out.</p>
          <p>Averages and rates need a minimum number of balls, shown on each list.</p>
          {scraped > 0 && <p>{scraped} {scraped === 1 ? "match comes" : "matches come"} from the live scores with no dismissal detail, so those batters have no average.</p>}
        </Info>
      </div>
      {summary && <Facts s={summary} />}
      {rows.isError ? (
        <div role="alert" className={cn(CARD, "flex items-center justify-between gap-snug p-inset")}>
          <p className="text-callout">Could not read the player files.</p>
          <button type="button" onClick={() => rows.refetch()} className="h-control shrink-0 rounded-[var(--chip-radius)] bg-foreground px-snug text-callout font-label text-background active:opacity-70">Try again</button>
        </div>
      ) : !result ? <Loading done={read[0]} total={read[1]} />
        : !result.groups.some((g: any) => g.boards.length) ? <EmptyState icon={<ChartBarIcon />} title="No player records yet" body="This season has no counted matches in the data yet." />
        : <Lists ed={ed} result={result} />}
      {trend.length > 1 && <Trends points={trend} current={ed.key} onPick={onSeason} />}
    </div>
  );
}

function SeasonSelect({ eds, value, onChange }: { eds: any[]; value: string; onChange: (k: string) => void }) {
  return (
    <select aria-label="Season" value={value} onChange={(e) => onChange(e.target.value)} className="h-control shrink-0 rounded-[var(--chip-radius)] bg-card px-snug text-callout font-label text-foreground outline-none ring-1 ring-hairline focus-visible:ring-2 focus-visible:ring-ring">
      {eds.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
    </select>
  );
}

const fact = (x: number | null | undefined, digits = 0) => (x == null ? "–" : x.toFixed(digits));

/** The season in four numbers, from the innings totals (matches that count for summary markets, as on the Markets tab). */
function Facts({ s }: { s: any }) {
  if (!s.counted) return null;
  const cells: [string, string][] = [["Matches", String(s.matches)], ["Avg 1st inns", fact(s.avgFirst)], ["6s a match", fact(s.sixesPerMatch, 1)], ["Bat 1st won", s.batFirstWinPct == null ? "–" : `${fact(s.batFirstWinPct)}%`]];
  return (
    <dl className={cn(CARD, "grid grid-cols-4 divide-x divide-hairline py-snug")}>
      {cells.map(([k, v]) => (
        <div key={k} className="flex min-w-0 flex-col gap-hair px-snug">
          <dt className={cn(HEAD, "truncate")}>{k}</dt>
          <dd className="num-cond text-metric font-emphasis">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Loading({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex flex-col gap-stack">
      <div role="status" className={cn(CARD, "flex flex-col gap-snug p-inset")}>
        <div className="flex items-baseline justify-between gap-snug text-callout"><span>Reading player files</span><span className="num-cond text-muted-foreground">{done} / {total}</span></div>
        <div role="progressbar" aria-label="Player files read" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="h-1 overflow-hidden rounded-full bg-hairline">
          <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${total ? (100 * done) / total : 0}%` }} />
        </div>
      </div>
      <LeagueSkeleton />
    </div>
  );
}

function Lists({ ed, result }: { ed: any; result: any }) {
  const id = useId();
  const groups = result.groups.filter((g: any) => g.boards.length);
  const [tab, setTab] = useState("bat");
  const group = groups.find((g: any) => g.id === tab) ?? groups[0];
  return (
    <>
      {result.leaders.length > 0 && (
        <div className="-mx-gutter flex snap-x snap-mandatory gap-snug overflow-x-auto overscroll-x-contain px-gutter [scrollbar-width:none] [scroll-padding-inline:var(--gutter)] lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
          {result.leaders.map((l: Leader) => <LeaderCard key={l.id} l={l} test={ed.fmt === "Test"} />)}
        </div>
      )}
      {groups.length > 1 && <PillGroup segmented layoutId={`stats-${id}`} label="Stats" value={group.id} onChange={(v) => { track("stats_group", { group: v }); setTab(v); }} className="w-full" itemClassName="flex-1"
        items={groups.map((g: any) => [g.id, g.label] as [string, string])} />}
      <AnimatedHeight>
        <div className="grid items-start gap-stack lg:grid-cols-2">
          {group.boards.map((b: Board) => <BoardCard key={b.id} b={b} />)}
        </div>
      </AnimatedHeight>
    </>
  );
}

/** The headline card of a list: the leader's picture in his team's shirt, his name and side, and the figure. A swipe rail on a phone, three across from lg. */
function LeaderCard({ l, test }: { l: Leader; test: boolean }) {
  const { store } = useData();
  const r = l.row, team = store.teams[r.t]?.n ?? "";
  return (
    <Link to={`/player/${r.p}`} title={l.cols.map((c, i) => `${c}${SPACE}${r.cells[i]}`).join(" · ")} onClick={() => track("stats_leader", { board: l.id })}
      className={cn(CARD, "flex w-(--fixture-card) shrink-0 snap-start flex-col gap-snug p-inset transition-colors active:bg-accent lg:w-auto")}>
      <span className={HEAD}>{l.label}</span>
      <span className="flex items-center gap-snug">
        <PlayerAvatar idx={r.p!} team={team} test={test} className="size-14" />
        <span className="grid min-w-0 flex-1 gap-hair">
          <span className="truncate text-body font-label"><PlayerName idx={r.p!} /></span>
          <span className="flex items-center gap-tight text-footnote text-muted-foreground"><TeamBadge name={team} size="xs" />{abbr(team)}</span>
        </span>
        <span className="grid justify-items-end gap-hair">
          <span className="num-cond text-stat font-emphasis leading-none text-primary">{r.v}</span>
          <span className={HEAD}>{l.head}</span>
        </span>
      </span>
    </Link>
  );
}

/** One list as a table: rank, name with side, the headline figure, then the supporting columns (two on a phone, all from sm). */
function BoardCard({ b }: { b: Board }) {
  const { store, names } = useData();
  const nav = useNavigate();
  const [all, setAll] = useState(false);
  const shown = all ? b.rows : b.rows.slice(0, SHOWN);
  const side = (t?: number) => abbr(store.teams[t ?? -1]?.n ?? "");
  const num = "px-snug text-right tabular-nums";
  const edge = (i: number) => cn(i >= 2 && "hidden sm:table-cell", i === b.cols.length - 1 && "pr-inset", i === 1 && b.cols.length > 2 && "max-sm:pr-inset"); // the last column on show keeps the card's inset
  return (
    <section aria-label={b.title} className={cn(CARD, "flex min-w-0 flex-col overflow-hidden")}>
      <header className="flex items-center justify-between gap-snug pl-inset pr-tight pt-tight">
        <h3 className="text-body font-label">{b.title}</h3>
        {b.note ? <Info label={`About ${b.title}`}><p>{b.note}</p></Info> : <span className="h-control" />}
      </header>
      <Table className="text-callout">
        <TableHeader>
          <TableRow className="border-hairline hover:bg-transparent">
            <TableHead className={cn(HEAD, "h-8 w-6 pl-inset pr-0 text-left")}>#</TableHead>
            <TableHead className={cn(HEAD, "h-8 px-snug text-left")}>{b.rows[0]?.p != null ? "Player" : "Team"}</TableHead>
            <TableHead className={cn(HEAD, "h-8", num)}>{b.head}</TableHead>
            {b.cols.map((c, i) => <TableHead key={c} className={cn(HEAD, "h-8", num, edge(i))}>{c}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((r) => {
            const player = r.p != null, name = player ? resolvePlayerLabel(store.playerName(r.p!), { catalogName: names?.[store.P.id[r.p!]] }) : store.teamName(r.t, true), crest = store.teams[r.t]?.n ?? "";
            const sub = r.m == null ? (player ? side(r.t) : "") : `${player ? `${side(r.t)} ` : ""}v ${side(r.q)}${r.date ? ` · ${day(r.date, false)}` : ""}`;
            return (
              <TableRow key={`${r.rank}-${r.p ?? r.t}-${r.m ?? ""}`} className={cn("border-hairline", player && "cursor-pointer")} onClick={(e) => { if (player && !(e.target as HTMLElement).closest("a")) nav(`/player/${r.p}`); }}>
                <TableCell className="w-6 py-tight pl-inset pr-0 text-footnote tabular-nums text-muted-foreground">{r.rank}</TableCell>
                <TableCell className="w-full max-w-0 px-snug py-tight">
                  <span className="flex items-center gap-snug">
                    {player ? <PlayerBadge idx={r.p!} size="md" className="max-sm:hidden" /> : <TeamBadge name={crest} size="md" className="max-sm:hidden" />}
                    <span className="grid min-w-0 gap-hair">
                      <span className="truncate font-label">{player ? <Link to={`/player/${r.p}`} title={name} className="hover:underline"><PlayerName idx={r.p!} /></Link> : name}</span>
                      <span className="flex items-center gap-tight truncate text-footnote text-muted-foreground">{player && r.m == null && <TeamBadge name={crest} size="xs" />}{sub}</span>
                    </span>
                  </span>
                </TableCell>
                <TableCell className={cn(num, "font-emphasis", r.rank === 1 && "text-primary")}>{r.v}</TableCell>
                {r.cells.map((c, i) => <TableCell key={i} className={cn(num, "text-muted-foreground", edge(i))}>{c}</TableCell>)}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {b.rows.length > SHOWN && (
        <button type="button" aria-expanded={all} onClick={() => { track("stats_more", { board: b.id }); setAll(!all); }} className="flex h-control items-center justify-center gap-tight border-t border-hairline text-callout font-label text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:bg-accent">
          {all ? "Show less" : `Show all ${b.rows.length}`}
          <ChevronDownIcon className={cn("size-4 transition-transform", all && "rotate-180")} aria-hidden />
        </button>
      )}
    </section>
  );
}

/** One measure for every season of this competition (same format and gender), oldest on the left; tap a bar to look at that season. */
function Trends({ points, current, onPick }: { points: any[]; current: string; onPick: (key: string) => void }) {
  const id = useId();
  const [metric, setMetric] = useState(TREND_METRICS[0].id);
  const m = TREND_METRICS.find((x: any) => x.id === metric) ?? TREND_METRICS[0];
  const vals = points.map((p) => p[m.id] as number | null);
  const top = Math.max(1, ...vals.map((v) => v ?? 0));
  const at = points.findIndex((p) => p.key === current);
  const read = (i: number) => (vals[i] == null ? "–" : m.digits ? vals[i]!.toFixed(m.digits) : String(Math.round(vals[i]!)));
  return (
    <section aria-label="Season by season" className={cn(CARD, "flex flex-col gap-snug p-inset")}>
      <div className="flex items-center justify-between gap-snug">
        <h3 className="text-body font-label">Season by season</h3>
        <Info label="About season by season" className="-mr-tight"><p>Seasons with at least three counted matches, matches that count for summary markets only (void games out). Tap a bar to open that season.</p></Info>
      </div>
      <PillGroup layoutId={`trend-${id}`} label="Measure" value={metric} onChange={setMetric} items={TREND_METRICS.map((x: any) => [x.id, x.label] as [string, string])} />
      <div role="img" aria-label={`${m.label} by season: ${points.map((p, i) => `${p.label} ${read(i)}`).join(", ")}`} className="flex h-28 items-end gap-hair border-b border-hairline">
        {points.map((p, i) => (
          <button key={p.key} type="button" aria-label={`${p.label}: ${read(i)}`} aria-pressed={p.key === current} title={`${p.label}: ${read(i)}`} onClick={() => onPick(p.key)} className="group flex h-full min-w-0 flex-1 items-end outline-none">
            <span className={cn("w-full rounded-t-[3px] transition-colors", p.key === current ? "bg-primary" : "bg-foreground/25 group-hover:bg-foreground/40 group-focus-visible:bg-foreground/40")} style={{ height: `${Math.max(((vals[i] ?? 0) / top) * 100, 3)}%` }} />
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 items-center text-footnote tabular-nums text-muted-foreground">
        <span>{points[0].label}</span>
        <span className="text-center font-label text-foreground">{at >= 0 ? `${points[at].label}${SPACE}·${SPACE}${read(at)}` : ""}</span>
        <span className="text-right">{points[points.length - 1].label}</span>
      </div>
    </section>
  );
}
