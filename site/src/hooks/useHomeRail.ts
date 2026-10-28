/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { fixtureState, usePricedFixtures } from "@/hooks/useEngine";
import { useLiveDoc } from "@/hooks/useLive";
import { useRail } from "@/hooks/useRail";
import { liveForFixture } from "@/engine/live.js";
import { fixtureKey, homeTeam, rankFixtures, settleOrder } from "@/lib/priority";

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
 * The fixtures the home rail shows, in order. Nothing (`ready` false: the page shows a skeleton) until the schedule and the bookmaker lines are in, so the list is never the
 * unpriced schedule that the priced one then replaces; and a short wait for the rail settings and the first live scores, so the order is right the first time.
 * What is on screen then stays put: a rail file or a live score that arrives after the cap changes what a card says, not where it sits (until the tab is left and come back to).
 */
export function useHomeRail(limit = 14): { ready: boolean; fixtures: any[] } {
  const { fixtures: fx, ready: haveFixtures } = usePricedFixtures();
  const live = useLiveDoc();
  const { rail, settled } = useRail();
  const railLate = useGaveUp(RAIL_WAIT_MS, settled), liveLate = useGaveUp(LIVE_WAIT_MS, live.isFetched);
  const ready = haveFixtures && (settled || railLate) && (live.isFetched || liveLate);
  const ranked = useMemo(() => rankFixtures(fx, homeTeam(), (f) => fixtureState(f, liveForFixture(live.data, f)?.status), rail).slice(0, limit), [fx, live.data, rail, limit]);
  const shown = useRef<string[]>([]);
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const back = () => { if (!document.hidden) { shown.current = []; setEpoch((e) => e + 1); } }; // nobody watched the rail while the tab was away: rank it afresh
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, []);
  const fixtures = useMemo(() => (ready ? settleOrder(shown.current, ranked, fixtureKey) : []), [ready, ranked, epoch]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { shown.current = fixtures.map(fixtureKey); }, [fixtures]);
  return { ready, fixtures };
}
