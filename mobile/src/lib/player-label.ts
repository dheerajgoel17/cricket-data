import { resolvePlayerLabel } from "@cricket/engine/player-label.js";

/** Display name for a store player index: book spelling → names.json → scorecard / id. */
export function playerLabel(store: any, names: Record<string, string> | undefined | null, idx: number, bookName?: string) {
  const pid = store?.P?.id?.[idx];
  return resolvePlayerLabel(store?.playerName?.(idx) ?? "", { bookName, catalogName: pid != null ? names?.[pid] : undefined });
}
