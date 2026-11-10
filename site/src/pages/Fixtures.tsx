/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpOnSquareIcon, ChevronLeftIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { matchShareText } from "@cricket/engine/share-text.js";
import { sendShare, shareFixtureUrl } from "@/lib/share";
import { fancyMarketPath } from "@/lib/fancy-path";
import { track } from "@/lib/analytics";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { STATS } from "@cricket/engine/rules.js";
import { FORMATS } from "@cricket/engine/util.js";
import { useData } from "@/lib/data";
import { collectGrid } from "@/lib/grid";
import { clockStartedMs, liveBlurb, sessionLabel, teamScore } from "@cricket/engine/live.js";
import { playState } from "@/lib/play-state";
import { abbr, dayKey, dayLabel, fixtureStart, fixtureWhen, localTime } from "@/lib/format";
import { formatCountdown, formatElapsed, useNow } from "@/lib/clock";
import { setTitle } from "@/lib/title";
import { HeaderActions } from "@/lib/header-slot";
import { fixtureBooks } from "@cricket/engine/lines.js";
import { fixtureState, useFixtureBooks, useFixtures, usePricedFixtures } from "@/hooks/useEngine";
import { useLiveMatch } from "@/hooks/useLive";
import { Field, LiveForm, NativeSelect, useQ } from "@/components/app/forms";
import { PillGroup } from "@/components/app/pill-group";
import { GridFilterBar } from "@/components/app/grid-filters";
import { HotProps } from "@/components/app/hot-props";
import { MatchFancy } from "@/components/app/match-fancy";
import { GridTable, TrendCards } from "@/components/app/grid";
import { TeamBadge, usePreloadTeams } from "@/components/app/badges";
import { LiveScore, NO_SCORE } from "@/components/app/fixture-card";
import { ScorecardBody, ScorecardCard, hasCard, scoreboardShows } from "@/components/app/live-board";
import { RecentForm, recentForms } from "@/components/app/recent-form";
import { LiveFeed } from "@/components/app/live-feed";
import { FixtureGroundPanel, FixtureVenue, fixtureHasGround } from "@/components/app/fixture-ground";
import { AnimatedHeight } from "@/components/app/animated-height";
import { cn } from "@/lib/utils";
import { GridSkeleton, ListSkeleton, MatchHeaderSkeleton, RowsSkeleton, ScorecardSkeleton } from "@/components/app/skeletons";
import { Crumbs, DataTable, EmptyNote, Muted, PageTitle, Panel } from "@/components/app/page";
import { Input } from "@/components/ui/input";

const STAT_OPTIONS: [string, string][] = Object.entries(STATS).map(([k, v]: any) => [k, v.label]);
const GAMES: [number, string][] = [5, 10, 15, 20, 30].map((n) => [n, `Last ${n}`]);
const HITS: [number, string][] = [[0.5, "50%+"], [0.6, "60%+"], [0.7, "70%+"], [0.8, "80%+"]];
const fmtOf = (f: any) => (FORMATS.includes(f?.fmt) ? f.fmt : "T20");

const TABS: [string, string][] = [["props", "Props"], ["fancy", "Match Fancy"], ["ground", "Ground"], ["form", "Form"], ["grid", "Grid"], ["trends", "Custom line"]];

/** Where the match is in time: label (Upcoming / Started / Completed) and the ticking value, from the shared 1 s clock. The clock never says Live. */
function useMatchClock(when: Date, timed: boolean, fmt?: string) {
  const now = useNow(1000), ms = when.getTime() - now;
  if (!timed) return { label: "Upcoming", value: "Time TBC", tone: "", since: "" };
  if (ms > 0) return { label: "Upcoming", value: formatCountdown(ms), tone: "", since: "" };
  if (ms > -clockStartedMs(fmt)) return { label: "Started", value: formatElapsed(-ms), tone: "started", since: formatElapsed(-ms) };
  return { label: "Completed", value: "", tone: "", since: formatElapsed(-ms) };
}

/** A side's crest and name, linking to its team page when it has one. */
function TeamName({ name, ix, small }: { name: string; ix: number; small?: boolean }) {
  const body = <><TeamBadge name={name} size="md" className={small ? "size-8" : "size-control"} eager /><span className="min-w-0 truncate text-title font-bold leading-tight tracking-tight">{name}</span></>;
  return ix >= 0 ? <Link to={`/team/${ix}`} className="flex min-w-0 flex-1 items-center gap-snug active:opacity-70">{body}</Link> : <div className="flex min-w-0 flex-1 items-center gap-snug">{body}</div>;
}

