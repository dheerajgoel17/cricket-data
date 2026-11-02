import { useQuery } from "@tanstack/react-query";
import { bookFixtures, fixtureInBooks, liveForFixture } from "@cricket/engine/live.js";
import { freshState, linesQuery, liveQuery, stateQuery } from "@/lib/queries";

/** The /api/live body, polled every ~15 s (see `liveQuery`). */
export function useLiveDoc() {
  return useQuery(liveQuery);
}

/**
 * The match-state table's body while it is fresh (written in the last 20 minutes), else null: it says when a match turned final, which is when a finished Test leaves the lists
 * (`keepUntil`). Without it (not configured, down, stale) the lists fall back to the match's clock window.
 */
export function useStateDoc() {
  return freshState(useQuery(stateQuery).data);
}

export function useLiveMatch(fixture: { a?: string; b?: string; start?: string; fmt?: string } | null | undefined) {
  const q = useLiveDoc();
  const lines = useQuery(linesQuery);
  const books = bookFixtures(lines.data);
  const hit = fixture ? liveForFixture(q.data, fixture) : null;
  return { ...q, match: hit && (!books.length || fixtureInBooks(books, fixture)) ? hit : null };
}
