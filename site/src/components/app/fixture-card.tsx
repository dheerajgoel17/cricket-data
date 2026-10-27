/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { liveBlurb, teamScore } from "@/engine/live.js";
import { useLiveMatch } from "@/hooks/useLive";
import { abbr, dayKey, dayLabel, fixtureStart, localTime, pretty } from "@/lib/format";
import { useNow } from "@/lib/clock";
import { TeamBadge, usePreloadTeams } from "./badges";
import { PillGroup } from "./pill-group";

const seriesName = (f: any) => (f.series ? (f.series.includes(" ") ? f.series : pretty(f.series.replace(/-\d{4}$/, ""))) : `${f.gender === "female" ? "Women's" : "Men's"} cricket`);
/** Short chip label: drops the year, "in <place>" and "tour of <host>" tails so names aren't cut mid-word. */
const shortSeries = (n: string) => {
  const t = n.replace(/\s+\d{4}([-/]\d{2,4})?$/, "").replace(/\s+in\s+[A-Z][\w ]*$/, "").replace(/\s+tour of\s.*$/i, " tour").trim();
  return t.length > 30 ? `${t.slice(0, 29)}…` : t;
};
const hasTime = (f: any) => f.start.length > 10;
const city = (v: string) => (v || "").split(",")[0].replace(/\(.*\)/, "").trim();

/** One team's live total, right-aligned on the same row as the name. Empty means they have not batted. */
export function LiveScore({ s, size = "md", className }: { s: { display?: string; runs?: number | null; wkts?: number | null; overs?: number | null } | null | undefined; size?: "md" | "lg"; className?: string }) {
  if (!s?.display) {
    return <span className={cn("shrink-0 text-muted-foreground", size === "lg" ? "text-callout" : "text-footnote", className)}>Yet to bat</span>;
  }
  const total = s.runs != null && s.wkts != null ? `${s.runs}/${s.wkts}` : String(s.runs ?? String(s.display).replace(/\s*\(.*$/, ""));
  return (
    <span className={cn("inline-flex shrink-0 items-baseline gap-tight tabular-nums", className)}>
      <span className={cn("font-bold leading-none tracking-tight", size === "lg" ? "text-title" : "text-body font-semibold")}>{total}</span>
      {s.overs != null && <span className="text-footnote font-medium text-muted-foreground">{Number.isInteger(s.overs) ? s.overs.toFixed(1) : s.overs} ov</span>}
    </span>
  );
}

export function startsIn(ms: number) {
  const m = Math.max(1, Math.round(ms / 60000)), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d >= 1) return `Starts in ${d} day${d > 1 ? "s" : ""}`;
  return h >= 1 ? `Starts in ${h}h${m % 60 ? ` ${m % 60}m` : ""}` : `Starts in ${m}m`;
}

