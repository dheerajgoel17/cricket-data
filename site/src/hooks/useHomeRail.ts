/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { fixtureState, usePricedFixtures } from "@/hooks/useEngine";
import { useLiveDoc } from "@/hooks/useLive";
import { useRail } from "@/hooks/useRail";
import { liveForFixture } from "@/engine/live.js";
import { keepMsFor } from "@/engine/lines.js";
import { arrangeFixtures, homeTeam, rankFixtures } from "@/lib/priority";

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
 * The fixtures the home rail shows, in series clusters (`arrangeFixtures`): matches in play, then those starting within 24 hours, then later games up to 10 days. Nothing (`ready` false: the page shows a skeleton)
 * until the schedule and the bookmaker lines are in, so the list is never the unpriced schedule that the priced one then replaces. The live state is what puts a match first, so
 * the first paint also has it: at once from the last /api/live body kept on the device (`live-cache.ts`), else after a short wait (the same for the rail settings). A fresh body that
 * changes a match's state (it has gone live, or ended) re-sorts the rail; one that changes nothing leaves the order as it was.
 */
/** How many games without props the rail adds after the ones with props. */
const NO_PROPS_LIMIT = 24;
/** Upcoming priced matches this far ahead stay on the rail. */
export const SHOW_AHEAD_MS = 10 * 86400e3;
/** A limited-overs Final stays on the rail this long after it started (a Test keeps 6 days). */
export const FINISHED_KEEP_MS = 24 * 3600e3;

/**
 * Finished matches the rail still shows: 24 hours from the start (6 days for a Test). Newest first.
 */
export function keepFinished(finished: any[], now = Date.now()): any[] {
  return finished.filter((f) => Date.parse(f.start) > now - keepMsFor(f.fmt)).sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
}

export function useHomeRail(): { ready: boolean; fixtures: any[] } {
  const { fixtures: fx, ready: haveFixtures } = usePricedFixtures();
  const live = useLiveDoc();
  const { rail, settled } = useRail();
  const haveLive = live.data !== undefined || live.isFetched;
  const railLate = useGaveUp(RAIL_WAIT_MS, settled), liveLate = useGaveUp(LIVE_WAIT_MS, haveLive);
  const ready = haveFixtures && (settled || railLate) && (haveLive || liveLate);
  const fixtures = useMemo(() => {
    if (!ready) return [];
    const now = Date.now();
    const stateOf = (f: any) => fixtureState(f, liveForFixture(live.data, f)?.status);
    const ranked = rankFixtures(fx, homeTeam(), stateOf, rail);
    const priced = ranked.filter((f) => !f.noProps);
    const arranged = arrangeFixtures(keepFinished(priced.filter((f) => stateOf(f) === "final")).concat(priced.filter((f) => stateOf(f) !== "final")), stateOf, homeTeam(), rail);
    const upcoming = arranged.filter((f) => stateOf(f) === "upcoming" && Date.parse(f.start) < now + SHOW_AHEAD_MS);
    const cap = new Set(upcoming);
    const shown = arranged.filter((f) => stateOf(f) !== "upcoming" || cap.has(f));
    return [...shown, ...ranked.filter((f) => f.noProps).slice(0, NO_PROPS_LIMIT)]; // games with props first; the ones without follow, in the same order
  }, [ready, fx, live.data, rail]);
  return { ready, fixtures };
}
