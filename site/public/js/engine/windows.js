// Hit rate per look-back window (L5, L10, ...) over a player's chart entries: the numbers behind the range pills.
// Entries are oldest -> newest; `value == null` is a DNP / VOID / N-A fixture, which never counts in a hit rate.

export const WINDOWS = [5, 10, 20, 30, 0]; // 0 = every fixture

const hit = (v, line, side) => (side === "under" ? v < line : v > line);

/** One window: how many fixtures it spans, how many were played, hits and the hit rate (null when nothing was played). */
export function windowRate(entries, n, line, side = "over") {
  const slice = n ? entries.slice(-n) : entries;
  const played = slice.filter((e) => e.value != null);
  const hits = played.filter((e) => hit(e.value, line, side)).length;
  const mean = played.length ? played.reduce((a, e) => a + e.value, 0) / played.length : null;
  return { n, label: n ? `L${n}` : "All", fixtures: slice.length, played: played.length, hits, p: played.length ? hits / played.length : null, mean };
}

/** All windows that fit the data (a window larger than the history is dropped, "All" always stays). */
export function windowRates(entries, line, side = "over", sizes = WINDOWS) {
  return sizes.filter((n) => n === 0 || n <= entries.length).map((n) => windowRate(entries, n, line, side));
}

/** Per-fixture result for colouring a bar: "hit", "miss", "push" (exactly on the line) or the reason it has no value. */
export function barState(e, line, side = "over") {
  if (e.value == null) return e.void ? "void" : e.unknown ? "na" : "dnp";
  if (e.value === line) return "push";
  return hit(e.value, line, side) ? "hit" : "miss";
}
