/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { abbr, dayKey, dayLabel, fixtureStart, localTime, pretty } from "@/lib/format";
import { TeamBadge } from "./badges";

const seriesName = (f: any) => (f.series ? (f.series.includes(" ") ? f.series : pretty(f.series.replace(/-\d{4}$/, ""))) : `${f.gender === "female" ? "Women's" : "Men's"} cricket`);
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
    <Link to={f.id ? `/fixture/${f.id}` : f.a_ix >= 0 ? `/team/${f.a_ix}` : "/teams"} className="group flex w-[340px] shrink-0 snap-start flex-col rounded-2xl border bg-card px-4 pb-3 pt-3.5 shadow-[0_1px_0_0_rgba(255,255,255,.04)_inset] transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-[#161616] hover:shadow-[0_10px_30px_-14px_var(--primary)]">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.14em]">
        {live ? <span className="flex items-center gap-1.5 text-miss"><span className="size-2 animate-pulse rounded-full bg-miss" />Live</span> : <span className="text-muted-foreground">Upcoming</span>}
        <span className="ml-auto min-w-0 truncate text-[12px] font-medium normal-case tracking-normal text-muted-foreground" title={`${seriesName(f)} · ${f.venue || ""}`}>{f.fmt || "T20"}{f.gender === "female" ? " (W)" : ""}{city(f.venue) ? ` • ${city(f.venue)}` : ""}</span>
      </div>
      <div className="mt-3 flex items-stretch gap-3">
        <div className="grid min-w-0 flex-1 gap-2.5">
          {[f.a, f.b].map((t: string) => <div key={t} className="flex items-center gap-2.5" title={t}><TeamBadge name={t} /><b className="truncate text-[17px] font-semibold tracking-wide">{abbr(t)}</b></div>)}
        </div>
        <div className="grid shrink-0 content-center justify-items-end text-right">
          <span className="text-[13px] text-muted-foreground">{dayLabel(dayKey(f))}</span>
          {timed && <span className="text-xl font-bold tabular-nums leading-tight">{localTime(when)}</span>}
        </div>
      </div>
      <p className="mt-3 min-h-5 truncate text-[14px] text-foreground/80">{status}</p>
      <div className="mt-2.5 flex items-center border-t pt-2.5 text-[13px] font-semibold">
        <span className="min-w-0 truncate font-normal text-muted-foreground">{seriesName(f)}</span>
        <span className="ml-auto pl-3 text-primary">Props</span>
      </div>
    </Link>
  );
}

/** Chips (All + top series) over a snap-scrolling rail of FixtureCards, arrow buttons on desktop. */
export function FixtureRail({ fx }: { fx: any[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState("all");
  const chips = useMemo(() => {
    const c = new Map<string, number>();
    fx.forEach((f) => c.set(seriesName(f), (c.get(seriesName(f)) || 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [fx]);
  const shown = sel === "all" ? fx : fx.filter((f) => seriesName(f) === sel);
  if (!fx.length) return null;
  const by = (d: number) => ref.current?.scrollBy({ left: d * 700, behavior: "smooth" });
  const chip = (on: boolean) => cn("shrink-0 rounded-xl border px-4 py-2 text-sm font-medium transition-colors max-w-[220px] truncate", on ? "border-foreground/70 bg-card text-foreground" : "border-border/60 text-muted-foreground hover:text-foreground");
  const arrow = "absolute top-[calc(50%+28px)] z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full border bg-background/95 shadow-lg backdrop-blur transition hover:border-primary hover:text-primary md:grid";
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="relative -mx-4 pt-4 md:-mx-8" aria-label="Upcoming matches">
      <div className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:px-8 [&::-webkit-scrollbar]:hidden">
        <button type="button" className={chip(sel === "all")} onClick={() => setSel("all")}>Matches ({fx.length})</button>
        {chips.map(([n, k]) => <button key={n} type="button" title={n} className={chip(sel === n)} onClick={() => setSel(n)}>{n} ({k})</button>)}
      </div>
      <button type="button" aria-label="Scroll left" onClick={() => by(-1)} className={`${arrow} left-3`}><ChevronLeft className="size-5" /></button>
      <div ref={ref} className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 py-4 [scrollbar-width:none] md:px-8 [&::-webkit-scrollbar]:hidden">
        {shown.map((f) => <FixtureCard key={`${f.id}${f.a}${f.b}`} f={f} />)}
      </div>
      <button type="button" aria-label="Scroll right" onClick={() => by(1)} className={`${arrow} right-3`}><ChevronRight className="size-5" /></button>
    </motion.section>
  );
}
