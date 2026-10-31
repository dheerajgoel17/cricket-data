/* eslint-disable @typescript-eslint/no-explicit-any */
// The Props screener's filter state: what the URL says, what is on by default, which filters are active and how rows are narrowed and ordered. Pure (no React,
// no DOM), so it is tested on its own and a native app can reuse it. Only filters the rows can answer exist: nothing here approximates a missing field.
import { hotOrder, norm } from "@/lib/hot-lines";

export type Win = "season" | "h2h" | "ven" | "l5" | "l10";
export type Sort = "hit" | "edge" | "price";
export type Inns = "all" | "first" | "second";

export interface Screener {
  stat: string;      // "all" or a stat key (the chip rail)
  win: Win;          // hit-rate window that ranks the rows
  day: string;       // "0" today ... "9"
  match: string;     // "all" or a match chip id
  team: string;      // "all" or a team name
  fmt: string;       // "all" or T20 / ODI / Test ... (formats are never mixed into one sample, but one list may show several)
  comp: string;      // "all" or a competition name
  min: number;       // minimum hit rate in the chosen window, percent (0 = off)
  value: boolean;    // only rows with a positive edge
  inns: Inns;        // only games where his side batted first / chased: every row is scored again from those games (provisional matches have no innings detail and drop out)
  sort: Sort;
  bars: boolean;     // show the form chart on each row
}

export const DEFAULTS: Screener = { stat: "all", win: "l10", day: "0", match: "all", team: "all", fmt: "all", comp: "all", min: 0, value: false, inns: "all", sort: "hit", bars: true };
export const INNS_LABEL: Record<Inns, string> = { all: "Any innings", first: "Batted first", second: "Chasing" };
export const WIN_LABEL: Record<Win, string> = { season: "Season", h2h: "H2H", ven: "Venue", l5: "L5", l10: "L10" };
export const SORT_LABEL: Record<Sort, string> = { hit: "Hit rate", edge: "Edge", price: "Longest price" };
const WINS = Object.keys(WIN_LABEL) as Win[], SORTS = Object.keys(SORT_LABEL) as Sort[], INNS = Object.keys(INNS_LABEL) as Inns[];
export const MIN_STEPS = [0, 50, 60, 70, 80, 90];

/** Read the screener from a query string. Unknown or malformed values fall back to the default (a stale link never breaks the page). */
export function parseScreener(sp: URLSearchParams): Screener {
  const g = (k: string, d: string) => sp.get(k) || d;
  const win = g("win", DEFAULTS.win) as Win, sort = g("sort", DEFAULTS.sort) as Sort, inns = g("inns", DEFAULTS.inns) as Inns;
  const day = Number(g("day", DEFAULTS.day)), min = Number(g("min", "0"));
  return {
    stat: g("stat", DEFAULTS.stat), win: WINS.includes(win) ? win : DEFAULTS.win, day: Number.isInteger(day) && day >= 0 && day < 30 ? String(day) : DEFAULTS.day,
    match: g("match", DEFAULTS.match), team: g("team", DEFAULTS.team), fmt: g("fmt", DEFAULTS.fmt), comp: g("comp", DEFAULTS.comp),
    min: MIN_STEPS.includes(min) ? min : 0, value: sp.get("value") === "1", inns: INNS.includes(inns) ? inns : DEFAULTS.inns, sort: SORTS.includes(sort) ? sort : DEFAULTS.sort, bars: sp.get("bars") !== "0",
  };
}

/** Only what differs from the default goes in the URL, so the plain screener keeps its plain `/props` address. */
export function screenerParams(s: Screener): URLSearchParams {
  const sp = new URLSearchParams();
  for (const k of ["stat", "win", "day", "match", "team", "fmt", "comp", "inns", "sort"] as const) if (s[k] !== DEFAULTS[k]) sp.set(k, s[k]);
  if (s.min) sp.set("min", String(s.min));
  if (s.value) sp.set("value", "1");
  if (!s.bars) sp.set("bars", "0");
  return sp;
}

export interface ActiveFilter { key: keyof Screener; label: string; value: string }

