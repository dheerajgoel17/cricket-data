import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const BAR: Record<string, string> = { hit: "bg-primary", miss: "bg-miss", push: "bg-amber", dnp: "bg-dnp/50", void: "bg-dnp/50", na: "bg-dnp/50" };

/** Last-games bars against a dashed line (green hit, red miss, amber push, grey DNP). `last` is oldest to newest; `max` is the bar-height scale. */
export function MiniBars({ last, line, max, className }: { last: { v: number | null; s: string }[]; line: number; max?: number; className?: string }) {
  const top = max ?? Math.max(line * 1.5, ...last.map((x) => x.v ?? 0), 1);
  return (
    <div className={cn("relative flex h-9 w-[72px] shrink-0 items-end gap-[2px] sm:w-[104px] sm:gap-[3px]", className)} role="img" aria-label={`Last ${last.length}: ${last.map((x) => x.v ?? "DNP").join(", ")} against a line of ${line}`}>
      {last.map((x, i) => <span key={i} className={cn("flex-1 rounded-[2px]", BAR[x.s] || "bg-dnp/50")} style={{ height: `${Math.max(x.v == null ? 8 : (x.v / top) * 100, 8)}%` }} />)}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/40" style={{ bottom: `${Math.min(100, (line / top) * 100)}%` }} />
    </div>
  );
}

export type BarLabel = { date: string; text: string };

/**
 * One bar per recent match (oldest left) against the chosen line: green over, red under, amber push. The bars fill the width, and with up to `LABELLED` matches each has its date and
 * opponent under it (more than that would not fit: then the first and last dates only). The bars grow up from the baseline in turn when the data changes.
 */
export const LABELLED = 14;
export function ValueBars({ values, line, labels }: { values: number[]; line: number; labels?: BarLabel[] }) {
  const reduce = useReducedMotion();
  const top = Math.max(line * 1.25, ...values, 1);
  const each = !!labels && labels.length === values.length && values.length <= LABELLED;
  const [pick, setPick] = useState<number | null>(null); // with more bars than fit labels, a tap (or hover) on a bar says which match it is
  const picked = !each && pick != null && labels?.[pick] ? { l: labels[pick], v: values[pick] } : null;
  return (
    <div className="flex flex-col gap-tight" role="img" aria-label={`Last ${values.length} matches: ${values.join(", ")}; line ${line}`}>
      <div className="relative flex h-28 items-end gap-tight">
        {values.map((v, i) => (
          <motion.span key={`${i}-${v}`} onClick={() => setPick(i)} onMouseEnter={() => setPick(i)} title={labels?.[i] ? `${labels[i].date} ${labels[i].text}: ${v}` : String(v)} className={cn("min-w-0 flex-1 origin-bottom rounded-[3px]", v > line ? "bg-primary" : v < line ? "bg-miss" : "bg-amber")}
            style={{ height: `${Math.max((v / top) * 100, 4)}%` }} initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: Math.min(i, 30) * 0.014, duration: 0.3, ease: [0.22, 1, 0.36, 1] }} />
        ))}
        <motion.span aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/50" animate={{ bottom: `${Math.min(100, (line / top) * 100)}%` }} transition={{ duration: 0.3 }}>
          <span className="absolute -top-2.5 right-0 rounded bg-background/80 px-1 text-caption font-semibold tabular-nums text-muted-foreground">{line}</span>
        </motion.span>
      </div>
      {each ? (
        <div className="flex gap-tight text-center text-caption leading-tight text-muted-foreground">
          {labels!.map((l, i) => <span key={i} className="grid min-w-0 flex-1"><span className="truncate tabular-nums">{values[i]}</span><span className="truncate">{l.text}</span><span className="truncate tabular-nums">{l.date}</span></span>)}
        </div>
      ) : (
        picked ? <div className="flex justify-between gap-snug text-footnote"><span className="min-w-0 truncate font-semibold">{picked.l.text}</span><span className="shrink-0 tabular-nums text-muted-foreground">{picked.l.date} · <b className={cn("font-semibold", picked.v > line ? "text-primary" : picked.v < line ? "text-miss" : "text-foreground")}>{picked.v}</b></span></div>
        : <div className="flex justify-between text-caption text-muted-foreground"><span>{labels?.[0] ? `Oldest · ${labels[0].date}` : "Oldest"}</span><span>{labels?.length ? `${labels[labels.length - 1].date} · Latest` : "Latest"}</span></div>
      )}
    </div>
  );
}
