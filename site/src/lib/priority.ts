/* eslint-disable @typescript-eslint/no-explicit-any */
import { teamKey } from "@/engine/live.js";

// Which fixtures lead the home rail: matches in play first, then the ones still to come, then finished ones; inside each group the viewer's own team first, then
// by how big the match is (the two sides' standing), with a lift for the viewer's own part of the world and for the big tournaments and leagues. No account: the
// region is read from the time zone, then the language tag. The tunables (group order, standings, bonuses, tournaments) are published as config/home_rail.json
// and read at view time, so changing them needs no deploy; the built-in values below are the fallback (and a test keeps the file equal to them).

const ZONE: Record<string, string> = {
  "Asia/Kolkata": "india", "Asia/Calcutta": "india", "Asia/Karachi": "pakistan", "Asia/Dhaka": "bangladesh", "Asia/Colombo": "srilanka", "Asia/Kabul": "afghanistan",
  "Asia/Kathmandu": "nepal", "Asia/Katmandu": "nepal", "Pacific/Auckland": "newzealand", "Africa/Johannesburg": "southafrica", "Africa/Harare": "zimbabwe",
  "Africa/Windhoek": "namibia", "Europe/London": "england", "Europe/Dublin": "ireland", "Europe/Amsterdam": "netherlands", "Asia/Muscat": "oman",
  "Asia/Dubai": "uae", "Asia/Qatar": "qatar", "America/Jamaica": "westindies", "America/Port_of_Spain": "westindies", "America/Barbados": "westindies",
};
const LANG: Record<string, string> = {
  IN: "india", PK: "pakistan", BD: "bangladesh", LK: "srilanka", AF: "afghanistan", NP: "nepal", NZ: "newzealand", ZA: "southafrica", ZW: "zimbabwe", NA: "namibia",
  GB: "england", IE: "ireland", NL: "netherlands", OM: "oman", AE: "uae", QA: "qatar", AU: "australia", JM: "westindies", TT: "westindies", BB: "westindies", GY: "westindies",
};

/** The viewer's team key ("india"), or null when the zone and language say nothing about cricket. */
export function homeTeam(zone: string = Intl.DateTimeFormat().resolvedOptions().timeZone, lang: string = typeof navigator === "undefined" ? "" : navigator.language): string | null {
  if (zone?.startsWith("Australia/")) return "australia";
  if (ZONE[zone]) return ZONE[zone];
  const region = /-([A-Za-z]{2})\b/.exec(lang || "")?.[1]?.toUpperCase();
  return (region && LANG[region]) || null;
}

/** How big a side is: the Test-playing nations first, then the strongest associates. Unknown sides (clubs, domestic teams) get a small default. */
const STANDING: Record<string, number> = {
  india: 100, australia: 95, england: 95, pakistan: 85, southafrica: 85, newzealand: 80, westindies: 70, srilanka: 70, bangladesh: 65, afghanistan: 60,
  zimbabwe: 40, ireland: 40, netherlands: 30, namibia: 25, scotland: 25, uae: 20, nepal: 20, oman: 20, usa: 20, canada: 15,
};
const REGION: Record<string, string> = {
  india: "asia", pakistan: "asia", bangladesh: "asia", srilanka: "asia", afghanistan: "asia", nepal: "asia", australia: "oceania", newzealand: "oceania",
  southafrica: "africa", zimbabwe: "africa", namibia: "africa", england: "europe", ireland: "europe", scotland: "europe", netherlands: "europe",
  westindies: "caribbean", uae: "gulf", oman: "gulf", qatar: "gulf",
};
const BIG_EVENT = ["world cup", "champions trophy", "asia cup", "ashes", "border gavaskar", "ipl", "indian premier", "big bash", "bbl", "psl", "pakistan super", "sa20", "cpl", "caribbean premier", "the hundred", "ilt20", "lpl", "bpl", "t20 blast"]; // whole words in the series name

export type RailState = "live" | "final" | "upcoming";
export interface RailConfig { tiers: RailState[]; standing: Record<string, number>; region: Record<string, string>; bigEvent: string[]; bonus: { home: number; homeWomen: number; region: number; event: number } }

export const DEFAULT_RAIL: RailConfig = { tiers: ["live", "upcoming", "final"], standing: STANDING, region: REGION, bigEvent: BIG_EVENT, bonus: { home: 100, homeWomen: 50, region: 30, event: 30 } };