/** Source B-style match card built from shadcn Card parts: status + format badges, the two sides with the start time, the status line, then series and the Props badge. */
export function FixtureCard({ f, i = 0 }: { f: any; i?: number }) {
  const now = useNow(30000);
  const when = fixtureStart(f), ms = when.getTime() - now, timed = hasTime(f);
  const { match } = useLiveMatch(f);
  const clockLive = timed && ms <= 0 && ms > -4 * 3600e3;
  const scores = [teamScore(match, f.a), teamScore(match, f.b)];
  const hasScore = scores.some((s) => s?.display);
  const final = match?.status === "final" || (!match && f.status === "Completed");
  const live = !final && (hasScore || clockLive);
  const status = liveBlurb(match) || (final ? f.result || "Match completed" : live ? "Match in progress" : timed ? startsIn(ms) : "Start time to be confirmed");
  const winner = final ? [f.a, f.b].find((t: string) => status.toLowerCase().includes(`${t.toLowerCase()} won`)) : undefined;
  const lost = (t: string) => !!winner && t !== winner; // the side that lost a finished match steps back
  return (
    <motion.div className="h-full" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i, 6) * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }} whileHover={{ y: -3 }} whileTap={{ scale: 0.985 }}>
    <Link to={f.id ? `/fixture/${f.id}` : f.a_ix >= 0 ? `/team/${f.a_ix}` : "/teams"} className="group block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full gap-0 rounded-2xl border-0 bg-white/[0.03] py-0 shadow-none ring-1 ring-white/[0.06] transition-colors group-hover:bg-white/[0.06]">
        <div className="flex h-full flex-col gap-snug p-inset">
          <div className="flex items-center gap-tight text-footnote font-medium text-muted-foreground">
            {live ? <span className="inline-flex items-center gap-tight font-semibold uppercase tracking-wider text-destructive"><span className="size-1.5 animate-pulse rounded-full bg-current" />Live</span> : <span className="font-semibold uppercase tracking-wider">{final ? "Final" : "Upcoming"}</span>}
            <span aria-hidden>·</span>
            <span>{f.fmt || "T20"}{f.gender === "female" ? " · W" : ""}</span>
            {city(f.venue) && <span className="ml-auto min-w-0 truncate" title={`${seriesName(f)} · ${f.venue}`}>{city(f.venue)}</span>}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-snug gap-y-snug">
            {[f.a, f.b].map((t: string, k: number) => (
              <div key={t} className="contents">
                <div className="flex min-w-0 items-center gap-snug" title={t}>
                  <TeamBadge name={t} size="md" eager />
                  <span className={cn("truncate text-body font-semibold", lost(t) && "font-medium text-muted-foreground")}>{t}</span>
                </div>
                {hasScore ? <LiveScore s={scores[k]} className={cn(lost(t) && "opacity-60")} /> : k === 0 && !final ? (
                  <span className="row-span-2 grid justify-items-end text-right">
                    <span className="text-footnote text-muted-foreground">{dayLabel(dayKey(f))}</span>
                    {timed && <span className="text-callout font-semibold tabular-nums">{localTime(when)}</span>}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between gap-snug pt-tight">
            <div className="grid min-w-0"><span className="truncate text-footnote font-medium">{status}</span><span className="truncate text-caption text-muted-foreground">{seriesName(f)}</span></div>
            <span className="inline-flex shrink-0 items-center text-footnote font-semibold text-primary">Props<ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
          </div>
        </div>
      </Card>
    </Link>
    </motion.div>
  );
}

/** Series chips (shadcn ToggleGroup) over a shadcn Carousel (embla: swipe, drag, snap; arrows from md) of FixtureCards. */
export function FixtureRail({ fx }: { fx: any[] }) {
  usePreloadTeams(fx.slice(0, 8).flatMap((f) => [f.a, f.b]));
  const [sel, setSel] = useState("all");
  const [api, setApi] = useState<CarouselApi>();
  const [edge, setEdge] = useState({ l: false, r: true });
  const [moving, setMoving] = useState(false); // edge blur shows only while the row is being dragged or is still gliding
  useEffect(() => {
    if (!api) return;
    const upd = () => setEdge({ l: api.canScrollPrev(), r: api.canScrollNext() });
    upd();
    let idle: ReturnType<typeof setTimeout>;
    const move = () => { upd(); setMoving(true); clearTimeout(idle); idle = setTimeout(() => setMoving(false), 160); }; // off ~160 ms after the last movement
    api.on("select", upd).on("reInit", upd).on("scroll", move).on("pointerDown", move);
    return () => { clearTimeout(idle); api.off("select", upd).off("reInit", upd).off("scroll", move).off("pointerDown", move); };
  }, [api]);
  const chips = useMemo(() => {
    const c = new Map<string, number>();
    fx.forEach((f) => c.set(seriesName(f), (c.get(seriesName(f)) || 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [fx]);
  const shown = sel === "all" ? fx : fx.filter((f) => seriesName(f) === sel);
  if (!fx.length) return null;
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex flex-col gap-stack" aria-label="Upcoming matches">
      <PillGroup layoutId="series-chip" label="Filter by series" value={sel} onChange={setSel}
        items={[["all", <>All <span className="ml-1.5 text-footnote text-muted-foreground">{fx.length}</span></>], ...chips.map(([n, k]) => [n, <span key={n} title={n}>{shortSeries(n)} <span className="ml-1 text-footnote text-muted-foreground">{k}</span></span>] as [string, React.ReactNode])]} />
      <Carousel key={sel} setApi={setApi} opts={{ align: "start", dragFree: true, containScroll: "trimSnaps" }}>
        <CarouselContent className="-ml-3">
          {shown.map((f, i) => <CarouselItem key={`${f.id}${f.a}${f.b}`} className="basis-[82%] pl-3 sm:basis-(--fixture-card)"><FixtureCard f={f} i={i} /></CarouselItem>)}
        </CarouselContent>
        {/* edge fades: blurred, masked strips that appear only on the side that still has cards to scroll to */}
        {(["l", "r"] as const).map((side) => (
          <div key={side} aria-hidden className={cn("pointer-events-none absolute inset-y-0 z-10 w-14 bg-black/40 backdrop-blur-md transition-opacity duration-300 ease-out",
            side === "l" ? "left-0 [mask-image:linear-gradient(to_right,#000,transparent)] [-webkit-mask-image:linear-gradient(to_right,#000,transparent)]" : "right-0 [mask-image:linear-gradient(to_left,#000,transparent)] [-webkit-mask-image:linear-gradient(to_left,#000,transparent)]",
            moving && edge[side] ? "opacity-100" : "opacity-0")} />
        ))}
        <CarouselPrevious className="left-2 hidden md:inline-flex" />
        <CarouselNext className="right-2 hidden md:inline-flex" />
      </Carousel>
    </motion.section>
  );
}
