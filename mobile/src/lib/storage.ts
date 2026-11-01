// On-device storage: MMKV under the shared key-value helpers (`@cricket/storage`), so saved items and the last live body behave as on the web.
import { createStorage } from "@cricket/storage";
import { createMMKV } from "react-native-mmkv";

const mmkv = createMMKV({ id: "fancy-cash" });

export const storage = createStorage({
  get: (k: string) => mmkv.getString(k) ?? null,
  set: (k: string, v: string) => void mmkv.set(k, v),
  remove: (k: string) => void mmkv.remove(k),
});

const LIVE_KEY = "live-body-v1";
/** Old enough that a match could have started or finished since: past this the kept body is not used (same window as the web app). */
export const LIVE_CACHE_MS = 30 * 60e3;

export function saveLive(body: any, now = Date.now()): void { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (Array.isArray(body?.matches)) storage.set(LIVE_KEY, { t: now, body });
}

export function readLive(now = Date.now()): { t: number; body: any } | null { // eslint-disable-line @typescript-eslint/no-explicit-any
  const c = storage.get(LIVE_KEY, null) as { t?: number; body?: any } | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  return c && typeof c.t === "number" && Array.isArray(c.body?.matches) && c.t <= now + 60e3 && now - c.t < LIVE_CACHE_MS ? (c as { t: number; body: any }) : null; // eslint-disable-line @typescript-eslint/no-explicit-any
}
