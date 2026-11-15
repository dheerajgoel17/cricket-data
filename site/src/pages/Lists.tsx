/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronRightIcon, PuzzlePieceIcon } from "@heroicons/react/24/outline";
import { liveBlurb, nextTestDayLine, sessionBadge, sessionLabel, teamScore } from "@cricket/engine/live.js";
import { motion } from "motion/react";
import { useNow } from "@/lib/clock";
import { dayKey, dayLabel, fixtureStart, localTime, matchDateLabel, pretty } from "@/lib/format";
import { fancyMarketPath } from "@/lib/fancy-path";
import { TabTitle } from "@/lib/header-slot";
import { hotDay, hotDayLabels, matchChipId } from "@/lib/hot-lines";
import { playState } from "@/lib/play-state";
import { setTitle } from "@/lib/title";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/app/empty-state";
import { HotProps } from "@/components/app/hot-props";
import { AdSlot } from "@/components/app/ad-slot";
import { LiveScore, MatchChip, NO_SCORE, startsIn } from "@/components/app/fixture-card";
import { FancyLines, fancyFm } from "@/components/app/match-fancy";
import { PillGroup } from "@/components/app/pill-group";
import { useFancyCards } from "@/hooks/useFancyCards";
import { useLiveMatch } from "@/hooks/useLive";
import { TeamBadge } from "@/components/app/badges";
import { StatusLabel } from "@/components/app/status-label";
import { RowsSkeleton } from "@/components/app/skeletons";
import { CardGrid } from "@/components/app/page";

const seriesName = (f: any) => (f.series ? (f.series.includes(" ") ? f.series : pretty(f.series.replace(/-\d{4}$/, ""))) : `${f.gender === "female" ? "Women's" : "Men's"} cricket`);
const hasTime = (f: any) => f.start.length > 10;
const city = (v: string) => (v || "").split(",")[0].replace(/\(.*\)/, "").trim();
const fxChip = (f: any) => matchChipId(`${f.a} vs ${f.b}`, f.start, f.fmt);

/** Player props: the hot props of every priced match, with the day switch and filters the component carries. */
export function PropsPage() {
  setTitle("Cricket player props: hit rates and listed lines");
  // The filters live in the URL. Coming back to Props from another tab (a bare /props) restores the last view of this session; a shared link with filters wins.
  const nav = useNavigate();
  const { search } = useLocation();
  const mounted = useRef(false);
  useEffect(() => {
    try {
      const first = !mounted.current;
      mounted.current = true;
      if (search) sessionStorage.setItem(LAST, search);
      else if (first) { const last = sessionStorage.getItem(LAST); if (last) nav(`/props${last}`, { replace: true }); }
      else sessionStorage.removeItem(LAST); // cleared on purpose
    } catch { /* storage blocked: the plain screener */ }
  }, [search, nav]);
  return (
    <div className="flex flex-col gap-stack">
      <TabTitle>Player props</TabTitle>
      <AdSlot slotId="props_list_top" />
      <HotProps syncUrl />
    </div>
  );
}
const LAST = "cph-props-last";

const SHOWN_ROWS = 4; // the best-edge markets on the card; the rest are one tap away on the match's Fancy tab

