/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo } from "react";
import { Platform } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LIVE_TTL_MS, lineNotIn, lineStanding, liveForFixture } from "@cricket/engine/live.js";
import { isLiveLine, liveThresholdKey, patchHotQuotes, prematchLines } from "@cricket/engine/hot-rows.js";
import { hotLines, hotOrder, otherHotCount, type HotScope } from "@site/lib/hot-lines";
import { lineHomePhase, type HomePhase } from "@site/lib/home-phase";
import { timed } from "@/lib/perf";
import { storeQuery } from "@/lib/data";
import { FEED_GC_MS, fixturesQuery, hotRowsQuery } from "@/lib/queries";
import { hotSnapKey, readHotSnap, writeHotSnap } from "@/lib/hot-cache";
import { scoreHotRows, type Row } from "@/lib/hot";
import { sideRate, withModelSide } from "@/lib/model-side";
import { useLinesLive } from "@/lib/use-lines-live";
import { useLive } from "@/lib/use-live";

/**
 * Scored hot rows for a day or one match.
 *
 * History scoring is keyed by the books file generation only — not `live_sig` — so a 15 s
 * in-play poll does not rebuild the list. New live-priced lines are scored in a small
 * follow-up query; quote moves are patched onto existing rows (`patchHotQuotes`).
 */
export function useHotRows(scope?: HotScope, doc?: any, innings?: "first" | "second") {
  // Do not auto-fetch the stats store on Home — matches.json + Resolver is a multi-second JS stall.
  // Seed/snap paint first; loadStore runs only when a leftover line truly needs player files.
  const stats = useQuery({ ...storeQuery, enabled: false });
  const linesQ = useLinesLive(), fixtures = useQuery(fixturesQuery), seedQ = useQuery(hotRowsQuery);
  const seed = seedQ.data?.rows ?? null;
  const lines = { data: doc ?? linesQ.data };
  const qc = useQueryClient();
  const what = !scope ? "none" : "day" in scope ? scope.day : scope.teams.join("|");
  const stamp = new Date().toDateString();
  const generated = lines.data?.generated_at_utc ?? "";
  const liveLines = useMemo(() => !scope || doc ? [] : hotLines((lines.data?.lines || []).filter(isLiveLine), scope, Date.now()), [scope, doc, lines.data]);
  const liveKey = useMemo(() => liveThresholdKey(liveLines), [liveLines]);
  // books generation only — live ticks must not invalidate this cache
  const baseKey = ["hot-rows-prematch", what, stamp, generated, doc ? lines.data?.lines?.length : "", seedQ.data?.generated_at_utc ?? "", ...(innings ? [innings] : [])];
  const snapKey = scope && "day" in scope && !doc && !innings ? hotSnapKey(what, stamp) : null;
  const snap = useMemo(() => (snapKey ? readHotSnap(snapKey) : null), [snapKey]);
  const loadStore = () => qc.ensureQueryData(storeQuery);

  const base = useQuery({
    queryKey: baseKey,
    enabled: !!scope && !!lines.data && fixtures.isSuccess && seedQ.isFetched,
    staleTime: 10 * 60_000,
    gcTime: FEED_GC_MS,
    placeholderData: (prev: Row[] | undefined, query) =>
      query?.queryKey[6] === innings ? prev ?? snap?.rows : snap?.rows,
    queryFn: async () => {
      if (snap && snapKey && snap.generated === generated && snap.rows.length) return snap.rows;
      const out = await scoreHotRows({
        store: stats.data?.store, rz: stats.data?.rz, loadStore,
        lines: prematchLines(lines.data.lines), fixtures: fixtures.data!, scope: scope!, seed, innings, names: stats.data?.names ?? null,
        seedOnly: Platform.OS === "android" && !!scope && "day" in scope && !stats.data,
        onRows: (r) => qc.setQueryData(baseKey, r),
      });
      if (snapKey) writeHotSnap(snapKey, generated, out);
      return out;
    },
  });

  // Live-only history scoring needs the store. Android day scope stays on the seed — when useLinesLive later fills the store cache, do not kick off a multi-second leftover score on Home.
  const androidDay = Platform.OS === "android" && !!scope && "day" in scope;
  const liveExtra = useQuery({
    queryKey: ["hot-rows-live", what, stamp, generated, liveKey, ...(innings ? [innings] : [])],
    enabled: !!scope && liveLines.length > 0 && fixtures.isSuccess && !!stats.data?.matchesReady && !androidDay,
    staleTime: LIVE_TTL_MS,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      return scoreHotRows({
        store: stats.data?.store, rz: stats.data?.rz, loadStore,
        lines: liveLines, fixtures: fixtures.data!, scope: scope!, seed: null, innings, names: stats.data?.names ?? null,
      });
    },
  });

  const data = useMemo(() => {
    return patchHotQuotes([...(base.data || []), ...(liveExtra.data || [])], lines.data?.lines || []) as Row[];
  }, [base.data, liveExtra.data, lines.data]);

  const day = scope && "day" in scope ? scope.day : -1;
  const otherDay = useMemo(() => (day >= 0 ? otherHotCount(lines.data?.lines || [], day) : 0), [lines.data, day]);
  const scoring = (base.isFetching && !base.isPlaceholderData) || (liveExtra.isFetching && !liveExtra.isPlaceholderData);
  const isLoading = !!scope && !data.length && (base.isLoading || liveExtra.isLoading || (base.isPending && !stats.isError && !linesQ.isError && !fixtures.isError));
  return {
    data: data as Row[] | undefined,
    isLoading,
    isFetching: base.isFetching || liveExtra.isFetching,
    isError: base.isError || liveExtra.isError || (!base.data && (stats.isError || linesQ.isError || fixtures.isError)),
    isSuccess: !!data?.length || base.isSuccess,
    scoring,
    otherDay,
    status: base.status,
  };
}

