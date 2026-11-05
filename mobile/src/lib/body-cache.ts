// The data files kept on the device with their ETag. The site sends them `no-store` (so no HTTP cache holds them) but answers a conditional request with 304, which costs a round trip and no body:
// the app asks "has this changed?" and, when it has not, reads the text it already decoded instead of downloading, unwrapping and parsing the file again. A file is rebuilt every few hours at
// most, so most launches after the first read everything from here.
// The stats files (index, matches, the player files) go one step further: each kept copy is tagged with the data build (`meta.json`'s `built_at`) it was checked against, so while the build is
// the same one no request is made for them at all (`lib/net.ts`).
import { raw } from "@/lib/storage";

const PREFIX = "body1:";
const TAG = "tag1:";
const TIME = "time1:";
/** A body larger than this is not kept (`matches.json` alone is about 9 MB). */
const MAX_CHARS = 24_000_000;

export interface Kept { etag: string; text: string }

export function cacheGet(path: string): Kept | null {
  const v = raw.get(PREFIX + path);
  if (!v) return null;
  const i = v.indexOf("\n");
  return i > 0 ? { etag: v.slice(0, i), text: v.slice(i + 1) } : null;
}

/** `text` is the decoded body (what `JSON.parse` takes), so a hit needs neither the key nor the unwrap. `tag` is the data build it was read under. */
export function cachePut(path: string, etag: string, text: string, tag?: string): void {
  if (text.length > MAX_CHARS) return;
  try { raw.set(PREFIX + path, `${etag}\n${text}`); raw.set(TIME + path, String(Date.now())); if (tag) raw.set(TAG + path, tag); else raw.remove(TAG + path); } catch { /* a full disk only costs the next launch a download */ }
}

/** The data build the kept copy was last checked against (small: separate from the body so a 304 does not rewrite megabytes). */
export const cacheTag = (path: string): string | undefined => raw.get(TAG + path);
/** The server just said the kept copy is still current: note when, and under which data build. */
export function cacheTouch(path: string, tag?: string): void { try { raw.set(TIME + path, String(Date.now())); if (tag) raw.set(TAG + path, tag); } catch { /* as above */ } }

/** How long ago the kept copy was last known to be current, in ms (Infinity when there is none). */
export function cacheAge(path: string, now = Date.now()): number { const t = Number(raw.get(TIME + path)); return t > 0 ? now - t : Infinity; }

export function cacheDrop(path: string): void { raw.remove(PREFIX + path); raw.remove(TAG + path); raw.remove(TIME + path); }
