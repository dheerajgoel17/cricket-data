import { cn } from "@/lib/utils";

const BAR: Record<string, string> = { hit: "bg-primary", miss: "bg-miss", push: "bg-amber", dnp: "bg-dnp/50", void: "bg-dnp/50", na: "bg-dnp/50" };

/** Last-games bars against a dashed line (green hit, red miss, amber push, grey DNP). `last` is oldest to newest; `max` is the bar-height scale. */
export function MiniBars({ last, line, max }: { last: { v: number | null; s: string }[]; line: number; max?: number }) {
  const top = max ?? Math.max(line * 1.5, ...last.map((x) => x.v ?? 0), 1);
  return (
    <div className="relative flex h-9 w-[72px] shrink-0 items-end gap-[2px] sm:w-[104px] sm:gap-[3px]" role="img" aria-label={`Last ${last.length}: ${last.map((x) => x.v ?? "DNP").join(", ")} against a line of ${line}`}>
      {last.map((x, i) => <span key={i} className={cn("flex-1 rounded-[2px]", BAR[x.s] || "bg-dnp/50")} style={{ height: `${Math.max(x.v == null ? 8 : (x.v / top) * 100, 8)}%` }} />)}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/40" style={{ bottom: `${Math.min(100, (line / top) * 100)}%` }} />
    </div>
  );
}

/** One bar per recent match (oldest left) against the chosen line: green over, red under, amber push. Taller than MiniBars, with the line labelled. */
export function ValueBars({ values, line }: { values: number[]; line: number }) {
  const top = Math.max(line * 1.25, ...values, 1);
  return (
    <div role="img" aria-label={`Last ${values.length} matches: ${values.join(", ")}; line ${line}`}>
      <div className="relative flex h-28 items-end gap-[3px]">
        {values.map((v, i) => <span key={i} title={String(v)} className={cn("flex-1 rounded-[3px]", v > line ? "bg-primary" : v < line ? "bg-miss" : "bg-amber")} style={{ height: `${Math.max((v / top) * 100, 4)}%`, maxWidth: 28 }} />)}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/50" style={{ bottom: `${Math.min(100, (line / top) * 100)}%` }}>
          <span className="absolute -top-2.5 right-0 rounded bg-background/80 px-1 text-caption font-semibold tabular-nums text-muted-foreground">{line}</span>
        </span>
      </div>
      <div className="mt-tight flex justify-between text-caption text-muted-foreground"><span>Oldest</span><span>Latest</span></div>
    </div>
  );
}
