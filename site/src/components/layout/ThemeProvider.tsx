import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { track } from "@/lib/analytics";
import { paintTheme, readPref, resolvedTheme, savePref, type ResolvedTheme, type ThemePref } from "@/lib/theme";

type ThemeCtx = { pref: ThemePref; resolved: ResolvedTheme; setPref: (pref: ThemePref) => void };

const Ctx = createContext<ThemeCtx | null>(null);

function subscribeSystem(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** Wraps the app so the header toggle and the toaster share one preference. The blocking script in index.html already painted the first frame. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readPref);
  const systemDark = useSyncExternalStore(subscribeSystem, () => window.matchMedia("(prefers-color-scheme: dark)").matches, () => true);
  const resolved = resolvedTheme(pref, systemDark);
  useEffect(() => { paintTheme(resolved); }, [resolved]);
  const value = useMemo<ThemeCtx>(() => ({
    pref,
    resolved,
    setPref: (next) => { setPrefState(next); savePref(next); track("theme_set", { theme: next }); },
  }), [pref, resolved]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme needs ThemeProvider");
  return ctx;
}
