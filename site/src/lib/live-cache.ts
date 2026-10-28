/* eslint-disable @typescript-eslint/no-explicit-any */
// The last /api/live body, kept on the device for a short while. The function can take seconds on a cold start; with the last body the home rail is already in the right order
// (matches in play first) on the first paint, and the fresh body, which is asked for at once, re-sorts it only where a match has changed state.

const KEY = "live-body-v1";
/** Old enough that a match could have started or finished since: past this the body is not used. */
export const LIVE_CACHE_MS = 30 * 60e3;

export function saveLive(body: any, now = Date.now()): void {
  try { if (Array.isArray(body?.matches)) localStorage.setItem(KEY, JSON.stringify({ t: now, body })); } catch { /* storage can be full or blocked: the body is only a head start */ }
}

/** The kept body and when it was saved, or null when there is none, it is too old, or it cannot be read. */
export function readLive(now = Date.now()): { t: number; body: any } | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    return c && typeof c.t === "number" && Array.isArray(c.body?.matches) && c.t <= now + 60e3 && now - c.t < LIVE_CACHE_MS ? c : null;
  } catch { return null; }
}
