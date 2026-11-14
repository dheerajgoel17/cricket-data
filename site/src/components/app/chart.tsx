/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import { barState } from "@cricket/engine/windows.js";
import { abbr, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Bar chart of a player's last fixtures against a line. Same width recipe as Fancy `ValueBars`: full-width
 * in-flow `flex-1` bars, dashed line + value on the right (no y-axis ticks — they sat on the oldest bar and
 * shifted the strip). DNP / VOID / N-A is a grey stub. More than 20 bars scroll sideways with the newest in view.
 */
export function ChartBars({ entries, line, side, label, onSelect, height = 340, animateKey }: {
  entries: any[]; line: number; side: string; label?: string; onSelect?: (e: any, state: string) => void; height?: number; animateKey?: string;
}) {
  const vals = entries.filter((e) => e.value != null).map((e) => e.value as number);
  const top = Math.max(2, Math.ceil(Math.max(line + 0.5, ...vals, 1)));
  const wide = entries.length > 20;
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = scroller.current; if (el && wide) el.scrollLeft = el.scrollWidth; }, [entries.length, animateKey, wide]);
  const col = wide ? "w-[30px] shrink-0" : "min-w-0 flex-1";
  return (
    <figure className="m-0 w-full font-condensed" aria-label={label || "Form chart"}>
      <div ref={scroller} className={cn("w-full min-w-0", wide && "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden")}>
        <div className={cn("flex flex-col gap-tight", wide ? "w-max min-w-full" : "w-full")}>
          <div className="relative flex w-full items-end gap-tight" style={{ height }}>
            {entries.map((e, i) => {
              const s = barState(e, line, side) as string;
              const tip = `${e.date} v ${e.opp}${e.venueName ? ` · ${e.venueName}` : ""}${e.value == null ? ({ void: " · in the XI, did not bat/bowl: bet void", na: " · XI not recorded", dnp: " · not in the XI" } as any)[s] : ` · ${e.value}`}`;
              // Zero must stay a visible red (miss) bar — a 1.5% stub reads as empty on phone heights.
              const pct = e.value == null ? 0 : e.value === 0 ? Math.max(12, (0.5 / top) * 100) : Math.max((Math.min(e.value, top) / top) * 100, 1.5);
              return (
                <button key={`${animateKey}-${i}`} type="button" title={tip} aria-label={tip} onClick={() => onSelect?.(e, s)}
                  className={cn("flex h-full cursor-pointer items-end border-0 bg-transparent p-0 hover:brightness-110", col)}>
                  {e.value == null
                    ? <div className="h-5 w-full self-end rounded-[3px] bg-dnp" />
                    : <div style={{ height: `${pct}%` }} className={cn("flex w-full items-end justify-center rounded-[3px] pb-hair text-callout font-label", e.value === 0 || s === "miss" ? "bg-miss text-white" : s === "push" ? "bg-amber text-background" : "bg-hit text-background")}>{e.value}</div>}
                </button>
              );
            })}
            <div className="pointer-events-none absolute inset-x-0 z-[2] border-t border-dashed border-foreground/35" style={{ bottom: `${(Math.min(line, top) / top) * 100}%` }}>
              <span className="absolute -top-2.5 right-0 rounded-sm bg-background/80 px-tight text-body tabular-nums">{line}</span>
            </div>
          </div>
          <div className="flex w-full gap-tight">
            {entries.map((e, i) => (
              <div key={i} className={cn("grid justify-items-center text-caption leading-snug text-muted-foreground", col)}>
                <span className="whitespace-nowrap">{shortDate(e.date)}</span>
                <span>{abbr(e.opp)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}
