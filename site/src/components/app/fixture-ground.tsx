/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Singular ground page: `/fixture/:id/ground` (tour chip + back to match) and
 * `/venue/:id` (venues list entry). Hero, weather, format chips + gender Filters
 * sheet (Props / Match Fancy pattern), FixtureCards, then Markets (Fancy-shaped ladder).
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { AdjustmentsHorizontalIcon, ChevronLeftIcon, ChevronRightIcon, CloudIcon, InformationCircleIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { MATCH_MARKETS, marketReport, selectMatches, topBatters } from "@cricket/engine/markets.js";
import { FORMATS } from "@cricket/engine/util.js";
import { useData } from "@/lib/data";
import { useFixtures } from "@/hooks/useEngine";
import { useNow } from "@/lib/clock";
import { matchDateLabel, odds, pc } from "@/lib/format";
import { filterGames, genderFilterLabel, groundGames, groundSummary, majorityFormat, MARKET_CHIPS, seriesName, tourDatesAtGround, tourStatusAtGround, venueParts, type GenderFilter, type GroundSummary, type TourStatus } from "@/lib/ground";
import { setTitle } from "@/lib/title";
import { fetchVenueWx, groundClock } from "@/lib/venue-wx";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ActiveChip, Chip } from "@/components/app/chip";
import { FixtureCard } from "@/components/app/fixture-card";
import { PlayerBadge, TeamBadge } from "@/components/app/badges";
import { StatsAd } from "@/components/app/stats-ad";
import { TABLE_HEAD } from "@/components/app/page";
import { EmptyState } from "@/components/app/empty-state";
import { cn } from "@/lib/utils";
import { GroundSkeleton } from "@/components/app/skeletons";
import { AnimatedNumber } from "@/components/app/animated-number";
import { ValueBars } from "@/components/app/mini-bars";
import { GroundGenderSheet } from "@/components/app/ground-filters";

export { fixtureHasGround, genderFilterLabel, tourDatesAtGround, tourStatusAtGround } from "@/lib/ground";
export type { GenderFilter } from "@/lib/ground";

const EASE = [0.22, 1, 0.36, 1] as const;
const pct1 = (n: number) => `${(n * 100).toFixed(1)}%`;

function TourStatusMark({ status }: { status: TourStatus }) {
  if (status === "In progress") {
    return (
      <span className="inline-flex shrink-0 items-center gap-tight label-cap text-caption font-label text-miss" role="status">
        <span aria-hidden className="relative grid size-1.5 place-items-center">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-miss/60 motion-reduce:animate-none" />
          <span className="relative size-1.5 rounded-full bg-miss" />
        </span>
        Live
      </span>
    );
  }
  if (status === "Completed") {
    return (
      <span className="inline-flex shrink-0 items-center gap-hair label-cap text-caption text-muted-foreground">
        <CheckCircleIcon aria-hidden className="size-3.5" />Done
      </span>
    );
  }
  return <span className="shrink-0 label-cap text-caption text-muted-foreground">Upcoming</span>;
}

function useVenueGround(venue?: string) {
  const { store } = useData();
  const { data: fixtures, isLoading } = useFixtures();
  const g = useMemo(() => groundGames(store, fixtures, venue), [store, fixtures, venue]);
  return { ...g, isLoading };
}

/** Flat label + value — Player props / Match Fancy Audit-free Metric (no filled tile). */
function Metric({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-hair">
      <span className="label-cap text-callout leading-tight text-muted-foreground">{k}</span>
      <b className="break-words font-condensed text-metric font-label leading-none tabular-nums">{v}</b>
    </div>
  );
}

const num0 = (n: number | null | undefined) => (n == null ? "—" : String(Math.round(n)));
const num1 = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(1));

/** One cell in the 2x2 Facts grid (tournament Stats / Player Metric). */
function Fact({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-hair px-snug py-snug">
      <dt className="label-cap truncate text-muted-foreground">{k}</dt>
      <dd className="font-condensed text-metric font-label tabular-nums">{v}</dd>
    </div>
  );
}

