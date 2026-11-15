import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/text";
import { LiveDot } from "@/ui/motion";
import { cap, color, font, space, type } from "@/ui/tokens";

export type StatusTone = "live" | "inPlay" | "session" | "muted";
export type StatusSurface = "plain" | "pill" | "dot";

/**
 * Match / row status marks — twin of web `StatusLabel`.
 * live + pill → white on miss (scoreboard); plain / dot / inPlay → miss caption; session → amber; muted → Final / Started / ….
 */
export function StatusLabel({
  tone = "muted",
  surface = "plain",
  children,
}: {
  tone?: StatusTone;
  surface?: StatusSurface;
  children?: ReactNode;
}) {
  const label = children ?? (tone === "live" ? (surface === "pill" ? "LIVE" : "Live") : tone === "inPlay" ? "In Play Market" : null);
  if (surface === "pill") {
    const bg = tone === "live" ? color.miss : tone === "session" ? "rgba(255, 184, 0, 0.2)" : color.secondary;
    const fg = tone === "live" ? "#fff" : tone === "session" ? color.amber : color["muted-foreground"];
    return (
      <View style={[styles.pill, { backgroundColor: bg }]} accessibilityRole="text">
        <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
      </View>
    );
  }
  if (tone === "live" && surface === "dot") {
    return (
      <View style={styles.dotRow} accessibilityRole="text">
        <LiveDot />
        <Text style={[styles.plain, { color: color.miss }]}>{label}</Text>
      </View>
    );
  }
  const fg = tone === "live" || tone === "inPlay" ? color.miss : tone === "session" ? color.amber : color["muted-foreground"];
  return <Text style={[styles.plain, { color: fg }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  pill: { borderRadius: 999, paddingHorizontal: space.snug, paddingVertical: 2 },
  pillText: { ...cap, fontFamily: font.bold, fontSize: 11 },
  plain: { ...cap, fontFamily: font.bold, fontSize: 11 },
  dotRow: { flexDirection: "row", alignItems: "center", gap: space.tight },
});
