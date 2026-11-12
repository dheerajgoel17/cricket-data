/* eslint-disable @typescript-eslint/no-explicit-any */
import { liveBoard, namesMatch, teamKey } from "@cricket/engine/live.js";
import { liveMerge, sameTeam } from "@cricket/engine/inplay-lines.js";

/**
 * The merge behind `useLinesLive`, kept apart so it can be tested: the book file with the in-play lines of started matches folded in (`liveMerge`), as the site's `useLinesLive` does it.
 * `store` and `rz` link a book's player name to the data; `live` is the 15 s scores doc that says which innings a Test batter is in and what he has made so far.
 */
export function mergeLiveLines(lines: any, inplay: any, live: any, fixtures: any[], store: any, rz: any) {
  const on = (live?.matches || []).some((m: any) => m.status === "live");
  if (!on || !inplay?.matches?.length || !lines || !store || !rz) return lines;
  const teamIdx = (n: string) => (store.teams || []).findIndex((t: any) => teamKey(t.n) === teamKey(n));
  const resolve = (name: string, sides: string[]) => {
    for (const side of sides) {
      const ti = teamIdx(side);
      const hits = rz.players(name, ti >= 0 ? { team: ti } : {}, 2) as { idx: number; score: number }[];
      if (hits.length && hits[0].score >= 8) return { pid: store.P.id[hits[0].idx], name: store.P.nm[hits[0].idx], team: side };
    }
    return null;
  };
  const liveOf = (sides: string[]) => (live?.matches || []).find((x: any) => x.status === "live" && sides.every((s) => (x.teams || []).some((t: any) => sameTeam(t.name, s))));
  const innOf = (team: string, sides: string[]) => {
    const n = (liveOf(sides)?.innings || []).filter((i: any) => i.runs != null && sameTeam(i.team, team)).length;
    return n ? Math.min(n, 2) : null;
  };
  const soFarOf = (name: string, sides: string[]) => (liveBoard(liveOf(sides))?.batters as any[] | undefined)?.find((p) => namesMatch(p.name, name))?.runs ?? null;
  const teamRunsOf = (team: string, inn: number, sides: string[], fmt: string) => {
    const own = (liveOf(sides)?.innings || []).filter((i: any) => i.runs != null && sameTeam(i.team, team)).sort((a: any, b: any) => a.n - b.n);
    return (fmt === "Test" ? own[inn - 1] : own[0])?.runs ?? null;
  };
  return liveMerge(lines, inplay, resolve, fixtures || [], innOf, soFarOf, teamRunsOf);
}
