import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createStore } from "@/engine/store.js";
import { Resolver } from "@/engine/resolve.js";
import { identityIndex } from "@/engine/identity.js";
import { gateKey, readJson, setWrapKey } from "@/lib/wrap-key";
import { type Photos } from "@/lib/assets";
import { AppSkeleton } from "@/components/app/skeletons";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Data { store: any; rz: any; photos: Photos; identity: ReturnType<typeof identityIndex> }
const Ctx = createContext<Data | null>(null);

async function loadJson(url: string) {
  try {
    const r = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    if (!r.ok) return null;
    return await readJson(r);
  } catch { return null; }
}

/** The player-identity table (our id <-> the live source's id, the books' names); a missing file just means nobody is linked and names decide. */
async function loadIdentity(base: string) {
  return identityIndex(await loadJson(`${base}identity.json`));
}

async function boot(): Promise<Data> {
  const k = await gateKey();
  setWrapKey(k);
  const store = await createStore({ base: "/data/", wrapKey: k });
  if (!store?.P?.id?.length) throw new Error("index.json: empty");
  const [photos, identity] = await Promise.all([
    loadJson("/data/photos.json").then((p) => (p || {}) as Photos),
    loadIdentity("/data/"),
  ]);
  return { store, rz: new Resolver(store), photos, identity };
}

const retryable = (e: unknown) => /HTTP 403|empty|Unexpected token/.test(String((e as Error)?.message || e));

/** Loads the generated data files once (matches, players index, photos map, identity table) and shares the engine objects with every page. */
export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setError(null);
    setData(null);
    (async () => {
      try {
        let out: Data;
        try { out = await boot(); }
        catch (e) {
          if (!retryable(e)) throw e;
          await new Promise((r) => setTimeout(r, 80)); // the gate cookie is sometimes not on the next request yet
          out = await boot();
        }
        if (live) setData(out);
      } catch (e) { if (live) setError((e as Error).message); }
    })();
    return () => { live = false; };
  }, [tick]);
  if (error) {
    const local = typeof location !== "undefined" && /localhost|127\.0\.0\.1/.test(location.hostname);
    return (
      <div className="m-8 rounded-lg border border-destructive p-6">
        <h2 className="text-xl font-medium">Data not found</h2>
        <p className="mt-2 text-muted-foreground">Could not load the data files ({error}).{local ? " Set SITE_URL in site/.env.local to use production data, or run the site build (docs/SITE.md)." : " Refresh, or try again in a moment."}</p>
        <button type="button" className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" onClick={() => setTick((n) => n + 1)}>Try again</button>
      </div>
    );
  }
  if (!data) return <AppSkeleton />;
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

export function useData(): Data {
  const d = useContext(Ctx);
  if (!d) throw new Error("useData outside DataProvider");
  return d;
}
