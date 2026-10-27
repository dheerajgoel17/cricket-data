import { cn } from "@/lib/utils";

/** RSS-style "live feed" mark (a dot and two diagonal arcs) whose arcs pulse outward in turn; marks a match the books are pricing props for. Still under reduced motion. */
export function LiveFeed({ className, label = "Bookmaker props are live" }: { className?: string; label?: string }) {
  return (
    <span role="img" aria-label={label} title={label} className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/25", className)}>
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path className="live-arc [animation-delay:.55s]" d="M4 4a16 16 0 0 1 16 16" />
        <path className="live-arc [animation-delay:.25s]" d="M4 11a9 9 0 0 1 9 9" />
        <circle cx="5" cy="19" r="1.4" fill="currentColor" />
      </svg>
    </span>
  );
}
