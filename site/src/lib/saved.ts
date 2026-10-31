import { useCallback, useSyncExternalStore } from "react";
import { createStorage, pushRecent, removeCombo, saveCombo, toggleKey, webAdapter, type FilterCombo } from "@cricket/storage";

/** One storage for the whole app: a native app builds the same thing over MMKV. No accounts, so everything lives on this device. */
export const appStorage = createStorage(webAdapter());
if (typeof window !== "undefined") window.addEventListener("storage", (e) => { if (e.key) appStorage.refresh(e.key); });

const SAVED = "cph-saved", COMBOS = "cph-combos", RECENTS = "cph-recents";
const NONE: string[] = [], NO_COMBOS: FilterCombo[] = [];

function useStored<T>(key: string, empty: T): T {
  return useSyncExternalStore((fn) => appStorage.subscribe(key, fn), () => appStorage.get(key, empty), () => empty);
}

/**
 * Saved players, teams and props (this device only). Keys look like "player:123", "team:4" or "prop:<player>:<stat>:<line>:<fmt>"
 * (see `propKey`). `toggle` returns whether the key is now saved.
 */
export function useSaved() {
  const list = useStored(SAVED, NONE);
  const toggle = useCallback((key: string) => { const r = toggleKey(appStorage.get(SAVED, NONE), key); appStorage.set(SAVED, r.list); return r.on; }, []);
  return { list, has: (k: string) => list.includes(k), toggle };
}

/** The key one priced line is saved under: the player's index, stat, line and format. A different line of the same stat is a different prop. */
export const propKey = (idx: number, stat: string, line: number, fmt: number | string) => `prop:${idx}:${stat}:${line}:${fmt}`;
export function parsePropKey(key: string) {
  const [kind, idx, stat, line, fmt] = key.split(":");
  return kind === "prop" && idx !== undefined && stat && line !== undefined && fmt !== undefined ? { idx: Number(idx), stat, line: Number(line), fmt: Number(fmt) } : null;
}

/** Saved filter combinations: a name and the query string that restores the view (`/props?stat=runs&win=l5`), which is also its shareable link. */
export function useCombos() {
  const combos = useStored(COMBOS, NO_COMBOS);
  return {
    combos,
    save: useCallback((name: string, query: string) => { const next = saveCombo(appStorage.get(COMBOS, NO_COMBOS), name, query); appStorage.set(COMBOS, next); return next !== appStorage.get(COMBOS, NO_COMBOS) || next.some((c) => c.name === name.trim()); }, []),
    remove: useCallback((name: string) => appStorage.set(COMBOS, removeCombo(appStorage.get(COMBOS, NO_COMBOS), name)), []),
  };
}

/** Players opened recently, newest first ("player:123"). */
export function useRecents() {
  const recents = useStored(RECENTS, NONE);
  return { recents, push: useCallback((key: string) => appStorage.set(RECENTS, pushRecent(appStorage.get(RECENTS, NONE), key)), []) };
}
export const pushRecentPlayer = (idx: number) => appStorage.set(RECENTS, pushRecent(appStorage.get(RECENTS, NONE), `player:${idx}`));
