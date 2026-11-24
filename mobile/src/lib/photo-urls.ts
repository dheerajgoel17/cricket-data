// The picture URLs for a team, league or player, worked out once per photos file and name instead of once per badge on screen (a Props list draws hundreds of crests and faces).
// Keyed on the identity of the photos object, so a refreshed file drops the old answers with it.
import { leagueLogos, playerPhotos, teamJerseys, teamLogos } from "@cricket/engine/photos.js";
import { flagUrl } from "@site/lib/assets";
import { abs } from "@/lib/config";

const memo = new WeakMap<object, Map<string, string[]>>();
const NONE = {};

function cached(photos: unknown, key: string, make: () => string[]): string[] {
  const root = (photos && typeof photos === "object" ? photos : NONE) as object;
  let m = memo.get(root);
  if (!m) memo.set(root, (m = new Map()));
  let v = m.get(key);
  if (!v) m.set(key, (v = make()));
  return v;
}

/** The source's logo for the team, then the national flag. */
export const teamUrls = (photos: unknown, name: string, size: number): string[] =>
  cached(photos, `t|${name}|${size > 40 ? 160 : 80}`, () => ([...teamLogos(photos, name), flagUrl(name, size > 40 ? 160 : 80)].filter(Boolean) as string[]).map(abs));

export const leagueUrls = (photos: unknown, name: string): string[] => cached(photos, `l|${name}`, () => (leagueLogos(photos, name) as string[]).map(abs));

export const faceUrls = (photos: unknown, pid: string): string[] => cached(photos, `f|${pid}`, () => (playerPhotos(photos, pid) as string[]).map(abs));

export const shirtUrls = (photos: unknown, team: string, test: boolean): string[] => cached(photos, `s|${team}|${test ? 1 : 0}`, () => (teamJerseys(photos, team, test) as string[]).map(abs));
