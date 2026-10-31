import { useState } from "react";
import { CheckIcon, ChevronDownIcon, MinusIcon, PlusIcon } from "@heroicons/react/24/outline";
import { odds, pc } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BookBadge } from "./book-badge";
import { OddsTable, type OddsLine } from "./odds-table";
import { Tick } from "./tick";

const best = (l: OddsLine, k: "over" | "under") => {
  let top: { source: string; price: number } | null = null;
  for (const b of l.books) { const p = b[k]; if (p != null && (!top || p > top.price)) top = { source: b.source, price: p }; }
  return top;
};

/**
 * The alternate-lines sheet: the line on the chart with a big stepper and its best price, then every line a book lists as one tappable row
 * (best over price and who has it, best under, how often he cleared it, a check on the chosen line) and a chevron that opens that line's price
 * per book. Only lines and prices that exist are shown: nothing is filled in for a line no book lists.
 */
export function AltLines({ lines, active, side, onPick, onStep, min = 0.5 }: {
  lines: (OddsLine & { hit?: number | null })[]; active: number; side: "over" | "under"; onPick: (line: number) => void; onStep: (delta: number) => void; min?: number;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const on = lines.find((l) => l.line === active);
  const top = on ? best(on, side) : null;
  const n = on?.books.length ?? 0;
  return (
    <div className="grid gap-group">
      <div className="grid justify-items-center gap-hair">
        <div className="flex items-center gap-stack">
          <button type="button" aria-label="Lower the line" disabled={active <= min} onClick={() => onStep(-0.5)} className="grid size-(--touch) place-items-center rounded-full bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 disabled:opacity-40"><MinusIcon className="size-5" /></button>
          <span className="min-w-24 text-center font-condensed text-stat font-semibold leading-none tabular-nums">{active}</span>
          <button type="button" aria-label="Raise the line" onClick={() => onStep(0.5)} className="grid size-(--touch) place-items-center rounded-full bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"><PlusIcon className="size-5" /></button>
        </div>
        <p className="flex items-center gap-snug text-callout text-muted-foreground">
          {top ? <><Tick value={top.price} className="font-condensed text-body font-semibold text-primary">{odds(top.price)}</Tick><BookBadge source={top.source} /><span>{n} {n === 1 ? "book" : "books"}</span></> : <span>No book lists {active}: the chart still counts how often he cleared it.</span>}
        </p>
      </div>

      <div>
        <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_3.5rem_3rem_2rem] items-center gap-snug border-b border-hairline pb-tight text-muted-foreground">
          <span className="label-cap text-footnote">Line</span><span className="label-cap text-footnote">Best {side}</span><span className="label-cap text-right text-footnote">{side === "over" ? "Under" : "Over"}</span><span className="label-cap text-right text-footnote">Hit</span><span />
        </div>
        <ul>
          {lines.map((l) => {
            const sel = l.line === active, b = best(l, side), o = best(l, side === "over" ? "under" : "over"), isOpen = open === l.line;
            return (
              <li key={l.line} className="border-b border-hairline last:border-b-0">
                <div className={cn("grid grid-cols-[3.5rem_minmax(0,1fr)_3.5rem_3rem_2rem] items-center gap-snug", sel && "bg-primary/10")}>
                  <button type="button" onClick={() => onPick(l.line)} aria-pressed={sel} aria-label={`Use line ${l.line}`} className="col-span-4 grid min-h-row grid-cols-subgrid items-center py-snug text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-accent">
                    <span className="grid"><span className="font-condensed text-metric font-semibold leading-none tabular-nums">{l.line}</span>{l.main && <span className="label-cap text-footnote text-primary">main</span>}</span>
                    <span className="flex min-w-0 items-center gap-snug">{b ? <><span className={cn("font-condensed text-body font-semibold tabular-nums", sel && "text-primary")}>{odds(b.price)}</span><BookBadge source={b.source} /></> : <span className="text-callout text-muted-foreground">–</span>}</span>
                    <span className="text-right font-condensed text-body tabular-nums text-muted-foreground">{o ? odds(o.price) : "–"}</span>
                    <span className="text-right font-condensed text-body font-semibold tabular-nums">{l.hit == null ? "–" : pc(l.hit)}</span>
                  </button>
                  <span className="grid place-items-center">
                    {sel ? <CheckIcon aria-label="On the chart" className="size-5 text-primary" /> : (
                      <button type="button" aria-expanded={isOpen} aria-label={`Prices for ${l.line}`} onClick={() => setOpen(isOpen ? null : l.line)} className="grid size-(--control) place-items-center rounded-full text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronDownIcon className={cn("size-4 transition-transform", isOpen && "rotate-180")} /></button>
                    )}
                  </span>
                </div>
                {sel && l.books.length > 1 && <div className="pb-snug"><OddsTable lines={[l]} /></div>}
                {!sel && isOpen && <div className="pb-snug"><OddsTable lines={[l]} /></div>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
