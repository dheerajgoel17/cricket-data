/* eslint-disable @typescript-eslint/no-explicit-any */
import { useNavigate, useParams, Link } from "react-router-dom";
import { ChevronLeft, Minus, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { STATS } from "@/engine/rules.js";
import { FORMATS } from "@/engine/util.js";
import { useData } from "@/lib/data";
import { collectGrid } from "@/lib/grid";
import { fixtureStart, fixtureWhen, localTime } from "@/lib/format";
import { formatCountdown, formatElapsed, useNow } from "@/lib/clock";
import { setTitle } from "@/lib/title";
import { useFixtures, usePricedFixtures } from "@/hooks/useEngine";
import { Field, LiveForm, NativeSelect, useQ } from "@/components/app/forms";
import { PillGroup } from "@/components/app/pill-group";
import { HotProps } from "@/components/app/hot-props";
import { MatchFancy } from "@/components/app/match-fancy";
import { GridTable, TrendCards } from "@/components/app/grid";
import { TeamBadge, usePreloadTeams } from "@/components/app/badges";
import { GridSkeleton, MatchHeaderSkeleton, RowsSkeleton } from "@/components/app/skeletons";
import { Crumbs, DataTable, EmptyNote, Muted, PageTitle, Panel } from "@/components/app/page";
import { Input } from "@/components/ui/input";

const STAT_OPTIONS: [string, string][] = Object.entries(STATS).map(([k, v]: any) => [k, v.label]);
const GAMES: [number, string][] = [5, 10, 15, 20, 30].map((n) => [n, `Last ${n}`]);
const HITS: [number, string][] = [[0.5, "50%+"], [0.6, "60%+"], [0.7, "70%+"], [0.8, "80%+"]];
const fmtOf = (f: any) => (FORMATS.includes(f?.fmt) ? f.fmt : "T20");

const TABS: [string, string][] = [["props", "Props"], ["fancy", "Match Fancy"], ["grid", "Grid"], ["trends", "Trends"]];

/** Time to / since the start, ticking every second from the shared clock. */
function MatchTimer({ when, timed }: { when: Date; timed: boolean }) {
  const now = useNow(1000), ms = when.getTime() - now;
  if (!timed) return <span className="text-sm text-muted-foreground">Start time to be confirmed</span>;
  const label = "text-[11px] font-medium uppercase tracking-wider text-muted-foreground";
  if (ms > 0) return <div className="grid justify-items-center gap-0.5"><span className={label}>Starts in</span><b className="text-lg font-semibold tabular-nums">{formatCountdown(ms)}</b></div>;
  if (ms > -4 * 3600e3) return <div className="grid justify-items-center gap-0.5"><span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-miss"><span className="size-1.5 animate-pulse rounded-full bg-miss" />Live</span><b className="text-lg font-semibold tabular-nums">{formatElapsed(-ms)}</b></div>;
  return <span className={label}>Completed</span>;
}

/** One match header (replaces the old hero + "Next match" card): flat flags, teams, start time and a live timer, then series, venue and badges. */
function MatchHeader({ f, live }: { f: any; live: boolean }) {
  const nav = useNavigate();
  const when = fixtureStart(f), timed = f.start.length > 10;
  const team = (name: string, ix: number) => {
    const body = <><TeamBadge name={name} size="lg" eager /><b className="max-w-full text-base font-semibold leading-tight">{name}</b></>;
    return ix >= 0 ? <Link to={`/team/${ix}`} className="grid min-w-0 justify-items-center gap-2.5">{body}</Link> : <div className="grid min-w-0 justify-items-center gap-2.5">{body}</div>;
  };
  return (
    <section className="pt-3">
      <button type="button" aria-label="Back" onClick={() => (history.length > 1 ? nav(-1) : nav("/"))} className="-ml-1 grid size-11 place-items-center rounded-full bg-card active:bg-accent"><ChevronLeft className="size-5" /></button>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        {team(f.a, f.a_ix)}
        <div className="grid justify-items-center gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">{when.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span>
          <b className="text-[28px] font-bold leading-none tracking-tight tabular-nums">{timed ? localTime(when) : "TBC"}</b>
          <div className="mt-1"><MatchTimer when={when} timed={timed} /></div>
        </div>
        {team(f.b, f.b_ix)}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
        {live && <Badge className="px-2.5 py-1 text-[11px] font-semibold">Props live</Badge>}
        <Badge variant="secondary" className="px-2.5 py-1 text-[11px] font-semibold">{f.fmt || "T20"}</Badge>
        <Badge variant="outline" className="px-2.5 py-1 text-[11px] font-semibold">{f.gender === "female" ? "Women" : "Men"}</Badge>
      </div>
      <p className="mt-3 text-center text-sm text-muted-foreground">{[f.series, f.venue].filter(Boolean).join(" · ")}</p>
    </section>
  );
}

/** Stat pills, a line stepper and the games window; hit-rate floor only for Trends. All state lives in the URL. */
function FilterBar({ stat, line, games, hit, setQ }: { stat: string; line: number; games: number; hit?: string; setQ: (p: Record<string, unknown>) => void }) {
  const step = (d: number) => setQ({ line: Math.max(0, Math.round((line + d) * 2) / 2) });
  return (
    <div className="mt-4 grid gap-2">
      <PillGroup layoutId="fx-stat" label="Stat" value={stat} onChange={(v) => setQ({ stat: v })} items={STAT_OPTIONS} />
      <div className="flex items-center gap-2">
        <div className="flex h-9 shrink-0 items-center rounded-full bg-card ring-1 ring-white/5">
          <Button variant="ghost" size="icon" aria-label="Lower the line" className="size-9 rounded-full" onClick={() => step(-0.5)}><Minus /></Button>
          <span className="min-w-[4.25rem] text-center text-sm font-semibold tabular-nums">O {line}</span>
          <Button variant="ghost" size="icon" aria-label="Raise the line" className="size-9 rounded-full" onClick={() => step(0.5)}><Plus /></Button>
        </div>
        <PillGroup segmented layoutId="fx-games" label="Games" value={String(games)} onChange={(v) => setQ({ n: v })} items={[5, 10, 15, 20, 30].map((n) => [String(n), `L${n}`])} className="min-w-0 flex-1 sm:w-72 sm:flex-none" />
      </div>
      {hit !== undefined && <PillGroup segmented layoutId="fx-hit" label="Minimum hit rate" value={hit} onChange={(v) => setQ({ hit: v })} items={HITS.map(([v, l]) => [String(v), l])} className="sm:w-72" />}
    </div>
  );
}

export function FixturePage() {
  const { store } = useData();
  const { "*": id = "" } = useParams();
  const [q, setQ] = useQ();
  const { data: all, isLoading } = useFixtures();
  const { fixtures: pricedFx, priced, ready } = usePricedFixtures();
  const fx = (all || []).find((f) => f.id === id);
  const live = !!fx && priced && pricedFx.some((p) => p.id === fx.id);
  const fmt = FORMATS.includes(q.fmt) ? q.fmt : fx ? fmtOf(fx) : "T20";
  const stat = (STATS as any)[q.stat] ? q.stat : "sixes";
  const line = q.line !== undefined && q.line !== "" ? Number(q.line) : 0.5;
  const games = [5, 10, 15, 20, 30].includes(Number(q.n)) ? Number(q.n) : 10;
  const tabs = TABS.filter(([k]) => k !== "props" || live);
  const wanted = q.tab === "markets" ? "fancy" : q.tab; // old links used ?tab=markets
  const tab = tabs.some(([k]) => k === wanted) ? wanted : tabs[0][0];
  const hit = HITS.some(([v]) => String(v) === q.hit) ? q.hit : "0.6";
  const teams: [string, number][] = fx ? [[fx.a, fx.a_ix], [fx.b, fx.b_ix]] : [];
  const known = teams.filter(([, i]) => i >= 0);
  const gridTeam = known.some(([, i]) => String(i) === q.team) ? Number(q.team) : known[0]?.[1];
  const grids = useQuery({ queryKey: ["fx-grids", id, fmt, stat, games], enabled: !!fx && fx.fmt !== "FC", queryFn: async () => Promise.all(known.map(async ([name, i]) => ({ name, team: i, g: await collectGrid(store, i, fmt, stat, games) }))) });
  const shown = grids.data?.find((x) => x.team === gridTeam) ?? grids.data?.[0];
  usePreloadTeams(fx ? [fx.a, fx.b] : []);
  setTitle("Match preview, player grid and trends");
  if (isLoading) return <div><MatchHeaderSkeleton /><RowsSkeleton /></div>;
  if (!fx) return <div className="pt-3"><EmptyNote>That fixture is no longer in the schedule.</EmptyNote><Button asChild variant="secondary" className="mt-3 rounded-full"><Link to="/">Back to fixtures</Link></Button></div>;
  if (fx.fmt === "FC") return <div><MatchHeader f={fx} live={false} /><Panel title="First-class match"><Muted>First-class cricket is not part of the stats here, so there is no player grid for this match.</Muted></Panel></div>;
  return (
    <div>
      <MatchHeader f={fx} live={live} />
      {!ready ? <div className="mt-5 grid gap-4"><Skeleton className="h-9 rounded-[9px] sm:w-96" /><RowsSkeleton /></div> : <>
      <PillGroup segmented layoutId="fx-tab" label="Sections" value={tab} onChange={(t) => setQ({ tab: t })} items={tabs} className="mt-5 sm:w-96" />
      {tab === "props" && <div className="-mt-2"><HotProps teams={[fx.a, fx.b]} /></div>}
      {tab === "grid" && (
        <>
          <FilterBar {...{ stat, line, games, setQ }} />
          {known.length > 1 && (
            <PillGroup segmented layoutId="fx-team" label="Team" value={String(gridTeam)} onChange={(v) => setQ({ team: v })} className="mt-3 sm:w-80"
              items={known.map(([name, i]) => [String(i), <span key={i} className="flex items-center gap-2"><TeamBadge name={name} size="xs" />{name}</span>])} />
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-primary/60" />clears {line}</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-destructive/60" />does not</span>
            <span className="flex items-center gap-1.5"><span className="rounded border border-dashed border-amber/60 px-1 text-[10px] text-amber">VOID</span>in the XI, did not bat or bowl</span>
          </div>
          <div className="mt-3">
            {grids.isLoading || !shown ? <GridSkeleton /> : (
              <section>
                <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold"><TeamBadge name={shown.name} size="xs" />{shown.name}<span className="text-sm font-normal text-muted-foreground">{(STATS as any)[stat].label} over {line}</span></h2>
                <GridTable g={shown.g} teamIdx={shown.team} line={line} />
              </section>)}
          </div>
        </>)}
      {tab === "trends" && (
        <>
          <FilterBar {...{ stat, line, games, hit, setQ }} />
          <div className="mt-4">{grids.data ? <TrendCards grids={grids.data} line={line} minHit={Number(hit)} stat={stat} /> : <RowsSkeleton />}</div>
        </>)}
      {tab === "fancy" && <MatchFancy fx={fx} teams={known} fmt={fmt} q={q} setQ={setQ} />}
      </>}
    </div>
  );
}

export function TrendsPage() {
  setTitle("Player trends");
  const { store } = useData();
  const [q, setQ] = useQ();
  const { data } = useFixtures();
  const fxs = (data || []).filter((f) => f.a_ix >= 0 && f.b_ix >= 0 && (f.start.length > 10 ? Date.parse(f.start) > Date.now() - 4 * 36e5 : true)).slice(0, 40);
  const sel = fxs.find((f) => f.id === q.f) || fxs[0];
  const fmt = FORMATS.includes(q.fmt) ? q.fmt : sel ? fmtOf(sel) : "T20";
  const stat = (STATS as any)[q.stat] ? q.stat : "sixes";
  const line = q.line !== undefined && q.line !== "" ? Number(q.line) : 0.5;
  const n = Number(q.n) || 10;
  const grids = useQuery({ queryKey: ["trend-grids", sel?.id, fmt, stat, n], enabled: !!sel, queryFn: async () => Promise.all([[sel.a, sel.a_ix], [sel.b, sel.b_ix]].map(async ([name, i]: any) => ({ name, team: i, g: await collectGrid(store, i, fmt, stat, n) }))) });
  return (
    <div>
      <Crumbs items={[["Home", "/"], ["Tools", "/tools"], ["Player trends"]]} />
      <PageTitle sub="Strongest recent hit-rate streaks for the players in an upcoming match.">Player trends</PageTitle>
      <LiveForm onValues={(v) => setQ(v)} className="mb-3" key={sel?.id}>
        <Field label="Fixture"><NativeSelect name="f" defaultValue={sel?.id} options={fxs.map((f) => [f.id, `${fixtureWhen(f, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}  ${f.a} v ${f.b} (${f.fmt || "T20"})`])} className="max-w-72" /></Field>
        <Field label="Format"><NativeSelect name="fmt" options={FORMATS.map((f: string) => [f, f])} defaultValue={fmt} /></Field>
        <Field label="Stat"><NativeSelect name="stat" options={STAT_OPTIONS} defaultValue={stat} /></Field>
        <Field label="Line"><Input name="line" type="number" step="0.5" defaultValue={line} className="w-24" /></Field>
        <Field label="Games"><NativeSelect name="n" options={GAMES} defaultValue={n} /></Field>
        <Field label="Min hit rate"><NativeSelect name="hit" options={HITS} defaultValue={q.hit || "0.6"} /></Field>
      </LiveForm>
      {!sel ? <EmptyNote>No upcoming fixtures with known teams right now.</EmptyNote> : (
        <div><h2 className="mb-2 text-xl font-medium">{sel.a} v {sel.b}</h2>
          {grids.data ? <TrendCards grids={grids.data} line={line} minHit={Number(q.hit || 0.6)} stat={stat} /> : <Muted>Loading…</Muted>}
          <Muted className="mt-3">Players whose last {n} {fmt} games for their team cleared {(STATS as any)[stat].label.toLowerCase()} over {line}. Games he did not feature in are excluded.</Muted></div>)}
    </div>
  );
}
void Card;
