/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { STATS } from "@/engine/rules.js";
import { FORMATS } from "@/engine/util.js";
import { useData } from "@/lib/data";
import { collectGrid } from "@/lib/grid";
import { clockLiveMs, liveBlurb, teamScore } from "@/engine/live.js";
import { dayKey, dayLabel, fixtureStart, fixtureWhen, localTime } from "@/lib/format";
import { formatCountdown, formatElapsed, useNow } from "@/lib/clock";
import { setTitle } from "@/lib/title";
import { fixtureBooks } from "@/engine/lines.js";
import { fixtureState, useFixtureBooks, useFixtures, usePricedFixtures } from "@/hooks/useEngine";
import { useLiveMatch } from "@/hooks/useLive";
import { Field, LiveForm, NativeSelect, useQ } from "@/components/app/forms";
import { PillGroup } from "@/components/app/pill-group";
import { LineStepper } from "@/components/app/line-stepper";
import { HotProps } from "@/components/app/hot-props";
import { MatchFancy } from "@/components/app/match-fancy";
import { GridTable, TrendCards } from "@/components/app/grid";
import { TeamBadge, usePreloadTeams } from "@/components/app/badges";
import { LiveScore } from "@/components/app/fixture-card";
import { LiveBoard, MatchAccordions } from "@/components/app/live-board";
import { LiveFeed } from "@/components/app/live-feed";
import { AnimatedHeight } from "@/components/app/animated-height";
import { cn } from "@/lib/utils";
import { GridSkeleton, ListSkeleton, MatchHeaderSkeleton, RowsSkeleton } from "@/components/app/skeletons";
import { Crumbs, DataTable, EmptyNote, Muted, PageTitle, Panel } from "@/components/app/page";
import { Input } from "@/components/ui/input";

const STAT_OPTIONS: [string, string][] = Object.entries(STATS).map(([k, v]: any) => [k, v.label]);
const GAMES: [number, string][] = [5, 10, 15, 20, 30].map((n) => [n, `Last ${n}`]);
const HITS: [number, string][] = [[0.5, "50%+"], [0.6, "60%+"], [0.7, "70%+"], [0.8, "80%+"]];
const fmtOf = (f: any) => (FORMATS.includes(f?.fmt) ? f.fmt : "T20");

const TABS: [string, string][] = [["props", "Props"], ["fancy", "Match Fancy"], ["grid", "Grid"], ["trends", "Trends"]];

/** Where the match is in time: label (Upcoming / Live / Completed) and the ticking value, from the shared 1 s clock. */
function useMatchClock(when: Date, timed: boolean, fmt?: string) {
  const now = useNow(1000), ms = when.getTime() - now;
  if (!timed) return { label: "Upcoming", value: "Time TBC", tone: "" };
  if (ms > 0) return { label: "Upcoming", value: formatCountdown(ms), tone: "" };
  if (ms > -clockLiveMs(fmt)) return { label: "Live", value: formatElapsed(-ms), tone: "live" };
  return { label: "Completed", value: "", tone: "" };
}

