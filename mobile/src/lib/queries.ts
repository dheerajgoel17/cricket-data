/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppState } from "react-native";
import { focusManager, queryOptions } from "@tanstack/react-query";
import { LIVE_TTL_MS } from "@cricket/engine/live.js";
import { getJson } from "@/lib/net";
import { readLive, saveLive } from "@/lib/storage";

// Feeds the Home rail reads. Same cadence as the site: the fixture and book files are fresh for 10 minutes, /api/live is polled every ~15 s.
export const fixturesQuery = queryOptions({ queryKey: ["fixtures"], queryFn: (): Promise<any[]> => getJson("/data/fixtures.json"), staleTime: 10 * 60_000 });
export const linesQuery = queryOptions({ queryKey: ["lines"], queryFn: (): Promise<any> => getJson("/data/lines.json"), staleTime: 10 * 60_000 });

/** Starts from the last body kept on the device (counted as stale, so the fresh one is asked for at once); a failed poll keeps what is on screen. */
export const liveQuery = queryOptions({
  queryKey: ["live-scores"],
  queryFn: async (): Promise<any | null> => { try { const body = await getJson("/api/live"); saveLive(body); return body; } catch { return null; } },
  refetchInterval: LIVE_TTL_MS,
  staleTime: LIVE_TTL_MS,
  placeholderData: (p: any) => p,
  initialData: () => readLive()?.body,
  initialDataUpdatedAt: () => readLive()?.t,
});

/** react-query on a phone: polling follows whether the app is in front, not a browser tab's focus. */
export function watchAppState(): () => void {
  const sub = AppState.addEventListener("change", (s) => focusManager.setFocused(s === "active"));
  return () => sub.remove();
}
