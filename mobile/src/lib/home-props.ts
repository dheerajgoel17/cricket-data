/* eslint-disable @typescript-eslint/no-explicit-any */
// Which prop rows the Home teaser lists. The Player props tab keeps every row of the day for the book's 24-hour window; Home is for what is current: rows still to be decided come
// first, and a line that has resulted stays only until 6 hours after its match is expected to have finished, filling a slot only when no undecided line is left to take it.

/** Hours after the expected end of its match that a resulted line stays on Home. */
export const RESULTED_KEEP_MS = 6 * 3600e3;

/** How long a match lasts from its start, rounded up (a Test's line is priced day by day, so a Test is one day's play). */
const LENGTH_MS: Record<string, number> = { T10: 3 * 3600e3, T20: 4 * 3600e3, Hundred: 4 * 3600e3, ODI: 8 * 3600e3, O60: 8 * 3600e3, Test: 9 * 3600e3, FC: 9 * 3600e3 };
const DEFAULT_LENGTH_MS = 4 * 3600e3;

/** When the match of this row is expected to be over. */
export const expectedEnd = (r: { start: string; fmt: string }) => Date.parse(r.start) + (LENGTH_MS[r.fmt] ?? DEFAULT_LENGTH_MS);

/**
 * `rows` are already in Home order. Undecided rows keep their order and come first; resulted rows (`standing.state === "final"`) follow, in their order, and only while
 * their match ended less than 6 hours ago. `standingOf` is the page's `soFarOf`.
 */
export function homeProps<T extends { start: string; fmt: string }>(rows: T[], standingOf: (r: T) => { state?: string } | null, now = Date.now(), limit = 4): T[] {
  const pending: T[] = [], resulted: T[] = [];
  for (const r of rows) {
    if (standingOf(r)?.state !== "final") pending.push(r);
    else if (now < expectedEnd(r) + RESULTED_KEEP_MS) resulted.push(r);
  }
  return pending.concat(resulted).slice(0, limit);
}
