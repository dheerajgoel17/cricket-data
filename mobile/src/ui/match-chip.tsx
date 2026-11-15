import { useEffect } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { AnimatedText, Text } from "@/ui/text";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { abbr } from "@site/lib/format";
import { dayLabel, localTime } from "@/lib/format";
import { fixtureStart } from "@/lib/rail";
import { TeamBadge } from "@/ui/team-badge";
import { color, control, font, radius, space, tint, type } from "@/ui/tokens";

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

type Tag = { text: string; session: boolean };

/** Home Props fixture hashtags: overlapping crests + `ABR v ABR`, then the start time or, once the match is on, a Live / session tag (the site's `MatchChip`). The chosen chip is the accent fill. */
export function MatchChips({ items, value, onChange, tags, all }: { items: Fx[]; value: string; onChange: (id: string) => void; tags?: Record<string, Tag>; /** Lead with an "All" chip whose id is `all` (the Player props match filter). */ all?: boolean }) {
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
      {all ? <AllChip on={value === "all"} onPress={() => { if (value !== "all") { void tick(); onChange("all"); } }} /> : null}
      {items.map((f) => (
        <MatchChip key={f.id} f={f} tag={tags?.[f.id]} on={f.id === value} onPress={() => { if (f.id !== value) { void tick(); onChange(f.id); } }} />
      ))}
    </ScrollView>
  );
}

function AllChip({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Press accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel="All matches" onPress={onPress} scale={0.97} style={[styles.chip, styles.allChip, { backgroundColor: on ? color.primary : color.card }]}>
      <Text style={[styles.allText, { color: on ? color["primary-foreground"] : color.foreground }]}>All</Text>
    </Press>
  );
}

function MatchChip({ f, on, onPress, tag }: { f: Fx; on: boolean; onPress: () => void; tag?: Tag }) {
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => { p.value = withTiming(on ? 1 : 0, { duration: 150 }); }, [on, p]);
  const box = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], [color.card, color.primary]) }));
  const title = useAnimatedStyle(() => ({ color: interpolateColor(p.value, [0, 1], [color.foreground, color["primary-foreground"]]) }));
  const sub = useAnimatedStyle(() => ({ color: interpolateColor(p.value, [0, 1], [color["muted-foreground"], "rgba(15,15,15,0.7)"]) }));
  return (
    <Press accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${f.a} v ${f.b}${tag ? `, ${tag.text}` : ""}`} onPress={onPress} scale={0.97}>
      <Animated.View style={[styles.chip, box]}>
        <Crests a={f.a} b={f.b} />
        <View style={styles.text}>
          <AnimatedText style={[styles.title, title]} numberOfLines={1}>{abbr(f.a)} v {abbr(f.b)}</AnimatedText>
          {tag
            ? <View style={[styles.tag, tag.session ? styles.tagSession : styles.tagLive]}><Text style={[styles.tagText, { color: tag.session ? color.foreground : on ? color["primary-foreground"] : color.destructive }]} numberOfLines={1}>{tag.text}</Text></View>
            : <AnimatedText style={[styles.sub, sub]} numberOfLines={1}>{subOf(f)}</AnimatedText>}
        </View>
      </Animated.View>
    </Press>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.tight, paddingHorizontal: space.gutter, paddingVertical: space.snug },
  chip: { minHeight: control + 8, paddingHorizontal: space.snug, paddingVertical: 6, borderRadius: radius.chip, flexDirection: "row", alignItems: "center", gap: space.tight },
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
  title: { ...type.caption, fontFamily: font.medium },
  sub: { ...type.caption },
  tag: { alignSelf: "flex-start", borderRadius: radius.chip, paddingHorizontal: space.tight },
  tagLive: { backgroundColor: tint.destructive(0.2) },
  tagSession: { backgroundColor: color.secondary },
  tagText: { ...type.caption, fontFamily: font.medium },
  allChip: { paddingHorizontal: space.stack, justifyContent: "center" },
  allText: { ...type.callout, fontFamily: font.medium },
});
