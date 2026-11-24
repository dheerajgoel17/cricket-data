/* A heading over hairline rows of tap-for-detail marks: the layout of the Odd / Even and Toss tabs (and the Form tab's team heads). Rows run edge to edge on a phone, copy keeps the gutter. */
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MarkData = { on: boolean; letter: string; label: string; detail: string };

/** One row: title and what it covers on the left, the headline figure on the right, the marks (newest on the right) under them; tapping a mark shows its detail line. */
export function MarkRow({ title, sub, headline, headlineSub, marks, note, hideWhenEmpty = true }: {
  title: string; sub: string; headline: ReactNode; headlineSub?: ReactNode; marks: MarkData[]; note?: ReactNode; hideWhenEmpty?: boolean;
}) {
  const [pick, setPick] = useState<number | null>(null);
  if (hideWhenEmpty && !marks.length) return null;
  const sel = pick != null ? marks[pick] : null;
  return (
    <li className="flex flex-col gap-snug border-t border-hairline px-gutter py-snug lg:px-0">
      <div className="flex items-baseline justify-between gap-snug">
        <div className="min-w-0">
          <div className="truncate text-callout font-label">{title}</div>
          <div className="truncate text-footnote text-muted-foreground">{sub}</div>
        </div>
        <div className="shrink-0 text-right tabular-nums">
          <div className="text-callout font-label">{headline}</div>
          {headlineSub != null && <div className="flex justify-end text-footnote text-muted-foreground">{headlineSub}</div>}
        </div>
      </div>
      {marks.length > 0 && (
        <div className="flex flex-nowrap items-center gap-tight" role="group" aria-label={title}>
          {marks.map((x, i) => (
            <button key={i} type="button" onClick={() => setPick(pick === i ? null : i)} aria-pressed={pick === i} aria-label={x.label}
              className={cn("grid size-7 shrink-0 place-items-center rounded-md text-footnote font-emphasis outline-none focus-visible:ring-2 focus-visible:ring-ring",
                x.on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground", pick === i && "ring-2 ring-foreground")}>
              {x.letter}
            </button>
          ))}
        </div>)}
      {(sel || note) && <p className="text-footnote text-muted-foreground tabular-nums">{sel ? sel.detail : note}</p>}
    </li>
  );
}

/** A heading (crest and name, or the ground) over its rows: the same head as a Form team. */
export function MarkSection({ head, children, label }: { head: ReactNode; children: ReactNode; label: string }) {
  return (
    <section className="-mx-gutter min-w-0 lg:mx-0" aria-label={label}>
      <div className="flex items-center gap-snug px-gutter py-snug lg:px-0">{head}</div>
      <ul>{children}</ul>
    </section>
  );
}
