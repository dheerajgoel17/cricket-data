import { Link } from "react-router-dom";
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon } from "@heroicons/react/24/outline";
import { STATS } from "@/engine/rules.js";
import { HIGH_ODDS, LOW_ODDS, marketTape } from "@/engine/tape.js";
import { fmtIndex } from "@/engine/util.js";
import { track } from "@/lib/analytics";
import { odds } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Tick } from "./tick";
import { PlayerBadge } from "./badges";

type TapeRow = {
  idx: number;
  name: string;
  stat: string;
  line: number;
  over: number;
  fmt: string;
  inn?: number;
  verdict: "cleared" | "missed" | "push" | null;
  v?: number;
};

function TapeCard({ kind, rows }: { kind: "hit" | "miss"; rows: TapeRow[] }) {
  const hit = kind === "hit";
  if (!rows.length) return null;
  return (
    <section className="flex h-full min-w-0 flex-col gap-snug rounded-2xl bg-card p-inset ring-1 ring-hairline">
      <div className="flex items-center gap-tight">
        {hit ? <ArrowTrendingUpIcon className="size-4 text-primary" aria-hidden /> : <ArrowTrendingDownIcon className="size-4 text-miss" aria-hidden />}
        <h2 className="text-body font-semibold">{hit ? "High odds hits" : "Low odds misses"}</h2>
      </div>
      <p className="text-footnote text-muted-foreground">
        {hit ? `Over at ${odds(HIGH_ODDS)} or longer that has already cleared.` : `Over at ${odds(LOW_ODDS)} or shorter that has already missed.`}
      </p>
      <ul className="flex flex-col">
        {rows.slice(0, 4).map((r) => (
          <li key={`${r.idx}${r.stat}${r.line}${r.fmt}`} className="border-t border-hairline first:border-t-0">
            <Link
              to={`/player/${r.idx}?stat=${r.stat}&line=${r.line}&fmt=${fmtIndex(r.fmt)}${r.inn ? `&scope=${r.inn}` : ""}`}
              onClick={() => track("tape_row", { kind, stat: r.stat })}
              className="flex min-h-row items-center gap-snug py-tight transition-colors active:bg-accent"
            >
              <PlayerBadge idx={r.idx} size="sm" className="size-control" />
              <span className="grid min-w-0 flex-1 gap-hair">
                <span className="truncate text-callout font-semibold">{r.name}</span>
                <span className="truncate text-footnote text-muted-foreground">O {r.line} {(STATS as Record<string, { label: string }>)[r.stat]?.label}</span>
              </span>
              <span className="grid justify-items-end gap-hair text-right">
                <Tick value={r.over} className={cn("text-callout font-semibold tabular-nums", hit ? "text-primary" : "text-miss")}>{odds(r.over)}</Tick>
                <span className={cn("text-footnote font-semibold", hit ? "text-primary" : "text-miss")}>{hit ? "Cleared" : "Missed"}{r.v != null ? ` · ${r.v}` : ""}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Dedicated high-odds-hits / low-odds-misses section. On a phone the two cards share the same 80vw peek rail as the fixture cards; from `lg` they sit side by side. */
export function MarketTape({ rows }: { rows: TapeRow[] }) {
  const { hits, misses } = marketTape(rows);
  const cards: ["hit" | "miss", TapeRow[]][] = [];
  if (hits.length) cards.push(["hit", hits]);
  if (misses.length) cards.push(["miss", misses]);
  if (!cards.length) return null;
  const peek = cards.length > 1;
  return (
    <div
      role="list"
      aria-label="High odds hits and low odds misses"
      className={cn(
        peek
          ? "-mx-gutter flex snap-x snap-mandatory gap-snug overflow-x-auto overscroll-x-contain px-gutter [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [scroll-padding-inline:var(--gutter)] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-stack lg:overflow-visible lg:px-0 lg:snap-none"
          : "grid gap-stack",
      )}
    >
      {cards.map(([kind, list]) => (
        <div key={kind} role="listitem" className={cn(peek && "w-(--fixture-card) shrink-0 snap-start lg:w-auto")}>
          <TapeCard kind={kind} rows={list} />
        </div>
      ))}
    </div>
  );
}
