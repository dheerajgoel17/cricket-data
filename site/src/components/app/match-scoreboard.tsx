/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { scoreLabel } from "@cricket/engine/live.js";
import { abbr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TeamBadge } from "./badges";
import { StatusLabel } from "./status-label";
import { Tick } from "./tick";

export type BoardScore = { display?: string; runs?: number | null; wkts?: number | null; overs?: number | null } | null | undefined;

export type BoardSide = {
  name: string;
  ix: number;
  score?: BoardScore;
};

function oversLine(s: BoardScore) {
  if (s?.overs == null) return null;
  const o = Number.isInteger(s.overs) ? String(s.overs) : String(s.overs);
  return `Over ${o}`;
}

/** One side: crest · abbr · large score · "Over N". Mirrored on the right. */
function SideBlock({ side, mirror, live, pending }: { side: BoardSide; mirror?: boolean; live?: boolean; pending?: boolean }) {
  const total = side.score?.display ? scoreLabel(side.score) : null;
  const overs = oversLine(side.score);
  const change = side.score?.runs == null ? null : side.score.runs + (side.score.wkts ?? 0) / 100;
  const crest = <TeamBadge name={side.name} size="md" className="size-9 shrink-0 sm:size-10" eager />;
  const code = <span className="label-cap text-callout font-emphasis text-muted-foreground">{abbr(side.name)}</span>;
  const figures = (
    <span className={cn("grid min-w-0 gap-hair", mirror ? "justify-items-end text-right" : "justify-items-start text-left")}>
      {pending && !total ? (
        <span className="h-8 w-20 animate-pulse rounded-md bg-secondary" aria-hidden />
      ) : total ? (
        live ? (
          <Tick quiet arrow={false} value={change} className="px-0 font-condensed text-metric font-emphasis leading-none tracking-tight tabular-nums sm:text-[1.75rem]">
            {total}
          </Tick>
        ) : (
          <span className="font-condensed text-metric font-emphasis leading-none tracking-tight tabular-nums sm:text-[1.75rem]">{total}</span>
        )
      ) : (
        <span className="text-title text-muted-foreground">—</span>
      )}
      {overs ? <span className="text-footnote text-muted-foreground">{overs}</span> : <span className="h-4" aria-hidden />}
    </span>
  );
  const body = (
    <span className={cn("flex min-w-0 items-center gap-snug", mirror && "flex-row-reverse")}>
      <span className={cn("flex shrink-0 flex-col items-center gap-hair", mirror && "items-center")}>
        {crest}
        {code}
      </span>
      {figures}
    </span>
  );
  if (side.ix >= 0) {
    return (
      <Link to={`/team/${side.ix}`} className={cn("min-w-0 flex-1 active:opacity-70", mirror && "flex justify-end")} aria-label={side.name}>
        {body}
      </Link>
    );
  }
  return <div className={cn("min-w-0 flex-1", mirror && "flex justify-end")}>{body}</div>;
}

/**
 * Fixture-page scoreboard (Hotstar-style composition, product tokens):
 * series · crest/score · LIVE pill · crest/score · optional live strip below.
 * Centre status uses shared StatusLabel (live pill = white on miss).
 */
export function MatchScoreboard({
  a,
  b,
  badge,
  livePulse,
  session,
  series,
  meta,
  ticker,
  strip,
  live = false,
  pending = false,
  className,
}: {
  a: BoardSide;
  b: BoardSide;
  badge: string;
  livePulse?: boolean;
  session?: boolean;
  series?: ReactNode;
  meta?: ReactNode;
  ticker?: ReactNode;
  strip?: ReactNode;
  live?: boolean;
  pending?: boolean;
  className?: string;
}) {
  const tone = livePulse ? "live" : session ? "session" : "muted";
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      {(series || meta) && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-snug gap-y-hair px-gutter pt-snug text-footnote text-muted-foreground">
          {series ? <span className="min-w-0 truncate font-label text-foreground/80">{series}</span> : <span />}
          {meta ? <span className="shrink-0">{meta}</span> : null}
        </div>
      )}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-snug px-gutter py-inset">
        <SideBlock side={a} live={live} pending={pending} />
        <StatusLabel tone={tone} surface="pill">{badge}</StatusLabel>
        <SideBlock side={b} mirror live={live} pending={pending} />
      </div>
      {ticker ? (
        <div className="flex flex-wrap items-baseline gap-x-snug gap-y-hair border-t border-hairline px-gutter py-snug text-callout">
          {ticker}
        </div>
      ) : null}
      {strip}
    </div>
  );
}
