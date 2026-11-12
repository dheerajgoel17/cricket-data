/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppState } from "react-native";
import { focusManager, queryOptions } from "@tanstack/react-query";
import { LIVE_TTL_MS } from "@cricket/engine/live.js";
import { getJson, peekJson } from "@/lib/net";
import { readLive, saveLive } from "@/lib/storage";

// Feeds the Home rail reads. Same cadence as the site: the fixture and book files are fresh for 10 minutes, /api/live is polled every ~15 s.
// Both start from the copy kept by the last launch when it is under 3 hours old (counted as stale, so the real one is asked for at once): the rail and the kept Hot rows paint while the request is out.
export const KEPT_MS = 3 * 60 * 60e3;
export const fixturesQuery = queryOptions({
  queryKey: ["fixtures"], queryFn: (): Promise<any[]> => getJson("/data/fixtures.json"), staleTime: 10 * 60_000,
  initialData: () => peekJson("/data/fixtures.json", KEPT_MS), initialDataUpdatedAt: 0,
});
export const linesQuery = queryOptions({
  queryKey: ["lines"], queryFn: (): Promise<any> => getJson("/data/lines.json"), staleTime: 10 * 60_000,
  initialData: () => peekJson("/data/lines.json", KEPT_MS), initialDataUpdatedAt: 0,
});

/** Team logos and player photos by name (crests on the cards); the flag is the fallback, so a failed load only costs the logo. */
/** Role, batting hand and bowling style per player (`lib/profile.ts`); the file is missing until the site has built it once, which only costs the profile line. */
export const profilesQuery = queryOptions({ queryKey: ["profiles"], queryFn: async (): Promise<any> => { try { return await getJson("/data/profiles.json"); } catch { return null; } }, staleTime: 60 * 60_000 });

export const photosQuery = queryOptions({ queryKey: ["photos"], queryFn: async (): Promise<any> => { try { return await getJson("/data/photos.json"); } catch { return {}; } }, staleTime: 60 * 60_000 });

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

/** In-play lines (a batter's innings runs, a side's innings total, the other live markets) from /api/inplay: null when the route is down or has nothing. Polled every ~15 s, but only while a match is on (see `useLinesLive`). */
export const inplayQuery = queryOptions({
  queryKey: ["inplay-lines"],
  queryFn: async (): Promise<any | null> => { try { return await getJson("/api/inplay"); } catch { return null; } },
  refetchInterval: LIVE_TTL_MS, staleTime: LIVE_TTL_MS, retry: false,
});

/** The Home rail's published settings (`config/home_rail.json`, read at view time like the site's `loadRail`, so a change needs no release); null when it cannot be read, and the built-in ones apply. */
const RAIL_URL = "https://raw.githubusercontent.com/dheerajgoel17/cricket-data/main/config/home_rail.json";
export const railConfigQuery = queryOptions({
  queryKey: ["home-rail-config"],
  queryFn: async (): Promise<any | null> => { try { const r = await fetch(RAIL_URL, { headers: { "cache-control": "no-cache" } }); return r.ok ? await r.json() : null; } catch { return null; } },
  staleTime: 10 * 60_000, retry: false,
});

/** react-query on a phone: polling follows whether the app is in front, not a browser tab's focus. */
export function watchAppState(): () => void {
  const sub = AppState.addEventListener("change", (s) => focusManager.setFocused(s === "active"));
  return () => sub.remove();
}
