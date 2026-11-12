/* eslint-disable @typescript-eslint/no-explicit-any */
// A match's page when the live book file has let it go (a finished match): the permanent archive file for its fixture id, as the site's `useFixtureBooks` does
// (site/src/hooks/useEngine.ts, a React hook). Props are never deleted, so a link to an old match keeps working.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { archiveFixture, fixtureBooks, isFixtureId, teamKey, withArchive } from "@cricket/engine/lines.js";
import { ARCHIVE_URL } from "@/lib/config";
import { storeQuery } from "@/lib/data";
import { fixturesQuery } from "@/lib/queries";
import { useLinesLive } from "@/lib/use-lines-live";

/** One match's archive file by fixture id, or null (no file, no archive address set, or a slow network: it gives up after 6 s). */
export async function loadArchive(id: string): Promise<any | null> {
  if (!ARCHIVE_URL || !isFixtureId(id)) return null;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(`${ARCHIVE_URL}/${id.slice(0, 7)}/${id}.json`, { signal: ctl.signal });
    const d = r.ok ? await r.json() : null;
    return d?.id === id ? d : null;
  } catch { return null; } finally { clearTimeout(t); }
}

/**
 * The fixture for an id and the book doc to read it with: the schedule's row and the live book file while the match is listed and priced; else the archive file's (`archived` says so),
 * with the archive's lines added to the doc.
 */
export function useFixtureBooks(id: string) {
  const stats = useQuery(storeQuery), fixtures = useQuery(fixturesQuery), lines = useLinesLive();
  const store: any = stats.data?.store;
  const listed = (fixtures.data || []).find((f: any) => f.id === id);
  const books = listed ? fixtureBooks(lines.data, listed) : { props: false, fancy: false };
  const settled = !fixtures.isLoading && !lines.isLoading;
  const need = settled && (!listed || (!books.props && !books.fancy));
  const archive = useQuery({ queryKey: ["archive", id], enabled: need, queryFn: () => loadArchive(id), staleTime: Infinity });
  const entry = need ? archive.data ?? null : null;
  return useMemo(() => {
    const teamIx = (name: string, g: string) => {
      const ts: any[] = store?.teams || [], gi = g === "female" ? 1 : 0, mine = (t: any) => (t.g ?? 0) === gi;
      const i = ts.findIndex((t) => mine(t) && t.n === name);
      return i >= 0 ? i : ts.findIndex((t) => mine(t) && teamKey(t.n) === teamKey(name));
    };
    return { fx: listed ?? (entry ? archiveFixture(entry, teamIx) : null), doc: entry ? withArchive(lines.data, entry) : lines.data, archived: !!entry, isLoading: fixtures.isLoading || (need && archive.isLoading) };
  }, [listed, entry, lines.data, fixtures.isLoading, need, archive.isLoading, store]);
}
