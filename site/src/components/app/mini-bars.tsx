import { cn } from "@/lib/utils";

const BAR: Record<string, string> = { hit: "bg-primary", miss: "bg-miss", push: "bg-amber", dnp: "bg-dnp/50", void: "bg-dnp/50", na: "bg-dnp/50" };

/** Last-games bars against a dashed line (green hit, red miss, amber push, grey DNP). `last` is oldest to newest; `max` is the bar-height scale. */
export function MiniBars({ last, line, max }: { last: { v: number | null; s: string }[]; line: number; max?: number }) {
  const top = max ?? Math.max(line * 1.5, ...last.map((x) => x.v ?? 0), 1);
  return (
    <div className="relative flex h-9 w-[84px] shrink-0 items-end gap-[2px] sm:w-[104px] sm:gap-[3px]" role="img" aria-label={`Last ${last.length}: ${last.map((x) => x.v ?? "DNP").join(", ")} against a line of ${line}`}>
      {last.map((x, i) => <span key={i} className={cn("w-2 rounded-[2px] sm:w-2.5", BAR[x.s] || "bg-dnp/50")} style={{ height: `${Math.max(x.v == null ? 8 : (x.v / top) * 100, 8)}%` }} />)}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/40" style={{ bottom: `${Math.min(100, (line / top) * 100)}%` }} />
    </div>
  );
}
