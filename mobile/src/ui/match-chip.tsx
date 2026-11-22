import { useChoice } from "@/lib/use-choice";
import { HScroll } from "@/ui/h-scroll";
import { Platform, StyleSheet, View } from "react-native";
import { chipFillTransition, chipTextTransition } from "@/ui/chips";
import { Press } from "@/ui/press";
import { AnimatedText, Text } from "@/ui/text";
import Animated, { useReducedMotion } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { abbr } from "@site/lib/format";
import { dayLabel, localTime } from "@/lib/format";
import { fixtureStart } from "@/lib/rail";
import { TeamBadge } from "@/ui/team-badge";
import { color, control, radius, space, tint, type, t } from "@/ui/tokens";

type Fx = { id: string; a: string; b: string; fmt?: string; start?: string };

const CREST = 20;

/** One ring, bare crest inside (full logo, no nested badge circle) — same idea as shadcn Avatar + AvatarImage. */
function Crests({ a, b }: { a: string; b: string }) {
  return (
    <View style={styles.group}>
      <View style={[styles.ring, { zIndex: 1 }]}><TeamBadge name={a} size={CREST} /></View>
      <View style={[styles.ring, styles.overlap, { zIndex: 0 }]}><TeamBadge name={b} size={CREST} /></View>
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
const SUB_ON = tint.hex(color["primary-foreground"], 0.7);

export function MatchChips({ items, value: valueProp, onChange: onChangeProp, tags, all }: { items: Fx[]; value: string; onChange: (id: string) => void; tags?: Record<string, Tag>; /** Lead with an "All" chip whose id is `all` (the Player props match filter). */ all?: boolean }) {
  const [value, onChange] = useChoice(valueProp, onChangeProp);
  const calm = useReducedMotion();
  return (
    <HScroll
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
      decelerationRate={Platform.OS === "ios" ? "fast" : 0.9}
      removeClippedSubviews={Platform.OS === "android"}
      overScrollMode={Platform.OS === "android" ? "never" : undefined}
    >
      {all ? <AllChip calm={calm} on={value === "all"} onPress={() => { if (value !== "all") { void tick(); onChange("all"); } }} /> : null}
      {items.map((f) => (
        <MatchChip key={f.id} calm={calm} f={f} tag={tags?.[f.id]} on={f.id === value} onPress={() => { if (f.id !== value) { void tick(); onChange(f.id); } }} />
      ))}
    </HScroll>
  );
}

function AllChip({ on, onPress, calm }: { on: boolean; onPress: () => void; calm: boolean }) {
  return (
    <Press accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel="All matches" onPress={onPress}>
      <Animated.View style={[styles.chip, styles.allChip, { backgroundColor: on ? color.primary : color.card }, !calm && chipFillTransition]}>
        <AnimatedText style={[styles.allText, { color: on ? color["primary-foreground"] : color.foreground }, !calm && chipTextTransition]}>All</AnimatedText>
      </Animated.View>
    </Press>
  );
}

function MatchChip({ f, on, onPress, tag, calm }: { f: Fx; on: boolean; onPress: () => void; tag?: Tag; calm: boolean }) {
  return (
    <Press accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${f.a} v ${f.b}${tag ? `, ${tag.text}` : ""}`} onPress={onPress} scale={0.97}>
      <Animated.View style={[styles.chip, { backgroundColor: on ? color.primary : color.card }, !calm && chipFillTransition]}>
        <Crests a={f.a} b={f.b} />
        <View style={styles.text}>
          <AnimatedText style={[styles.title, { color: on ? color["primary-foreground"] : color.foreground }, !calm && chipTextTransition]} numberOfLines={1}>{abbr(f.a)} v {abbr(f.b)}</AnimatedText>
          {tag
            ? <View style={[styles.tag, tag.session ? styles.tagSession : styles.tagLive]}><Text style={[styles.tagText, { color: tag.session ? color.foreground : on ? color["primary-foreground"] : color.destructive }]} numberOfLines={1}>{tag.text}</Text></View>
            : <AnimatedText style={[styles.sub, { color: on ? SUB_ON : color["muted-foreground"] }, !calm && chipTextTransition]} numberOfLines={1}>{subOf(f)}</AnimatedText>}
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
  title: { ...t.captionLabel },
  sub: { ...type.caption },
  tag: { alignSelf: "flex-start", borderRadius: radius.chip, paddingHorizontal: space.tight },
  tagLive: { backgroundColor: tint.destructive(0.2) },
  tagSession: { backgroundColor: color.secondary },
  tagText: { ...t.captionLabel },
  allChip: { paddingHorizontal: space.stack, justifyContent: "center" },
  allText: { ...t.calloutLabel },
});
