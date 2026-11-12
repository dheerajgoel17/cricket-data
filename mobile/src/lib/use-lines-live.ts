/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { storeQuery } from "@/lib/data";
import { mergeLiveLines } from "@/lib/merge-live";
import { fixturesQuery, inplayQuery, linesQuery, liveQuery } from "@/lib/queries";

/**
 * The book lines the screens read with the in-play lines of started matches folded in: a batter's innings-runs line and a side's innings-total line carry `live: true` and what they opened at, so the
 * props and Match Fancy rows show them; the other live markets are in `data.live` (`liveRows`). `/api/inplay` is asked (~15 s) only while a match is on. Same shape as `useQuery(linesQuery)`.
 */
export function useLinesLive() {
  const lines = useQuery(linesQuery), stats = useQuery(storeQuery), live = useQuery(liveQuery), fixtures = useQuery(fixturesQuery);
  const on = useMemo(() => (live.data?.matches || []).some((m: any) => m.status === "live"), [live.data]);
  const inplay = useQuery({ ...inplayQuery, enabled: on });
  const store = stats.data?.store, rz = stats.data?.rz;
  const data = useMemo(() => mergeLiveLines(lines.data, inplay.data, live.data, fixtures.data || [], store, rz), [lines.data, inplay.data, live.data, fixtures.data, store, rz]);
  return { ...lines, data };
}
