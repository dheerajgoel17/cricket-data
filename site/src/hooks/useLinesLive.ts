/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { liveBoard, namesMatch, teamKey } from "@cricket/engine/live.js";
import { liveMerge, sameTeam } from "@cricket/engine/inplay-lines.js";
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
  const fixtures = useQuery({ queryKey: ["fixtures"], queryFn: () => store.loadFixtures() as Promise<any[]> }); // the same cache entry as `useFixtures`
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
    // the live match of two sides, from the 15 s snapshot
    const liveOf = (sides: string[]) => (live.data?.matches || []).find((x: any) => x.status === "live" && sides.every((s) => (x.teams || []).some((t: any) => sameTeam(t.name, s))));
    // a Test batter's live line is his side's current innings: 1 or 2, counted from the live match's innings of that side (null when the live match is not found)
    const innOf = (team: string, sides: string[]) => {
      const n = (liveOf(sides)?.innings || []).filter((i: any) => i.runs != null && sameTeam(i.team, team)).length;
      return n ? Math.min(n, 2) : null;
    };
    // a pre-match line stays the row (and is the bet we settle) until the runs so far are past it; then the live line takes over. A batter's runs, null when he is not on the board:
    const soFarOf = (name: string, sides: string[]) => {
      const b = (liveBoard(liveOf(sides))?.batters as any[] | undefined)?.find((p) => namesMatch(p.name, name));
      return b?.runs ?? null;
    };
    // ... and a side's runs in that innings (a Test side's 1st or 2nd turn; a limited-overs side has the one)
    const teamRunsOf = (team: string, inn: number, sides: string[], fmt: string) => {
      const own = (liveOf(sides)?.innings || []).filter((i: any) => i.runs != null && sameTeam(i.team, team)).sort((a: any, b: any) => a.n - b.n);
      return (fmt === "Test" ? own[inn - 1] : own[0])?.runs ?? null;
    };
    return liveMerge(lines.data, inplay.data, resolve, fixtures.data || [], innOf, soFarOf, teamRunsOf);
  }, [on, inplay.data, lines.data, store, rz, fixtures.data, live.data]);
  return { ...lines, data };
}
