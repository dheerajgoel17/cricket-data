/* eslint-disable @typescript-eslint/no-explicit-any */
// Which book lines the Hot props score, and in what order the player files they need are fetched. Pure, so it is tested without the page.

import { keepMsFor } from "@cricket/engine/lines.js";

import { matchChipId, norm } from "@cricket/engine/hot-rows.js";
export { matchChipId, norm };
export const sameMatch = (match: string, [a, b]: [string, string]) => { const [x, y] = String(match).split(/\s+vs\s+/i); const s = new Set([norm(x), norm(y)]); return s.has(norm(a)) && s.has(norm(b)); };

/** How many local days of priced lines Hot props lists (today = 0). */
export const HOT_DAYS = 10;

/** 0 = today … `HOT_DAYS-1` (viewer's local days), else -1. */
export function dayOffset(iso: string, now = Date.now()): number {
  const d = new Date(iso), t = new Date(now);
  d.setHours(0, 0, 0, 0); t.setHours(0, 0, 0, 0);
  const n = Math.round((d.getTime() - t.getTime()) / 864e5);
  return n >= 0 && n < HOT_DAYS ? n : -1;
}

/**
 * Which day's Hot props list a priced line belongs on. Days 0…`HOT_DAYS-1` follow the viewer's calendar; a match that has already started and is still
 * in the keep window (24 h, 6 days for a Test — books restamp a Test each morning) is today's, so day 4 of a Test is not dropped because its first start was Tuesday.
 */
export function hotDay(iso: string, fmt?: string, now = Date.now()): number {
  const off = dayOffset(iso, now);
  if (off >= 0) return off;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t <= now && t > now - keepMsFor(fmt) ? 0 : -1;
}

/** Chip labels for the Hot props day filter: Today, Tomorrow, then weekday dates. */
export function hotDayLabels(now = Date.now()): [string, string][] {
  return Array.from({ length: HOT_DAYS }, (_, d) => {
    if (d === 0) return ["0", "Today"];
    if (d === 1) return ["1", "Tomorrow"];
    const t = new Date(now);
    t.setHours(12, 0, 0, 0);
    t.setDate(t.getDate() + d);
    return [String(d), t.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })];
  });
}

/** How many priced lines sit on another Hot props day (so the day switch stays when this day has none). */
export function otherHotCount(lines: any[], day: number, now = Date.now()): number {
  return lines.filter((l) => {
    if (!l.start_utc || !l.books?.length) return false;
    const d = hotDay(l.start_utc, l.fmt, now);
    return d >= 0 && d !== day;
  }).length;
}

export type HotScope =
  | { day: number }                                            // the home: the lines of one local day
  | { teams: [string, string]; archive: boolean };            // a fixture page: the lines of that pair of sides (an archived match whatever its age)

/**
 * The priced lines to score. The home scores one day's lines at a time (today by default, another of the next `HOT_DAYS` when asked): every other day's lines would be scored and then thrown
 * away by the day filter, and each one costs a player file. A fixture page scores only its own two sides.
 */
export function hotLines(lines: any[], scope: HotScope, now = Date.now()): any[] {
  const priced = (l: any) => l.start_utc && l.books?.length;
  if ("teams" in scope) return lines.filter((l) => priced(l) && sameMatch(l.match, scope.teams) && (scope.archive || Date.parse(l.start_utc) > now - keepMsFor(l.fmt)));
  return lines.filter((l) => priced(l) && hotDay(l.start_utc, l.fmt, now) === scope.day);
}

/** What orders a Hot props row: whether its match is in play now, the hit rate over the window shown, the edge. */
export interface HotKey { live: boolean; p: number | null; edge: number | null }

/** Hot props order: rows of a match in play first (the live feed's word for it, as the home rail uses), then the higher hit rate, then the higher edge. */
export const hotOrder = (x: HotKey, y: HotKey): number => Number(y.live) - Number(x.live) || (y.p ?? 0) - (x.p ?? 0) || (y.edge ?? -1) - (x.edge ?? -1);

/**
 * Home Props mix: rank all rows by `hotOrder` first (live → hit rate → edge). When both kinds exist, only then
 * rebalance so each sits in about [⌊n/3⌋, ⌈2n/3⌉] — leave a natural 4+2 alone, fix a 6+0 or 5+1 by swapping the
 * weakest of the heavy kind for the best excluded of the light one. If the light kind cannot fill its floor, trim
 * the heavy kind to the ceiling (short card beats a flood). One kind alone still fills `n`.
 */
export function mixHomeRows<T extends HotKey & { kind: string }>(rows: T[], n: number): T[] {
  if (n <= 0 || !rows.length) return [];
  const byKind = (k: string) => rows.filter((r) => r.kind === k).sort(hotOrder);
  const players = byKind("player"), fancy = byKind("fancy");
  if (!players.length) return fancy.slice(0, n);
  if (!fancy.length) return players.slice(0, n);

  const lo = Math.floor(n / 3), hi = Math.ceil((2 * n) / 3);
  const picked = [...rows].sort(hotOrder).slice(0, Math.min(n, rows.length));
  const has = new Set(picked);
  const count = (k: string) => picked.filter((r) => r.kind === k).length;
  const bestOut = (pool: T[]) => pool.find((r) => !has.has(r));
  const worstIn = (k: string) => [...picked].filter((r) => r.kind === k).sort(hotOrder).at(-1);
  const swap = (drop: T, add: T) => {
    const i = picked.indexOf(drop);
    if (i < 0) return;
    picked[i] = add;
    has.delete(drop);
    has.add(add);
  };
  const trim = (k: string) => {
    const drop = worstIn(k);
    if (!drop) return false;
    const i = picked.indexOf(drop);
    picked.splice(i, 1);
    has.delete(drop);
    return true;
  };

  for (const [need, other, pool] of [["player", "fancy", players], ["fancy", "player", fancy]] as const) {
    const want = Math.min(lo, pool.length);
    while (count(need) < want) {
      const add = bestOut(pool), drop = worstIn(other);
      if (!add || !drop) break;
      swap(drop, add);
    }
  }
  for (const [heavy, light, pool] of [["player", "fancy", fancy], ["fancy", "player", players]] as const) {
    while (count(heavy) > hi) {
      const add = bestOut(pool), drop = worstIn(heavy);
      if (add && drop) swap(drop, add);
      else if (!trim(heavy)) break;
      else if (count(heavy) <= Math.max(count(light), 1) && count(light) < lo) break;
    }
  }
  return picked.sort(hotOrder);
}

/**
 * Order shard groups so lines from matches that have already started are scored before later kickoffs.
 * Within a file, started lines come first too, so the open match's rows land before the rest of that file.
 */
export function prioritizeHotGroups<T extends { lines: { start_utc?: string }[] }>(groups: T[], now = Date.now()): T[] {
  const started = (l: { start_utc?: string }) => {
    const t = Date.parse(String(l.start_utc || ""));
    return Number.isFinite(t) && t <= now ? 1 : 0;
  };
  return groups
    .map((g) => ({
      ...g,
      lines: [...g.lines].sort((a, b) => started(b) - started(a) || Date.parse(String(a.start_utc || "")) - Date.parse(String(b.start_utc || ""))),
    }))
    .sort((a, b) => {
      const aN = a.lines.reduce((n, l) => n + started(l), 0);
      const bN = b.lines.reduce((n, l) => n + started(l), 0);
      return bN - aN || b.lines.length - a.lines.length;
    });
}

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
