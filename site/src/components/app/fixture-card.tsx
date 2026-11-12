/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { liveBlurb, scoreLabel, sessionLabel, teamScore } from "@cricket/engine/live.js";
import { useLiveMatch } from "@/hooks/useLive";
import { playState } from "@/lib/play-state";
import { abbr, dayKey, dayLabel, fixtureStart, localTime, matchDateLabel, pretty } from "@/lib/format";
import { useNow } from "@/lib/clock";
import { TeamAvatar, TeamBadge, usePreloadTeams } from "./badges";
import { Tick } from "./tick";

const seriesName = (f: any) => (f.series ? (f.series.includes(" ") ? f.series : pretty(f.series.replace(/-\d{4}$/, ""))) : `${f.gender === "female" ? "Women's" : "Men's"} cricket`);
const hasTime = (f: any) => f.start.length > 10;
const city = (v: string) => (v || "").split(",")[0].replace(/\(.*\)/, "").trim();

/** One team's live total, right-aligned on the same row as the name. Empty means they have not batted. */
export function LiveScore({ s, size = "md", className, live = false }: { live?: boolean; s: { display?: string; runs?: number | null; wkts?: number | null; overs?: number | null } | null | undefined; size?: "md" | "lg"; className?: string }) {
  if (!s?.display) {
    return <span className={cn("shrink-0 text-muted-foreground", size === "lg" ? "text-callout" : "text-footnote", className)}>Yet to bat</span>;
  }
  const total = scoreLabel(s);
  const totalClass = cn("font-condensed font-bold leading-none tracking-tight", size === "lg" ? "text-title" : "text-body");
  // Include wickets so a dismissal can animate the score even when no runs were scored.
  const change = s.runs == null ? null : s.runs + (s.wkts ?? 0) / 100;
  return (
    <span className={cn("inline-flex shrink-0 items-baseline gap-tight tabular-nums", className)}>
      {live ? <Tick quiet value={change} className={cn(totalClass, "px-0")}>{total}</Tick> : <span className={totalClass}>{total}</span>}
      {s.overs != null && <span className="font-condensed text-footnote font-medium text-muted-foreground">{Number.isInteger(s.overs) ? s.overs.toFixed(1) : s.overs} ov</span>}
    </span>
  );
}

/** What a started match says in place of its score when neither the schedule nor the live feed lists it. */
export const NO_SCORE = "Score not available from our source";

export function startsIn(ms: number) {
  const m = Math.max(1, Math.round(ms / 60000)), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d >= 1) return `Starts in ${d} day${d > 1 ? "s" : ""}`;
  return h >= 1 ? `Starts in ${h}h${m % 60 ? ` ${m % 60}m` : ""}` : `Starts in ${m}m`;
}

/** Source B-style match card built from shadcn Card parts: status + format badges, the two sides with the start time, the status line, then series and the Props badge.
 *  `f.cardScores` (optional): precomputed side scores from history when the live feed has none — same shape as `teamScore`. */
