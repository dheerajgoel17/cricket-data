// The data files kept on the device with their ETag. The site sends them `no-store` (so no HTTP cache holds them) but answers a conditional request with 304, which costs a round trip and no body:
// the app asks "has this changed?" and, when it has not, reads the text it already decoded instead of downloading, unwrapping and parsing the file again. A file is rebuilt every few hours at
// most, so most launches after the first read everything from here.
import { raw } from "@/lib/storage";

const PREFIX = "body1:";
/** A body larger than this is not kept (the largest data file is about 2.6 MB). */
const MAX_CHARS = 6_000_000;

export interface Kept { etag: string; text: string }

export function cacheGet(path: string): Kept | null {
  const v = raw.get(PREFIX + path);
  if (!v) return null;
  const i = v.indexOf("\n");
  return i > 0 ? { etag: v.slice(0, i), text: v.slice(i + 1) } : null;
}

/** `text` is the decoded body (what `JSON.parse` takes), so a hit needs neither the key nor the unwrap. */
export function cachePut(path: string, etag: string, text: string): void {
  if (text.length > MAX_CHARS) return;
  try { raw.set(PREFIX + path, `${etag}\n${text}`); } catch { /* a full disk only costs the next launch a download */ }
}

export function cacheDrop(path: string): void { raw.remove(PREFIX + path); }
