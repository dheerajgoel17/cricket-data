import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createStore } from "@cricket/engine/store.js";
import { Resolver } from "@cricket/engine/resolve.js";
import { identityIndex } from "@cricket/engine/identity.js";
import { dataUrl } from "@/lib/data-url";
import { gateKey, readJson, setWrapKey } from "@/lib/wrap-key";
import { type Photos } from "@/lib/assets";
import { AppSkeleton } from "@/components/app/skeletons";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Data { store: any; rz: any; photos: Photos; identity: ReturnType<typeof identityIndex>; /** full names by player id (from the source's listing); empty until the data build has made them */ names: Record<string, string>; /** false until matches.json has joined the store; the home rail does not wait for it */ matchesReady: boolean }
const Ctx = createContext<(Data & { loadHistory: () => Promise<void> }) | null>(null);

export async function loadJson(url: string) {
  try {
    const r = await fetch(dataUrl(url), { credentials: "same-origin" });
    if (!r.ok) return null;
    return await readJson(r);
  } catch { return null; }
}

/** The player-identity table (our id <-> the live source's id, the books' names); a missing file just means nobody is linked and names decide. */
async function loadIdentity(base: string) {
  return identityIndex(await loadJson(`${base}identity.json`));
}

function lazyResolver(store: Awaited<ReturnType<typeof createStore>>) {
  let resolver: Resolver | undefined;
  return new Proxy({} as Resolver, {
    get(_target, key) {
      const target = resolver ??= new Resolver(store);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

const firstHome = typeof document !== "undefined" ? document.getElementById("home-start")?.innerHTML : undefined;

export const firstHomeRail = typeof document !== "undefined" ? document.getElementById("home-start-rail")?.innerHTML : undefined;

function loadExtras() {
  return Promise.all([
    loadJson("/data/photos.json").then((p) => (p || {}) as Photos),
    loadIdentity("/data/"),
    loadJson("/data/names.json").then((n) => (n && typeof n === "object" ? n : {}) as Record<string, string>),
  ]);
}

async function boot(isHome: boolean) {
  const k = await gateKey();
  setWrapKey(k);
  const fetchJson = async (path: string) => {
    const response = await fetch(dataUrl(`/data/${path}`), { credentials: "same-origin", priority: path === "matches.json" ? "low" : "auto" });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return readJson(response);
  };
  const fixtures = isHome ? fetchJson("fixtures.json").catch(() => null) : undefined;
  const store = await createStore({
    deferMatches: true,
    lazyMatches: true,
    fetchJson: async (path: string) => (path === "fixtures.json" ? await fixtures : null) ?? fetchJson(path),
  });
  if (!store?.P?.id?.length) throw new Error("index.json: empty");
  const data: Data = { store, rz: lazyResolver(store), photos: {}, identity: identityIndex(null), names: {}, matchesReady: false };
  return data;
}

const retryable = (e: unknown) => /HTTP 403|empty|Unexpected token/.test(String((e as Error)?.message || e));

/** Loads the generated data files once (matches, players index, photos map, identity table) and shares the engine objects with every page. */
export function DataProvider({ children, eagerHistory = false }: { children: ReactNode; eagerHistory?: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setError(null);
    setData(null);
    (async () => {
      try {
        let out: Awaited<ReturnType<typeof boot>>;
        const isHome = !eagerHistory && location.pathname === "/";
        try { out = await boot(isHome); }
        catch (e) {
          if (!retryable(e)) throw e;
          await new Promise((r) => setTimeout(r, 80)); // the gate cookie is sometimes not on the next request yet
          out = await boot(isHome);
        }
        if (!live) return;
        setData(out);
        void loadExtras().then(([photos, identity, names]) => {
          if (live) setData((d) => (d && d.store === out.store ? { ...d, photos, identity, names } : d));
        });
      } catch (e) { if (live) setError((e as Error).message); }
    })();
    return () => { live = false; };
  }, [tick, eagerHistory]);
  const store = data?.store;
  const loadHistory = useCallback(async () => {
    if (!store) return;
    await store.ready;
    setData((d) => d && d.store === store && !d.matchesReady ? { ...d, matchesReady: true } : d);
  }, [store]);
  useEffect(() => {
    if (eagerHistory) void loadHistory().catch((e: Error) => setError(e.message));
  }, [eagerHistory, loadHistory]);
  if (error) {
    const local = typeof location !== "undefined" && /localhost|127\.0\.0\.1/.test(location.hostname);
    return (
      <div className="m-8 rounded-lg border border-destructive p-6">
        <h2 className="text-xl font-label">Data not found</h2>
        <p className="mt-2 text-muted-foreground">Could not load the data files ({error}).{local ? " Set SITE_URL in site/.env.local to use production data, or run the site build (docs/SITE.md)." : " Refresh, or try again in a moment."}</p>
        <button type="button" className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-label text-primary-foreground" onClick={() => setTick((n) => n + 1)}>Try again</button>
      </div>
    );
  }
  if (!data) return firstHome && !eagerHistory ? <div dangerouslySetInnerHTML={{ __html: firstHome }} /> : <AppSkeleton />;
  return <Ctx.Provider value={{ ...data, loadHistory }}>{children}</Ctx.Provider>;
}

export function useData() {
  const d = useContext(Ctx);
  if (!d) throw new Error("useData outside DataProvider");
  return d;
}

/** The data when a provider is above, else null: for small display components that must not throw in isolation (tests, previews). */
export function useDataMaybe(): Data | null { return useContext(Ctx); }