/** The filters that are on, for the chip row (the stat chip rail is its own control and is not listed). `names` gives readable labels for ids. */
export function activeFilters(s: Screener, names: { day?: (d: string) => string; match?: (id: string) => string } = {}): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  if (s.day !== DEFAULTS.day) out.push({ key: "day", label: "Day", value: names.day?.(s.day) ?? s.day });
  if (s.match !== "all") out.push({ key: "match", label: "Match", value: names.match?.(s.match) ?? s.match });
  if (s.team !== "all") out.push({ key: "team", label: "Team", value: s.team });
  if (s.fmt !== "all") out.push({ key: "fmt", label: "Format", value: s.fmt });
  if (s.comp !== "all") out.push({ key: "comp", label: "Competition", value: s.comp });
  if (s.inns !== "all") out.push({ key: "inns", label: "Batting", value: INNS_LABEL[s.inns] });
  if (s.win !== DEFAULTS.win) out.push({ key: "win", label: "Window", value: WIN_LABEL[s.win] });
  if (s.min) out.push({ key: "min", label: "Hit rate", value: `${s.min}%+` });
  if (s.value) out.push({ key: "value", label: "Edge", value: "positive" });
  if (s.sort !== DEFAULTS.sort) out.push({ key: "sort", label: "Sort", value: SORT_LABEL[s.sort] });
  return out;
}

/** Back to the defaults for one filter, or all of them (the stat rail is kept unless `all` is true). */
export function clearFilter(s: Screener, key: keyof Screener | "all"): Screener {
  if (key === "all") return { ...DEFAULTS };
  return { ...s, [key]: DEFAULTS[key] } as Screener;
}

/** The fields of a row the filters read. `p`: its hit rate in the chosen window; `played` the games behind it. */
export interface FilterRow { fmt: string; team: string; comp?: string; stat: string; edge: number | null; over: number; live?: boolean; [k: string]: any }

/** Narrow by the filters that are about the row itself (day, match and stat are handled where the rows are fetched and ranked). */
export function narrow<T extends FilterRow>(rows: T[], s: Screener): T[] {
  return rows.filter((r) => {
    if (s.fmt !== "all" && r.fmt !== s.fmt) return false;
    if (s.team !== "all" && norm(r.team) !== norm(s.team)) return false;
    if (s.comp !== "all" && (r.comp || "") !== s.comp) return false;
    if (s.value && !((r.edge ?? 0) > 0)) return false;
    if (s.min) { const p = (r as any)[s.win]?.p; if (p == null || p * 100 < s.min) return false; }
    return true;
  });
}

/** Order rows: a match in play first (as the home rail does), then by the chosen sort, ties by the others. */
export function order<T extends FilterRow>(rows: T[], s: Screener): T[] {
  const key = (r: T) => ({ live: !!r.live, p: (r as any)[s.win]?.p ?? null, edge: r.edge });
  const by: Record<Sort, (x: T, y: T) => number> = {
    hit: (x, y) => hotOrder(key(x), key(y)),
    edge: (x, y) => Number(!!y.live) - Number(!!x.live) || (y.edge ?? -Infinity) - (x.edge ?? -Infinity) || ((y as any)[s.win]?.p ?? 0) - ((x as any)[s.win]?.p ?? 0),
    price: (x, y) => Number(!!y.live) - Number(!!x.live) || (y.over || 0) - (x.over || 0) || hotOrder(key(x), key(y)),
  };
  return [...rows].sort(by[s.sort]);
}

/** The values a filter can take in these rows (so the filter view lists real choices only), most common first. */
export function options<T extends FilterRow>(rows: T[], field: "fmt" | "team" | "comp"): string[] {
  const n = new Map<string, number>();
  for (const r of rows) { const v = (r as any)[field]; if (v) n.set(v, (n.get(v) || 0) + 1); }
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v);
}

/** `?query` of the screener, for a shareable link or a saved combination; "" when nothing differs from the default. */
export const screenerQuery = (s: Screener) => { const q = screenerParams(s).toString(); return q ? `?${q}` : ""; };
