/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link } from "react-router-dom";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { track } from "@/lib/analytics";
import { nextMatchRates } from "@cricket/engine/next-match.js";
import { abbr, localTime, odds } from "@/lib/format";
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
  /** The fixture page's id, when the schedule lists the match. */
  id?: string;
};

export type LineSoFar = Standing;

/** Shown when this stat has no listed book line: the chart still uses history so a fair line is readable. */
export function UnpricedNote({ statLabel, className }: { statLabel: string; className?: string }) {
  return (
    <p role="status" className={cn("flex gap-snug text-callout", className)}>
      <InformationCircleIcon aria-hidden className="relative top-px size-4 shrink-0 text-muted-foreground" />
      <span>
        <span className="font-label text-foreground">No book is offering odds for {statLabel}</span>
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
        <b className={cn("font-condensed text-title font-emphasis leading-none", tone(r.p))}>{r.p == null ? "–" : `${Math.round(r.p * 100)}%`}</b>
        <span className="ml-tight text-footnote text-muted-foreground">{r.hits}/{r.played} · fair {odds(r.fair)}</span>
      </span>
      <span className="sr-only">{side} {line}</span>
    </div>
  );
}

/** "29 Oct · 3:00 pm" in the viewer's zone (the date alone when the schedule has no time yet). */
export function whenLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return String(iso).length > 10 ? `${day} · ${localTime(d)}` : day;
}

/**
 * The match card on the player page, kept to one idea: his side vs the opponent, then Live / Completed, or the date, time and ground.
 * The line's standing (so far / Cleared) or "no listed odds" sits under it; the ground and opponent history is `MatchupRates`.
 */
export function NextMatch({ next, line, side, book, statLabel, standing, out }: {
  next: NextMatchInfo; line: number; side: string; book?: any; statLabel: string; fmt?: string;
  standing?: LineSoFar | null; out?: boolean; entries?: any[];
}) {
  const heading = next.phase && next.phase !== "upcoming" ? "This match" : "Next match";
  const upcoming = !next.phase || next.phase === "upcoming";
  const when = upcoming ? whenLabel(next.start) : "";
  return (
    <section className={cn("grid gap-snug rounded-2xl border border-hairline bg-card px-inset py-snug", out && "opacity-60")} aria-label={heading}>
      {next.id ? (
        <Link to={`/fixture/${next.id}`} aria-label={`Open match: ${next.match}`} className="-mx-inset -my-snug rounded-2xl px-inset py-snug outline-none hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-ring">
        <div className="flex min-w-0 items-center gap-snug">
        {next.opp ? <TeamBadge name={next.opp} size="sm" eager /> : null}
        <span className="min-w-0 flex-1 truncate text-body font-emphasis">{next.opp ? `vs ${abbr(next.opp)}` : next.match}{when ? <span className="font-normal text-muted-foreground"> on {when}</span> : null}</span>
        {out ? <Badge variant="outline" className="shrink-0 px-snug py-hair text-caption font-label text-muted-foreground">Not in XI</Badge> : null}
        {!upcoming ? <MatchStatus phase={next.phase!} className="shrink-0 text-footnote" /> : null}
        {next.id ? <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : null}
        </div>
      </Link>
      ) : (
      <div className="flex min-w-0 items-center gap-snug">
        {next.opp ? <TeamBadge name={next.opp} size="sm" eager /> : null}
        <span className="min-w-0 flex-1 truncate text-body font-emphasis">{next.opp ? `vs ${abbr(next.opp)}` : next.match}{when ? <span className="font-normal text-muted-foreground"> on {when}</span> : null}</span>
        {out ? <Badge variant="outline" className="shrink-0 px-snug py-hair text-caption font-label text-muted-foreground">Not in XI</Badge> : null}
        {!upcoming ? <MatchStatus phase={next.phase!} className="shrink-0 text-footnote" /> : null}
        {next.id ? <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : null}
      </div>
      )}
      {book && standing != null && (
        <p className="text-callout text-primary">
          <span className="font-label tabular-nums">{side === "over" ? "O" : "U"} {line}</span>
          {" · "}
          <StandingMark standing={standing} line={line} />
        </p>
      )}
      {!book && (
        <p role="status" className="text-callout">
          <span className="font-label text-foreground">No listed odds</span>
          <span className="text-muted-foreground"> · no book is offering {statLabel} on this match</span>
        </p>
      )}
    </section>
  );
}

/**
 * How he has gone over / under the chart's line at this ground and against this side (history, never prices). Standalone it is its own section;
 * `inline` is just the two cells, for the last row of the hit-rate / book-lane table above it.
 */
export function MatchupRates({ next, entries, line, side, inline }: { next: NextMatchInfo; entries: any[]; line: number; side: string; inline?: boolean }) {
  if (!next.ground && !next.opp) return null;
  const { here, versus } = nextMatchRates(entries, next, line, side);
  const ground = next.ground.split(",")[0];
  const cells = (
    <>
      {next.ground ? <RateRow label={`At ${ground}`} r={here} side={side} line={line} /> : <span />}
      {next.opp ? <RateRow label={`Vs ${next.opp}`} r={versus} side={side} line={line} /> : null}
    </>
  );
  if (inline) return <div className="grid grid-cols-2 divide-x divide-hairline [&>*]:px-snug [&>*]:py-snug" aria-label="At this ground and against this side">{cells}</div>;
  return (
    <section className="grid gap-snug" aria-label="At this ground and against this side">
      <h2 className="label-cap text-footnote text-muted-foreground">{side === "over" ? "Over" : "Under"} {line} · history</h2>
      <div className="grid grid-cols-2 gap-snug rounded-2xl border border-hairline p-inset">{cells}</div>
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
