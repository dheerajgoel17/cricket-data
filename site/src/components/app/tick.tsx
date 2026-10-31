import type { ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/20/solid";
import { stillNeed } from "@/engine/tape.js";
import { useTick } from "@/hooks/useTick";
import { cn } from "@/lib/utils";

const VERDICT = { cleared: "Cleared", missed: "Missed", push: "Push" } as const;

/** Flash green on a rise, red on a drop; a small arrow while the flash holds. The live poll is ~15 s, so this is how a so-far or a price change is seen. */
export function Tick({ value, children, className }: { value: number | null | undefined; children: ReactNode; className?: string }) {
  const dir = useTick(value);
  return (
    <span className={cn("inline-flex items-baseline gap-hair rounded-md px-hair", dir === 1 && "tick-up", dir === -1 && "tick-down", className)}>
      {dir === 1 ? <ArrowUpIcon className="size-3 shrink-0 text-primary" aria-hidden /> : null}
      {dir === -1 ? <ArrowDownIcon className="size-3 shrink-0 text-miss" aria-hidden /> : null}
      {children}
    </span>
  );
}

export type Standing = { v: number; state: string; verdict: "cleared" | "missed" | "push" | null };

/** So-far / final / Cleared against the booked line, flashing when the scorecard moves the number. */
export function StandingMark({ standing, line, className }: { standing: Standing | null | undefined; line?: number; className?: string }) {
  if (!standing) return null;
  const need = stillNeed(standing.v, line, standing.verdict);
  const tone = standing.verdict === "cleared" ? "text-primary" : standing.verdict === "missed" ? "text-miss" : "text-muted-foreground";
  return (
    <Tick value={standing.v} className={cn("tabular-nums", tone, className)}>
      {standing.v} {standing.state === "live" ? "so far" : standing.state}
      {need != null ? ` · ${need} to go` : null}
      {standing.verdict ? ` · ${VERDICT[standing.verdict]}` : null}
    </Tick>
  );
}
