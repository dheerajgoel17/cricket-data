import { Fragment } from "react";
import { odds, pc } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BookBadge } from "./book-badge";
import { Tick } from "./tick";

/** One bookmaker's price for one line. `underAt`: the book's under is on a different line than its over. */
export interface OddsBook { source: string; over: number | null; under: number | null; underAt?: { line: number; price: number } }
export interface OddsLine { line: number; books: OddsBook[]; main?: boolean; mkt?: number | null; hit?: number | null }

const th = "label-cap py-tight pr-snug text-left text-footnote font-medium text-muted-foreground";

/**
 * Prices as a table: one row per book, grouped by line. Columns are Line, Book, Over, Under (decimal) and, when `stats` is on, the market's
 * margin-free over chance and how often the player has cleared the line. With several books the best price of each side is in the accent colour.
 * Pass `onPick` to make the lines selectable (the chart takes the picked line); `active` marks the one on the chart.
 */
export function OddsTable({ lines, active, onPick, stats = false, className }: { lines: OddsLine[]; active?: number; onPick?: (line: number) => void; stats?: boolean; className?: string }) {
  return (
    <table className={cn("w-full border-collapse tabular-nums", className)}>
      <thead>
        <tr className="border-b border-hairline">
          <th scope="col" className={th}>Line</th><th scope="col" className={th}>Book</th><th scope="col" className={cn(th, "text-right")}>Over</th><th scope="col" className={cn(th, "text-right")}>Under</th>
          {stats && <><th scope="col" className={cn(th, "text-right")} title="Over chance with each book's margin removed">Mkt</th><th scope="col" className={cn(th, "pr-0 text-right")} title="How often he has cleared this line on the chart">Hit</th></>}
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => {
          const many = l.books.length > 1;
          const bestO = Math.max(0, ...l.books.map((b) => b.over || 0)), bestU = Math.max(0, ...l.books.map((b) => b.under || 0));
          const on = active === l.line;
          return (
            <Fragment key={l.line}>
              {l.books.map((b, i) => (
                <tr key={b.source} onClick={onPick ? () => onPick(l.line) : undefined} className={cn("border-b border-hairline last:border-b-0", onPick && "cursor-pointer active:bg-accent", on && "bg-accent/60")}>
                  {i === 0 && (
                    <td rowSpan={l.books.length} className="py-snug pr-snug align-middle">
                      {onPick ? <button type="button" aria-label={`Use line ${l.line}`} aria-pressed={on} className="text-left text-body font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">{l.line}</button> : <span className="text-body font-semibold">{l.line}</span>}
                      {l.main && <span className="label-cap block text-footnote text-primary">main</span>}
                    </td>
                  )}
                  <td className="py-snug pr-snug text-callout"><BookBadge source={b.source} /></td>
                  <td className={cn("py-snug pr-snug text-right font-condensed text-body font-medium", many && b.over != null && b.over === bestO ? "font-semibold text-primary" : "text-foreground")}><Tick value={b.over}>{odds(b.over)}</Tick></td>
                  <td className={cn("py-snug pr-snug text-right font-condensed text-body font-medium", many && b.under != null && b.under === bestU ? "font-semibold text-primary" : "text-foreground")}>
                    {b.underAt ? <><span className="text-footnote text-muted-foreground">U {b.underAt.line} </span><Tick value={b.underAt.price}>{odds(b.underAt.price)}</Tick></> : <Tick value={b.under}>{odds(b.under)}</Tick>}
                  </td>
                  {stats && i === 0 && (
                    <>
                      <td rowSpan={l.books.length} className="py-snug pr-snug text-right align-middle font-condensed text-body">{l.mkt == null ? "–" : pc(l.mkt)}</td>
                      <td rowSpan={l.books.length} className="py-snug text-right align-middle font-condensed text-body font-semibold">{l.hit == null ? "–" : pc(l.hit)}</td>
                    </>
                  )}
                </tr>
              ))}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
