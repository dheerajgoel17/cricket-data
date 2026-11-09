/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { teamKey } from "@cricket/engine/live.js";
import { liveMerge } from "@cricket/engine/inplay-lines.js";
import { useLiveDoc } from "@/hooks/useLive";
import { useData } from "@/lib/data";
import { inplayQuery, linesQuery } from "@/lib/queries";

/**
 * The book lines the tables read, with the in-play lines of started matches folded in (`liveMerge`): a batter's innings-runs line and a side's innings-total line replace the earlier ones and
 * carry `live: true`, so the props and fancy tables show them with their own history figures and no table of their own. `/api/inplay` is asked (~15 s) only while a match is on.
 * `data.live` holds the other live markets, shown as live rows of the Match Fancy list. Same shape as `useQuery(linesQuery)`.
 */
export function useLinesLive() {
  const lines = useQuery(linesQuery);
  const { store, rz } = useData();
  const live = useLiveDoc();
  const on = useMemo(() => (live.data?.matches || []).some((m: any) => m.status === "live"), [live.data]);
  const inplay = useQuery({ ...inplayQuery, enabled: on });
  const data = useMemo(() => {
    if (!on || !inplay.data?.matches?.length || !lines.data) return lines.data;
    const teamIdx = (n: string) => (store.teams || []).findIndex((t: any) => teamKey(t.n) === teamKey(n));
    const resolve = (name: string, sides: string[]) => {
      for (const side of sides) {
        const ti = teamIdx(side);
        const hits = rz.players(name, ti >= 0 ? { team: ti } : {}, 2) as { idx: number; score: number }[];
        if (hits.length && hits[0].score >= 8) return { pid: store.P.id[hits[0].idx], name: store.P.nm[hits[0].idx], team: side };
      }
      return null;
    };
    return liveMerge(lines.data, inplay.data, resolve);
  }, [on, inplay.data, lines.data, store, rz]);
  return { ...lines, data };
}