/** Fancy: every priced match with its best-edge markets (the book's line, the edge and the last ten results against it), each match linking to its own Fancy tab. Matches in play lead, same as the home rail. Day + match chips mirror Props. */
export function FancyPage() {
  setTitle("Cricket fancy lines: match totals and over/unders");
  const { cards, ready } = useFancyCards();
  const [params, setParams] = useSearchParams();
  const day = params.get("day") ?? "0";
  const match = params.get("match") ?? "all";
  const setFilter = (patch: { day?: string; match?: string }) => {
    const next = new URLSearchParams(params);
    const d = patch.day ?? day, m = patch.match ?? match;
    if (d === "0") next.delete("day"); else next.set("day", d);
    if (m === "all") next.delete("match"); else next.set("match", m);
    setParams(next, { replace: true });
  };
  const scored = useMemo(() => cards.filter((r: any) => r.rows.length > 0), [cards]); // lines up with something to score on
  const dayCards = useMemo(() => scored.filter((r: any) => hotDay(r.f.start, r.f.fmt) === Number(day)), [scored, day]);
  const matchChips = useMemo(() => dayCards.map((r: any) => ({ id: fxChip(r.f), a: r.f.a, b: r.f.b, start: r.f.start, fmt: r.f.fmt, series: r.f.series })), [dayCards]);
  const pick = matchChips.some((c) => c.id === match) ? match : "all";
  const rows = useMemo(() => (pick === "all" ? dayCards : dayCards.filter((r: any) => fxChip(r.f) === pick)), [dayCards, pick]);
  const otherDay = useMemo(() => scored.some((r: any) => { const d = hotDay(r.f.start, r.f.fmt); return d >= 0 && d !== Number(day); }), [scored, day]);
  const title = <TabTitle>Fancy</TabTitle>;
  if (!ready) return <>{title}<RowsSkeleton /></>;
  return (
    <div className="flex flex-col gap-stack">
      {title}
      {scored.length > 0 ? (
        <>
          <PillGroup layoutId="fancy-day" label="Day" value={day} onChange={(v) => setFilter({ day: v, match: "all" })} items={hotDayLabels()} className="min-w-0" />
          {matchChips.length > 0 ? (
            <PillGroup
              layoutId="fancy-match"
              label="Matches"
              value={pick}
              onChange={(v) => setFilter({ match: v })}
              className="w-auto max-w-full"
              itemClassName="h-auto min-h-control whitespace-normal px-snug py-tight"
              items={[["all", "All"], ...matchChips.map((f) => [f.id, <MatchChip key={f.id} f={f} />] as [string, ReactNode])]}
            />
          ) : null}
        </>
      ) : null}
      {!scored.length ? (
        <EmptyState
          icon={<PuzzlePieceIcon />}
          title="No fancy lines yet"
          body="They open a day or two before a match, once there are past matches to score them on."
        />
      ) : !rows.length ? (
        <EmptyState
          icon={<PuzzlePieceIcon />}
          title={day === "0" ? "No fancy lines today" : "No fancy lines for this day"}
          body={otherDay ? "Lines are priced on other days — pick another chip above." : "Lines usually land a day or two before the toss."}
        />
      ) : (
        <CardGrid>
          {rows.map((r: any, i: number) => <FancyCard key={r.f.id || `${r.f.a}${r.f.b}${r.f.start}`} {...r} i={i} />)}
        </CardGrid>
      )}
    </div>
  );
}

