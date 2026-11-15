/* eslint-disable @typescript-eslint/no-explicit-any */
import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/text";
import { trackOf } from "@/lib/live-track";
import { StatusLabel } from "@/ui/status-label";
import { StandingMark, type Standing } from "@/ui/tick";
import { color, num, space, type } from "@/ui/tokens";

// The in-play marks of a row, as the site's `live-spot.tsx` / StatusLabel draws them.

/** Plain "Live" caption. Match-live belongs on fixtures; prop rows do not use this. */
export function LiveBadge() {
  return <StatusLabel tone="live" surface="plain" />;
}

/** Line and odds are in-play ("In Play Market"). */
export function InPlayBadge() {
  return <StatusLabel tone="inPlay" surface="plain" />;
}

/** Where the line stood before the match; nothing when it has not moved. Scan rows use `Opened at`. */
export function LiveOpened({ opened, line, label = "was" }: { opened?: number | null; line?: number | null; label?: string }) {
  if (opened == null || line == null || opened === line) return null;
  return <Text style={styles.was}>{label} {opened}</Text>;
}

/** A live line as a bar: the score against the line, a notch where it opened. */
export function LiveTrack({ value, line, was, verdict }: { value?: number | null; line?: number | null; was?: number | null; verdict?: "cleared" | "missed" | "push" | null }) {
  const t = trackOf(value, line, was, verdict);
  if (!t) return null;
  const tone = t.tone === "miss" ? color.miss : t.tone === "primary" ? color.primary : color["text-soft"];
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`${value} of ${line}${was != null && was !== line ? `, was ${was}` : ""}`} style={styles.track}>
      <View style={[styles.fill, { width: `${t.fill}%`, backgroundColor: tone }]} />
      {t.lineAt != null ? <View style={[styles.notch, { left: `${t.lineAt}%`, backgroundColor: color.background }]} /> : null}
      {t.wasAt != null ? <View style={[styles.notch, styles.was2, { left: `${t.wasAt}%`, backgroundColor: color["muted-foreground"] }]} /> : null}
    </View>
  );
}

/** Under a live row: VOID or "Score unavailable". Hit/Miss stamp covers settled; no “N so far” copy on prop/fancy rows. */
export function LineProgress({ standing, live, line }: { standing: Standing | null | undefined; live: boolean; line: number; opened?: number | null }) {
  if (!standing || (standing.v == null && standing.state !== "void")) return live ? <Text style={styles.none}>Score unavailable</Text> : null;
  if (standing.state === "void") return <StandingMark standing={standing} line={line} />;
  return null;
}

const styles = StyleSheet.create({
  was: { ...type.footnote, ...num, color: color["muted-foreground"] },
  none: { ...type.footnote, color: color["muted-foreground"] },
  track: { height: 6, borderRadius: 3, backgroundColor: color.secondary, alignSelf: "stretch", overflow: "visible" },
  fill: { position: "absolute", top: 0, bottom: 0, left: 0, borderRadius: 3 },
  notch: { position: "absolute", top: -1, bottom: -1, width: 2, borderRadius: 1 },
  was2: { top: -2, bottom: -2 },
});
