import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createStore } from "@/engine/store.js";
import { Resolver } from "@/engine/resolve.js";
import { loadPhotos, type Photos } from "@/lib/assets";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Data { store: any; rz: any; photos: Photos }
const Ctx = createContext<Data | null>(null);

/** Loads the generated data files once (matches, players index, photos map) and shares the engine objects with every page. */
export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const store = await createStore({ base: "/data/" });
        const [photos] = await Promise.all([loadPhotos("/data/")]);
        if (live) setData({ store, rz: new Resolver(store), photos });
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
