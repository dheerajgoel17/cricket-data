/* eslint-disable @typescript-eslint/no-explicit-any */
// The stats engine's data: the players index, the matches table and (lazily, per player file) every player's history. The same loader the site's DataProvider uses.
import { queryOptions } from "@tanstack/react-query";
import { identityIndex } from "@cricket/engine/identity.js";
import { Resolver } from "@cricket/engine/resolve.js";
import { createStore } from "@cricket/engine/store.js";
import { getJson } from "@/lib/net";
import { mark, span } from "@/lib/perf";

export interface StatsData { store: any; rz: any; identity: ReturnType<typeof identityIndex>; /** full names by player id, when the data build has made them */ names: Record<string, string> }

/** `meta.json`, `index.json` and `matches.json` (about 4.5 MB between them); a player's own file is fetched when a row needs it. Kept for the whole run. */
export const storeQuery = queryOptions({
  queryKey: ["stats-store"],
  staleTime: Infinity,
  gcTime: Infinity,
  retry: 1,
  queryFn: async (): Promise<StatsData> => {
    mark("store-start");
    let t = Date.now();
    const store = await createStore({ fetchJson: (p: string) => getJson(`/data/${p}`) });
    if (!store?.P?.id?.length) throw new Error("index.json: empty");
    // the player-identity table (our id <-> the live source's id, the books' names); a missing file just means nobody is linked and names decide
    span("createStore", t); t = Date.now();
    const identity = identityIndex(await getJson("/data/identity.json").catch(() => null));
    const names = await getJson("/data/names.json").catch(() => null);
    mark("store-ready");
    span("identity+names", t); t = Date.now();
    const rz = new Resolver(store);
    span("Resolver", t);
    return { store, rz, identity, names: names && typeof names === "object" ? (names as Record<string, string>) : {} };
  },
});
