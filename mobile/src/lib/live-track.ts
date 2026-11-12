/**
 * The geometry of a live bar: what has been scored against the line, with a notch where the line stood before the match. Green once the batter is past the pre-match line (or the live line), neutral
 * before; past the live line the bar runs on to the score and a second notch marks the line. Null when there is nothing to draw (no score yet, or no line).
 */
export function trackOf(value?: number | null, line?: number | null, was?: number | null, verdict?: "cleared" | "missed" | "push" | null) {
  if (value == null || line == null || !(line > 0) || value < 0) return null;
  const scale = Math.max(line, value), pct = (n: number) => Math.min(100, Math.round((n / scale) * 1000) / 10);
  const tone = verdict === "missed" ? "miss" : verdict === "cleared" || value > line || (was != null && value > was) ? "primary" : "neutral";
  return {
    fill: pct(value), tone: tone as "miss" | "primary" | "neutral",
    lineAt: value > line ? pct(line) : null,
    wasAt: was != null && was !== line && was > 0 && was < scale ? pct(was) : null,
  };
}
