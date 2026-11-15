/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { storeQuery } from "@/lib/data";
import { mergeLiveLinesSliced } from "@/lib/merge-live";
import { span } from "@/lib/perf";
import { fixturesQuery, inplayQuery, linesQuery } from "@/lib/queries";
import { useLive } from "@/lib/use-live";

const versions = new WeakMap<object, number>();
let version = 0;
const versionOf = (doc: any): number => {
  if (!doc || typeof doc !== "object") return 0;
  if (!versions.has(doc)) versions.set(doc, ++version);
  return versions.get(doc)!;
};

/**
 * Book lines with in-play folds when the stats store is **already** loaded (Fancy / Player / Leagues).
 * Never starts `storeQuery` itself — that was freezing tab switches when Home/Props mounted this hook.
 * Android live network is already deferred via `useLive({ defer })`; no second merge delay (that stacked ~8 s).
 */
export function useLinesLive() {
  const lines = useQuery(linesQuery), live = useLive({ defer: true }), fixtures = useQuery(fixturesQuery);
  const on = useMemo(
    () => !!(live.gateOpen && (live.data?.matches || []).some((m: any) => m.status === "live")),
    [live.gateOpen, live.data],
  );
  // Read-only: do not enable storeQuery here.
  const stats = useQuery({ ...storeQuery, enabled: false });
  const store = stats.data?.store, rz = stats.data?.rz;
  // Merge only when store is warm (Fancy/Player) — Home never loads it, so cold start stays seed-only.
  const wantMerge = on && !!store && !!rz && !!stats.data?.matchesReady;
  const inplay = useQuery({ ...inplayQuery, enabled: wantMerge });

  // One merge per snapshot across all mounted consumers, rather than one per hook instance.
  const merged = useQuery({
    queryKey: ["merged-live-lines", versionOf(lines.data), versionOf(inplay.data), versionOf(live.data), versionOf(fixtures.data), versionOf(store)],
    enabled: wantMerge && !!inplay.data && !!lines.data,
    staleTime: Infinity,
    gcTime: 60_000,
    structuralSharing: false,
    placeholderData: (prev: any) => prev?.generated_at_utc === lines.data?.generated_at_utc ? prev : undefined,
    queryFn: async () => {
      const rest = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      // the name resolver is built behind the store in slices: wait for it (up to ~6 s) rather than build it here in one half-second block
      for (let i = 0; i < 40 && rz.built === false; i++) await rest(150);
      await rest(16);
      const t = Date.now();
      const out = await mergeLiveLinesSliced(lines.data, inplay.data, live.data, fixtures.data || [], store, rz, () => rest(8));
      span("mergeLiveLines", t);
      return out;
    },
  });
  return { ...lines, data: wantMerge ? merged.data ?? lines.data : lines.data };
}
