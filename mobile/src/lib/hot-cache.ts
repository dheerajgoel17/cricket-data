// Last scored Hot props rows kept on the device so Home / Props can paint before the next scoring pass finishes.
import { raw } from "@/lib/storage";
import type { Row } from "@/lib/hot";

const PREFIX = "hot-rows-v1:";
/** Drop a snapshot older than this (a new day of lines is a different key anyway). */
const MAX_AGE_MS = 6 * 60 * 60e3;
/** Cap JSON size so a huge day cannot fill MMKV. */
const MAX_CHARS = 800_000;

export type HotSnap = { t: number; generated: string; rows: Row[] };

/** One snapshot per local day list and the books file's generation stamp. */
export function hotSnapKey(dayOrTeams: string, generated: string, dayStamp: string): string {
  return `${PREFIX}${dayStamp}|${dayOrTeams}|${generated || "-"}`;
}

export function readHotSnap(key: string, now = Date.now()): HotSnap | null {
  const v = raw.get(key);
  if (!v) return null;
  try {
    const s = JSON.parse(v) as HotSnap;
    if (!s || typeof s.t !== "number" || !Array.isArray(s.rows)) return null;
    if (now - s.t > MAX_AGE_MS || s.t > now + 60e3) return null;
    return s;
  } catch {
    return null;
  }
}

export function writeHotSnap(key: string, generated: string, rows: Row[], now = Date.now()): void {
  if (!rows.length) return;
  const text = JSON.stringify({ t: now, generated: generated || "", rows } satisfies HotSnap);
  if (text.length > MAX_CHARS) return;
  try { raw.set(key, text); } catch { /* full disk: next launch scores from scratch */ }
}
