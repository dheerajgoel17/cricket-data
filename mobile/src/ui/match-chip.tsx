import { useEffect } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { AnimatedText } from "@/ui/text";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { abbr } from "@site/lib/format";
import { dayLabel, localTime } from "@/lib/format";
import { fixtureStart } from "@/lib/rail";
import { TeamBadge } from "@/ui/team-badge";
import { color, control, font, radius, space, type } from "@/ui/tokens";

type Fx = { id: string; a: string; b: string; fmt?: string; start?: string };

const CREST = 20;

/** One ring, bare crest inside (full logo, no nested badge circle) — same idea as shadcn Avatar + AvatarImage. */
function Crests({ a, b }: { a: string; b: string }) {
  return (
    <View style={styles.group}>
      <View style={[styles.ring, { zIndex: 1 }]}><TeamBadge name={a} size={CREST} bare /></View>
      <View style={[styles.ring, styles.overlap, { zIndex: 0 }]}><TeamBadge name={b} size={CREST} bare /></View>
    </View>
  );
}

function subOf(f: Fx) {
  if (!f.start) return f.fmt || "";
  const when = fixtureStart(f as { start: string });
  return String(f.start).length > 10 ? localTime(when) : dayLabel(when);
}

async function tick() {
  if (Platform.OS === "web") return;
  try { await Haptics.selectionAsync(); } catch { /* no vibrator */ }
}

/** Home Props fixture hashtags: overlapping crests + `ABR v ABR` (site MatchChip), tuned for iOS snap / Android clip. */
export function MatchChips({ items, value, onChange }: { items: Fx[]; value: string; onChange: (id: string) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
      decelerationRate={Platform.OS === "ios" ? "fast" : 0.9}
      removeClippedSubviews={Platform.OS === "android"}
      overScrollMode={Platform.OS === "android" ? "never" : undefined}
    >
      {items.map((f) => (
        <MatchChip key={f.id} f={f} on={f.id === value} onPress={() => { if (f.id !== value) { void tick(); onChange(f.id); } }} />
      ))}
    </ScrollView>
  );
}

function MatchChip({ f, on, onPress }: { f: Fx; on: boolean; onPress: () => void }) {
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => { p.value = withTiming(on ? 1 : 0, { duration: Platform.OS === "android" ? 140 : 200 }); }, [on, p]);
  const box = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], [color.card, color.foreground]) }));
  const title = useAnimatedStyle(() => ({ color: interpolateColor(p.value, [0, 1], [color.foreground, color.background]) }));
  const sub = useAnimatedStyle(() => ({ color: interpolateColor(p.value, [0, 1], [color["muted-foreground"], "rgba(0,0,0,0.55)"]) }));
  return (
    <Press accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${f.a} v ${f.b}`} onPress={onPress} scale={0.98}>
      <Animated.View style={[styles.chip, box]}>
        <Crests a={f.a} b={f.b} />
        <View style={styles.text}>
          <AnimatedText style={[styles.title, title]} numberOfLines={1}>{abbr(f.a)} v {abbr(f.b)}</AnimatedText>
          <AnimatedText style={[styles.sub, sub]} numberOfLines={1}>{subOf(f)}</AnimatedText>
        </View>
      </Animated.View>
    </Press>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.tight, paddingHorizontal: space.gutter, paddingVertical: space.snug },
  chip: { minHeight: control + 4, paddingHorizontal: space.snug, paddingVertical: 6, borderRadius: radius.chip, flexDirection: "row", alignItems: "center", gap: space.tight },
  group: { flexDirection: "row", alignItems: "center", width: CREST * 2 - 6 },
  ring: {
    width: CREST + 4,
    height: CREST + 4,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: color.background,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.secondary,
    overflow: "hidden",
  },
  overlap: { marginLeft: -10 },
  text: { minWidth: 0, gap: 1 },
  title: { ...type.caption, fontFamily: font.medium, fontSize: 12 },
  sub: { ...type.caption, fontSize: 10 },
});