function statsTip(s: GroundSummary): string {
  const parts = [
    `Averages over ${s.counted} void-excluded ${s.firstN ? `${s.firstN} 1st` : "0 1st"} / ${s.secondN} 2nd inns.`,
    s.decided ? `Chase ${num0(s.chaseWinPct)}% · defend ${num0(s.defendWinPct)}% of ${s.decided} decided.` : null,
    s.powerplayOvers
      ? (s.avgPowerplay == null
        ? `Powerplay (overs 1–${s.powerplayOvers}): no full over tape in this sample.`
        : `Powerplay (overs 1–${s.powerplayOvers}): ${s.powerplayN} with a full tape.`)
      : null,
  ];
  return parts.filter(Boolean).join(" ");
}

/**
 * Venue intelligence for the active format + gender (same sample as Markets).
 * Always a 2x2 Facts grid + full-width hairline secondary rows (Fancy Typical/Average shape).
 */
function GroundStats({ store, venueIndexes, fmt, gender }: { store: any; venueIndexes: number[]; fmt: string; gender: GenderFilter }) {
  const fmtName = FORMATS.includes(fmt) ? fmt : "T20";
  const ms = useMemo(() => selectMatches(store, {
    fmt: FORMATS.indexOf(fmtName),
    venue: venueIndexes,
    gender: gender === "female" ? 1 : gender === "male" ? 0 : null,
  }) as number[], [store, venueIndexes, fmtName, gender]);
  const s = useMemo(() => groundSummary(store, ms, fmtName), [store, ms, fmtName]);
  if (!s.counted) return null;
  const hi = s.highestFirst;
  const showPp = s.powerplayOvers != null;
  // Always 2x2: when the format has no powerplay, Extras fills the fourth cell.
  const primary: [string, ReactNode][] = [
    ["1st inns avg", num0(s.avgFirst)],
    ["2nd inns avg", num0(s.avgSecond)],
    ["Chase win", s.chaseWinPct == null ? "—" : `${num0(s.chaseWinPct)}%`],
    showPp
      ? [`PP 1–${s.powerplayOvers}`, s.avgPowerplay == null ? "—" : num0(s.avgPowerplay)]
      : ["Extras / match", num1(s.avgExtras)],
  ];
  // One labelled figure per row (Fancy rhythm) — not "20.4 4s · 3.4 6s · 45%".
  const secondary: [string, ReactNode][] = [
    ["Fours / inns", num1(s.foursPerInns)],
    ["Sixes / inns", num1(s.sixesPerInns)],
  ];
  if (s.boundaryRunPct != null) secondary.push(["Boundary runs", `${num0(s.boundaryRunPct)}%`]);
  if (showPp) secondary.push(["Extras / match", num1(s.avgExtras)]);
  secondary.push(["Highest 1st", (
    <span className="tabular-nums">
      {hi ? hi.runs : "—"}
      {hi ? <span className="text-callout font-copy text-muted-foreground"> · {hi.a} vs {hi.b}, {matchDateLabel(hi.date)}</span> : null}
    </span>
  )]);
  return (
    <section className="flex flex-col gap-snug" aria-label="Ground stats">
      <div className="flex items-baseline justify-between gap-snug">
        <div className="flex min-w-0 items-center gap-tight">
          <h2 className="text-title font-label tracking-tight">Ground stats</h2>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label="About ground stats" className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                <InformationCircleIcon className="size-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="max-w-64 text-callout text-muted-foreground">{statsTip(s)}</PopoverContent>
          </Popover>
        </div>
        <span className="shrink-0 text-callout tabular-nums text-muted-foreground">{s.counted} · {fmtName} · void excluded</span>
      </div>
      {/* One bordered block (no gap between 2x2 and rows) — same continuous hairline stack as Fancy lists. */}
      <div className="overflow-hidden border border-hairline">
        <dl className="grid grid-cols-2 divide-x divide-y divide-hairline">
          {primary.map(([k, v]) => (
            <Fact key={k} k={k} v={v} />
          ))}
        </dl>
        <dl className="border-t border-hairline">
          {secondary.map(([k, v]) => (
            <div key={k} className="flex min-h-11 items-center justify-between gap-snug border-t border-hairline px-snug py-snug first:border-t-0">
              <dt className="label-cap shrink-0 text-muted-foreground">{k}</dt>
              <dd className="min-w-0 text-right font-condensed text-metric font-label tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      {s.counted < 10 ? <p className="text-footnote text-amber" role="status">Small sample ({s.counted} matches): treat these with caution.</p> : null}
    </section>
  );
}

/** Past games listed before Show more (embedded Ground chip stays short; full page a bit longer). */
const MATCH_PAGE_EMBED = 4;
const MATCH_PAGE_FULL = 8;

function GroundMatches({ list, pageSize }: { list: any[]; pageSize: number }) {
  const [shown, setShown] = useState(pageSize);
  useEffect(() => { setShown(pageSize); }, [list, pageSize]);
  return (
    <section className="flex flex-col gap-snug">
      <div className="flex items-baseline justify-between gap-snug">
        <h2 className="text-title font-label tracking-tight">Matches</h2>
        <span className="font-condensed text-callout font-label tabular-nums text-muted-foreground">{list.length}</span>
      </div>
      {!list.length ? (
        <EmptyState compact title="No matches" body="Nothing at this ground for the filters you picked." />
      ) : (
        <>
          <ul className="flex flex-col gap-snug" aria-label="Matches at this ground">
            {list.slice(0, shown).map((f, i) => (
              <li key={f.id || f._key || `${f.a}-${f.b}-${f.start}`}>
                <FixtureCard f={f} i={Math.min(i, 6)} />
              </li>
            ))}
          </ul>
          {list.length > shown ? (
            <Button type="button" variant="secondary" className="h-control w-full rounded-2xl text-callout shadow-none" onClick={() => setShown((n) => n + pageSize)}>
              Show more · {list.length - shown} left
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}

/** Format chips + optional gender Filters button (AdjustmentsHorizontal + Men/Women/All). */
function GroundFilterBar({ fx, fmt, gender, onFmt, onGender }: {
  fx: any[]; fmt: string; gender: GenderFilter;
  onFmt: (v: string) => void; onGender: (v: GenderFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const formats = useMemo(() => {
    const c = new Map<string, number>();
    for (const f of fx) { const k = f.fmt || "T20"; c.set(k, (c.get(k) || 0) + 1); }
    return FORMATS.filter((f) => c.has(f)).map((f) => [f, c.get(f)!] as [string, number]);
  }, [fx]);
  const hasMen = fx.some((f) => f.gender !== "female");
  const hasWomen = fx.some((f) => f.gender === "female");
  const both = hasMen && hasWomen;
  const gl = genderFilterLabel(gender);
  return (
    <div className="flex flex-col gap-snug">
      <div className="flex items-center gap-snug">
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-tight overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="toolbar" aria-label="Format filters">
          {formats.map(([f, n]) => {
            const count = gender
              ? fx.filter((x) => (x.fmt || "T20") === f && (x.gender === gender || (!x.gender && gender === "male"))).length
              : n;
            if (gender && !count) return null;
            return <Chip key={f} on={fmt === f} onClick={() => onFmt(f)}>{f}<span className="text-footnote opacity-70">{count}</span></Chip>;
          })}
        </div>
        {both ? (
          <Button type="button" variant="secondary" size="sm" aria-label={`Filters${gender ? ", 1 active" : ""}`} onClick={() => setOpen(true)}
            className="relative h-control shrink-0 rounded-[var(--chip-radius)] bg-card px-snug text-callout shadow-none">
            <AdjustmentsHorizontalIcon className="size-4" />{gl}
            {gender ? <span className="absolute -right-hair -top-hair grid min-w-4 place-items-center rounded-full bg-primary px-hair text-caption font-emphasis text-primary-foreground ring-2 ring-background">1</span> : null}
          </Button>
        ) : null}
      </div>
      {both && gender ? (
        <div className="-mx-gutter flex items-center gap-snug overflow-x-auto px-gutter [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Active filters">
          <ActiveChip label="Gender" value={gl} onRemove={() => onGender("")} />
          <button type="button" onClick={() => onGender("")} className="h-control shrink-0 px-snug text-callout font-label text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">Clear all</button>
        </div>
      ) : null}
      {both ? <GroundGenderSheet open={open} onOpenChange={setOpen} gender={gender} onApply={onGender} /> : null}
    </div>
  );
}

type FromFx = { a: string; b: string; series?: string; start?: string; status?: string; gender?: string; fmt?: string };

/** Compact tour row back to the match: crests, series, dates here, status mark (MatchStatus language). */
function TourChip({ from, fixtureId, atGround, now }: { from: FromFx; fixtureId: string; atGround: any[]; now: number }) {
  const series = seriesName(from);
  const same = useMemo(() => {
    const key = series;
    const hits = atGround.filter((f) => seriesName(f) === key);
    if (hits.length) return hits;
    return from.start ? [{ ...from, source: "schedule" }] : [];
  }, [atGround, series, from]);
  const status = tourStatusAtGround(same, now);
  const dates = tourDatesAtGround(same);
  const n = same.length;
  const sub = dates
    ? (n > 1 ? `${dates} · ${n} here` : dates)
    : `${from.a} v ${from.b}`;
  return (
    <Link
      to={`/fixture/${fixtureId}`}
      className="flex w-full max-w-full items-center gap-snug rounded-2xl bg-card px-snug py-snug outline-none ring-1 ring-hairline transition-colors hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-ring active:opacity-80"
    >
      <span className="flex shrink-0 items-center -space-x-2">
        <TeamBadge name={from.a} size="sm" eager />
        <TeamBadge name={from.b} size="sm" eager />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-callout font-label leading-snug">{series}</span>
        <span className="block truncate text-caption text-muted-foreground">{sub}</span>
      </span>
      <TourStatusMark status={status} />
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

/** Match Fancy–shaped markets: Typical / Average / Low–high (with tips), bars, O/U, ladder. Format from the sticky bar (one format only). */
function GroundMarkets({ store, venueIndexes, fmt, gender }: { store: any; venueIndexes: number[]; fmt: string; gender: GenderFilter }) {
  const reduce = useReducedMotion();
  const [market, setMarket] = useState("match_runs");
  const [line, setLine] = useState<number | null>(null);
  const fmtName = FORMATS.includes(fmt) ? fmt : "T20";
  useEffect(() => { setLine(null); }, [fmtName, market]);
  const ms = useMemo(() => selectMatches(store, {
    fmt: FORMATS.indexOf(fmtName),
    venue: venueIndexes,
    gender: gender === "female" ? 1 : gender === "male" ? 0 : null,
  }), [store, venueIndexes, fmtName, gender]);
  const isTop = market === "top_batter";
  const rep = useMemo(() => (isTop || !ms.length ? null : marketReport(store, ms, market)), [store, ms, market, isTop]);
  const tops = useMemo(() => (isTop && ms.length ? topBatters(store, ms, { scope: "match" }) : null), [store, ms, isTop]);
  const ladder = rep?.ladder?.filter((l: any) => l.n) || [];
  // Summary has no O/U (built with line=null); median often is not a ladder half-line — open on the middle ladder line like Match Fancy.
  const activeLine = line ?? ladder[Math.floor(ladder.length / 2)]?.line ?? ladder[0]?.line ?? null;
  const s = rep?.summary;
  const atLine = activeLine == null ? null : (ladder.find((l: any) => l.line === activeLine) || null);

  return (
    <section className="flex flex-col gap-snug">
      <div className="flex items-baseline justify-between gap-snug">
        <h2 className="text-title font-label tracking-tight">Markets</h2>
        <span className="text-callout tabular-nums text-muted-foreground">{ms.length} matches</span>
      </div>
      <div className="flex flex-nowrap items-center gap-tight overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="toolbar" aria-label="Market">
        {MARKET_CHIPS.map(([k, label]) => (
          <Chip key={k} on={market === k} onClick={() => { setMarket(k); setLine(null); }}>{label}</Chip>
        ))}
      </div>
      {!ms.length ? (
        <EmptyState compact title="No matches" body={`Nothing in ${fmtName} at this ground for these filters.`} />
      ) : isTop && tops ? (
        <section className="-mx-gutter overflow-hidden border-y border-hairline" aria-label="Top batter">
          <p className="px-gutter py-snug text-footnote text-muted-foreground">Highest score in the match · last {tops.n} {fmtName}</p>
          <ul>
            {tops.rows.map((r: any, i: number) => {
              const max = Math.max(...tops.rows.map((x: any) => x.pSole), 0.0001);
              return (
                <motion.li key={r.player} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.3, ease: EASE }} className="relative border-t border-hairline">
                  <motion.span aria-hidden className="absolute inset-y-0 left-0 origin-left bg-primary/10" style={{ width: `${(r.pSole / max) * 100}%` }} initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.03, ease: EASE }} />
                  <Link to={`/player/${r.player}`} className="relative flex items-center gap-snug px-gutter py-snug outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring active:bg-accent">
                    <PlayerBadge idx={r.player} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-label">{r.name}</span>
                      <span className="text-callout text-muted-foreground">{r.sole} sole{r.tied ? ` + ${r.tied} tied` : ""} of {tops.n}</span>
                    </span>
                    <span className="grid justify-items-end text-right">
                      <AnimatedNumber className="text-body font-label tabular-nums text-primary" value={r.pSole} format={pct1} />
                      <span className="text-footnote text-muted-foreground">fair {odds(r.fairSole)}</span>
                    </span>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
          {!tops.rows.length ? <p className="px-gutter pb-snug text-callout text-muted-foreground">Not enough matches.</p> : null}
        </section>
      ) : rep && s && activeLine != null && atLine ? (
        <div className="flex flex-col gap-snug">
          <div className="flex items-baseline justify-between gap-snug">
            <h3 className="text-body font-label">{(MATCH_MARKETS as any)[market]?.label || market}</h3>
            <span className="text-footnote text-muted-foreground">{rep.n} matches · void excluded</span>
          </div>
          <div className="grid grid-cols-3 gap-snug">
            {([
              ["Typical", s.median, "Middle result in this sample (median).", (n: number) => (Number.isInteger(s.median) ? String(Math.round(n)) : n.toFixed(1))],
              ["Average", s.mean, "Mean across the same matches.", (n: number) => n.toFixed(1)],
              ["Low–high", null, "Lowest and highest result in the sample.", null],
            ] as const).map(([lab, val, tip, fmtN]) => (
              <div key={lab} className="grid min-w-0 gap-hair">
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="label-cap inline-flex w-fit items-center gap-hair text-callout leading-tight text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                      {lab}<InformationCircleIcon className="size-3.5 opacity-70" aria-hidden />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="max-w-56 text-callout text-muted-foreground">{tip}</PopoverContent>
                </Popover>
                {lab === "Low–high" ? (
                  <b className="font-condensed text-metric font-label leading-none tabular-nums">
                    {s.min == null || s.max == null ? "—" : (
                      <><AnimatedNumber value={s.min} format={(n) => String(Math.round(n))} />–<AnimatedNumber value={s.max} format={(n) => String(Math.round(n))} /></>
                    )}
                  </b>
                ) : (
                  <AnimatedNumber className="font-condensed text-metric font-label leading-none tabular-nums" value={val as number} format={fmtN as (n: number) => string} />
                )}
              </div>
            ))}
          </div>
          <ValueBars values={rep.values} line={activeLine} />
          <div className="grid grid-cols-2 gap-snug">
            {(["over", "under"] as const).map((side) => {
              const p: number | null = (atLine as any)[side === "over" ? "pOver" : "pUnder"] ?? null;
              const fair = (atLine as any)[side === "over" ? "fairOver" : "fairUnder"];
              const hit = (atLine as any)[side];
              return (
                <div key={side} className="flex flex-col gap-tight border-t border-hairline pt-snug">
                  <div className="text-footnote font-label capitalize text-muted-foreground">{side} {activeLine}</div>
                  <AnimatedNumber className={cn("text-title font-emphasis tabular-nums", side === "over" ? "text-primary" : "text-foreground")} value={p} format={pct1} />
                  <div className="h-1.5 overflow-hidden rounded-full bg-hairline">
                    <motion.div className={cn("h-full w-full origin-left rounded-full", side === "over" ? "bg-primary" : "bg-foreground/70")} initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: p ?? 0 }} transition={{ duration: 0.3, ease: EASE }} />
                  </div>
                  <div className="text-footnote text-muted-foreground">{hit != null ? `${hit} of ${rep.n}` : "—"} · fair {odds(fair)}</div>
                </div>
              );
            })}
          </div>
          {rep.n < 10 ? <p className="text-footnote text-amber">Small sample ({rep.n} matches): treat these with caution.</p> : null}
          {/* Phone: full-bleed like Match Fancy / Player ladder (`-mx-gutter`). */}
          <section className="-mx-gutter min-w-0 border-y border-hairline" aria-label="Line ladder">
            <div className="grid grid-cols-3 px-gutter">
              <span className={cn(TABLE_HEAD, "px-0")}>Line</span>
              <span className={cn(TABLE_HEAD, "px-0 text-right")}>Over</span>
              <span className={cn(TABLE_HEAD, "px-0 text-right")}>Under</span>
            </div>
            {ladder.map((l: any, i: number) => (
              <motion.button key={l.line} type="button" onClick={() => setLine(l.line)} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 7) * 0.03, duration: 0.3, ease: EASE }}
                className="relative grid w-full grid-cols-[1fr_1fr_1fr] items-center border-t border-hairline px-gutter py-snug text-left text-body transition-colors active:bg-accent">
                {l.line === activeLine && <motion.span layoutId="ground-ladder-sel" aria-hidden className="absolute inset-0 bg-accent/60" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }} />}
                <span className="relative font-label tabular-nums">{l.line}</span>
                <span className="relative text-right tabular-nums"><b className="text-primary">{pc(l.pOver)}</b> <span className="text-footnote text-muted-foreground">{odds(l.fairOver)}</span></span>
                <span className="relative text-right tabular-nums"><b>{pc(l.pUnder)}</b> <span className="text-footnote text-muted-foreground">{odds(l.fairUnder)}</span></span>
              </motion.button>
            ))}
          </section>
        </div>
      ) : (
        <EmptyState compact title="No sample" body={`Not enough ${fmtName} matches for this market.`} />
      )}
    </section>
  );
}

/** Dedicated ground page (player-page shape): hero + metrics + sticky filters + cards — no match scores or scorecard. */
export function FixtureGroundPanel({ venue, fixtureId, from, embedded }: {
  venue?: string; fixtureId?: string; from?: FromFx;
  /** Inside the match page's Ground chip: a short head with a link to the full page instead of the hero, no sticky filter row, the page title left alone. */
  embedded?: boolean;
}) {
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const { store } = useData();
  const { primary, venueIndices, label, known, atGround, isLoading } = useVenueGround(venue);
  const majorityFmt = useMemo(() => majorityFormat(atGround), [atGround]);
  const [fmt, setFmt] = useState("");
  const preferredFmt = from?.fmt ?? "";
  const activeFmt = FORMATS.includes(fmt) ? fmt : FORMATS.includes(preferredFmt) ? preferredFmt : majorityFmt;
  const [gender, setGender] = useState<GenderFilter>("");
  const shown = useMemo(() => filterGames(atGround, activeFmt, gender), [atGround, activeFmt, gender]);
  const name = label || venue || "Ground";
  const { ground, city } = venueParts(name);
  const wxQ = useQuery({ queryKey: ["venue-wx", name], queryFn: () => fetchVenueWx(name), staleTime: 10 * 60_000, enabled: !!name });
  const wx = wxQ.data;
  const now = useNow(30_000);
  const local = wx?.timeZone ? groundClock(wx.timeZone, now) : (wx?.localTime || "");
  const fromFixture = !!fixtureId;
  if (!embedded) setTitle(`${ground}: matches at this ground`);

  if (!venue) return <EmptyState title="No venue" body="This fixture has no ground listed." />;
  if (isLoading) return <GroundSkeleton />;
  if (!known && !atGround.length) {
    return <EmptyState title="Ground not in data" body={`We could not match “${venue}” to fixtures or stats.`} />;
  }

  const back = () => {
    if (history.length > 1) nav(-1);
    else if (fromFixture) nav(`/fixture/${fixtureId}`);
    else nav("/teams?tab=venues");
  };

  const metrics = (
    <>
      <div className="grid grid-cols-3 divide-x divide-hairline border-y border-hairline py-snug">
        <div className="px-snug first:pl-0"><Metric k="Matches" v={atGround.length} /></div>
        <div className="px-snug">
          <Metric
            k="Weather"
            v={wxQ.isLoading ? "…" : wx ? (
              <span className="inline-flex items-baseline gap-hair">
                <CloudIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>{wx.temp}°</span>
              </span>
            ) : "—"}
          />
        </div>
        <div className="px-snug last:pr-0"><Metric k="Local" v={wxQ.isLoading ? "…" : (local || "—")} /></div>
      </div>
      {wx ? (
        <p className="text-callout text-muted-foreground">{wx.label} · ground local time{wx.city && wx.city !== city ? ` · ${wx.city}` : ""}</p>
      ) : wxQ.isError ? (
        <p className="text-callout text-muted-foreground">Weather unavailable for this ground</p>
      ) : null}
    </>
  );
  const tour = from && fixtureId ? <TourChip from={from} fixtureId={fixtureId} atGround={atGround} now={now} /> : null;

  // Same vertical rhythm as Match Fancy detail (gap-snug throughout).
  return (
    <div className="flex flex-col gap-snug">
      {embedded ? (
        <div className="flex flex-col gap-snug">
          <div className="flex items-center gap-snug">
            <MapPinIcon className="size-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-label">{ground}</p>
              {city ? <p className="truncate text-footnote text-muted-foreground">{city}</p> : null}
            </div>
            {fixtureId ? <Link to={`/fixture/${fixtureId}/ground`} className="inline-flex shrink-0 items-center gap-hair text-callout font-label text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">Full page<ChevronRightIcon className="size-4" aria-hidden /></Link> : null}
          </div>
          {metrics}
          {tour}
        </div>
      ) : (
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative -mx-gutter overflow-hidden border-b border-hairline px-gutter pb-stack"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_0%_-10%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_55%),radial-gradient(70%_50%_at_100%_20%,color-mix(in_oklab,var(--secondary)_80%,transparent),transparent_50%)]"
        />
        <div className="relative flex flex-col gap-stack pt-stack">
          <button
            type="button"
            aria-label={fromFixture ? "Back to match" : "Back to venues"}
            onClick={back}
            className="hidden size-control place-items-center rounded-full bg-secondary text-primary lg:grid"
          >
            <ChevronLeftIcon className="size-5" />
          </button>
          <div className="flex items-end gap-snug">
            <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-secondary ring-1 ring-hairline">
              <MapPinIcon className="size-8 text-primary" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="label-cap text-footnote text-primary">Ground</p>
              <h1 className="text-display font-emphasis leading-tight tracking-tight">{ground}</h1>
              {city ? <p className="truncate text-body text-muted-foreground">{city}</p> : null}
            </div>
          </div>
          {metrics}
          {tour}
        </div>
      </motion.section>
      )}

      {atGround.length ? (
        <div className={cn(!embedded && "sticky top-header z-30 -mx-gutter bg-background/85 px-gutter py-tight backdrop-blur-xl backdrop-saturate-150")}>
          <GroundFilterBar fx={atGround} fmt={activeFmt} gender={gender} onFmt={setFmt} onGender={setGender} />
        </div>
      ) : null}

      {/* Fancy rhythm: stats → Markets → collapsed Matches (not a long dump before prices). */}
      {primary >= 0 ? <GroundStats store={store} venueIndexes={venueIndices} fmt={activeFmt} gender={gender} /> : null}
      {primary >= 0 ? <GroundMarkets store={store} venueIndexes={venueIndices} fmt={activeFmt} gender={gender} /> : null}
      <GroundMatches key={`${activeFmt}|${gender}`} list={shown} pageSize={embedded ? MATCH_PAGE_EMBED : MATCH_PAGE_FULL} />
    </div>
  );
}

/** `/venue/:id` — same singular ground page without a fixture tour chip. */
export function VenueGroundPage() {
  const { store } = useData();
  const { id } = useParams();
  const idx = Number(id);
  if (!(idx >= 0 && idx < store.venues.length)) return <EmptyState title="Unknown ground" body="This ground is not in the stats data." />;
  return (
    <div className="flex flex-col gap-snug">
      <StatsAd />
      <FixtureGroundPanel venue={store.venues[idx]} />
    </div>
  );
}

/** Venue line on the match header: opens the fixture's ground page (not a sheet). */
export function FixtureVenue({ venue, fixtureId }: { venue?: string; fixtureId: string }) {
  if (!venue || !fixtureId) return null;
  return (
    <Link
      to={`/fixture/${fixtureId}/ground`}
      className={cn(
        "inline-flex max-w-full items-center gap-hair text-left text-callout text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:opacity-70",
      )}
    >
      <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 truncate underline-offset-2">{venue}</span>
      <ChevronRightIcon className="size-3.5 shrink-0 opacity-60" aria-hidden />
    </Link>
  );
}
