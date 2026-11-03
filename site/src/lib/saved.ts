import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createStorage, pushRecent, removeCombo, saveCombo, toggleKey, webAdapter, type FilterCombo } from "@cricket/storage";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

/** Device storage for recents only (and a one-time migrate of old local favourites into the account). */
export const appStorage = createStorage(webAdapter());
if (typeof window !== "undefined") window.addEventListener("storage", (e) => { if (e.key) appStorage.refresh(e.key); });

const SAVED = "cph-saved", COMBOS = "cph-combos", RECENTS = "cph-recents", MERGED = "cph-saved-merged";
const NONE: string[] = [], NO_COMBOS: FilterCombo[] = [];

function useStored<T>(key: string, empty: T): T {
  return useSyncExternalStore((fn) => appStorage.subscribe(key, fn), () => appStorage.get(key, empty), () => empty);
}

/** The key one priced line is saved under: the player's index, stat, line and format. A different line of the same stat is a different prop. */
export const propKey = (idx: number, stat: string, line: number, fmt: number | string) => `prop:${idx}:${stat}:${line}:${fmt}`;
export function parsePropKey(key: string) {
  const [kind, idx, stat, line, fmt] = key.split(":");
  return kind === "prop" && idx !== undefined && stat && line !== undefined && fmt !== undefined ? { idx: Number(idx), stat, line: Number(line), fmt: Number(fmt) } : null;
}

async function fetchKeys(userId: string): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from("saved_items").select("key").eq("user_id", userId);
  if (error) throw error;
  return (data || []).map((r) => r.key as string);
}

async function fetchCombos(userId: string): Promise<FilterCombo[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from("saved_combos").select("name,query,created_at").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => ({ name: r.name as string, query: r.query as string, at: r.created_at ? Date.parse(r.created_at as string) : 0 }));
}

/** One-time: push any leftover device favourites into the account, then clear those local keys. */
async function mergeLocalOnce(userId: string) {
  if (typeof window === "undefined") return;
  const flag = `${MERGED}:${userId}`;
  if (appStorage.get(flag, false)) return;
  const sb = getSupabase();
  if (!sb) return;
  const localKeys = appStorage.get(SAVED, NONE) as string[];
  const localCombos = appStorage.get(COMBOS, NO_COMBOS) as FilterCombo[];
  if (localKeys.length) {
    const rows = localKeys.map((key) => ({ user_id: userId, key }));
    await sb.from("saved_items").upsert(rows, { onConflict: "user_id,key" });
  }
  if (localCombos.length) {
    const rows = localCombos.map((c) => ({ user_id: userId, name: c.name, query: c.query }));
    await sb.from("saved_combos").upsert(rows, { onConflict: "user_id,name" });
  }
  appStorage.remove(SAVED);
  appStorage.remove(COMBOS);
  appStorage.set(flag, true);
}

/**
 * Saved players, teams and props (account). Keys look like "player:123", "team:4" or "prop:<player>:<stat>:<line>:<fmt>".
 * Logged out: empty list; `toggle` opens sign-in and returns false.
 */
export function useSaved() {
  const { user, requireSignIn } = useAuth();
  const [list, setList] = useState<string[]>(NONE);
  const [ready, setReady] = useState(false);
  const uid = user?.id ?? null;
  const gen = useRef(0);

  useEffect(() => {
    if (!uid) { setList(NONE); setReady(true); return; }
    const n = ++gen.current;
    setReady(false);
    (async () => {
      try {
        await mergeLocalOnce(uid);
        const keys = await fetchKeys(uid);
        if (gen.current === n) setList(keys);
      } catch {
        if (gen.current === n) setList(NONE);
      } finally {
        if (gen.current === n) setReady(true);
      }
    })();
  }, [uid]);

  const toggle = useCallback((key: string) => {
    if (!requireSignIn() || !uid) return false;
    const sb = getSupabase();
    if (!sb) return false;
    const r = toggleKey(list, key);
    setList(r.list);
    if (r.on) {
      void sb.from("saved_items").upsert({ user_id: uid, key }, { onConflict: "user_id,key" }).then(({ error }) => {
        if (error) setList((cur) => cur.filter((k) => k !== key));
      });
    } else {
      void sb.from("saved_items").delete().eq("user_id", uid).eq("key", key).then(({ error }) => {
        if (error) setList((cur) => (cur.includes(key) ? cur : [...cur, key]));
      });
    }
    return r.on;
  }, [list, requireSignIn, uid]);

  return { list, has: (k: string) => list.includes(k), toggle, ready };
}

/** Saved filter combinations on the account (name + query string). Logged out: save opens sign-in. */
export function useCombos() {
  const { user, requireSignIn } = useAuth();
  const [combos, setCombos] = useState<FilterCombo[]>(NO_COMBOS);
  const uid = user?.id ?? null;
  const gen = useRef(0);

  useEffect(() => {
    if (!uid) { setCombos(NO_COMBOS); return; }
    const n = ++gen.current;
    (async () => {
      try {
        await mergeLocalOnce(uid);
        const rows = await fetchCombos(uid);
        if (gen.current === n) setCombos(rows);
      } catch {
        if (gen.current === n) setCombos(NO_COMBOS);
      }
    })();
  }, [uid]);

  const save = useCallback((name: string, query: string) => {
    if (!requireSignIn() || !uid) return false;
    const sb = getSupabase();
    if (!sb) return false;
    const next = saveCombo(combos, name, query);
    const row = next.find((c) => c.name === String(name || "").trim().slice(0, 40));
    if (!row) return false;
    setCombos(next);
    void sb.from("saved_combos").upsert({ user_id: uid, name: row.name, query: row.query }, { onConflict: "user_id,name" }).then(({ error }) => {
      if (error) setCombos((cur) => removeCombo(cur, row.name));
    });
    return true;
  }, [combos, requireSignIn, uid]);

  const remove = useCallback((name: string) => {
    if (!requireSignIn() || !uid) return;
    const sb = getSupabase();
    if (!sb) return;
    const prev = combos;
    setCombos(removeCombo(combos, name));
    void sb.from("saved_combos").delete().eq("user_id", uid).eq("name", name).then(({ error }) => {
      if (error) setCombos(prev);
    });
  }, [combos, requireSignIn, uid]);

  return { combos, save, remove };
}

/** Players opened recently, newest first ("player:123") — still on this device. */
export function useRecents() {
  const recents = useStored(RECENTS, NONE);
  return { recents, push: useCallback((key: string) => appStorage.set(RECENTS, pushRecent(appStorage.get(RECENTS, NONE), key)), []) };
}
export const pushRecentPlayer = (idx: number) => appStorage.set(RECENTS, pushRecent(appStorage.get(RECENTS, NONE), `player:${idx}`));
