// Bookmaker marks in site/public/books. One stem per file; feed names vary (case, "Premium"/"Fancy", compound ids like moviodds_bet365).

/** Stem → display name. Keys match the files in public/books (minus extension). */
export const BOOK_STEMS = {
  bet365: "bet365",
  ladbrokes: "Ladbrokes",
  leovegas: "LeoVegas",
  fairwin247: "FairWin247",
  reddybook: "Reddybook",
  polymarket: "Polymarket",
  dafabet: "Dafabet",
};

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
  const stems = Object.keys(BOOK_STEMS).sort((a, b) => b.length - a.length);
  for (const s of stems) {
    if (compact === s || compact.includes(s) || raw === s || raw.includes(s)) return s;
  }
  return "";
}

/** Display name for a feed source, falling back to the raw string when unknown. */
export function bookDisplayName(source) {
  const stem = bookLogoStem(source);
  if (stem) {
    const v = bookVariant(source);
    return v ? `${BOOK_STEMS[stem]} ${v}` : BOOK_STEMS[stem];
  }
  return String(source || "");
}
