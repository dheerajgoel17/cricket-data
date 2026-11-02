/* eslint-disable @typescript-eslint/no-explicit-any */
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { LIVE_TTL_MS } from "@cricket/engine/live.js";
import { loadLines, loadLive, loadRail, loadState } from "@/lib/feeds";
import { readLive } from "@/lib/live-cache";

// The three feeds the home page reads, defined once so the hooks and the start-up prefetch share a cache entry.
export const linesQuery = queryOptions({ queryKey: ["lines"], queryFn: loadLines, staleTime: 10 * 60_000 });
export const railQuery = queryOptions({ queryKey: ["rail"], queryFn: loadRail, staleTime: 10 * 60_000 });
/** Polls /api/live every ~15 s. The function caches the same interval; this just refreshes the page. Starts from the last body kept on the device (`live-cache.ts`), which counts as stale, so the fresh one is asked for at once. */
export const liveQuery = queryOptions({ queryKey: ["live-scores"], queryFn: loadLive, refetchInterval: LIVE_TTL_MS, staleTime: LIVE_TTL_MS, placeholderData: (p: any) => p,
  initialData: () => readLive()?.body, initialDataUpdatedAt: () => readLive()?.t });

/** The match-state table: one phase per match, refreshed by a job every few minutes. A body older than `STATE_MAX_AGE_MS` is not trusted (see `freshState`). */
export const stateQuery = queryOptions({ queryKey: ["match-state"], queryFn: loadState, refetchInterval: 30_000, staleTime: 30_000, retry: false });
export const STATE_MAX_AGE_MS = 20 * 60_000;
/** The state doc when it exists and was written recently, else null. */
export const freshState = (doc: any, now = Date.now()) => (doc?.updatedAt && now - Date.parse(doc.updatedAt) <= STATE_MAX_AGE_MS ? doc : null);

/** Starts the feeds before the data files and the page code have loaded (they need nothing from either), so they are in by the time the home page mounts instead of starting then. Live scores feed Fancy and player props too (`/fancy`, `/props`, a fixture page). */
export function prefetchFeeds(client: QueryClient, path: string) {
  void client.prefetchQuery(linesQuery);
  const live = path === "/" || path.startsWith("/fancy") || path.startsWith("/props") || path.startsWith("/fixture");
  if (path === "/") void client.prefetchQuery(railQuery);
  if (live) void client.prefetchQuery(liveQuery);
}
