/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { barState } from "@/engine/windows.js";
import { abbr, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Bar chart of a player's last fixtures against a line. Bars grow up from the baseline (Motion); a DNP / VOID / N-A fixture is a grey stub
 * and never counts in a hit rate. Heights are scaled to `top`; more than 20 bars scroll sideways with the newest in view.
 */
export function ChartBars({ entries, line, side, label, onSelect, height = 340, animateKey }: {
  entries: any[]; line: number; side: string; label?: string; onSelect?: (e: any, state: string) => void; height?: number; animateKey?: string;
}) {
  const vals = entries.filter((e) => e.value != null).map((e) => e.value as number);
  const top = Math.max(2, Math.ceil(Math.max(line + 0.5, ...vals, 1)));
  const nt = Math.min(top, 5);
  const ticks = Array.from({ length: nt + 1 }, (_, i) => Math.round((top / nt) * i * 10) / 10);
  const wide = entries.length > 20;
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = scroller.current; if (el) el.scrollLeft = el.scrollWidth; }, [entries.length, animateKey]);
  const colStyle = wide ? { flex: "0 0 30px" } : { flex: "1 1 0" };
  return (
    <figure className="m-0" aria-label={label || "Form chart"}>
      <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-1">
        <div className="flex flex-col justify-between text-right text-sm leading-none text-foreground" style={{ height }}>{ticks.slice().reverse().map((t) => <span key={t}>{t}</span>)}</div>
        <div ref={scroller} className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="w-max min-w-full">
            <div className="relative" style={{ height }}>
              <div className="absolute inset-x-0 z-[2] border-t border-white" style={{ bottom: `${(Math.min(line, top) / top) * 100}%` }}><span className="sticky left-0 inline-block -translate-y-[110%] text-base">{line}</span></div>
              <div className="absolute inset-0 flex items-end gap-1">
                {entries.map((e, i) => {
                  const s = barState(e, line, side) as string;
                  const tip = `${e.date} v ${e.opp}${e.venueName ? ` · ${e.venueName}` : ""}${e.value == null ? ({ void: " · in the XI, did not bat/bowl: bet void", na: " · XI not recorded", dnp: " · not in the XI" } as any)[s] : ` · ${e.value}`}`;
                  const pct = e.value == null ? 0 : Math.max((Math.min(e.value, top) / top) * 100, 1.5);
                  return (
                    <button key={`${animateKey}-${i}`} type="button" title={tip} aria-label={tip} onClick={() => onSelect?.(e, s)} style={colStyle} className="flex h-full min-w-0 cursor-pointer items-end border-0 bg-transparent p-0 hover:brightness-110">
                      {e.value == null
                        ? <div className="h-5 w-full self-end bg-dnp" />
                        : <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.45, delay: Math.min(i * 0.012, 0.4), ease: [0.22, 1, 0.36, 1] }} style={{ height: `${pct}%`, transformOrigin: "bottom" }}
                            className={cn("flex w-full items-end justify-center pb-1 text-[13px] font-medium", s === "miss" ? "bg-miss text-white" : s === "push" ? "bg-amber text-background" : "bg-hit text-background")}>{e.value}</motion.div>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-1 pt-1.5">{entries.map((e, i) => <div key={i} style={colStyle} className="grid min-w-0 justify-items-center text-[10.5px] leading-snug text-muted-foreground"><span className="whitespace-nowrap">{shortDate(e.date)}</span><span>{abbr(e.opp)}</span></div>)}</div>
          </div>
        </div>
      </div>
    </figure>
  );
}
