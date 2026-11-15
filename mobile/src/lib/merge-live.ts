/* eslint-disable @typescript-eslint/no-explicit-any */
import { liveBoard, namesMatch, teamKey } from "@cricket/engine/live.js";
import { liveMerge, sameTeam } from "@cricket/engine/inplay-lines.js";

const links = new WeakMap<object, { day: string; names: Map<string, any> }>();

/**
 * The merge behind `useLinesLive`, kept apart so it can be tested: the book file with the in-play lines of started matches folded in (`liveMerge`), as the site's `useLinesLive` does it.
 * `store` and `rz` link a book's player name to the data; `live` is the 15 s scores doc that says which innings a Test batter is in and what he has made so far.
 * `lookup`, when given, answers a name the day's cache does not hold yet in place of the search (`mergeLiveLinesSliced` uses it to find out which names are missing).
 */
export function mergeLiveLines(lines: any, inplay: any, live: any, fixtures: any[], store: any, rz: any, lookup?: (name: string, sides: string[]) => any) {
  const on = (live?.matches || []).some((m: any) => m.status === "live");
  if (!on || !inplay?.matches?.length || !lines || !store || !rz) return lines;
  const resolved = namesOf(rz);
  const boards = new Map<any, any>();
  const boardOf = (match: any) => {
    if (!boards.has(match)) boards.set(match, liveBoard(match));
    return boards.get(match);
  };
  const resolve = (name: string, sides: string[]) => {
    const key = JSON.stringify([name, sides]);
    if (resolved.has(key)) return resolved.get(key);
    if (lookup) return lookup(name, sides);
    const hit = findPlayer(store, rz, name, sides);
    resolved.set(key, hit);
    return hit;
  };
  const liveOf = (sides: string[]) => (live?.matches || []).find((x: any) => x.status === "live" && sides.every((s) => (x.teams || []).some((t: any) => sameTeam(t.name, s))));
  const innOf = (team: string, sides: string[]) => {
    const n = (liveOf(sides)?.innings || []).filter((i: any) => i.runs != null && sameTeam(i.team, team)).length;
    return n ? Math.min(n, 2) : null;
  };
  const soFarOf = (name: string, sides: string[]) => (boardOf(liveOf(sides))?.batters as any[] | undefined)?.find((p) => namesMatch(p.name, name))?.runs ?? null;
  const teamRunsOf = (team: string, inn: number, sides: string[], fmt: string) => {
    const own = (liveOf(sides)?.innings || []).filter((i: any) => i.runs != null && sameTeam(i.team, team)).sort((a: any, b: any) => a.n - b.n);
    return (fmt === "Test" ? own[inn - 1] : own[0])?.runs ?? null;
  };
  return liveMerge(lines, inplay, resolve, fixtures || [], innOf, soFarOf, teamRunsOf);
}

/** The day's name links for a resolver: a book's spelling of a batter, with the two sides, to the player it is (or null). Started again each day. */
function namesOf(rz: any): Map<string, any> {
  const day = new Date().toDateString();
  let cache = links.get(rz);
  if (!cache || cache.day !== day) links.set(rz, cache = { day, names: new Map() });
  return cache.names;
}

function findPlayer(store: any, rz: any, name: string, sides: string[]) {
  const teamIdx = (n: string) => (store.teams || []).findIndex((t: any) => teamKey(t.n) === teamKey(n));
  for (const side of sides) {
    const ti = teamIdx(side);
    const hits = rz.players(name, ti >= 0 ? { team: ti } : {}, 2) as { idx: number; score: number }[];
    if (hits.length && hits[0].score >= 8) return { pid: store.P.id[hits[0].idx], name: store.P.nm[hits[0].idx], team: side };
  }
  return null;
}

/**
 * The same merge for a phone: a name the books spell their own way is searched for among ~15,000 players, and the first merge of a match day did forty of those searches in one go
 * (a second of frozen screen). Here a first pass only notes which names are not linked yet, they are searched one by one with `pause()` awaited between slices, and the merge then
 * runs with every name known. With nothing to look up it is the one pass.
 */
export async function mergeLiveLinesSliced(lines: any, inplay: any, live: any, fixtures: any[], store: any, rz: any, pause: () => Promise<void>, sliceMs = 8) {
  const missing = new Map<string, [string, string[]]>();
  const first = mergeLiveLines(lines, inplay, live, fixtures, store, rz, (name, sides) => { missing.set(JSON.stringify([name, sides]), [name, sides]); return null; });
  if (!missing.size) return first;
  const resolved = namesOf(rz);
  let t = Date.now();
  for (const [key, [name, sides]] of missing) {
    resolved.set(key, findPlayer(store, rz, name, sides));
    if (Date.now() - t >= sliceMs) { await pause(); t = Date.now(); }
  }
  await pause();
  return mergeLiveLines(lines, inplay, live, fixtures, store, rz);
}