/** One match's fancy markets: FixtureCard shell (all breakpoints) + compact FancyLines. */
function FancyCard({ f, ms, rows, i }: { f: any; ms: number[]; rows: any[]; i: number }) {
  const nav = useNavigate();
  const { match } = useLiveMatch(f);
  const blurb = liveBlurb(match);
  const sessionSummary = blurb || match?.session || "";
  const stumps = sessionLabel(sessionSummary) === "Stumps";
  const now = useNow(stumps ? 1000 : 30000);
  const when = fixtureStart(f), kickMs = when.getTime() - now, timed = hasTime(f);
  const scores = [teamScore(match, f.a), teamScore(match, f.b)];
  const play = playState(f, match, now);
  const hasScore = play.hasScore || !!(scores[0]?.display || scores[1]?.display);
  const [final, delayed, live, started] = [play.state === "final", play.state === "delayed", play.state === "live", play.state === "started"];
  const session = sessionBadge(sessionSummary);
  const nextDay = nextTestDayLine(f.start, sessionSummary, now);
  const status = nextDay || blurb || (final ? f.result || "Match completed" : live && !session ? "Match in progress" : started ? NO_SCORE : delayed ? "Start delayed" : timed ? startsIn(kickMs) : "Start time to be confirmed");
  const winner = final ? [f.a, f.b].find((t: string) => status.toLowerCase().includes(`${t.toLowerCase()} won`)) : undefined;
  const lost = (t: string) => !!winner && t !== winner;
  const place = city(f.venue);
  const to = (fm?: string, sc?: number) => (fm ? fancyMarketPath(f.id, { fm, sc: sc != null && sc >= 0 ? sc : null }) : `/fixture/${f.id}?tab=fancy`);
  return (
    <motion.div className="h-full" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 6) * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
      <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-hairline transition-colors hover:bg-surface-raised">
        {/* Parent: match chrome — raised wash on the card (phone + desktop). */}
        <Link to={to()} className="flex flex-col gap-snug bg-surface-raised px-inset py-inset outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="flex items-center gap-tight text-footnote font-label text-muted-foreground">
            {session ? <StatusLabel tone="session" surface="plain">{session}</StatusLabel> : live ? <StatusLabel tone="live" surface="dot" /> : <StatusLabel tone="muted" surface="plain">{final ? "Final" : started ? "Started" : "Upcoming"}</StatusLabel>}
            <span aria-hidden>·</span>
            <span className="label-cap text-footnote">{f.fmt || "T20"}{f.gender === "female" ? " · W" : ""}</span>
            {final ? (
              <span className="ml-auto shrink-0 tabular-nums">{matchDateLabel(f.start)}</span>
            ) : place ? (
              <span className="ml-auto min-w-0 truncate" title={f.venue}>{place}</span>
            ) : null}
          </div>
          <div className="flex flex-col gap-snug">
            {[f.a, f.b].map((t: string, k: number) => (
              <div key={t} className="flex min-w-0 items-center gap-snug" title={t}>
                <TeamBadge name={t} size="md" eager />
                <span className={cn("min-w-0 flex-1 truncate text-body font-emphasis", lost(t) && "text-muted-foreground")}>{t}</span>
                {hasScore || live ? (
                  <LiveScore live={live && !session} pending={live && !match} s={scores[k]} className={cn(lost(t) && "opacity-60")} />
                ) : k === 0 && !final ? (
                  <span className="grid shrink-0 justify-items-end text-right">
                    <span className="text-footnote text-muted-foreground">{dayLabel(dayKey(f))}</span>
                    {timed ? <span className="text-callout font-label tabular-nums">{localTime(when)}</span> : null}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </Link>
        {/* Markets on the card base — pad copy with inset so hairlines still span the panel. */}
        {rows.length ? (
          <div className="border-t border-hairline [&_button]:px-inset">
            <FancyLines
              rows={rows.slice(0, SHOWN_ROWS)}
              density="compact"
              bleed={false}
              inset={false}
              onOpen={(r) => nav(to(fancyFm(r.key, r.inn || 0), r.scope))}
            />
          </div>
        ) : (
          <p className="border-t border-hairline px-inset py-snug text-callout text-muted-foreground">
            {ms.length ? "Lines are up; none of them score on past matches in this format." : "Lines are up; no past matches to score them on."}
          </p>
        )}
        {/* Footer: status · series · Fancy CTA on a quieter strip. */}
        <Link to={to()} className="mt-auto flex items-center justify-between gap-snug border-t border-hairline bg-surface px-inset py-stack outline-none focus-visible:ring-2 focus-visible:ring-ring pb-inset pt-snug">
          <div className="grid min-w-0">
            <span className="truncate text-footnote font-label">{status}</span>
            <span className="truncate text-caption text-muted-foreground">{seriesName(f)}{ms.length ? ` · last ${ms.length}` : ""}</span>
          </div>
          <span className="inline-flex shrink-0 items-center text-footnote font-label text-primary">{rows.length > SHOWN_ROWS ? `All ${rows.length} markets` : "Fancy"}<ChevronRightIcon className="size-4" aria-hidden /></span>
        </Link>
      </div>
    </motion.div>
  );
}
