import { useCallback, useSyncExternalStore } from "react";

const KEY = "cph-saved";
const listeners = new Set<() => void>();
const read = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
let cache = read();
const write = (l: string[]) => { cache = l; try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* private mode */ } listeners.forEach((f) => f()); };
const subscribe = (f: () => void) => { listeners.add(f); return () => listeners.delete(f); };

/** Saved players / teams (this browser only). Keys look like "player:123" or "team:4". */
export function useSaved() {
  const list = useSyncExternalStore(subscribe, () => cache);
  const toggle = useCallback((key: string) => { const l = [...cache]; const i = l.indexOf(key); if (i >= 0) l.splice(i, 1); else l.push(key); write(l); return i < 0; }, []);
  return { list, has: (k: string) => list.includes(k), toggle };
}
