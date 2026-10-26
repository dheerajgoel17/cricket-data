// Session view state: filters, tabs and searches survive in-app navigation.
// A shared link (any query param) wins over what this browser last used.
const KEY = "cph-view";
const MAX = 40;

export function hasQuery(q) {
  return !!q && Object.entries(q).some(([, v]) => v != null && v !== "");
}

export function cleanQuery(q) {
  const out = {};
  for (const [k, v] of Object.entries(q || {})) if (v != null && v !== "") out[k] = String(v);
  return out;
}

/** URL params win as a set. An empty URL adopts the saved query for that screen. */
export function adoptQuery(urlQuery, saved) {
  if (hasQuery(urlQuery)) return { ...urlQuery };
  if (saved && hasQuery(saved)) return { ...saved };
  return { ...(urlQuery || {}) };
}

export function remember(state, scope, query) {
  const order = (state?.order || []).filter((s) => s !== scope);
  order.push(scope);
  const next = { ...(state || {}), [scope]: cleanQuery(query), order };
  while (order.length > MAX) {
    const old = order.shift();
    delete next[old];
  }
  next.order = order;
  return next;
}

/** Which screen a route belongs to. Null means "do not restore" (ask, about, tools). */
export function scopeFor(name, args = []) {
  const n = name === "fixtures" ? "" : (name || "");
  if (n === "") return "home";
  if (n === "players" || n === "teams" || n === "competitions" || n === "trends" || n === "pair") return n;
  if ((n === "player" || n === "team" || n === "venue" || n === "league") && args[0] != null && args[0] !== "") return `${n}:${args[0]}`;
  if (n === "fixture" && args.length) return `fixture:${args.join("/")}`;
  return null;
}

export function queryString(q) {
  return new URLSearchParams(cleanQuery(q)).toString();
}

export function hashFor(name, args, q) {
  const path = [name, ...(args || [])].filter((x) => x != null && x !== "").join("/");
  const qs = queryString(q);
  return `#/${path}${qs ? `?${qs}` : ""}`;
}

export function readView(storage) {
  if (!storage) return {};
  try { return JSON.parse(storage.getItem(KEY) || "{}") || {}; } catch { return {}; }
}

export function writeView(storage, state) {
  if (!storage) return;
  try { storage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}
