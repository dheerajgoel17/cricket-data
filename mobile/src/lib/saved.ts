import { useCallback, useSyncExternalStore } from "react";
import { pushRecent, toggleKey } from "@cricket/storage";
import { storage } from "@/lib/storage";

// Saved players, teams and props, on this device only (the site's `useSaved`, over MMKV). Same key and same item keys, so a later sync of the two is a copy.
const SAVED = "cph-saved";
const NONE: string[] = [];

function useStored<T>(key: string, empty: T): T {
  return useSyncExternalStore((fn) => storage.subscribe(key, fn), () => storage.get(key, empty), () => empty);
}

/** Keys look like "player:123", "team:4" or "prop:<player>:<stat>:<line>:<fmt>". `toggle` returns whether the key is now saved. */
export function useSaved() {
  const list = useStored(SAVED, NONE) as string[];
  const toggle = useCallback((key: string) => { const r = toggleKey(storage.get(SAVED, NONE), key); storage.set(SAVED, r.list); return r.on as boolean; }, []);
  return { list, has: (k: string) => list.includes(k), toggle };
}

/** The key one priced line is saved under: the player's index, stat, line and format. A different line of the same stat is a different prop. */
export const propKey = (idx: number, stat: string, line: number, fmt: number | string) => `prop:${idx}:${stat}:${line}:${fmt}`;

const RECENTS = "cph-recents";

/** Players opened recently, newest first ("player:123"). */
export function useRecents() {
  return { recents: useStored(RECENTS, NONE) as string[] };
}
export const pushRecentPlayer = (idx: number) => storage.set(RECENTS, pushRecent(storage.get(RECENTS, NONE), `player:${idx}`));

/** A saved prop key read back: the player's index, stat, line and format number. Null for any other key. */
export function parsePropKey(key: string) {
  const [kind, idx, stat, line, fmt] = key.split(":");
  return kind === "prop" && idx !== undefined && stat && line !== undefined && fmt !== undefined ? { idx: Number(idx), stat, line: Number(line), fmt: Number(fmt) } : null;
}
