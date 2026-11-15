/* eslint-disable @typescript-eslint/no-explicit-any */
// The stats engine's data: same boot shape as the site's DataProvider (`deferMatches`).
import { Platform } from "react-native";
import { queryOptions } from "@tanstack/react-query";
import { identityIndex } from "@cricket/engine/identity.js";
import { Resolver } from "@cricket/engine/resolve.js";
import { createStore } from "@cricket/engine/store.js";
import { getJson, setDataBuild } from "@/lib/net";
import { mark, span, timed } from "@/lib/perf";

export interface StatsData {
  store: any;
  rz: any;
  identity: ReturnType<typeof identityIndex>;
  /** full names by player id, when the data build has made them */
  names: Record<string, string>;
  /** false until matches.json has joined (site `matchesReady`); Fancy / Leagues / Player wait for it */
  matchesReady: boolean;
  matchesError?: Error;
}

const pause = () => new Promise<void>((r) => setTimeout(r, Platform.OS === "android" ? 32 : 0));

/**
 * The name resolver without its half second: indexing ~15,000 names used to hold the screen that asked for the store (a tab, a page) before anything could be drawn. This stands in for
 * it at once and is the same object for good (it is a cache key in `merge-live`); the real one is built behind it in slices (`Resolver.create`) once the store has been handed over.
 * A call that arrives before that has finished builds it there and then, as before.
 */
function lazyResolver(store: any): any {
  let real: any = null;
  const now = () => (real ??= timed("Resolver (on demand)", () => new Resolver(store)));
  setTimeout(() => {
    if (real) return;
    const t = Date.now();
    void (Resolver as any).create(store, () => new Promise<void>((r) => setTimeout(r, 8)), 8).then((r: any) => { real ??= r; span("Resolver (background)", t); });
  }, 400);
  return new Proxy({}, {
    // `built`: has the real one been made yet? (asked by work that can wait for it rather than build it on the spot)
    get: (_t, k) => { if (k === "built") return !!real; const r = now(), v = r[k]; return typeof v === "function" ? v.bind(r) : v; },
    set: (_t, k, v) => { now()[k] = v; return true; },
    has: (_t, k) => k in now(),
  });
}

/**
 * Index + Resolver first (`deferMatches: true`, same as the site). `matches.json` (~8 MB parse) joins on
 * `store.ready` and flips `matchesReady` — Home / Saved do not wait for it.
 */
export const storeQuery = queryOptions<StatsData>({
  queryKey: ["stats-store"],
  staleTime: (query) => query.state.data?.matchesError ? 0 : Infinity,
  structuralSharing: false,
  gcTime: Infinity,
  retry: 1,
  queryFn: async ({ client }): Promise<StatsData> => {
    mark("store-start");
    await pause();
    let t = Date.now();
    const meta = await getJson("/data/meta.json");
    setDataBuild(meta?.built_at ? `${meta.built_at}|${meta.schema ?? ""}` : undefined);
    await pause();
    const store = await createStore({
      deferMatches: true,
      fetchJson: (p: string) => (p === "meta.json" ? Promise.resolve(meta) : getJson(`/data/${p}`)),
    });
    void store.ready.catch(() => {}); // identity/names may still be loading when matches fails
    if (!store?.P?.id?.length) throw new Error("index.json: empty");
    span("createStore", t); t = Date.now();
    await pause();
    const identity = identityIndex(await getJson("/data/identity.json").catch(() => null));
    const names = await getJson("/data/names.json").catch(() => null);
    mark("store-ready");
    span("identity+names", t); t = Date.now();
    await pause();
    const rz = lazyResolver(store);
    const out: StatsData = {
      store, rz, identity,
      names: names && typeof names === "object" ? (names as Record<string, string>) : {},
      matchesReady: !!store.M,
    };
    // Publish after the initial query result has entered the cache, even for a warm matches file.
    void store.ready.then(() => {
      setTimeout(() => {
        mark("matches-ready");
        client.setQueryData(["stats-store"], (prev: StatsData | undefined) =>
          (prev && prev.store === store ? { ...prev, matchesReady: true } : prev));
      }, 0);
    }).catch((error: Error) => {
      setTimeout(() => {
        mark("matches-error");
        client.setQueryData(["stats-store"], (prev: StatsData | undefined) =>
          (prev && prev.store === store ? { ...prev, matchesError: error } : prev));
      }, 0);
    });
    return out;
  },
});
