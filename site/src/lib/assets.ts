import { dataUrl } from "./data-url";
// Free image sources, loaded lazily in the browser: Source A's public image CDN (ids matched at build time, see photos.ts),
// flagcdn.com flags for national sides, Wikimedia Commons photos via Wikidata, then initials / a silhouette.
// Face: never the source's stock helmet avatar (build strips those). Jersey: never the source's plain AD shirt.
export { leagueLogos, playerPhotos, teamLogos } from "@cricket/engine/photos.js";
export { flagCode } from "@cricket/engine/flags.js";
import { flagCode } from "@cricket/engine/flags.js";

export interface Photos { p?: Record<string, string>; t?: Record<string, string>; l?: Record<string, string>; base?: string; s?: Record<string, string[]> }

export const flagUrl = (name: string, w = 80) => {
  const code = flagCode(name);
  return code ? `https://flagcdn.com/w${w}/${code}.png` : null;
};

export async function loadPhotos(base = "/data/"): Promise<Photos> {
  try { return await (await fetch(dataUrl(`${base}photos.json`))).json(); } catch { return {}; }
}
