/** The competitions a search text names, as event indices. The Resolver's `event()` answers `{ idx: number[], name }` (or null when nothing matches); an older shape was a bare array. Never throws. */
export function leaguesOf(rz: { event?: (text: string) => unknown }, text: string, limit = 4): number[] {
  const e = rz.event?.(text) as { idx?: unknown } | unknown[] | null | undefined;
  const idx = Array.isArray(e) ? e : e && typeof e === "object" ? (e as { idx?: unknown }).idx : undefined;
  return Array.isArray(idx) ? (idx as number[]).slice(0, limit) : [];
}
