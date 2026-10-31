import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { localTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type MatchPhase = "upcoming" | "live" | "final";

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** When an upcoming match starts, in the viewer's own time zone: "10:30 pm" today, "Tomorrow 10:30 pm", else "Mon 2 Nov 10:30 pm". */
export function startLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const t = localTime(d), tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  if (sameDay(d, now)) return t;
  if (sameDay(d, tomorrow)) return `Tomorrow ${t}`;
  return `${d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} ${t}`;
}

/**
 * A match's status as it is shown beside a side's name: the local start time while it is to come, a red pulsing LIVE badge while it is on, and a muted
 * Completed mark once it is over. `className` sizes it; the text never says a time for a match that has started.
 */
export function MatchStatus({ phase, start, className }: { phase: MatchPhase; start?: string; className?: string }) {
  if (phase === "live") {
    return (
      <span className={cn("inline-flex items-center gap-tight label-cap text-callout font-semibold text-destructive", className)} role="status">
        <span aria-hidden className="relative grid size-2 place-items-center"><span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive/60 motion-reduce:animate-none" /><span className="relative size-2 rounded-full bg-destructive" /></span>Live
      </span>
    );
  }
  if (phase === "final") {
    return <span className={cn("inline-flex items-center gap-hair label-cap text-callout text-muted-foreground", className)}><CheckCircleIcon aria-hidden className="size-3.5" />Completed</span>;
  }
  return <span className={cn("font-medium tabular-nums", className)}>{start ? startLabel(start) : "Scheduled"}</span>;
}
