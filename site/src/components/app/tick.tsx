import type { ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/20/solid";
import { stillNeed } from "@cricket/engine/tape.js";
import { useTick } from "@/hooks/useTick";
import { cn } from "@/lib/utils";

const VERDICT = { cleared: "Cleared", missed: "Missed", push: "On the line" } as const;

/** Quiet ticks roll the new value into place and leave the direction visible briefly. */
export function Tick({ value, children, className, quiet = false }: { quiet?: boolean; value: number | null | undefined; children: ReactNode; className?: string }) {
  const dir = useTick(value, quiet ? 2600 : undefined);
  return (
    <span className={cn("inline-flex items-baseline gap-hair rounded-md px-hair", !quiet && dir === 1 && "tick-up", !quiet && dir === -1 && "tick-down", className)}>
      {dir === -1 ? <ArrowDownIcon className="size-3 shrink-0 text-miss" aria-hidden /> : null}
      {(dir === 1 || (quiet && dir === 0)) && <ArrowUpIcon className={cn("size-3 shrink-0 text-primary", dir === 0 && "invisible")} aria-hidden />}
      {quiet ? (
        <span className="inline-block min-w-0 overflow-hidden align-baseline">
          <span key={value ?? "empty"} className={cn("block tabular-nums", dir === 1 && "ticker-roll-up text-primary", dir === -1 && "ticker-roll-down text-miss")}>{children}</span>
        </span>
      ) : children}
    </span>
  );
}

export type Standing = { v: number | null; state: string; verdict: "cleared" | "missed" | "push" | null };

/** So-far / final / Cleared against the booked line, flashing when the scorecard moves the number. VOID is a fancy side run line that needed the side to bat first. */
export function StandingMark({ standing, line, className, quiet }: { quiet?: boolean; standing: Standing | null | undefined; line?: number; className?: string }) {
  if (!standing) return null;
  if (standing.state === "void") return <span className={cn("rounded border border-dashed border-amber/60 px-hair text-caption text-amber", className)}>VOID</span>;
  const need = standing.state === "live" ? stillNeed(standing.v, line, standing.verdict) : null;
  const tone = standing.verdict === "cleared" ? "text-primary" : standing.verdict === "missed" ? "text-miss" : "text-muted-foreground";
  return (
    <Tick quiet={quiet} value={standing.v} className={cn("tabular-nums", tone, className)}>
      {standing.v} {standing.state === "live" ? "so far" : standing.state}
      {need != null ? ` · ${need} to go` : null}
      {standing.verdict ? ` · ${VERDICT[standing.verdict]}` : null}
    </Tick>
  );
}
