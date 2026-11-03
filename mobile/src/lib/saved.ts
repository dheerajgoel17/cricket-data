import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { pushRecent, removeCombo, saveCombo, toggleKey } from "@cricket/storage";

type FilterCombo = { name: string; query: string; at: number };
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { storage } from "@/lib/storage";

const SAVED = "cph-saved", COMBOS = "cph-combos", RECENTS = "cph-recents", MERGED = "cph-saved-merged";
const NONE: string[] = [], NO_COMBOS: FilterCombo[] = [];

function useStored<T>(key: string, empty: T): T {
  return useSyncExternalStore((fn) => storage.subscribe(key, fn), () => storage.get(key, empty), () => empty);
}

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

async function mergeLocalOnce(userId: string) {
  const flag = `${MERGED}:${userId}`;
  if (storage.get(flag, false)) return;
  const sb = getSupabase();
  if (!sb) return;
  const localKeys = storage.get(SAVED, NONE) as string[];
  const localCombos = storage.get(COMBOS, NO_COMBOS) as FilterCombo[];
  if (localKeys.length) await sb.from("saved_items").upsert(localKeys.map((key) => ({ user_id: userId, key })), { onConflict: "user_id,key" });
  if (localCombos.length) await sb.from("saved_combos").upsert(localCombos.map((c) => ({ user_id: userId, name: c.name, query: c.query })), { onConflict: "user_id,name" });
  storage.remove(SAVED);
  storage.remove(COMBOS);
  storage.set(flag, true);
}

/** Account watchlist. Logged out: empty; `toggle` opens sign-in and returns false. */
export function useSaved() {
  const { user, requireSignIn } = useAuth();
  const [list, setList] = useState<string[]>(NONE);
  const uid = user?.id ?? null;
  const gen = useRef(0);

  useEffect(() => {
    if (!uid) { setList(NONE); return; }
    const n = ++gen.current;
    (async () => {
      try {
        await mergeLocalOnce(uid);
        const keys = await fetchKeys(uid);
        if (gen.current === n) setList(keys);
      } catch {
        if (gen.current === n) setList(NONE);
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

  return { list, has: (k: string) => list.includes(k), toggle };
}

export function useCombos() {
  const { user, requireSignIn } = useAuth();
  const [combos, setCombos] = useState<FilterCombo[]>(NO_COMBOS);
  const uid = user?.id ?? null;

  useEffect(() => {
    if (!uid) { setCombos(NO_COMBOS); return; }
    const sb = getSupabase();
    if (!sb) return;
    void (async () => {
      await mergeLocalOnce(uid);
      const { data } = await sb.from("saved_combos").select("name,query,created_at").eq("user_id", uid).order("created_at", { ascending: false });
      setCombos((data || []).map((r) => ({ name: r.name as string, query: r.query as string, at: r.created_at ? Date.parse(r.created_at as string) : 0 })));
    })();
  }, [uid]);

  const save = useCallback((name: string, query: string) => {
    if (!requireSignIn() || !uid) return false;
    const sb = getSupabase();
    if (!sb) return false;
    const next = saveCombo(combos, name, query) as FilterCombo[];
    const row = next.find((c: FilterCombo) => c.name === String(name || "").trim().slice(0, 40));
    if (!row) return false;
    setCombos(next);
    void sb.from("saved_combos").upsert({ user_id: uid, name: row.name, query: row.query }, { onConflict: "user_id,name" });
    return true;
  }, [combos, requireSignIn, uid]);

  const remove = useCallback((name: string) => {
    if (!requireSignIn() || !uid) return;
    const sb = getSupabase();
    if (!sb) return;
    setCombos(removeCombo(combos, name));
    void sb.from("saved_combos").delete().eq("user_id", uid).eq("name", name);
  }, [combos, requireSignIn, uid]);

  return { combos, save, remove };
}

export function useRecents() {
  return { recents: useStored(RECENTS, NONE) as string[] };
}
export const pushRecentPlayer = (idx: number) => storage.set(RECENTS, pushRecent(storage.get(RECENTS, NONE), `player:${idx}`));