const words = (x: unknown) => ` ${String(x || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;

/** The published config laid over the built-in one: anything missing or malformed keeps its built-in value, and nothing but these keys is read. */
export function sanitizeRail(raw: any): RailConfig {
  const d = DEFAULT_RAIL;
  if (!raw || typeof raw !== "object") return d;
  const num = (x: unknown, lo: number, hi: number) => (typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi ? x : null);
  const named = (o: unknown) => Object.entries(o && typeof o === "object" ? (o as object) : {}).slice(0, 300).filter(([k]) => /^[a-z0-9]{1,40}$/.test(k));
  const tiers = Array.isArray(raw.tiers) ? ([...new Set(raw.tiers)].filter((t) => (d.tiers as unknown[]).includes(t)) as RailState[]) : [];
  const standing = { ...d.standing }, region = { ...d.region }, bonus = { ...d.bonus };
  for (const [k, v] of named(raw.standing)) { const n = num(v, 0, 1000); if (n != null) standing[k] = n; }
  for (const [k, v] of named(raw.region)) if (typeof v === "string" && /^[a-z]{1,20}$/.test(v)) region[k] = v;
  for (const k of Object.keys(bonus) as (keyof typeof bonus)[]) { const n = num(raw.bonus?.[k], -1000, 1000); if (n != null) bonus[k] = n; }
  const events = Array.isArray(raw.bigEvent) ? raw.bigEvent.filter((x: unknown): x is string => typeof x === "string" && x.trim().length > 0 && x.length <= 60).slice(0, 100) : null;
  return { tiers: [...tiers, ...d.tiers.filter((t) => !tiers.includes(t))], standing, region, bigEvent: events ?? d.bigEvent, bonus };
}

function standing(name: string, table: Record<string, number>): number {
  const key = teamKey(name);
  if (table[key] != null) return table[key];
  if (key.endsWith("u19") && table[key.slice(0, -3)] != null) return table[key.slice(0, -3)] * 0.25; // youth side
  if (key.length > 4 && key.endsWith("a") && table[key.slice(0, -1)] != null) return table[key.slice(0, -1)] * 0.4; // "A" side
  return 10;
}

/** How big the match is, higher first: the two sides' standing, with a lift for the viewer's own team or part of the world and for a big tournament. */
export function fixtureScore(f: any, home: string | null, cfg: RailConfig = DEFAULT_RAIL): number {
  const a = teamKey(f.a), b = teamKey(f.b);
  let s = (standing(f.a, cfg.standing) + standing(f.b, cfg.standing)) * (f.gender === "female" ? 0.8 : 1);
  if (home && (a === home || b === home)) s += f.gender === "female" ? cfg.bonus.homeWomen : cfg.bonus.home; // the women's side of the viewer's team counts, for less
  else if (home && cfg.region[home] && (cfg.region[a] === cfg.region[home] || cfg.region[b] === cfg.region[home])) s += cfg.bonus.region;
  const series = words(f.series);
  if (cfg.bigEvent.some((e) => series.includes(words(e)))) s += cfg.bonus.event;
  return s;
}

/** The fixtures in order: by group first (`cfg.tiers`: matches in play, then to come, then finished; `stateOf` is the live feed's word for a match), then best first; equal scores keep the start order. */
export function rankFixtures(fx: any[], home: string | null, stateOf: (f: any) => RailState = () => "upcoming", cfg: RailConfig = DEFAULT_RAIL): any[] {
  return fx.map((f, i) => ({ f, i, t: cfg.tiers.indexOf(stateOf(f)), s: fixtureScore(f, home, cfg) })).sort((x, y) => x.t - y.t || y.s - x.s || x.i - y.i).map((x) => x.f);
}

/** A fixture's identity on screen (the same two sides can meet again in a series, so the start is part of it). */
export const fixtureKey = (f: any): string => `${f.id ?? ""}|${f.a}|${f.b}|${f.start ?? ""}`;

/**
 * `next` (the fresh ranking, cut to what the rail shows) with the cards already on screen left where they were: the cards of `shown` (their keys, in screen order) that are still
 * in `next` keep their places relative to each other, and a card that was not on screen takes the slot the ranking gives it. A late change of rank (a match that has gone live,
 * new rail settings) then changes what a card says and not where it sits.
 */
export function settleOrder<T>(shown: string[], next: T[], keyOf: (x: T) => string): T[] {
  const at = new Map(shown.map((k, i) => [k, i] as const));
  const kept = next.filter((x) => at.has(keyOf(x))).sort((p, q) => at.get(keyOf(p))! - at.get(keyOf(q))!);
  let j = 0;
  return next.map((x) => (at.has(keyOf(x)) ? kept[j++] : x));
}