/** The two sides, each with its score (or "Yet to bat"). */
function ScoreRows({ f, match, small }: { f: any; match: any; small?: boolean }) {
  const sides: [string, number][] = [[f.a, f.a_ix], [f.b, f.b_ix]];
  return (
    <div className={cn("grid", small ? "gap-tight" : "gap-snug")}>
      {sides.map(([name, ix]) => (
        <div key={name} className="flex min-w-0 items-center gap-snug">
          <TeamName name={name} ix={ix} small={small} />
          <LiveScore s={teamScore(match, name)} size="lg" />
        </div>
      ))}
    </div>
  );
}

/** Match header, flat like Source B's (no card): status and format, the two sides with their start time and live timer, then series and venue. */
function MatchHeader({ f, live }: { f: any; live: boolean }) {
  const nav = useNavigate();
  const when = fixtureStart(f), timed = f.start.length > 10;
  const clock = useMatchClock(when, timed, f.fmt);
  const { match } = useLiveMatch(f);
  const { state, hasScore } = playState(f, match);
  const [final, delayed, on, started] = [state === "final", state === "delayed", state === "live", state === "started"]; // in play only on evidence, never on the clock
  const blurb = liveBlurb(match) || (final ? f.result || "" : started ? NO_SCORE : "");
  const session = sessionLabel(blurb) || match?.session || ""; // Rain delay / Stumps / Lunch — same badge as the home card; never a Live pulse over a session break
  const badge = session || (on ? "Live" : final ? "Final" : delayed ? "Delayed" : started ? "Started" : clock.label);
  const livePulse = on && !session;
  const compact = hasScore && !final; // in play: one line for state + ground, a smaller crest, no series line (the board below carries the rest)
  const sides: [string, number][] = [[f.a, f.a_ix], [f.b, f.b_ix]];
  const inCard = compact && scoreboardShows(match, true); // status, ground and scores all sit in the scorecard card instead
  // the live-feed mark and Share live in the top bar, not in the card
  const actions = (
    <HeaderActions>
      {live && <LiveFeed />}
      <button type="button" aria-label="Share" onClick={() => { track("share", { kind: "fixture" }); void sendShare(matchShareText({ a: f.a, b: f.b, when: `${dayLabel(dayKey(f))}${timed ? `, ${localTime(when)}` : ""}`, venue: f.venue, series: f.series, url: shareFixtureUrl(location.origin, f.id) }) || shareFixtureUrl(location.origin, f.id), `${f.a} v ${f.b}`, () => toast("Copied")); }}
      className={cn("grid size-control place-items-center rounded-full bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring",)}><ArrowUpOnSquareIcon className="size-5" /></button>
    </HeaderActions>
  );
  const backBtn = (
    <button type="button" aria-label="Back" onClick={() => (history.length > 1 ? nav(-1) : nav("/"))} className="-ml-2 hidden items-center rounded-lg px-1 py-tight text-body text-primary lg:flex transition-opacity active:opacity-40"><ChevronLeftIcon className="size-5" />Back</button>
  );
  const statusRow = (
      <div className="flex items-center gap-snug">
        <span className={cn("label-cap text-footnote", livePulse ? "text-miss" : session ? "text-destructive" : "text-muted-foreground")}>
          {livePulse && <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-miss align-middle" />}{badge}
        </span>
        <span className="text-footnote font-medium text-muted-foreground">· {f.fmt || "T20"} · {f.gender === "female" ? "Women" : "Men"}</span>
      </div>
  );
  const stateLine = (
        <div className="flex min-w-0 items-center gap-tight text-callout text-muted-foreground">
          {blurb ? <span className="max-w-[60%] shrink-0 truncate">{blurb}</span> : null}
          {blurb && f.venue ? <span aria-hidden>·</span> : null}
          {f.venue ? <div className="min-w-0"><FixtureVenue venue={f.venue} fixtureId={f.id} /></div> : null}
        </div>
  );
  if (inCard) {
    const known = sides.filter(([, i]) => i >= 0);
    return (
      <section className="flex flex-col gap-tight">
        {backBtn}
        {actions}
        <ScorecardCard match={match} teams={known} inPlay fixtureId={f.id} top={<div className="flex flex-col gap-tight">{statusRow}{stateLine}</div>} head={<ScoreRows f={f} match={match} small />} />
      </section>
    );
  }
  return (
    <section className={cn("flex flex-col", compact ? "gap-tight" : hasScore ? "gap-snug" : "gap-stack")}>
      {backBtn}
      {actions}
      {statusRow}
      {hasScore ? <ScoreRows f={f} match={match} small={compact} /> : (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-snug">
          <div className="grid min-w-0 gap-stack"><TeamName name={f.a} ix={f.a_ix} /><TeamName name={f.b} ix={f.b_ix} /></div>
          <div className="grid justify-items-end gap-hair text-right">
            <span className="text-callout font-medium text-muted-foreground">{dayLabel(dayKey(f))}{timed ? `, ${localTime(when)}` : ""}</span>
            <b className={cn("text-metric font-bold leading-none tracking-tight tabular-nums", on && "text-miss")}>{delayed ? "Start delayed" : started ? clock.since : clock.value}</b>
          </div>
        </div>
      )}
      {compact ? stateLine : (
      <div className="flex flex-col gap-hair">
        {(blurb || f.series) ? <p className="text-callout text-muted-foreground">{[blurb, f.series].filter(Boolean).join(" · ")}</p> : null}
        {f.venue ? <FixtureVenue venue={f.venue} fixtureId={f.id} /> : (!blurb && !f.series ? <p className="text-callout text-muted-foreground">Match details to be confirmed</p> : null)}
      </div>
      )}
    </section>
  );
}

export function FixturePage() {
  const { store } = useData();
  const nav = useNavigate();
  const { "*": raw = "" } = useParams();
  const fancyDetail = /\/fancy\/?$/.test(raw);
  const groundDetail = /\/ground\/?$/.test(raw);
  const cardDetail = /\/scorecard\/?$/.test(raw);
  const id = raw.replace(/\/(fancy|ground|scorecard)\/?$/, "");
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
  const hasForm = !!fx && recentForms(store, [[fx.a, fx.a_ix], [fx.b, fx.b_ix]], fmt).some((f) => f.games.length);
  const tabs = TABS.filter(([k]) => (k === "props" ? books.props : k === "fancy" ? books.fancy : k === "form" ? hasForm : k === "ground" ? fixtureHasGround(store, fx?.venue) : true));
  const wanted = q.tab === "markets" ? "fancy" : q.tab; // old links used ?tab=markets
  const tab = tabs.some(([k]) => k === wanted) ? wanted : tabs[0][0];
  const hit = HITS.some(([v]) => String(v) === q.hit) ? q.hit : "0.6";
  const teams: [string, number][] = fx ? [[fx.a, fx.a_ix], [fx.b, fx.b_ix]] : [];
  const known = teams.filter(([, i]) => i >= 0);
  const gridTeam = known.some(([, i]) => String(i) === q.team) ? Number(q.team) : known[0]?.[1];
  const grids = useQuery({ queryKey: ["fx-grids", id, fmt, stat, games], enabled: !!fx && fx.fmt !== "FC", queryFn: async () => Promise.all(known.map(async ([name, i]) => ({ name, team: i, g: await collectGrid(store, i, fmt, stat, games) }))) });
  const bodyRef = useRef<HTMLDivElement>(null);
  const ps = fx ? playState(fx, match) : null, inPlay = !!ps && ps.hasScore && ps.state !== "final";
  const reduceMotion = useReducedMotion();
  // old links opened a market with ?tab=fancy&fm=… and scrolled the chart into view; send them to the market page instead
  useEffect(() => {
    if (!fancyDetail && tab === "fancy" && q.fm) nav(fancyMarketPath(id, { fm: q.fm, sc: q.sc, mw: q.mw, mv: q.mv, ml: q.ml }), { replace: true });
  }, [fancyDetail, tab, q.fm, q.sc, q.mw, q.mv, q.ml, id, nav]);
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
  if (isLoading) return <div className="flex flex-col gap-section"><MatchHeaderSkeleton /><ScorecardSkeleton /><RowsSkeleton /></div>;
  if (!fx) return (
    <div className="flex flex-col items-stretch gap-snug pt-snug">
      <EmptyNote title="Fixture gone">That match is no longer in the schedule.</EmptyNote>
      <Button asChild variant="secondary" className="w-fit rounded-full"><Link to="/">Back to fixtures</Link></Button>
    </div>
  );
  if (fx.fmt === "FC") return <div><MatchHeader f={fx} live={false} /><Panel title="First-class match"><Muted>First-class cricket is not part of the stats here, so there is no player grid for this match.</Muted></Panel></div>;
  if (fancyDetail) {
    return (
      <div className="flex flex-col gap-section">
        <MatchHeader f={fx} live={live} />
        <Link to={`/fixture/${fx.id}?tab=fancy`} className="inline-flex w-fit items-center gap-tight text-callout font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronLeftIcon className="size-4" aria-hidden />Match Fancy
        </Link>
        <MatchFancy fx={fx} teams={known} fmt={fmt} q={q} setQ={setQ} doc={doc} mode="detail" />
      </div>
    );
  }
  if (cardDetail) {
    setTitle(`${fx.a} v ${fx.b} scorecard`);
    return (
      <div className="flex flex-col gap-stack">
        <Link to={`/fixture/${fx.id}`} className="inline-flex w-fit min-w-0 items-center gap-tight text-callout font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronLeftIcon className="size-4 shrink-0" aria-hidden /><span className="truncate">{fx.a} v {fx.b}</span>
        </Link>
        <PageTitle sub={match?.session || liveBlurb(match) || undefined}>Scorecard</PageTitle>
        {hasCard(match) ? <ScorecardBody match={match} teams={known} /> : <EmptyNote title="No scorecard yet">There is no card for this match from our source yet. It shows here once play has started.</EmptyNote>}
      </div>
    );
  }
  if (groundDetail) {
    return <FixtureGroundPanel venue={fx.venue} fixtureId={fx.id} from={{ a: fx.a, b: fx.b, series: fx.series, start: fx.start, status: fx.status, gender: fx.gender }} />;
  }
  return (
    <div className="flex flex-col gap-section">
      <div className="flex flex-col gap-stack">
        <MatchHeader f={fx} live={live} />
        {!inPlay && <ScorecardCard match={match} teams={known} inPlay={false} fixtureId={fx.id} />}
      </div>
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
          {tab === "ground" && <FixtureGroundPanel embedded venue={fx.venue} fixtureId={fx.id} from={{ a: fx.a, b: fx.b, series: fx.series, start: fx.start, status: fx.status, gender: fx.gender }} />}
          {tab === "form" && <RecentForm teams={known} fmt={fmt} />}
          {tab === "grid" && (
            <>
              <GridFilterBar stat={stat} line={line} games={games} items={STAT_OPTIONS} setQ={setQ} />
              <div className="flex min-w-0 flex-col gap-snug">
                {known.length > 1 && (
                  <PillGroup layoutId="fx-team" label="Team" value={String(gridTeam)} onChange={(v) => setQ({ team: v })}
                    items={known.map(([name, i]) => [String(i), <span key={i} className="flex items-center gap-tight"><TeamBadge name={name} size="xs" />{abbr(name)}</span>])} />
                )}
                <div className="flex flex-wrap items-center gap-x-stack gap-y-tight text-footnote text-muted-foreground">
                  <span className="flex items-center gap-tight"><span className="size-2.5 rounded-[3px] bg-primary/60" />clears {line}</span>
                  <span className="flex items-center gap-tight"><span className="size-2.5 rounded-[3px] bg-destructive/60" />does not</span>
                  <span className="flex items-center gap-tight"><span className="rounded border border-dashed border-amber/60 px-hair text-caption text-amber">VOID</span>in the XI, did not bat or bowl</span>
                </div>
              </div>
              {grids.isLoading || !shown ? <GridSkeleton /> : (
                <section className="flex flex-col gap-snug">
                  <h2 className="flex items-center gap-tight text-body font-medium"><TeamBadge name={shown.name} size="xs" />{shown.name}<span className="text-callout font-normal text-muted-foreground">{(STATS as any)[stat].label} over {line}</span></h2>
                  <GridTable g={shown.g} teamIdx={shown.team} line={line} />
                </section>)}
            </>)}
          {tab === "trends" && (
            <>
              <GridFilterBar stat={stat} line={line} games={games} hit={hit} items={STAT_OPTIONS} setQ={setQ} />
              {grids.data ? <TrendCards grids={grids.data} line={line} minHit={Number(hit)} stat={stat} /> : <RowsSkeleton />}
            </>)}
          {tab === "fancy" && <MatchFancy fx={fx} teams={known} fmt={fmt} q={q} setQ={setQ} doc={doc} mode="list" />}
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
      {!sel ? <EmptyNote title="No fixtures to trend">No upcoming matches with known teams right now.</EmptyNote> : (
        <div className="flex flex-col gap-snug"><h2 className="text-title font-medium">{sel.a} v {sel.b}</h2>
          {grids.data ? <TrendCards grids={grids.data} line={line} minHit={Number(q.hit || 0.6)} stat={stat} /> : <ListSkeleton rows={4} />}
          <Muted>Players whose last {n} {fmt} games for their team cleared {(STATS as any)[stat].label.toLowerCase()} over {line}. Games he did not feature in are excluded.</Muted></div>)}
    </div>
  );
}
void Card;
