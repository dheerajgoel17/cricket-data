import { useQuery } from "@tanstack/react-query";
import { bookFixtures, fixtureInBooks, liveForFixture } from "@cricket/engine/live.js";
import { linesQuery, liveQuery } from "@/lib/queries";

/** The /api/live body, polled every ~15 s (see `liveQuery`). */
export function useLiveDoc() {
  return useQuery(liveQuery);
}

export function useLiveMatch(fixture: { a?: string; b?: string; start?: string; fmt?: string } | null | undefined) {
  const q = useLiveDoc();
  const lines = useQuery(linesQuery);
  const books = bookFixtures(lines.data);
  const hit = fixture ? liveForFixture(q.data, fixture) : null;
  return { ...q, match: hit && (!books.length || fixtureInBooks(books, fixture)) ? hit : null };
}
