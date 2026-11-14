/** True when the store's name slot is only the eight-hex player id (no scorecard spelling yet). */
export const isHexPlayerId = (s) => /^[0-9a-f]{8}$/.test(String(s || ""));

/**
 * Label to show for a player when `raw` may be an eight-hex id.
 * Prefer the book's spelling, then the source full name (`names.json` / catalog), else the raw value.
 */
export function resolvePlayerLabel(raw, { bookName, catalogName } = {}) {
  if (!isHexPlayerId(raw)) return String(raw || "");
  if (bookName && !isHexPlayerId(bookName)) return bookName;
  if (catalogName) return catalogName;
  return String(raw || "");
}
