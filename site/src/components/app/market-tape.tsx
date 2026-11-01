import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon } from "@heroicons/react/24/outline";
import { STATS } from "@cricket/engine/rules.js";
import { HIGH_ODDS, LOW_ODDS, marketTape } from "@cricket/engine/tape.js";
import { fmtIndex } from "@cricket/engine/util.js";
import { track } from "@/lib/analytics";
import { odds } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PillGroup } from "./pill-group";
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

/** One card for the two sharp-tape lists, a tab each: the long shots that cleared, the heavy favourites that missed. */
export function MarketTape({ rows }: { rows: TapeRow[] }) {
  const { hits, misses } = marketTape(rows);
  const id = useId();
  const [tab, setTab] = useState<"hit" | "miss">("hit");
  if (!hits.length && !misses.length) return null;
  const kind: "hit" | "miss" = tab === "hit" ? (hits.length ? "hit" : "miss") : (misses.length ? "miss" : "hit");
  const list = kind === "hit" ? hits : misses, hit = kind === "hit";
  const tabs: [string, string][] = [["hit", `High odds hits · ${hits.length}`], ["miss", `Low odds misses · ${misses.length}`]];
  return (
    <section aria-label="High odds hits and low odds misses" className="flex min-w-0 flex-col gap-snug rounded-2xl bg-card p-inset ring-1 ring-hairline">
      {hits.length && misses.length ? (
        <PillGroup segmented layoutId={`tape-${id}`} label="Market tape" value={kind} onChange={(v) => setTab(v as "hit" | "miss")} items={tabs} />
      ) : (
        <div className="flex items-center gap-tight">
          {hit ? <ArrowTrendingUpIcon className="size-4 text-primary" aria-hidden /> : <ArrowTrendingDownIcon className="size-4 text-miss" aria-hidden />}
          <h2 className="text-body font-medium">{hit ? "High odds hits" : "Low odds misses"}</h2>
        </div>
      )}
      <p className="text-footnote text-muted-foreground">
        {hit ? `Over at ${odds(HIGH_ODDS)} or longer that has already cleared.` : `Over at ${odds(LOW_ODDS)} or shorter that has already missed.`}
      </p>
      <ul className="flex flex-col">
        {list.slice(0, 4).map((r) => (
          <li key={`${r.idx}${r.stat}${r.line}${r.fmt}`} className="border-t border-hairline first:border-t-0">
            <Link
              to={`/player/${r.idx}?stat=${r.stat}&line=${r.line}&fmt=${fmtIndex(r.fmt)}${r.inn ? `&scope=${r.inn}` : ""}`}
              onClick={() => track("tape_row", { kind, stat: r.stat })}
              className="flex min-h-row items-center gap-snug py-tight transition-colors active:bg-accent"
            >
              <PlayerBadge idx={r.idx} size="sm" className="size-control" />
              <span className="grid min-w-0 flex-1 gap-hair">
                <span className="truncate text-callout font-medium">{r.name}</span>
                <span className="truncate text-footnote text-muted-foreground">O {r.line} {(STATS as Record<string, { label: string }>)[r.stat]?.label}</span>
              </span>
              <span className="grid justify-items-end gap-hair text-right">
                <Tick value={r.over} className={cn("text-callout font-medium tabular-nums", hit ? "text-primary" : "text-miss")}>{odds(r.over)}</Tick>
                <span className={cn("text-footnote font-medium", hit ? "text-primary" : "text-miss")}>{hit ? "Cleared" : "Missed"}{r.v != null ? ` · ${r.v}` : ""}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
