/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { abbr, dayKey, dayLabel, fixtureStart, localTime, pretty } from "@/lib/format";
import { TeamBadge } from "./badges";

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

/** Cricinfo-style strip card: status + competition on top, abbreviated sides left, start time right, status line, action footer. */
export function FixtureCard({ f }: { f: any }) {
  const when = fixtureStart(f), ms = when.getTime() - Date.now(), timed = hasTime(f);
  const live = timed && ms <= 0 && ms > -4 * 3600e3;
  const status = live ? "Match in progress" : timed ? startsIn(ms) : "Start time to be confirmed";
  return (
    <Link to={f.id ? `/fixture/${f.id}` : f.a_ix >= 0 ? `/team/${f.a_ix}` : "/teams"} className="group flex w-[288px] shrink-0 snap-start flex-col rounded-xl border bg-card px-3 pt-3 transition hover:border-primary/50 hover:bg-[#161616]">
      <div className="flex items-center gap-1.5">
        {live ? <Badge variant="destructive" className="gap-1.5 text-[10px] font-semibold uppercase tracking-wider"><span className="size-1.5 animate-pulse rounded-full bg-white" />Live</Badge> : <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wider">Upcoming</Badge>}
        <Badge variant="outline" className="text-[10px] font-semibold">{f.fmt || "T20"}{f.gender === "female" ? " · W" : ""}</Badge>
        {city(f.venue) && <span className="ml-auto min-w-0 truncate text-[11px] font-medium text-muted-foreground" title={`${seriesName(f)} · ${f.venue}`}>{city(f.venue)}</span>}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <div className="grid min-w-0 gap-2">
          {[f.a, f.b].map((t: string) => <div key={t} className="flex items-center gap-2" title={t}><TeamBadge name={t} size="xs" /><span className="truncate text-sm font-medium capitalize">{abbr(t)}</span></div>)}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs font-medium text-muted-foreground">{dayLabel(dayKey(f))}</div>
          {timed && <div className="text-base font-semibold leading-5 tabular-nums">{localTime(when)}</div>}
        </div>
      </div>
      <p className="mt-3 truncate text-xs font-medium text-muted-foreground">{status}</p>
      <div className="mt-2.5 flex items-center border-t py-2 text-xs font-medium">
        <span className="min-w-0 truncate text-muted-foreground">{seriesName(f)}</span>
        <Badge className="ml-auto text-[11px] font-semibold">Props</Badge>
      </div>
    </Link>
  );
}

/** Chips (All + top series) over a snap-scrolling rail of FixtureCards, arrow buttons on desktop. */
export function FixtureRail({ fx }: { fx: any[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState("all");
  const [edge, setEdge] = useState({ l: false, r: true });
  const chips = useMemo(() => {
    const c = new Map<string, number>();
    fx.forEach((f) => c.set(seriesName(f), (c.get(seriesName(f)) || 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [fx]);
  const upd = () => { const e = ref.current; if (e) setEdge({ l: e.scrollLeft > 8, r: e.scrollLeft + e.clientWidth < e.scrollWidth - 8 }); };
  useEffect(upd, [sel, fx]);
  const shown = sel === "all" ? fx : fx.filter((f) => seriesName(f) === sel);
  if (!fx.length) return null;
  const by = (d: number) => ref.current?.scrollBy({ left: d * 700, behavior: "smooth" });
  const chip = "h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium data-[state=on]:border-primary data-[state=on]:bg-primary/15 data-[state=on]:text-primary";
  const arrow = "absolute top-[calc(50%+22px)] z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full border bg-background/95 shadow-lg backdrop-blur transition hover:border-primary hover:text-primary md:grid";
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="relative -mx-4 pt-4 md:-mx-8" aria-label="Upcoming matches">
      <ToggleGroup type="single" value={sel} onValueChange={(v) => v && setSel(v)} variant="outline" spacing={2} className="w-full gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:px-8 [&::-webkit-scrollbar]:hidden" aria-label="Filter by series">
        <ToggleGroupItem value="all" className={chip}>All <span className="ml-1 text-muted-foreground">{fx.length}</span></ToggleGroupItem>
        {chips.map(([n, k]) => <ToggleGroupItem key={n} value={n} title={n} className={chip}>{shortSeries(n)} <span className="ml-1 text-muted-foreground">{k}</span></ToggleGroupItem>)}
      </ToggleGroup>
      {edge.l && <button type="button" aria-label="Scroll left" onClick={() => by(-1)} className={`${arrow} left-3`}><ChevronLeft className="size-5" /></button>}
      <div ref={ref} onScroll={upd} className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto scroll-smooth px-4 py-4 [scrollbar-width:none] md:scroll-px-8 md:px-8 [&::-webkit-scrollbar]:hidden">
        {shown.map((f) => <FixtureCard key={`${f.id}${f.a}${f.b}`} f={f} />)}
      </div>
      {edge.r && <button type="button" aria-label="Scroll right" onClick={() => by(1)} className={`${arrow} right-3`}><ChevronRight className="size-5" /></button>}
    </motion.section>
  );
}
