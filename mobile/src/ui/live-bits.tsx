/* eslint-disable @typescript-eslint/no-explicit-any */
import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/text";
import { trackOf } from "@/lib/live-track";
import { StandingMark, type Standing } from "@/ui/tick";
import { cap, color, num, space, type } from "@/ui/tokens";

// The in-play marks of a row, as the site's `live-spot.tsx` draws them.

/** The small red mark of a row whose line is a live price: it sits beside the row's name, never on the line. */
export function LiveBadge() {
  return <Text style={styles.badge}>Live</Text>;
}

/** Where the line stood before the match ("was 31.5"); nothing when it has not moved. */
export function LiveOpened({ opened, line }: { opened?: number | null; line?: number | null }) {
  if (opened == null || line == null || opened === line) return null;
  return <Text style={styles.was}>was {opened}</Text>;
}

/** A live line as a bar: the score against the line, a notch where it opened. */
export function LiveTrack({ value, line, was, verdict }: { value?: number | null; line?: number | null; was?: number | null; verdict?: "cleared" | "missed" | "push" | null }) {
  const t = trackOf(value, line, was, verdict);
  if (!t) return null;
  const tone = t.tone === "miss" ? color.miss : t.tone === "primary" ? color.primary : "rgba(255,255,255,0.7)";
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`${value} of ${line}${was != null && was !== line ? `, was ${was}` : ""}`} style={styles.track}>
      <View style={[styles.fill, { width: `${t.fill}%`, backgroundColor: tone }]} />
      {t.lineAt != null ? <View style={[styles.notch, { left: `${t.lineAt}%`, backgroundColor: color.background }]} /> : null}
      {t.wasAt != null ? <View style={[styles.notch, styles.was2, { left: `${t.wasAt}%`, backgroundColor: color["muted-foreground"] }]} /> : null}
    </View>
  );
}

/** Under a live row: the bar and the so-far words; "Score unavailable" while the match is on and the feed has no figure for it. */
export function LineProgress({ standing, live, line, opened }: { standing: Standing | null | undefined; live: boolean; line: number; opened?: number | null }) {
  if (!standing || (standing.v == null && standing.state !== "void")) return live ? <Text style={styles.none}>Score unavailable</Text> : null;
  return (
    <View style={styles.progress}>
      {standing.state === "live" ? <LiveTrack value={standing.v} line={line} was={opened} verdict={standing.verdict} /> : null}
      <StandingMark standing={standing} line={line} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { ...cap, fontFamily: num.fontFamily, fontSize: 11, color: color.miss },
  was: { ...type.footnote, ...num, color: color["muted-foreground"] },
  none: { ...type.footnote, color: color["muted-foreground"] },
  progress: { gap: 4, alignItems: "flex-start", alignSelf: "stretch" },
  track: { height: 6, borderRadius: 3, backgroundColor: color.secondary, alignSelf: "stretch", overflow: "visible" },
  fill: { position: "absolute", top: 0, bottom: 0, left: 0, borderRadius: 3 },
  notch: { position: "absolute", top: -1, bottom: -1, width: 2, borderRadius: 1 },
  was2: { top: -2, bottom: -2 },
});
