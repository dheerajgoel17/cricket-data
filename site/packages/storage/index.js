/**
 * Storage abstraction. An adapter is `{ get(key) -> string | null, set(key, value), remove(key) }`, synchronous so a React
 * `useSyncExternalStore` hook can read it: the web adapter wraps localStorage, a native app passes an MMKV-backed one.
 * Every access is guarded: private mode or a full quota only costs persistence, never an exception.
 */
export function memoryAdapter(seed = {}) {
  const m = new Map(Object.entries(seed));
  return { get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => void m.set(k, v), remove: (k) => void m.delete(k) };
}

export function webAdapter(getStorage = () => globalThis.localStorage) {
  const safe = (fn, fallback) => { try { return fn(getStorage()); } catch { return fallback; } };
  return { get: (k) => safe((s) => s.getItem(k), null), set: (k, v) => safe((s) => s.setItem(k, v)), remove: (k) => safe((s) => s.removeItem(k)) };
}

/** JSON values over an adapter, with change subscriptions per key (the same tab only; cross-tab changes arrive through `refresh`). */
export function createStorage(adapter) {
  const subs = new Map();
  const cache = new Map();
  const read = (key, fallback) => {
    if (cache.has(key)) return cache.get(key);
    let v = fallback;
    try { const raw = adapter.get(key); if (raw != null) v = JSON.parse(raw); } catch { /* corrupt value: start empty */ }
    cache.set(key, v);
    return v;
  };
  const emit = (key) => subs.get(key)?.forEach((f) => f());
  return {
    /** The same object is returned until the value changes, so it is a stable snapshot for useSyncExternalStore. */
    get: read,
    set(key, value) { cache.set(key, value); try { adapter.set(key, JSON.stringify(value)); } catch { /* persistence only */ } emit(key); },
    remove(key) { cache.delete(key); try { adapter.remove(key); } catch { /* ignore */ } emit(key); },
    subscribe(key, fn) { if (!subs.has(key)) subs.set(key, new Set()); subs.get(key).add(fn); return () => subs.get(key)?.delete(fn); },
    /** Drop the cached copy and re-read (a `storage` event from another tab). */
    refresh(key) { cache.delete(key); emit(key); },
  };
}

// ---- pure list helpers (saved items) -------------------------------------------------------------------------------------------------------------

/** Toggle `key` in a list of strings; returns the new list and whether the key is now saved. */
export function toggleKey(list, key) {
  const i = list.indexOf(key);
  return i >= 0 ? { list: list.filter((k) => k !== key), on: false } : { list: [...list, key], on: true };
}

/** Most-recent-first list without duplicates, capped. */
export function pushRecent(list, key, max = 12) {
  return [key, ...list.filter((k) => k !== key)].slice(0, max);
}

/**
 * A saved filter combination: a name and the URL query that restores it (`?stat=runs&win=l5`). Same name replaces the old one;
 * empty queries are not saved. The query is plain text, so it also works as a shareable link.
 */
export function saveCombo(list, name, query, max = 20) {
  const n = String(name || "").trim().slice(0, 40), q = String(query || "").replace(/^\?/, "");
  if (!n || !q) return list;
  return [{ name: n, query: q, at: Date.now() }, ...list.filter((c) => c.name !== n)].slice(0, max);
}

export const removeCombo = (list, name) => list.filter((c) => c.name !== name);
