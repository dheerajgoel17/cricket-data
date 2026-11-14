/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LIVE_TTL_MS, lineNotIn, lineStanding, liveForFixture } from "@cricket/engine/live.js";
import { missingLiveLines, patchHotQuotes, rowLineKey } from "@cricket/engine/hot-rows.js";
import { hotOrder, otherHotCount, type HotScope } from "@site/lib/hot-lines";
import { lineHomePhase, type HomePhase } from "@site/lib/home-phase";
import { timed } from "@/lib/perf";
import { storeQuery } from "@/lib/data";
import { FEED_GC_MS, fixturesQuery, hotRowsQuery, liveQuery } from "@/lib/queries";
import { hotSnapKey, readHotSnap, writeHotSnap } from "@/lib/hot-cache";
import { scoreHotRows, type Row } from "@/lib/hot";
import { sideRate, withModelSide } from "@/lib/model-side";
import { useLinesLive } from "@/lib/use-lines-live";

/**
 * Scored hot rows for a day or one match.
 *
 * History scoring is keyed by the books file generation only — not `live_sig` — so a 15 s
 * in-play poll does not rebuild the list. New live-priced lines are scored in a small
 * follow-up query; quote moves are patched onto existing rows (`patchHotQuotes`).
 */
export function useHotRows(scope?: HotScope, doc?: any) {
  const stats = useQuery(storeQuery), linesQ = useLinesLive(), fixtures = useQuery(fixturesQuery), seedQ = useQuery(hotRowsQuery);
  const seed = seedQ.data?.rows ?? null;
  const lines = { data: doc ?? linesQ.data };
  const qc = useQueryClient();
  const what = !scope ? "none" : "day" in scope ? scope.day : scope.teams.join("|");
  const stamp = new Date().toDateString();
  const generated = lines.data?.generated_at_utc ?? "";
  const liveSig = doc ? "" : (lines.data?.live_sig ?? "");
  // books generation only — live ticks must not invalidate this cache
  const baseKey = ["hot-rows", what, stamp, generated, doc ? lines.data?.lines?.length : "", seedQ.data?.generated_at_utc ?? ""];
  const snapKey = scope && "day" in scope && !doc ? hotSnapKey(what, stamp) : null;
  const snap = useMemo(() => (snapKey ? readHotSnap(snapKey) : null), [snapKey]);

  const base = useQuery({
    queryKey: baseKey,
    enabled: !!scope && !!lines.data && fixtures.isSuccess && seedQ.isFetched && (!!stats.data || !!snap || !!seed),
    staleTime: 10 * 60_000,
    gcTime: FEED_GC_MS,
    placeholderData: (prev: Row[] | undefined) => prev ?? snap?.rows,
    queryFn: async () => {
      if (snap && snapKey && snap.generated === generated && snap.rows.length) return snap.rows;
      const out = await scoreHotRows({
        store: stats.data?.store, rz: stats.data?.rz, loadStore: () => qc.ensureQueryData(storeQuery),
        lines: lines.data.lines || [], fixtures: fixtures.data!, scope: scope!, seed,
        onRows: (r) => qc.setQueryData(baseKey, r),
      });
      if (snapKey) writeHotSnap(snapKey, generated, out);
      return out;
    },
  });

  const liveExtra = useQuery({
    queryKey: ["hot-rows-live", what, stamp, generated, liveSig],
    enabled: !!scope && !doc && !!base.data && !!liveSig && !!lines.data,
    staleTime: LIVE_TTL_MS,
    gcTime: FEED_GC_MS,
    placeholderData: (prev: Row[] | undefined) => prev,
    queryFn: async () => {
      const missing = missingLiveLines(base.data || [], lines.data.lines || []);
      if (!missing.length) return [] as Row[];
      return scoreHotRows({
        store: stats.data?.store, rz: stats.data?.rz, loadStore: () => qc.ensureQueryData(storeQuery),
        lines: missing, fixtures: fixtures.data!, scope: scope!, seed: null,
      });
    },
  });

  const data = useMemo(() => {
    const baseRows = base.data || [];
    if (!baseRows.length && !liveExtra.data?.length) return baseRows;
    const keys = new Set(baseRows.map(rowLineKey));
    const merged = baseRows.slice();
    for (const r of liveExtra.data || []) {
      if (!keys.has(rowLineKey(r))) { merged.push(r); keys.add(rowLineKey(r)); }
    }
    return patchHotQuotes(merged, lines.data?.lines || []);
  }, [base.data, liveExtra.data, lines.data]);

  const day = scope && "day" in scope ? scope.day : -1;
  const otherDay = useMemo(() => (day >= 0 ? otherHotCount(lines.data?.lines || [], day) : 0), [lines.data, day]);
  const scoring = (base.isFetching && !base.isPlaceholderData) || (liveExtra.isFetching && !liveExtra.isPlaceholderData);
  const isLoading = !!scope && ((base.isLoading && !data.length) || (!data.length && !base.isError && !liveExtra.isError));
  return {
    data: data as Row[] | undefined,
    isLoading,
    isFetching: base.isFetching || liveExtra.isFetching,
    isError: base.isError,
    isSuccess: !!data?.length || base.isSuccess,
    scoring,
    otherDay,
    status: base.status,
  };
}

/** The rows ready to show: edge worked out, the live feed's word on each, and where a line stands so far. Ordered: matches in play, higher hit rate, higher edge. */
export function useHotView(scope?: HotScope, phase?: HomePhase, doc?: any) {
  const hot = useHotRows(scope, doc);
  const live = useQuery(liveQuery);
  const identity = useQuery(storeQuery).data?.identity;
  const matchOf = (r: Row) => { const [a, b] = String(r.match).split(/\s+vs\s+/i); return liveForFixture(live.data, { a, b, start: r.start, fmt: r.fmt }); };
  const asLine = (r: Row) => ({ pid: r.pid, player: r.name, book_name: r.bookName, team: r.team, stat: r.stat, line: r.line, inn: r.inn });
  const soFarOf = (r: Row) => lineStanding(matchOf(r), asLine(r), identity, { stored: r.stored, settled: r.settled });
  const outOf = (r: Row) => lineNotIn(matchOf(r), asLine(r), identity);
  const day = scope && "day" in scope ? scope.day : -1;
  const rows = useMemo(
    () => timed(`hotView rows day=${day}`, () => (hot.data || [] as Row[])
      .map((r: Row) => withModelSide(r))
      .filter((r: Row) => (day < 0 || r.day === day) && (!phase || lineHomePhase(r, live.data) === phase))
      .sort((x: Row, y: Row) => hotOrder({ live: matchOf(x)?.status === "live", p: sideRate(x), edge: x.edge }, { live: matchOf(y)?.status === "live", p: sideRate(y), edge: y.edge }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hot.data, live.data, phase, day],
  );
  return { rows, isLoading: hot.isLoading, scoring: hot.scoring, error: hot.isError, otherDay: hot.otherDay, soFarOf, outOf, matchOf };
}
