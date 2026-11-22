/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy, Suspense, useMemo } from "react";
import { liveForFixture } from "@cricket/engine/live.js";
import { countPhases, phaseOf, pickHomePhase } from "@/lib/home-phase";
import { setTitle } from "@/lib/title";
import { firstHomeRail } from "@/lib/data";
import { useQ } from "@/components/app/forms";
import { HomePhaseBar } from "@/components/app/home-phase-bar";
import { fixtureState } from "@/hooks/useEngine";
import { useHomeRail } from "@/hooks/useHomeRail";
import { useLiveDoc } from "@/hooks/useLive";
import { FixtureRail } from "@/components/app/fixture-card";
import { HomePropsSkeleton, RailSkeleton } from "@/components/app/skeletons";

const HotHome = lazy(() => import("@/components/app/hot-home").then((m) => ({ default: m.HotHome })));

export function HomePage() {
  setTitle("Cricket fixtures, hot player props and stats");
  // matches in play first, then those starting within 24 hours, then later games up to 10 days; inside each the viewer's own team, then the biggest matches (src/lib/priority.ts, settings in config/home_rail.json)
  const { ready, fixtures } = useHomeRail();
  const live = useLiveDoc();
  const [q, setQ] = useQ();
  const stateOf = (f: any) => fixtureState(f, liveForFixture(live.data, f)?.status);
  // Rail is books-priced only (`usePricedFixtures`); noProps filter is a safety net for stale flags.
  const priced = useMemo(() => fixtures.filter((f) => !f.noProps), [fixtures]);
  const counts = useMemo(() => countPhases(priced, (f) => phaseOf(stateOf(f))), [priced, live.data]);
  const phase = pickHomePhase(counts, q.view);
  const shown = priced.filter((f) => phaseOf(stateOf(f)) === phase);
  return (
    <div className="flex flex-col">
      <h1 className="sr-only">Cricket fixtures</h1>
      <HomePhaseBar value={phase} counts={counts} onChange={(p) => setQ({ view: p })} />
      <div className="flex flex-col gap-section pt-stack">
        {ready ? <FixtureRail fx={shown} /> : firstHomeRail && !q.view ? <section aria-label="Matches" dangerouslySetInnerHTML={{ __html: firstHomeRail }} /> : <RailSkeleton />}
        <Suspense fallback={<HomePropsSkeleton />}><HotHome phase={phase} /></Suspense>
      </div>
    </div>
  );
}
