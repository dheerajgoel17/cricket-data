import { odds, pc } from "@/lib/format";
import { BookBadge } from "./book-badge";
import { BookTable } from "./book-table";
import { Tick } from "./tick";
import { TableCell, TableRow } from "@/components/ui/table";

export type LadderBook = { source: string; over: number | null; under: number | null };
export type LadderPriced = {
  line: number;
  over: number | null;
  under: number | null;
  books: LadderBook[];
};

/** Best book for one side at a line: price + that book's mark on one row — never pairs the other side under the same badge. */
export function SideBook({ priced, side }: { priced?: LadderPriced | null; side: "over" | "under" }) {
  const face = priced?.[side] != null ? priced.books.find((x) => x[side] === priced[side]) : null;
  const p = face?.[side] ?? null;
  if (p == null) return <span className="text-footnote text-muted-foreground">—</span>;
  return (
    <span className="flex min-w-0 max-w-full items-center gap-tight overflow-hidden">
      <Tick value={p} className="shrink-0 font-condensed text-body font-bold leading-none tabular-nums text-primary">{odds(p)}</Tick>
      <BookBadge source={face!.source} className="min-w-0 max-w-full truncate" />
    </span>
  );
}

/** One ladder line: Over and Under each own their book; extras sit behind the shared +N books accordion. */
export function LadderRow({ line, summary, priced, selected, onPick }: {
  line: number;
  summary: { pOver: number | null; pUnder: number | null; fairOver: number | null; fairUnder: number | null };
  priced: LadderPriced | null;
  selected: boolean;
  onPick: () => void;
}) {
  const overSrc = priced?.over != null ? priced.books.find((x) => x.over === priced.over)?.source : undefined;
  const underSrc = priced?.under != null ? priced.books.find((x) => x.under === priced.under)?.source : undefined;
  return (
    <TableRow data-state={selected ? "selected" : undefined}
      className="cursor-pointer border-hairline active:bg-primary/10 data-[state=selected]:bg-primary/15"
      onClick={onPick}>
      <TableCell className="w-[3rem] px-snug py-tight align-middle font-medium tabular-nums">{line}</TableCell>
      <TableCell className="min-w-0 overflow-hidden whitespace-normal px-snug py-tight align-middle">
        <span className="grid min-w-0 justify-items-start gap-hair" onClick={(e) => e.stopPropagation()}>
          <SideBook priced={priced} side="over" />
          {priced && <BookTable books={priced.books} shown={[overSrc, underSrc]} />}
        </span>
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden whitespace-normal px-snug py-tight align-middle">
        <SideBook priced={priced} side="under" />
      </TableCell>
      <TableCell className="w-[3.75rem] whitespace-normal px-snug py-tight align-middle tabular-nums">
        <span className="grid justify-items-start gap-hair text-left">
          <b className="text-primary leading-none">{summary.pOver == null ? "–" : pc(summary.pOver)}</b>
          <span className="text-footnote leading-none text-muted-foreground">{summary.fairOver == null ? "–" : odds(summary.fairOver)}</span>
        </span>
      </TableCell>
      <TableCell className="w-[3.75rem] whitespace-normal px-snug py-tight align-middle tabular-nums">
        <span className="grid justify-items-start gap-hair text-left">
          <b className="leading-none">{summary.pUnder == null ? "–" : pc(summary.pUnder)}</b>
          <span className="text-footnote leading-none text-muted-foreground">{summary.fairUnder == null ? "–" : odds(summary.fairUnder)}</span>
        </span>
      </TableCell>
    </TableRow>
  );
}

/** Face best over/under prices from a player book line (`books` at one line). */
export function pricedFromBooks(line: number, books: LadderBook[]): LadderPriced {
  const over = Math.max(0, ...books.map((b) => b.over || 0)) || null;
  const under = Math.max(0, ...books.map((b) => b.under || 0)) || null;
  return { line, over: over && over > 1 ? over : null, under: under && under > 1 ? under : null, books };
}
