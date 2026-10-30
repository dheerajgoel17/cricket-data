import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createStore } from "@/engine/store.js";
import { Resolver } from "@/engine/resolve.js";
import { unwrap } from "@/engine/wrap.js";
import { loadPhotos, type Photos } from "@/lib/assets";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Data { store: any; rz: any; photos: Photos; identity: any }
const Ctx = createContext<Data | null>(null);

async function gate() {
  try {
    const r = await fetch("/api/gate", { credentials: "same-origin" });
    if (!r.ok) return {};
    return await r.json();
  } catch { return {}; }
}

async function loadJson(url: string, key?: string) {
  try {
    const r = await fetch(url, { credentials: "same-origin" });
    if (!r.ok) return url.endsWith("identity.json") ? { p: [], fx: [] } : {};
    return await unwrap(await r.json(), key);
  } catch { return url.endsWith("identity.json") ? { p: [], fx: [] } : {}; }
}

/** Loads the generated data files once (matches, players index, photos map) and shares the engine objects with every page. */
export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const g = await gate();
        const store = await createStore({ base: "/data/", wrapKey: g.k });
        const [photos, identity] = await Promise.all([
          loadPhotos("/data/").then((p) => unwrap(p, g.k)),
          loadJson("/data/identity.json", g.k),
        ]);
        if (live) setData({ store, rz: new Resolver(store, identity), photos, identity });
      } catch (e) { if (live) setError((e as Error).message); }
    })();
    return () => { live = false; };
  }, []);
  if (error) return <div className="m-8 rounded-lg border border-destructive p-6"><h2 className="text-xl font-medium">Data not found</h2><p className="mt-2 text-muted-foreground">Could not load the data files ({error}). Run the site build first: see docs/SITE.md.</p></div>;
  if (!data) return <div className="p-8 text-muted-foreground" role="status">Loading data…</div>;
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

export function useData(): Data {
  const d = useContext(Ctx);
  if (!d) throw new Error("useData outside DataProvider");
  return d;
}
