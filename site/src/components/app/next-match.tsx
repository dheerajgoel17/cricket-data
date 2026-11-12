/* eslint-disable @typescript-eslint/no-explicit-any */
import { track } from "@/lib/analytics";
import { nextMatchRates } from "@cricket/engine/next-match.js";
import { localWhen, odds } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MatchStatus } from "./match-status";
import { TeamBadge } from "./badges";
import { StandingMark, type Standing } from "./tick";

const tone = (p: number | null) => (p == null ? "text-muted-foreground" : p >= 0.6 ? "text-primary" : p <= 0.25 ? "text-miss" : "text-foreground");

export type NextMatchInfo = {
  match: string;
  start: string;
  competition: string;
  team?: string;
  opp: string;
  ground: string;
  known?: string;
  /** True when a book has a line for this player on this match (any stat). */
  priced?: boolean;
  /** upcoming until the start; live while in play; final once the live feed (or the clock) says it is over. */
  phase?: "upcoming" | "live" | "final";
};

export type LineSoFar = Standing;

/** Shown when this stat has no listed book line: the chart still uses history so a fair line is readable. */
export function UnpricedNote({ statLabel, className }: { statLabel: string; className?: string }) {
  return (
    <p role="status" className={cn("flex gap-snug text-callout", className)}>
      <InformationCircleIcon aria-hidden className="relative top-px size-4 shrink-0 text-muted-foreground" />
      <span>
        <span className="font-medium text-foreground">No book is offering odds for {statLabel}</span>
        {" "}on this match. Hit rates and fair prices are from his history, not a listed market.
      </span>
    </p>
  );
}

/** One context row: hit rate, n, fair decimal odds on the line the chart is on. */
function RateRow({ label, r, side, line }: { label: string; r: { p: number | null; hits: number; played: number; fair: number | null }; side: string; line: number }) {
  if (r.played < 1) {
    return (
      <div className="grid gap-hair text-left">
        <span className="label-cap text-caption text-muted-foreground">{label}</span>
        <span className="text-footnote text-muted-foreground">No data</span>
      </div>
    );
  }
  return (
    <div className="grid gap-hair text-left">
      <span className="label-cap text-caption text-muted-foreground">{label}</span>
      <span className="tabular-nums">
        <b className={cn("font-condensed text-title font-bold leading-none", tone(r.p))}>{r.p == null ? "–" : `${Math.round(r.p * 100)}%`}</b>
        <span className="ml-tight text-footnote text-muted-foreground">{r.hits}/{r.played} · fair {odds(r.fair)}</span>
      </span>
      <span className="sr-only">{side} {line}</span>
    </div>
  );
}

/**
 * This / next match card on the player page: who and when, standing, ground / opponent hit rates.
 * Book prices live in the chart strip and line ladder — not repeated here.
 */
export function NextMatch({ next, entries, line, side, book, statLabel, fmt, standing, out }: {
  next: NextMatchInfo; entries: any[]; line: number; side: string; book?: any; statLabel: string; fmt?: string;
  standing?: LineSoFar | null; out?: boolean;
}) {
  const { here, versus } = nextMatchRates(entries, next, line, side);
  const ground = next.ground.split(",")[0];
  const heading = next.phase && next.phase !== "upcoming" ? "This match" : "Next match";
  return (
    <section className={cn("grid gap-snug rounded-2xl bg-card p-inset ring-1 ring-hairline", out && "opacity-60")} aria-label={heading}>
      <div className="flex items-baseline justify-between gap-snug">
        <h2 className="label-cap text-footnote text-muted-foreground">{heading}</h2>
        {next.phase === "live" || next.phase === "final"
          ? <MatchStatus phase={next.phase} className="shrink-0 text-footnote" />
          : <span className="shrink-0 text-footnote tabular-nums text-muted-foreground">{localWhen(next.start)}</span>}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-snug">
        {next.team ? (
          <span className="inline-flex min-w-0 max-w-[46%] items-center gap-tight">
            <TeamBadge name={next.team} size="sm" eager />
            <span className="min-w-0 truncate text-body font-medium">{next.team}</span>
          </span>
        ) : null}
        {next.team && next.opp ? <span className="shrink-0 text-footnote text-muted-foreground">vs</span> : null}
        {next.opp ? (
          <span className="inline-flex min-w-0 max-w-[46%] items-center gap-tight">
            <TeamBadge name={next.opp} size="sm" eager />
            <span className="min-w-0 truncate text-body font-medium">{next.opp}</span>
          </span>
        ) : <span className="min-w-0 truncate text-body font-medium">{next.match}</span>}
        {out ? <Badge variant="outline" className="shrink-0 px-snug py-hair text-caption font-medium text-muted-foreground">Not in XI</Badge> : null}
      </div>
      {(next.ground || next.competition) ? (
        <p className="truncate text-footnote text-muted-foreground">
          {[ground || next.ground, next.competition, fmt].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {book && standing != null && (
        <p className="text-callout text-primary">
          <span className="font-medium tabular-nums">{side === "over" ? "O" : "U"} {line}</span>
          {" · "}
          <StandingMark standing={standing} line={line} />
        </p>
      )}
      {!book && (
        <p role="status" className="text-callout">
          <span className="font-medium text-foreground">No listed odds</span>
          <span className="text-muted-foreground"> · no book is offering {statLabel} on this match</span>
        </p>
      )}
      {(next.ground || next.opp) ? (
        <div className="grid grid-cols-2 gap-snug border-t border-hairline pt-snug">
          {next.ground ? <RateRow label={`At ${ground}`} r={here} side={side} line={line} /> : <span />}
          {next.opp ? <RateRow label={`Vs ${next.opp}`} r={versus} side={side} line={line} /> : null}
        </div>
      ) : null}
    </section>
  );
}

/** Quick picks inside the Filters sheet: only games against his next opponent, only games at its ground. */
export function NextFilters({ next, q, navigateWith }: { next: NextMatchInfo; q: Record<string, string>; navigateWith: (p: Record<string, unknown>) => void }) {
  const chips: [string, string, string][] = [];
  if (next.opp) chips.push(["opp", next.opp, `vs ${next.opp}`]);
  if (next.known) chips.push(["venue", next.known, `At ${next.ground.split(",")[0]}`]);
  return <>{chips.map(([k, v, label]) => {
    const on = q[k] === v;
    return (
      <Button key={k} variant={on ? "default" : "secondary"} className="h-control rounded-full px-snug text-callout" aria-pressed={on}
        onClick={() => { track("player_filter", { kind: k, on: on ? 0 : 1 }); navigateWith({ [k]: on ? "" : v }); }}>
        {on ? `${label} ✓` : `Only ${label}`}
      </Button>
    );
  })}</>;
}
