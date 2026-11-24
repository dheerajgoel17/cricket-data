import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Localization from "expo-localization";
import { homeTeam, sanitizeRail } from "@site/lib/priority";
import { fixturesQuery, linesQuery, railConfigQuery } from "@/lib/queries";
import { mark, timed } from "@/lib/perf";
import { buildRail, type RailItem } from "@/lib/rail";
import { useLive } from "@/lib/use-live";

/** How long Home waits for the live feed before showing the rail without it. */
const SETTLE_MS = 3500;

// Home, the Props block and the Fancy cards each ask for the rail; building it takes ~135 ms on a phone, so the one built for these inputs is shared.
let built: { fx: unknown; lines: unknown; live: unknown; home: unknown; rail: unknown; items: RailItem[] } | null = null;
function railFor(fx: any[], lines: any, live: any, home: any, rail: any): RailItem[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (built && built.fx === fx && built.lines === lines && built.live === live && built.home === home && built.rail === rail) return built.items;
  const items = timed("buildRail", () => buildRail({ fixtures: fx, lines, live, home, rail }));
  built = { fx, lines, live, home, rail, items };
  return items;
}

// One settings object per published config and one home side for the app: every `useRail` (Home, the Props block, the Fancy cards) must hand `railFor` the same identities,
// or each of them rebuilds the rail for itself on every change (three builds per poll).
let cfgSeen: { raw: unknown; rail: ReturnType<typeof sanitizeRail> } | null = null;
const railOf = (raw: unknown) => (cfgSeen && cfgSeen.raw === raw ? cfgSeen.rail : (cfgSeen = { raw, rail: sanitizeRail(raw) }).rail);
let homeSide: { v: string | null } | null = null;
const homeOf = () => (homeSide ??= { v: homeTeam(Localization.getCalendars()[0]?.timeZone ?? undefined, Localization.getLocales()[0]?.languageTag) }).v;

/** The Home rail: not `ready` until the schedule and the book lines are in, so it is never the unpriced schedule that the priced list then replaces. */
export function useRail(): { ready: boolean; settled: boolean; liveKnown: boolean; items: RailItem[]; error: boolean; refetch: () => Promise<unknown>; refreshing: boolean } {
  const fx = useQuery(fixturesQuery), lines = useQuery(linesQuery), live = useLive({ defer: true }), cfg = useQuery(railConfigQuery);
  const rail = railOf(cfg.data);
  const home = homeOf();
  const ready = fx.isSuccess && (lines.isSuccess || lines.isError);
  // Which match is in play is only known once the live feed has spoken (a kept body or the first poll; a failed poll with nothing kept is also an answer). Home waits for that before choosing a phase,
  // so it never opens on Pre-match with one card and then flips to In play; a feed that is slow past `SETTLE_MS` is not waited for any longer.
  const [late, setLate] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLate(true), SETTLE_MS); return () => clearTimeout(t); }, []);
  const settled = live.data !== undefined || late;
  const items = useMemo(
    () => (ready ? railFor(fx.data!, lines.data, live.data, home, rail) : []),
    [ready, fx.data, lines.data, live.data, home, rail],
  );
  // Stats store is not prefetched here — Home paints from hot-rows seed; Player / Fancy / leftover scoring pull the store when needed.
  if (ready) mark("rail-ready", `items=${items.length}`);
  return {
    ready, settled, liveKnown: live.data !== undefined, items, error: fx.isError && !fx.data,
    refreshing: fx.isRefetching || lines.isRefetching || live.isRefetching,
    refetch: () => Promise.all([fx.refetch(), lines.refetch(), live.refetch()]),
  };
}
