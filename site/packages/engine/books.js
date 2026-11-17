// Bookmaker marks in site/public/books. One stem per file; feed names vary (case, "Premium"/"Fancy", compound ids like moviodds_bet365).
// The list of books and their files is DATA, not code: public/books/books.json ({ stem: { name, file } }), which the site and the apps fetch at run time and hand to
// `setBookManifest`, so a new book's logo shows in an app that was installed before the book existed. The table below is only the built-in fallback (offline, first
// launch, a failed fetch); add new books to books.json, not here.

/** Stem → display name. Keys match the files in public/books (minus extension). */
export const BOOK_STEMS = {
  bet365: "bet365",
  ladbrokes: "Ladbrokes",
  leovegas: "LeoVegas",
  fairwin247: "FairWin247",
  reddybook: "Reddybook",
  polymarket: "Polymarket",
  dafabet: "Dafabet",
  "1xbet": "1xBet",
  bcgame: "bc.game",
};
const BUILTIN_FILES = { bet365: "bet365.svg", ladbrokes: "ladbrokes.svg", polymarket: "polymarket.svg", "1xbet": "1xbet.svg" };

let stems = { ...BOOK_STEMS };
let files = {};
let version = 0;
const listeners = new Set();

/** Merge the published books.json over the built-in table. Ignores anything that is not `{ stem: { name, file } }` with a plain file name; returns whether anything changed. */
export function setBookManifest(manifest) {
  if (!manifest || typeof manifest !== "object") return false;
  let changed = false;
  for (const [stem, v] of Object.entries(manifest)) {
    if (!/^[a-z0-9]+$/.test(stem) || !v || typeof v.name !== "string" || !v.name.trim() || typeof v.file !== "string" || !/^[\w.-]+\.(svg|png|jpg|webp)$/i.test(v.file)) continue;
    if (stems[stem] !== v.name.trim() || files[stem] !== v.file) { stems[stem] = v.name.trim(); files[stem] = v.file; changed = true; }
  }
  if (changed) { version++; for (const cb of listeners) cb(); }
  return changed;
}

/** For `useSyncExternalStore`: badges re-render when the manifest arrives. */
export const subscribeBooks = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };
export const bookVersion = () => version;

/** The logo file name for a stem ("bcgame.png"), from the manifest, else the built-in table, else the png the books folder has always used. */
export const bookLogoFile = (stem) => (stem ? files[stem] || BUILTIN_FILES[stem] || (stems[stem] ? `${stem}.png` : "") : "");

const VARIANT = /^(.*\S)\s+(Premium|Fancy)$/i;

/** Premium / Fancy suffix, if the feed published one. */
export function bookVariant(source) {
  return VARIANT.exec(String(source || ""))?.[2] ?? "";
}

/**
 * File stem for a book's mark: "bet365", "ladbrokes", … or "" when we have no file.
 * Accepts the names feeds publish: "Ladbrokes", "LeoVegas", "FairWin247 Premium", "moviodds_bet365", "feedx_ladbrokes".
 */
export function bookLogoStem(source) {
  const raw = String(source || "").replace(VARIANT, "$1").trim().toLowerCase();
  if (!raw) return "";
  const compact = raw.replace(/[^a-z0-9]+/g, "");
  // longest stem first so fairwin247 wins over a shorter accidental match
  const order = Object.keys(stems).sort((a, b) => b.length - a.length);
  for (const s of order) {
    if (compact === s || compact.includes(s) || raw === s || raw.includes(s)) return s;
  }
  return "";
}

/** Display name for a feed source, falling back to the raw string when unknown. */
export function bookDisplayName(source) {
  const stem = bookLogoStem(source);
  if (stem) {
    const v = bookVariant(source);
    return v ? `${stems[stem]} ${v}` : stems[stem];
  }
  return String(source || "");
}
