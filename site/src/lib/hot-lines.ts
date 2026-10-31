/* eslint-disable @typescript-eslint/no-explicit-any */
// Which book lines the Hot props score, and in what order the player files they need are fetched. Pure, so it is tested without the page.

import { keepMsFor } from "@cricket/engine/lines.js";

export const norm = (n: string) => String(n || "").toLowerCase().replace(/\(w\)|women'?s?|\sw$/g, "").replace(/[^a-z0-9]/g, "");
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

/** One chip per match: a Test's day-by-day book starts share a chip; a limited-overs line keeps its own kick-off. */
export function matchChipId(match: string, start: string, fmt?: string): string {
  const [a, b] = String(match).split(/\s+vs\s+/i);
  const pair = [norm(a), norm(b)].sort().join("|");
  return fmt === "Test" || fmt === "FC" ? `${pair}|${fmt}` : `${pair}|${start}`;
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
