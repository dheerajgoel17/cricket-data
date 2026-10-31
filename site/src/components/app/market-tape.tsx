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
    <section className="flex min-w-0 flex-col gap-snug rounded-2xl bg-card p-inset ring-1 ring-hairline">
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

/** Two modules on the home / props list: long-shot overs that cleared, and short-priced overs that missed, from the scorecard's settled lines. */
export function MarketTape({ rows }: { rows: TapeRow[] }) {
  const { hits, misses } = marketTape(rows);
  if (!hits.length && !misses.length) return null;
  return (
    <div className="grid gap-stack lg:grid-cols-2">
      <TapeCard kind="hit" rows={hits} />
      <TapeCard kind="miss" rows={misses} />
    </div>
  );
}
