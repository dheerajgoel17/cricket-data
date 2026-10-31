/* eslint-disable @typescript-eslint/no-explicit-any */
import { track } from "@/lib/analytics";
import { bookQuotes } from "@cricket/engine/lines.js";
import { nextMatchRates } from "@cricket/engine/next-match.js";
import { localWhen, odds } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OddsTable } from "./odds-table";
import { Note } from "./note";
import { MatchStatus } from "./match-status";
import { TeamBadge } from "./badges";
import { StandingMark, Tick, type Standing } from "./tick";

const CARD = ""; // flat: the page is the container
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

/** One context row: hit rate, n, fair decimal odds on the line the chart is on. */
function RateRow({ label, r, side, line }: { label: string; r: { p: number | null; hits: number; played: number; fair: number | null }; side: string; line: number }) {
  if (r.played < 1) {
    return (
      <div className="flex items-baseline justify-between gap-snug text-callout">
        <span className="min-w-0 truncate text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">no sample</span>
      </div>
    );
  }
  return (
    <div className="flex items-baseline justify-between gap-snug text-callout">
      <span className="min-w-0 truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 tabular-nums">
        <b className={cn("font-semibold", tone(r.p))}>{r.p == null ? "–" : `${Math.round(r.p * 100)}%`}</b>
        {" "}<span className="text-muted-foreground">{r.hits} of {r.played}</span>
        {" "}<span className="text-muted-foreground" title={`fair ${side} ${line}`}>fair {odds(r.fair)}</span>
      </span>
    </div>
  );
}

/**
 * Next match on the player page: who and when, the books' prices on this line, and how he has gone over/under it at that ground and against that side
 * (the games on the chart, this format, filters applied). A match that has started or just finished stays here with the listed line and whether it cleared.
 */
export function NextMatch({ next, entries, line, side, book, statLabel, fmt, standing, out }: {
  next: NextMatchInfo; entries: any[]; line: number; side: string; book?: any; statLabel: string; fmt?: string;
  standing?: LineSoFar | null; out?: boolean;
}) {
  const { here, versus } = nextMatchRates(entries, next, line, side);
  const bookAt = book?.lines?.find((l: any) => l.line === line) || null;
  const quotes = bookQuotes(bookAt ? [bookAt] : []);
  const best = bookAt ? Math.max(0, ...bookAt.books.map((b: any) => b[side] || 0)) : 0;
  const ground = next.ground.split(",")[0];
  const heading = next.phase && next.phase !== "upcoming" ? "This match" : "Next match";
  return (
    <div className={cn("grid gap-snug", CARD, out && "opacity-60")}>
      <div className="flex items-start justify-between gap-snug">
        <span className="label-cap text-footnote text-muted-foreground">{heading}</span>
        {next.phase === "live" || next.phase === "final" ? <MatchStatus phase={next.phase} className="shrink-0 text-footnote" /> : <span className="shrink-0 text-footnote tabular-nums text-muted-foreground">{localWhen(next.start)}</span>}
      </div>
      <div className="flex min-w-0 items-center gap-snug">
        {next.team ? <><TeamBadge name={next.team} size="sm" eager /><span className="text-footnote text-muted-foreground">vs</span></> : null}
        {next.opp ? <><TeamBadge name={next.opp} size="sm" eager /><span className="min-w-0 truncate text-body font-semibold">{next.opp}</span></>
          : <span className="min-w-0 truncate text-body font-semibold">{next.match}</span>}
        {out ? <Badge variant="outline" className="shrink-0 px-snug py-hair text-caption font-semibold text-muted-foreground">Not in XI</Badge> : null}
      </div>
      {next.ground ? <span className="text-callout text-muted-foreground">{next.ground}{next.competition ? ` · ${next.competition}` : ""}</span> : null}

      {book ? (
        <>
          <div className="grid gap-hair border-t border-hairline pt-snug">
            <div className="flex flex-wrap items-baseline justify-between gap-snug">
              <span className="text-body font-semibold tabular-nums">{side === "over" ? "O" : "U"} {line} <span className="font-medium text-muted-foreground">{statLabel}</span>
                {standing != null && <> · <StandingMark standing={standing} line={line} /></>}
              </span>
              {best > 1 ? <Tick value={best} className="text-callout font-semibold tabular-nums text-foreground">{odds(best)}</Tick> : null}
            </div>
            {quotes.length ? (
              <OddsTable lines={quotes.map((q: any) => ({ line: q.line, books: [{ source: q.source, over: q.over, under: q.under, underAt: q.underAt }] }))} />
            ) : book.main && book.main.line !== line ? (
              <p className="text-callout text-muted-foreground">Books price {book.main.line} on this match, not {line}.</p>
            ) : null}
          </div>

          <div className="grid gap-snug border-t border-hairline pt-snug sm:grid-cols-2">
            {next.ground ? <div className="rounded-xl bg-secondary/60 p-snug"><RateRow label={`At ${ground}`} r={here} side={side} line={line} /></div> : null}
            {next.opp ? <div className="rounded-xl bg-secondary/60 p-snug"><RateRow label={`Vs ${next.opp}`} r={versus} side={side} line={line} /></div> : null}
            <Note className="sm:col-span-2" title="How to read this" items={[
              <>Hit rate counts {fmt ? <b className="font-semibold text-foreground">{fmt}</b> : "the"} games he played on this line. Other formats are never mixed in.</>,
              "Games he did not play (DNP) or that were void are left out, not counted as misses.",
              "Fair odds are 1 ÷ hit rate. They carry no bookmaker margin, so compare them with the listed price.",
            ]} />
          </div>
        </>
      ) : (
        <p className="border-t border-hairline pt-snug text-callout text-muted-foreground">No props live yet</p>
      )}
    </div>
  );
}

/** Quick filters: only games against his next opponent, only games at its ground (the same URL keys as the sheet). */
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
