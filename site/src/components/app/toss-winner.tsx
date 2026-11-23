import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { bookName } from "@cricket/engine/lines.js";
import { tossMarket, tossRecord } from "@cricket/engine/toss.js";
import { odds } from "@/lib/format";
import { TeamBadge } from "./badges";

type Side = { name: string; price: number; book: string | null };
export type TossMarket = { default: boolean; sides: Side[]; books: { source: string; prices: number[] }[] };
export type TossRecord = { n: number; won: number; bat: number };
export const tossRecordFor = tossRecord as (store: any, team: number, o: { fmt: number; gender?: number; lastN?: number }) => TossRecord | null;
export const tossFor = tossMarket as (doc: any, fx: { a: string; b: string; fmt?: string; startMs?: number }) => TossMarket;

/** "Won 6 of last 10 tosses · chose bat 4": the side's own toss history. */
export const tossLine = (r: TossRecord) => `Won ${r.won} of last ${r.n} tosses${r.won ? ` · chose bat ${r.bat}` : ""}`;

/** The toss-winner market on the Match scope of Match Fancy: both sides' prices, no history edge (a toss is a coin flip). A side price is a book's, else the 1.95 default, which the row says. */
export function TossWinner({ market, records }: { market: TossMarket; records?: (TossRecord | null)[] }) {
  const note = market.default ? "Default price, no book lists the toss" : market.books.length > 1 ? `Best of ${market.books.length} books` : bookName(market.books[0]!.source);
  return (
    <section className="flex flex-col" aria-label="Toss winner">
      <div className="flex items-baseline justify-between gap-snug px-inset py-snug">
        <h2 className="text-body font-emphasis">Toss winner</h2>
        <span className="text-footnote text-muted-foreground">{note}</span>
      </div>
      <ul>
        {market.sides.map((s, i) => (
          <li key={s.name} className="border-t border-hairline first:border-t-0">
            <Item size="sm" className="rounded-none border-0 px-inset py-snug">
              <ItemMedia><TeamBadge name={s.name} size="md" /></ItemMedia>
              <ItemContent className="min-w-0 gap-hair">
                <ItemTitle className="max-w-full text-body font-label"><span className="truncate">{s.name}</span></ItemTitle>
                {!market.default && market.books.length > 1 && s.book ? <ItemDescription className="text-callout">{bookName(s.book)}</ItemDescription> : null}
                {records?.[i]?.n ? <ItemDescription className="text-callout tabular-nums">{tossLine(records[i]!)}</ItemDescription> : null}
              </ItemContent>
              <ItemActions><span className="text-body font-label tabular-nums text-primary">{odds(s.price)}</span></ItemActions>
            </Item>
          </li>
        ))}
      </ul>
    </section>
  );
}