/** Status-only fingerprint so a 15 s score tick does not rebuild/sort every Hot row (standing still updates via soFarOf). */
function livePhaseSig(doc: any): string {
  const ms = doc?.matches;
  if (!Array.isArray(ms) || !ms.length) return "";
  let s = "";
  for (const m of ms) s += `${m.start || ""}:${m.status || ""};`;
  return s;
}

/** The rows ready to show: edge worked out, the live feed's word on each, and where a line stands so far. Ordered: matches in play, higher hit rate, higher edge. */
export function useHotView(scope?: HotScope, phase?: HomePhase, doc?: any, innings?: "first" | "second") {
  const hot = useHotRows(scope, doc, innings);
  const live = useLive({ defer: true });
  const identity = useQuery({ ...storeQuery, enabled: false }).data?.identity;
  const phaseSig = useMemo(() => livePhaseSig(live.data), [live.data]);
  const matchOf = useMemo(() => {
    const matches = new Map<string, any>();
    return (r: Row) => {
      const key = JSON.stringify([r.match, r.start, r.fmt]);
      if (!matches.has(key)) {
        const [a, b] = String(r.match).split(/\s+vs\s+/i);
        matches.set(key, liveForFixture(live.data, { a, b, start: r.start, fmt: r.fmt }));
      }
      return matches.get(key);
    };
  }, [live.data]);
  const asLine = (r: Row) => ({ pid: r.pid, player: r.name, book_name: r.bookName, team: r.team, stat: r.stat, line: r.line, inn: r.inn });
  const soFarOf = useCallback((r: Row) => lineStanding(matchOf(r), asLine(r), identity, { stored: r.stored, settled: r.settled }), [matchOf, identity]);
  const outOf = useCallback((r: Row) => lineNotIn(matchOf(r), asLine(r), identity), [matchOf, identity]);
  const day = scope && "day" in scope ? scope.day : -1;
  const rows = useMemo(
    () => timed(`hotView rows day=${day}`, () => {
      const list = (hot.data || [] as Row[])
        .map((r: Row) => withModelSide(r))
        .filter((r: Row) => (day < 0 || r.day === day) && (!phase || lineHomePhase(r, live.data) === phase));
      // one liveForFixture per row, not once per sort compare
      const liveFlag = new Map<Row, boolean>();
      for (const r of list) liveFlag.set(r, matchOf(r)?.status === "live");
      return list.sort((x: Row, y: Row) => hotOrder({ live: !!liveFlag.get(x), p: sideRate(x), edge: x.edge }, { live: !!liveFlag.get(y), p: sideRate(y), edge: y.edge }));
    }),
    // phaseSig: rebuild when who is live/final changes, not when only so-far numbers move
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hot.data, phaseSig, phase, day],
  );
  return { rows, isLoading: hot.isLoading, scoring: hot.scoring, error: hot.isError, otherDay: hot.otherDay, soFarOf, outOf, matchOf };
}