/** Match header, flat like Source B's (no card): status and format, the two sides with their start time and live timer, then series and venue. */
function MatchHeader({ f, live }: { f: any; live: boolean }) {
  const nav = useNavigate();
  const when = fixtureStart(f), timed = f.start.length > 10;
  const clock = useMatchClock(when, timed, f.fmt);
  const { match } = useLiveMatch(f);
  const scores = [teamScore(match, f.a), teamScore(match, f.b)];
  const hasScore = scores.some((s) => s?.display);
  const final = match?.status === "final" || (!match && fixtureState(f) === "final");
  const delayed = !final && !hasScore && match?.status === "upcoming" && clock.tone === "live"; // its time has passed but the live feed says it has not started: delayed, not in play
  const on = !final && !delayed && (hasScore || clock.tone === "live" || fixtureState(f, match?.status) === "live");
  const blurb = liveBlurb(match) || (final ? f.result || "" : "");
  const team = (name: string, ix: number) => {
    const body = <><TeamBadge name={name} size="md" className="size-control" eager /><span className="min-w-0 truncate text-title font-bold leading-tight tracking-tight">{name}</span></>;
    return ix >= 0 ? <Link to={`/team/${ix}`} className="flex min-w-0 flex-1 items-center gap-snug active:opacity-70">{body}</Link> : <div className="flex min-w-0 flex-1 items-center gap-snug">{body}</div>;
  };
  const sides: [string, number][] = [[f.a, f.a_ix], [f.b, f.b_ix]];
  return (
    <section className="flex flex-col gap-stack">
      <button type="button" aria-label="Back" onClick={() => (history.length > 1 ? nav(-1) : nav("/"))} className="-ml-2 flex items-center rounded-lg px-1 py-tight text-body text-primary transition-opacity active:opacity-40"><ChevronLeftIcon className="size-5" />Back</button>
      <div className="flex items-center gap-snug">
        <span className={cn("text-footnote font-semibold uppercase tracking-[.14em]", on ? "text-miss" : "text-muted-foreground")}>
          {on && <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-miss align-middle" />}{on ? "Live" : final ? "Final" : delayed ? "Delayed" : clock.label}
        </span>
        <span className="text-footnote font-medium text-muted-foreground">· {f.fmt || "T20"} · {f.gender === "female" ? "Women" : "Men"}</span>
        {live && <LiveFeed className="ml-auto" />}
      </div>
      {hasScore ? (
        <div className="grid gap-stack">
          {sides.map(([name, ix], i) => (
            <div key={name} className="flex min-w-0 items-center gap-snug">
              {team(name, ix)}
              <LiveScore s={scores[i]} size="lg" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-snug">
          <div className="grid min-w-0 gap-stack">{team(f.a, f.a_ix)}{team(f.b, f.b_ix)}</div>
          <div className="grid justify-items-end gap-hair text-right">
            <span className="text-callout font-semibold text-muted-foreground">{dayLabel(dayKey(f))}{timed ? `, ${localTime(when)}` : ""}</span>
            <b className={cn("text-metric font-bold leading-none tracking-tight tabular-nums", on && "text-miss")}>{delayed ? "Start delayed" : clock.value}</b>
          </div>
        </div>
      )}
      <p className="text-callout text-muted-foreground">{[blurb, f.series, f.venue].filter(Boolean).join(" · ") || "Match details to be confirmed"}</p>
      {hasScore && !final && <LiveBoard match={match} teams={sides} />}
    </section>
  );
}

/** Stat pills, a line stepper and the games window; hit-rate floor only for Trends. All state lives in the URL. */
function FilterBar({ stat, line, games, hit, setQ }: { stat: string; line: number; games: number; hit?: string; setQ: (p: Record<string, unknown>) => void }) {
  const step = (d: number) => setQ({ line: Math.max(0, Math.round((line + d) * 2) / 2) });
  return (
    <div className="flex min-w-0 flex-col gap-snug">
      <PillGroup layoutId="fx-stat" label="Stat" value={stat} onChange={(v) => setQ({ stat: v })} items={STAT_OPTIONS} />
      <div className="flex items-center gap-tight">
        <LineStepper value={line} label="O" min={0} onStep={step} />
        <PillGroup segmented layoutId="fx-games" label="Games" value={String(games)} onChange={(v) => setQ({ n: v })} items={[5, 10, 15, 20, 30].map((n) => [String(n), `L${n}`])} className="min-w-0" />
      </div>
      {hit !== undefined && <PillGroup segmented layoutId="fx-hit" label="Minimum hit rate" value={hit} onChange={(v) => setQ({ hit: v })} items={HITS.map(([v, l]) => [String(v), l])} />}
    </div>
  );
}

export function FixturePage() {
  const { store } = useData();
  const { "*": id = "" } = useParams();
  const [q, setQ] = useQ();
  const { fixtures: pricedFx, priced, ready } = usePricedFixtures();
  const { fx, doc, archived, isLoading } = useFixtureBooks(id);
  const live = !!fx && priced && pricedFx.some((p) => p.id === fx.id);
  const { match } = useLiveMatch(fx);
  const books = fixtureBooks(doc, fx);
  const fmt = FORMATS.includes(q.fmt) ? q.fmt : fx ? fmtOf(fx) : "T20";
  const stat = (STATS as any)[q.stat] ? q.stat : "sixes";
  const line = q.line !== undefined && q.line !== "" ? Number(q.line) : 0.5;
  const games = [5, 10, 15, 20, 30].includes(Number(q.n)) ? Number(q.n) : 10;
  const tabs = TABS.filter(([k]) => (k === "props" ? books.props : k === "fancy" ? books.fancy : true));
  const wanted = q.tab === "markets" ? "fancy" : q.tab; // old links used ?tab=markets
  const tab = tabs.some(([k]) => k === wanted) ? wanted : tabs[0][0];
  const hit = HITS.some(([v]) => String(v) === q.hit) ? q.hit : "0.6";
  const teams: [string, number][] = fx ? [[fx.a, fx.a_ix], [fx.b, fx.b_ix]] : [];
  const known = teams.filter(([, i]) => i >= 0);
  const gridTeam = known.some(([, i]) => String(i) === q.team) ? Number(q.team) : known[0]?.[1];
  const grids = useQuery({ queryKey: ["fx-grids", id, fmt, stat, games], enabled: !!fx && fx.fmt !== "FC", queryFn: async () => Promise.all(known.map(async ([name, i]) => ({ name, team: i, g: await collectGrid(store, i, fmt, stat, games) }))) });
  const bodyRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  // switching tabs: if the page is scrolled past the top of the tab body, bring the new body into view (smoothly) instead of stranding the reader mid-way
  const switchTab = (t: string) => {
    setQ({ tab: t });
    const align = () => { const el = bodyRef.current; if (el && el.getBoundingClientRect().top < 128) el.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" }); };
    align();
    setTimeout(align, 420); // the body's height finishes animating after ~300 ms: settle exactly on its top
  };
  const shown = grids.data?.find((x) => x.team === gridTeam) ?? grids.data?.[0];
  usePreloadTeams(fx ? [fx.a, fx.b] : []);
  setTitle(fx ? `${fx.a} v ${fx.b}: stats, props and listed lines` : "Match preview, player grid and trends");
  if (isLoading) return <div><MatchHeaderSkeleton /><RowsSkeleton /></div>;
  if (!fx) return <div className="flex flex-col items-start gap-snug pt-snug"><EmptyNote>That fixture is no longer in the schedule.</EmptyNote><Button asChild variant="secondary" className="rounded-full"><Link to="/">Back to fixtures</Link></Button></div>;
  if (fx.fmt === "FC") return <div><MatchHeader f={fx} live={false} /><Panel title="First-class match"><Muted>First-class cricket is not part of the stats here, so there is no player grid for this match.</Muted></Panel></div>;
  return (
    <div className="flex flex-col gap-section">
      <MatchHeader f={fx} live={live} />
      <MatchAccordions match={match} teams={known} fmt={fmt} />
      {!ready ? <div className="flex flex-col gap-stack"><Skeleton className="h-control w-72 rounded-full" /><RowsSkeleton /></div> : (
        <div className="flex min-w-0 flex-col gap-stack">
          <div className="sticky top-header z-30 -mx-gutter bg-background/80 px-gutter py-tight backdrop-blur-xl backdrop-saturate-150">
            <PillGroup segmented layoutId="fx-tab" label="Sections" value={tab} onChange={switchTab} items={tabs} />
          </div>
          <div ref={bodyRef} className="scroll-mt-32">
          <AnimatedHeight>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex min-w-0 flex-col gap-stack">
          {tab === "props" && <HotProps teams={[fx.a, fx.b]} start={fx.start} fmt={fx.fmt} archive={archived ? doc : undefined} />}
          {tab === "grid" && (
            <>
              <FilterBar {...{ stat, line, games, setQ }} />
              <div className="flex min-w-0 flex-col gap-snug">
                {known.length > 1 && (
                  <PillGroup segmented layoutId="fx-team" label="Team" value={String(gridTeam)} onChange={(v) => setQ({ team: v })}
                    items={known.map(([name, i]) => [String(i), <span key={i} className="flex items-center gap-tight"><TeamBadge name={name} size="xs" />{name}</span>])} />
                )}
                <div className="flex flex-wrap items-center gap-x-stack gap-y-tight text-footnote text-muted-foreground">
                  <span className="flex items-center gap-tight"><span className="size-2.5 rounded-[3px] bg-primary/60" />clears {line}</span>
                  <span className="flex items-center gap-tight"><span className="size-2.5 rounded-[3px] bg-destructive/60" />does not</span>
                  <span className="flex items-center gap-tight"><span className="rounded border border-dashed border-amber/60 px-hair text-caption text-amber">VOID</span>in the XI, did not bat or bowl</span>
                </div>
              </div>
              {grids.isLoading || !shown ? <GridSkeleton /> : (
                <section className="flex flex-col gap-snug">
                  <h2 className="flex items-center gap-tight text-body font-semibold"><TeamBadge name={shown.name} size="xs" />{shown.name}<span className="text-callout font-normal text-muted-foreground">{(STATS as any)[stat].label} over {line}</span></h2>
                  <GridTable g={shown.g} teamIdx={shown.team} line={line} />
                </section>)}
            </>)}
          {tab === "trends" && (
            <>
              <FilterBar {...{ stat, line, games, hit, setQ }} />
              {grids.data ? <TrendCards grids={grids.data} line={line} minHit={Number(hit)} stat={stat} /> : <RowsSkeleton />}
            </>)}
          {tab === "fancy" && <MatchFancy fx={fx} teams={known} fmt={fmt} q={q} setQ={setQ} doc={doc} />}
              </motion.div>
            </AnimatePresence>
          </AnimatedHeight>
          </div>
        </div>)}
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
    <div className="flex flex-col gap-stack">
      <Crumbs items={[["Home", "/"], ["Tools", "/tools"], ["Player trends"]]} />
      <PageTitle sub="Strongest recent hit-rate streaks for the players in an upcoming match.">Player trends</PageTitle>
      <LiveForm onValues={(v) => setQ(v)} key={sel?.id}>
        <Field label="Fixture"><NativeSelect name="f" defaultValue={sel?.id} options={fxs.map((f) => [f.id, `${fixtureWhen(f, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}  ${f.a} v ${f.b} (${f.fmt || "T20"})`])} className="max-w-72" /></Field>
        <Field label="Format"><NativeSelect name="fmt" options={FORMATS.map((f: string) => [f, f])} defaultValue={fmt} /></Field>
        <Field label="Stat"><NativeSelect name="stat" options={STAT_OPTIONS} defaultValue={stat} /></Field>
        <Field label="Line"><Input name="line" type="number" step="0.5" defaultValue={line} className="w-24" /></Field>
        <Field label="Games"><NativeSelect name="n" options={GAMES} defaultValue={n} /></Field>
        <Field label="Min hit rate"><NativeSelect name="hit" options={HITS} defaultValue={q.hit || "0.6"} /></Field>
      </LiveForm>
      {!sel ? <EmptyNote>No upcoming fixtures with known teams right now.</EmptyNote> : (
        <div className="flex flex-col gap-snug"><h2 className="text-title font-medium">{sel.a} v {sel.b}</h2>
          {grids.data ? <TrendCards grids={grids.data} line={line} minHit={Number(q.hit || 0.6)} stat={stat} /> : <ListSkeleton rows={4} />}
          <Muted>Players whose last {n} {fmt} games for their team cleared {(STATS as any)[stat].label.toLowerCase()} over {line}. Games he did not feature in are excluded.</Muted></div>)}
    </div>
  );
}
void Card;
