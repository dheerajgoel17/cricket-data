/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { abbr, dayKey, dayLabel, fixtureStart, localTime, pretty } from "@/lib/format";
import { useNow } from "@/lib/clock";
import { TeamFlag, usePreloadTeams } from "./badges";
import { PillGroup } from "./pill-group";

const seriesName = (f: any) => (f.series ? (f.series.includes(" ") ? f.series : pretty(f.series.replace(/-\d{4}$/, ""))) : `${f.gender === "female" ? "Women's" : "Men's"} cricket`);
/** Short chip label: drops the year, "in <place>" and "tour of <host>" tails so names aren't cut mid-word. */
const shortSeries = (n: string) => {
  const t = n.replace(/\s+\d{4}([-/]\d{2,4})?$/, "").replace(/\s+in\s+[A-Z][\w ]*$/, "").replace(/\s+tour of\s.*$/i, " tour").trim();
  return t.length > 30 ? `${t.slice(0, 29)}…` : t;
};
const hasTime = (f: any) => f.start.length > 10;
const city = (v: string) => (v || "").split(",")[0].replace(/\(.*\)/, "").trim();

function startsIn(ms: number) {
  const m = Math.round(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d >= 1) return `Starts in ${d} day${d > 1 ? "s" : ""}`;
  return h >= 1 ? `Match starts in ${h} hr${h > 1 ? "s" : ""} ${m % 60} mins` : `Match starts in ${m} mins`;
}

/** Cricinfo-style match card built from shadcn Card parts: status + format badges, the two sides with the start time, the status line, then series and the Props badge. */
export function FixtureCard({ f, i = 0 }: { f: any; i?: number }) {
  const now = useNow(30000);
  const when = fixtureStart(f), ms = when.getTime() - now, timed = hasTime(f);
  const live = timed && ms <= 0 && ms > -4 * 3600e3;
  const status = live ? "Match in progress" : timed ? startsIn(ms) : "Start time to be confirmed";
  return (
    <motion.div className="h-full" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i, 6) * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }} whileHover={{ y: -3 }} whileTap={{ scale: 0.985 }}>
    <Link to={f.id ? `/fixture/${f.id}` : f.a_ix >= 0 ? `/team/${f.a_ix}` : "/teams"} className="group block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full gap-0 rounded-2xl border-0 py-0 shadow-none ring-1 ring-white/5 transition group-hover:bg-[#232325]">
        <CardHeader className="flex items-center gap-2 px-4 pb-0 pt-4">
          {live ? <Badge variant="destructive" className="gap-1.5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"><span className="size-1.5 animate-pulse rounded-full bg-white" />Live</Badge> : <Badge variant="secondary" className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider">Upcoming</Badge>}
          <Badge variant="outline" className="px-2.5 py-1 text-[11px] font-semibold">{f.fmt || "T20"}{f.gender === "female" ? " · W" : ""}</Badge>
          {city(f.venue) && <span className="ml-auto min-w-0 truncate text-xs font-medium text-muted-foreground" title={`${seriesName(f)} · ${f.venue}`}>{city(f.venue)}</span>}
        </CardHeader>
        <CardContent className="px-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="grid min-w-0 gap-3">
              {[f.a, f.b].map((t: string) => <div key={t} className="flex items-center gap-2" title={t}><TeamFlag name={t} className="h-6 w-9 rounded-[4px]" /><span className="truncate text-base font-semibold capitalize">{abbr(t)}</span></div>)}
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-medium text-muted-foreground">{dayLabel(dayKey(f))}</div>
              {timed && <div className="text-xl font-bold leading-6 tabular-nums">{localTime(when)}</div>}
            </div>
          </div>
          <p className="mt-4 truncate text-[13px] font-medium text-muted-foreground">{status}</p>
        </CardContent>
        <CardFooter className="mt-4 justify-between border-t px-4 py-3 text-[13px] font-medium [.border-t]:pt-3">
          <span className="min-w-0 truncate text-muted-foreground">{seriesName(f)}</span>
          <Badge className="ml-3 px-3 py-1 text-xs font-semibold">Props</Badge>
        </CardFooter>
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
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="pt-4" aria-label="Upcoming matches">
      <PillGroup layoutId="series-chip" label="Filter by series" value={sel} onChange={setSel}
        items={[["all", <>All <span className="ml-1.5 text-xs text-muted-foreground">{fx.length}</span></>], ...chips.map(([n, k]) => [n, <span key={n} title={n}>{shortSeries(n)} <span className="ml-1 text-xs text-muted-foreground">{k}</span></span>] as [string, React.ReactNode])]} />
      <Carousel key={sel} setApi={setApi} opts={{ align: "start", dragFree: true, containScroll: "trimSnaps" }} className="mt-3">
        <CarouselContent className="-ml-3">
          {shown.map((f, i) => <CarouselItem key={`${f.id}${f.a}${f.b}`} className="basis-[86%] pl-3 sm:basis-[360px]"><FixtureCard f={f} i={i} /></CarouselItem>)}
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
