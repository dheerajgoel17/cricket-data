/* eslint-disable @typescript-eslint/no-explicit-any */
// Which book lines the Hot props score, and in what order the player files they need are fetched. Pure, so it is tested without the page.

export const norm = (n: string) => String(n || "").toLowerCase().replace(/\(w\)|women'?s?|\sw$/g, "").replace(/[^a-z0-9]/g, "");
export const sameMatch = (match: string, [a, b]: [string, string]) => { const [x, y] = String(match).split(/\s+vs\s+/i); const s = new Set([norm(x), norm(y)]); return s.has(norm(a)) && s.has(norm(b)); };

/** 0 = today, 1 = tomorrow (viewer's local days), else -1. */
export function dayOffset(iso: string, now = Date.now()): number {
  const d = new Date(iso), t = new Date(now);
  d.setHours(0, 0, 0, 0); t.setHours(0, 0, 0, 0);
  const n = Math.round((d.getTime() - t.getTime()) / 864e5);
  return n === 0 || n === 1 ? n : -1;
}

const AGE_MS = 40 * 3600e3; // a fixture page's match stays for 40 h after its start (the page itself keeps it as long as it is on)

export type HotScope =
  | { day: number }                                            // the home: the lines of one local day
  | { teams: [string, string]; archive: boolean };            // a fixture page: the lines of that pair of sides (an archived match whatever its age)

/**
 * The priced lines to score. The home scores one day's lines at a time (today by default, tomorrow when asked): every other day's lines would be scored and then thrown
 * away by the day filter, and each one costs a player file. A fixture page scores only its own two sides.
 */
export function hotLines(lines: any[], scope: HotScope, now = Date.now()): any[] {
  const priced = (l: any) => l.start_utc && l.books?.length;
  if ("teams" in scope) return lines.filter((l) => priced(l) && sameMatch(l.match, scope.teams) && (scope.archive || Date.parse(l.start_utc) > now - AGE_MS));
  return lines.filter((l) => priced(l) && dayOffset(l.start_utc, now) === scope.day);
}

/** What orders a Hot props row: whether its match is in play now, the hit rate over the window shown, the edge. */
export interface HotKey { live: boolean; p: number | null; edge: number | null }

/** Hot props order: rows of a match in play first (the live feed's word for it, as the home rail uses), then the higher hit rate, then the higher edge. */
export const hotOrder = (x: HotKey, y: HotKey): number => Number(y.live) - Number(x.live) || (y.p ?? 0) - (x.p ?? 0) || (y.edge ?? -1) - (x.edge ?? -1);

/** The lines grouped by the player file (shard) their player is in, the file with the most lines first (the most rows are ready when it lands). Lines of players the data does not know are left out. */
export function byShard(lines: any[], indexOf: (pid: string) => number, shardOf: (idx: number) => number): { shard: number; lines: any[] }[] {
  const groups = new Map<number, any[]>();
  for (const l of lines) {
    const i = indexOf(l.pid);
    if (i < 0) continue;
    const s = shardOf(i);
    const g = groups.get(s);
    if (g) g.push(l); else groups.set(s, [l]);
  }
  return [...groups].map(([shard, ls]) => ({ shard, lines: ls })).sort((a, b) => b.lines.length - a.lines.length || a.shard - b.shard);
}

/** `fn` over `items`, at most `n` running at once, in order. Resolves when all are done. */
export async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (next < items.length) await fn(items[next++]); }));
}
