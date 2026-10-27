/* eslint-disable @typescript-eslint/no-explicit-any */
import { teamKey } from "@/engine/live.js";

// Which fixtures lead the home rail: matches of the viewer's own team first, then by how big the match is (the two sides' standing), with a lift for the
// viewer's own part of the world, for the big tournaments and leagues, and for matches in play. Finished matches sink. No account: the region is read from
// the time zone, then the language tag.

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
const BIG_EVENT = /world cup|champions trophy|asia cup|ashes|border.?gavaskar|ipl|indian premier|big bash|bbl|psl|pakistan super|sa20|cpl|caribbean premier|the hundred|ilt20|lpl|bpl|t20 blast/i;

function standing(name: string): number {
  const key = teamKey(name);
  if (STANDING[key] != null) return STANDING[key];
  if (key.endsWith("u19") && STANDING[key.slice(0, -3)] != null) return STANDING[key.slice(0, -3)] * 0.25; // youth side
  if (key.length > 4 && key.endsWith("a") && STANDING[key.slice(0, -1)] != null) return STANDING[key.slice(0, -1)] * 0.4; // "A" side
  return 10;
}

/** Higher is shown first. `state` comes from the live feed: "live" lifts a match, "final" sinks it. */
export function fixtureScore(f: any, home: string | null, state: "live" | "final" | "upcoming" = "upcoming"): number {
  const a = teamKey(f.a), b = teamKey(f.b);
  let s = (standing(f.a) + standing(f.b)) * (f.gender === "female" ? 0.8 : 1);
  if (home && (a === home || b === home)) s += f.gender === "female" ? 50 : 100; // the women's side of the viewer's team counts, for less
  else if (home && REGION[home] && (REGION[a] === REGION[home] || REGION[b] === REGION[home])) s += 30;
  if (BIG_EVENT.test(String(f.series || ""))) s += 30;
  if (state === "live") s += 15;
  if (state === "final") s -= 400; // always behind everything still to come
  return s;
}

/** The fixtures best first; equal scores keep the start order. */
export function rankFixtures(fx: any[], home: string | null, stateOf: (f: any) => "live" | "final" | "upcoming" = () => "upcoming"): any[] {
  return fx.map((f, i) => ({ f, i, s: fixtureScore(f, home, stateOf(f)) })).sort((x, y) => y.s - x.s || x.i - y.i).map((x) => x.f);
}
