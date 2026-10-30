/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { fixtureState, usePricedFixtures } from "@/hooks/useEngine";
import { useLiveDoc } from "@/hooks/useLive";
import { useRail } from "@/hooks/useRail";
import { liveForFixture } from "@/engine/live.js";
import { homeTeam, rankFixtures } from "@/lib/priority";

/** How long the rail waits for its published settings and for the first live scores before it paints with what it has (the viewer sees the skeleton meanwhile). */
export const RAIL_WAIT_MS = 800, LIVE_WAIT_MS = 1200;

/** False until `ms` after the first render, true after (a re-render then); never starts the timer when `done` already. */
function useGaveUp(ms: number, done: boolean): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setLate(true), ms);
    return () => clearTimeout(t);
  }, [ms, done]);
  return late;
}

/**
 * The fixtures the home rail shows, in order: matches in play first, then the ones to come, then finished ones (`rankFixtures`). Nothing (`ready` false: the page shows a skeleton)
 * until the schedule and the bookmaker lines are in, so the list is never the unpriced schedule that the priced one then replaces. The live state is what puts a match first, so
 * the first paint also has it: at once from the last /api/live body kept on the device (`live-cache.ts`), else after a short wait (the same for the rail settings). A fresh body that
 * changes a match's state (it has gone live, or ended) re-sorts the rail; one that changes nothing leaves the order as it was.
 */
/** How many games without props the rail adds after the ones with props. */
const NO_PROPS_LIMIT = 24;
/** A match that began in this window (a T20 that just ended) sits at the front of the finished group. */
export const JUST_ENDED_MS = 8 * 3600e3;

/**
 * Finished matches the rail still shows: every priced Final `shownFixtures` kept (no count cap). Just-ended games
 * lead the group so a club or women's T20 is not buried behind older internationals the moment it goes Final.
 */
export function keepFinished(finished: any[], now = Date.now()): any[] {
  const just = finished.filter((f) => Date.parse(f.start) > now - JUST_ENDED_MS);
  const older = finished.filter((f) => Date.parse(f.start) <= now - JUST_ENDED_MS);
  return [...just, ...older];
}

export function useHomeRail(limit = 14): { ready: boolean; fixtures: any[] } {
  const { fixtures: fx, ready: haveFixtures } = usePricedFixtures();
  const live = useLiveDoc();
  const { rail, settled } = useRail();
  const haveLive = live.data !== undefined || live.isFetched;
  const railLate = useGaveUp(RAIL_WAIT_MS, settled), liveLate = useGaveUp(LIVE_WAIT_MS, haveLive);
  const ready = haveFixtures && (settled || railLate) && (haveLive || liveLate);
  const fixtures = useMemo(() => {
    if (!ready) return [];
    const stateOf = (f: any) => fixtureState(f, liveForFixture(live.data, f)?.status);
    const ranked = rankFixtures(fx, homeTeam(), stateOf, rail);
    const priced = ranked.filter((f) => !f.noProps);
    // finished matches have their own places after the live and coming ones: with many matches lined up they would be cut off the `limit`, so they are appended in full
    const done = keepFinished(priced.filter((f) => stateOf(f) === "final")), going = priced.filter((f) => stateOf(f) !== "final").slice(0, limit);
    return [...going, ...done, ...ranked.filter((f) => f.noProps).slice(0, NO_PROPS_LIMIT)]; // games with props first; the ones without follow, in the same order
  }, [ready, fx, live.data, rail, limit]);
  return { ready, fixtures };
}
