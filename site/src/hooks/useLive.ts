import { useQuery } from "@tanstack/react-query";
import { bookFixtures, fixtureInBooks, LIVE_TTL_MS, liveForFixture } from "@/engine/live.js";
import { loadLines, loadLive } from "@/lib/feeds";

/** Polls /api/live every ~15 s. The function caches the same interval; this just refreshes the page. */
export function useLiveDoc() {
  return useQuery({ queryKey: ["live-scores"], queryFn: loadLive, refetchInterval: LIVE_TTL_MS, staleTime: LIVE_TTL_MS, placeholderData: (p) => p });
}

export function useLiveMatch(fixture: { a?: string; b?: string; start?: string } | null | undefined) {
  const q = useLiveDoc();
  const lines = useQuery({ queryKey: ["lines"], queryFn: loadLines, staleTime: 10 * 60_000 });
  const books = bookFixtures(lines.data);
  const hit = fixture ? liveForFixture(q.data, fixture) : null;
  return { ...q, match: hit && (!books.length || fixtureInBooks(books, fixture)) ? hit : null };
}
