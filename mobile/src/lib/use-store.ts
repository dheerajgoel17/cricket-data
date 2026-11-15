import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { storeQuery, type StatsData } from "@/lib/data";

type StoreQuery = Omit<ReturnType<typeof useQuery<StatsData>>, "isError" | "error"> & { isError: boolean; error: Error | null; matchesReady: boolean };

/**
 * Stats store (`matches.json` + Resolver). Waits one frame on Android so the tab/page chrome paints before the multi-second load steals the JS thread.
 * Pass `enabled: false` to keep it off (Home cold start).
 * `matchesReady` is false until `matches.json` has joined — anything that reads `store.M` must wait for it.
 */
export function useStore(opts?: { enabled?: boolean; deferMs?: number }): StoreQuery {
  const want = opts?.enabled !== false;
  const [go, setGo] = useState(() => Platform.OS !== "android" && want);
  useEffect(() => {
    if (!want) { setGo(false); return; }
    if (Platform.OS !== "android") { setGo(true); return; }
    const t = setTimeout(() => setGo(true), opts?.deferMs ?? 48);
    return () => clearTimeout(t);
  }, [want, opts?.deferMs]);
  const q = useQuery({ ...storeQuery, enabled: want && go });
  return { ...q, isError: q.isError || !!q.data?.matchesError, error: q.error ?? q.data?.matchesError ?? null, matchesReady: !!q.data?.matchesReady };
}
