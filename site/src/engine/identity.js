// The player-identity table (data/identity.json, built by src/cricket_site/identity.py): our id <-> the live source's own id, and the names the books use.
// Pure: no fetch, no DOM. The live lookups (live.js) read ids from here and fall back to names only for a player the table does not know.
//   { v: 1, s: { "<our id>": "<source id>" }, b: { "<our id>": ["<name the books use>"] } }

/** Lookups over the table; every one is safe on a missing or empty table (nothing is linked, so names decide as they used to). */
export function identityIndex(doc) {
  const s = doc?.s || {}, b = doc?.b || {};
  const owner = new Map(Object.entries(s).map(([pid, sid]) => [sid, pid]));
  return {
    sourceOf: (pid) => (pid && s[pid]) || "",
    pidOf: (sid) => (sid && owner.get(sid)) || "",
    isLinked: (sid) => !!sid && owner.has(sid),
    bookNames: (pid) => (pid && b[pid]) || [],
    size: owner.size,
  };
}

export const NO_IDENTITY = identityIndex(null);