export function FixtureCard({ f, i = 0 }: { f: any; i?: number }) {
  const now = useNow(30000);
  const when = fixtureStart(f), ms = when.getTime() - now, timed = hasTime(f);
  const { match } = useLiveMatch(f);
  const liveScores = [teamScore(match, f.a), teamScore(match, f.b)];
  const scores = (f.cardScores?.[0]?.display || f.cardScores?.[1]?.display) ? f.cardScores : liveScores;
  const play = playState(f, match, now);
  const hasScore = play.hasScore || !!(scores?.[0]?.display || scores?.[1]?.display);
  const [final, delayed, live, started] = [play.state === "final", play.state === "delayed", play.state === "live", play.state === "started"]; // in play only on evidence; a started match with no word on play has no LIVE badge and no score columns
  const blurb = liveBlurb(match);
  const session = sessionLabel(blurb) || match?.session || "";
  const status = blurb || (final ? f.result || "Match completed" : live ? "Match in progress" : started ? NO_SCORE : delayed ? "Start delayed" : timed ? startsIn(ms) : "Start time to be confirmed");
  const winner = final ? [f.a, f.b].find((t: string) => status.toLowerCase().includes(`${t.toLowerCase()} won`)) : undefined;
  const lost = (t: string) => !!winner && t !== winner; // the side that lost a finished match steps back
  const cta = f.noProps ? (final ? "Match" : "No props live yet") : "Props";
  return (
    <motion.div className="h-full" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i, 6) * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
    <Link to={f.id ? `/fixture/${f.id}` : f.a_ix >= 0 ? `/team/${f.a_ix}` : "/teams"} className="group block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full gap-0 rounded-2xl border-0 bg-card py-0 shadow-none ring-1 ring-hairline transition-colors group-hover:bg-surface-raised">
        <div className="flex h-full flex-col gap-snug p-inset">
          <div className="flex items-center gap-tight text-footnote font-medium text-muted-foreground">
            {session ? <span className="label-cap text-footnote text-destructive">{session}</span> : live ? <span className="inline-flex items-center gap-tight label-cap text-footnote text-destructive"><span className="size-1.5 animate-pulse rounded-full bg-current" />Live</span> : <span className="label-cap text-footnote">{final ? "Final" : started ? "Started" : "Upcoming"}</span>}
            <span aria-hidden>·</span>
            <span>{f.fmt || "T20"}{f.gender === "female" ? " · W" : ""}</span>
            {final ? (
              <span className="ml-auto shrink-0 tabular-nums">{matchDateLabel(f.start)}</span>
            ) : city(f.venue) ? (
              <span className="ml-auto min-w-0 truncate" title={`${seriesName(f)} · ${f.venue}`}>{city(f.venue)}</span>
            ) : null}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-snug gap-y-snug">
            {[f.a, f.b].map((t: string, k: number) => (
              <div key={t} className="contents">
                <div className="flex min-w-0 items-center gap-snug" title={t}>
                  <TeamBadge name={t} size="md" eager />
                  <span className={cn("truncate text-body font-medium", lost(t) && "font-medium text-muted-foreground")}>{t}</span>
                </div>
                {hasScore || live ? <LiveScore live={live} s={scores[k]} className={cn(lost(t) && "opacity-60")} /> : k === 0 && !final ? (
                  <span className="row-span-2 grid justify-items-end text-right">
                    <span className="text-footnote text-muted-foreground">{dayLabel(dayKey(f))}</span>
                    {timed && <span className="text-callout font-medium tabular-nums">{localTime(when)}</span>}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between gap-snug pt-tight">
            <div className="grid min-w-0"><span className="truncate text-footnote font-medium">{status}</span><span className="truncate text-caption text-muted-foreground">{seriesName(f)}</span></div>
            {f.noProps && !final ? <span className="shrink-0 text-footnote text-muted-foreground">{cta}</span> : <span className="inline-flex shrink-0 items-center text-footnote font-medium text-primary">{cta}<ChevronRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></span>}
          </div>
        </div>
      </Card>
    </Link>
    </motion.div>
  );
}

/** Crests + short names + kick-off; sits inside a PillGroup. Uses shadcn AvatarGroup (image fills each Avatar — no nested Circle). */
export function MatchChip({ f }: { f: any }) {
  const when = fixtureStart(f), timed = hasTime(f);
  const { match } = useLiveMatch(f);
  const session = sessionLabel(liveBlurb(match)) || match?.session || "";
  const live = !!(session || match?.status === "live");
  const sub = session || (match?.status === "live" ? "Live" : timed ? localTime(when) : dayLabel(dayKey(f)));
  return (
    <span className="flex min-w-0 items-center gap-tight">
      <AvatarGroup className="-space-x-1.5">
        <TeamAvatar name={f.a} size="xs" eager />
        <TeamAvatar name={f.b} size="xs" eager />
      </AvatarGroup>
      <span className="grid min-w-0 text-left leading-tight">
        <span className="truncate text-caption font-medium">{abbr(f.a)} v {abbr(f.b)}</span>
        {live
          ? <Badge variant="destructive" className="h-auto w-fit rounded-[var(--chip-radius)] px-tight text-caption font-medium">{sub}</Badge>
          : <span className="truncate text-caption opacity-70">{sub}</span>}
      </span>
    </span>
  );
}

/** Native snap rail of FixtureCards (iOS momentum, one-card snap). On a phone each card is `--fixture-card` (80% of the screen) so the next match peeks; from `lg` the token is a fixed rem. The home phase tabs (In play / Pre-match / Completed) pick which cards sit here. */
export function FixtureRail({ fx }: { fx: any[] }) {
  usePreloadTeams(fx.slice(0, 8).flatMap((f) => [f.a, f.b]));
  if (!fx.length) return null;
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} aria-label="Matches">
      <div
        role="list"
        aria-label="Match cards"
        className="-mx-gutter flex snap-x snap-mandatory gap-snug overflow-x-auto overscroll-x-contain px-gutter [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [scroll-padding-inline:var(--gutter)] [&::-webkit-scrollbar]:hidden"
      >
        {fx.map((f, i) => (
          <div key={`${f.id}${f.a}${f.b}`} role="listitem" className="w-(--fixture-card) shrink-0 snap-start">
            <FixtureCard f={f} i={i} />
          </div>
        ))}
      </div>
    </motion.section>
  );
}
