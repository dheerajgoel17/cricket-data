import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Localization from "expo-localization";
import { homeTeam } from "@site/lib/priority";
import { fixturesQuery, linesQuery, liveQuery } from "@/lib/queries";
import { mark, timed } from "@/lib/perf";
import { buildRail, type RailItem } from "@/lib/rail";

// Home, the Props block and the Fancy cards each ask for the rail; building it takes ~135 ms on a phone, so the one built for these inputs is shared.
let built: { fx: unknown; lines: unknown; live: unknown; home: unknown; items: RailItem[] } | null = null;
function railFor(fx: any[], lines: any, live: any, home: any): RailItem[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (built && built.fx === fx && built.lines === lines && built.live === live && built.home === home) return built.items;
  const items = timed("buildRail", () => buildRail({ fixtures: fx, lines, live, home }));
  built = { fx, lines, live, home, items };
  return items;
}

/** The Home rail: not `ready` until the schedule and the book lines are in, so it is never the unpriced schedule that the priced list then replaces. */
export function useRail(): { ready: boolean; items: RailItem[]; error: boolean; refetch: () => Promise<unknown>; refreshing: boolean } {
  const fx = useQuery(fixturesQuery), lines = useQuery(linesQuery), live = useQuery(liveQuery);
  const home = useMemo(() => homeTeam(Localization.getCalendars()[0]?.timeZone ?? undefined, Localization.getLocales()[0]?.languageTag), []);
  const ready = fx.isSuccess && (lines.isSuccess || lines.isError);
  const items = useMemo(
    () => (ready ? railFor(fx.data!, lines.data, live.data, home) : []),
    [ready, fx.data, lines.data, live.data, home],
  );
  if (ready) mark("rail-ready", `items=${items.length}`);
  return {
    ready, items, error: fx.isError && !fx.data,
    refreshing: fx.isRefetching || lines.isRefetching || live.isRefetching,
    refetch: () => Promise.all([fx.refetch(), lines.refetch(), live.refetch()]),
  };
}
