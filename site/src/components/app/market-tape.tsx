import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon } from "@heroicons/react/24/outline";
import { STATS } from "@cricket/engine/rules.js";
import { HIGH_ODDS, LOW_ODDS, marketTape } from "@cricket/engine/tape.js";
import { fmtIndex } from "@cricket/engine/util.js";
import { track } from "@/lib/analytics";
import { odds as fmtPrice } from "@/lib/format";
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
  start?: string;
  verdict: "cleared" | "missed" | "push" | null;
  v?: number;
};

function rowHref(r: TapeRow) {
  return `/player/${r.idx}?stat=${r.stat}&line=${r.line}&fmt=${fmtIndex(r.fmt)}${r.start ? `&start=${encodeURIComponent(r.start)}` : ""}${r.inn ? `&scope=${r.inn}` : ""}`;
}

/** Perforated tear across a ticket — page-coloured notches bite the sides (parent must not clip). */
function TicketTear() {
  return (
    <div aria-hidden className="relative z-10 h-0">
      <div className="absolute inset-x-5 top-1/2 border-t border-dashed border-primary-foreground/45" />
      <span className="absolute top-1/2 left-0 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
      <span className="absolute top-1/2 right-0 size-5 translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
    </div>
  );
}

/** One card for the two sharp-tape lists. High odds hits render as a theme-coloured ticket; misses stay a quiet card. Copy stays in stats wording. */
export function MarketTape({ rows, quiet }: { rows: TapeRow[]; quiet?: boolean }) {
  const { hits, misses } = marketTape(rows);
  const id = useId();
  const [tab, setTab] = useState<"hit" | "miss">("hit");
  if (!hits.length && !misses.length) return null;
  const kind: "hit" | "miss" = tab === "hit" ? (hits.length ? "hit" : "miss") : (misses.length ? "miss" : "hit");
  const list = kind === "hit" ? hits : misses, hit = kind === "hit";
  const tabs: [string, string][] = [["hit", `High odds hits · ${hits.length}`], ["miss", `Low odds misses · ${misses.length}`]];

  if (hit) {
    return (
      <section
        aria-label="High odds hits and low odds misses"
        className="relative flex min-w-0 flex-col rounded-2xl bg-primary text-primary-foreground"
      >
        <header className="flex flex-col gap-tight px-inset pt-inset pb-snug">
          {hits.length && misses.length ? (
            <PillGroup segmented layoutId={`tape-${id}`} label="Market tape" value={kind} onChange={(v) => setTab(v as "hit" | "miss")} items={tabs} />
          ) : (
            <div className="flex items-start justify-between gap-snug">
              <h2 className="flex min-w-0 items-center gap-snug text-title font-emphasis tracking-tight">
                <ArrowTrendingUpIcon className="size-5 stroke-[2.5]" aria-hidden />
                High odds hits
              </h2>
              <span className="label-cap shrink-0 rounded-md border border-primary-foreground/35 px-snug py-hair text-caption font-emphasis text-primary-foreground">
                {list.length} cleared
              </span>
            </div>
          )}
          <p className="text-footnote font-label text-primary-foreground/70">
            Over at {fmtPrice(HIGH_ODDS)} or longer that has already cleared.
          </p>
        </header>

        <TicketTear />

        <ul className="flex flex-col px-inset pb-snug pt-snug">
          {list.slice(0, 4).map((r, i) => (
            <li key={`${r.idx}${r.stat}${r.line}${r.fmt}`} className={cn(i > 0 && "border-t border-dashed border-primary-foreground/25")}>
              <Link
                to={rowHref(r)}
                onClick={() => track("tape_row", { kind, stat: r.stat })}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-stack py-snug transition-colors active:bg-primary-foreground/10"
              >
                <span className="flex min-w-0 items-center gap-snug">
                  <PlayerBadge idx={r.idx} size="sm" className="size-control ring-1 ring-primary-foreground/20" />
                  <span className="grid min-w-0 gap-hair">
                    <span className="truncate text-body font-emphasis tracking-tight">{r.name}</span>
                    <span className="truncate text-footnote font-label text-primary-foreground/65">
                      O {r.line} {(STATS as Record<string, { label: string }>)[r.stat]?.label}
                    </span>
                  </span>
                </span>
                <span className="grid justify-items-end gap-hair border-l border-dashed border-primary-foreground/35 pl-stack text-right">
                  <Tick quiet={quiet} value={r.over} className="num-cond text-title text-primary-foreground">{fmtPrice(r.over)}</Tick>
                  <span className="label-cap text-footnote text-primary-foreground">
                    Cleared{r.v != null ? ` · ${r.v}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section aria-label="High odds hits and low odds misses" className="flex min-w-0 flex-col gap-snug rounded-2xl bg-card p-inset text-foreground ring-1 ring-hairline">
      {hits.length && misses.length ? (
        <PillGroup segmented layoutId={`tape-${id}`} label="Market tape" value={kind} onChange={(v) => setTab(v as "hit" | "miss")} items={tabs} />
      ) : (
        <div className="flex items-center gap-tight">
          <ArrowTrendingDownIcon className="size-4 text-miss" aria-hidden />
          <h2 className="text-body font-label">Low odds misses</h2>
        </div>
      )}
      <p className="text-footnote text-muted-foreground">
        Over at {fmtPrice(LOW_ODDS)} or shorter that has already missed.
      </p>
      <ul className="flex flex-col">
        {list.slice(0, 4).map((r) => (
          <li key={`${r.idx}${r.stat}${r.line}${r.fmt}`} className="border-t border-hairline first:border-t-0">
            <Link
              to={rowHref(r)}
              onClick={() => track("tape_row", { kind, stat: r.stat })}
              className="flex min-h-row items-center gap-snug py-tight transition-colors active:bg-accent"
            >
              <PlayerBadge idx={r.idx} size="sm" className="size-control" />
              <span className="grid min-w-0 flex-1 gap-hair">
                <span className="truncate text-callout font-label">{r.name}</span>
                <span className="truncate text-footnote text-muted-foreground">
                  O {r.line} {(STATS as Record<string, { label: string }>)[r.stat]?.label}
                </span>
              </span>
              <span className="grid justify-items-end gap-hair text-right">
                <Tick quiet={quiet} value={r.over} className="text-callout font-label tabular-nums text-miss">{fmtPrice(r.over)}</Tick>
                <span className="text-footnote font-label text-miss">Missed{r.v != null ? ` · ${r.v}` : ""}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
