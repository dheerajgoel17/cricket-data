/**
 * Order Hot props shard groups so lines from matches that have already started
 * (in play / Started) are scored before later kickoffs. Pure; tested without the store.
 */
export function prioritizeHotGroups<T extends { lines: { start_utc?: string }[] }>(
  groups: T[],
  now = Date.now(),
): T[] {
  const started = (l: { start_utc?: string }) => {
    const t = Date.parse(String(l.start_utc || ""));
    return Number.isFinite(t) && t <= now ? 1 : 0;
  };
  return groups
    .map((g) => ({
      ...g,
      lines: [...g.lines].sort((a, b) => started(b) - started(a) || Date.parse(String(a.start_utc || "")) - Date.parse(String(b.start_utc || ""))),
    }))
    .sort((a, b) => {
      const aN = a.lines.reduce((n, l) => n + started(l), 0);
      const bN = b.lines.reduce((n, l) => n + started(l), 0);
      return bN - aN || b.lines.length - a.lines.length;
    });
}

/** Publish as soon as the first scored row lands, then drip every `everyMs`. */
export const HOT_FIRST_PUBLISH = 1;
export const HOT_PUBLISH_MS = 350;
/** After the first paint, score this many shards at once; before that, one shard so the first row is not starved. */
export const HOT_SHARDS_AFTER_PAINT = 8;

export function shouldPublishHot(outLen: number, publishedAt: number, now = Date.now(), first = HOT_FIRST_PUBLISH, everyMs = HOT_PUBLISH_MS): boolean {
  if (outLen < first) return false;
  if (!publishedAt) return true;
  return now - publishedAt >= everyMs;
}
