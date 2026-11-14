import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import Animated, { Easing, cancelAnimation, makeMutable, useAnimatedStyle, withRepeat, withTiming } from "react-native-reanimated";
import { color, radius, space } from "@/ui/tokens";

/**
 * Page-shaped loading placeholders. Each matches the real layout (prop rows, fancy cards,
 * match header, player hero, grid, …) so the screen does not jump when data arrives.
 */

// One value drives every placeholder on screen, so twenty skeleton rows are one animation, not twenty.
const beat = makeMutable(0);
let watching = 0;
function useBeat() {
  useEffect(() => {
    if (watching++ === 0) beat.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false);
    return () => { if (--watching === 0) cancelAnimation(beat); };
  }, []);
}

/** A grey block with a light that sweeps across it while what it stands for is loading. */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  useBeat();
  const [w, setW] = useState(0);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: -w + 2 * w * beat.value }] }));
  return (
    <View style={[styles.block, style, styles.clip]} onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
      {w ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, sweep]}>
          <Svg width="100%" height="100%">
            <Defs><LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#fff" stopOpacity="0" /><Stop offset="0.5" stopColor="#fff" stopOpacity="0.09" /><Stop offset="1" stopColor="#fff" stopOpacity="0" /></LinearGradient></Defs>
            <Rect width="100%" height="100%" fill="url(#sheen)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

const W1 = ["46%", "38%", "54%", "42%", "50%"] as const;
const W2 = ["72%", "64%", "78%", "68%", "60%"] as const;

/** Props / hot list: photo, name, line, edge — same chrome as PropRow. */
export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="skeleton-rows">
      {Array.from({ length: rows }, (_, k) => (
        <View key={k} style={[styles.skRow, k > 0 && styles.skSep, { opacity: Math.max(0.45, 1 - k * 0.14) }]}>
          <Skeleton style={styles.skAvatar} />
          <View style={styles.skText}>
            <Skeleton style={[styles.skLine, { width: W1[k % 5] }]} />
            <Skeleton style={[styles.skBig, { width: W2[k % 5] }]} />
            <Skeleton style={[styles.skLine, { width: "34%", height: 9 }]} />
          </View>
          <View style={styles.skSide}><Skeleton style={styles.skEdge} /><Skeleton style={styles.skTag} /></View>
        </View>
      ))}
    </View>
  );
}

/** Home rail fixture card. */
export function CardSkeleton({ width }: { width: number }) {
  return (
    <View style={[styles.skCard, { width }]} testID="skeleton-card">
      <View style={styles.skMeta}><Skeleton style={[styles.skLine, { width: 70 }]} /><Skeleton style={[styles.skLine, { width: 110 }]} /></View>
      <View style={styles.skSides}>
        {[0, 1].map((k) => (
          <View key={k} style={styles.skSide2}>
            <Skeleton style={styles.skCrest} />
            <Skeleton style={[styles.skTeam, { width: k ? "34%" : "42%" }]} />
            <Skeleton style={styles.skScore} />
          </View>
        ))}
      </View>
      <View style={styles.skMeta}><Skeleton style={[styles.skLine, { width: "52%" }]} /><Skeleton style={[styles.skLine, { width: 44 }]} /></View>
    </View>
  );
}

/** Market tape ticket while hits settle. */
export function TapeSkeleton() {
  return (
    <View style={styles.tape} testID="skeleton-tape">
      <Skeleton style={[styles.skBig, { width: "42%", backgroundColor: "rgba(255,255,255,0.18)" }]} />
      <Skeleton style={[styles.skLine, { width: "58%", backgroundColor: "rgba(255,255,255,0.12)" }]} />
      <View style={styles.tear}>
        <View style={styles.tearLine} />
        <View style={[styles.notch, styles.notchL]} />
        <View style={[styles.notch, styles.notchR]} />
      </View>
      {[0, 1].map((k) => (
        <View key={k} style={styles.tapeRow}>
          <Skeleton style={[styles.skAvatar, { backgroundColor: "rgba(255,255,255,0.18)" }]} />
          <View style={styles.skText}>
            <Skeleton style={[styles.skLine, { width: "55%", backgroundColor: "rgba(255,255,255,0.18)" }]} />
            <Skeleton style={[styles.skLine, { width: "38%", height: 9, backgroundColor: "rgba(255,255,255,0.12)" }]} />
          </View>
          <Skeleton style={[styles.skEdge, { backgroundColor: "rgba(255,255,255,0.18)" }]} />
        </View>
      ))}
    </View>
  );
}

/** Fancy tab: match card + overview rows. */
export function FancyCardSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <View style={{ gap: space.stack }} testID="skeleton-fancy">
      {Array.from({ length: cards }, (_, i) => (
        <View key={i} style={[styles.fancyCard, { opacity: Math.max(0.5, 1 - i * 0.2) }]}>
          <View style={styles.skMeta}>
            <Skeleton style={[styles.skLine, { width: 48 }]} />
            <Skeleton style={[styles.skLine, { width: 90 }]} />
          </View>
          {[0, 1].map((k) => (
            <View key={k} style={styles.skSide2}>
              <Skeleton style={styles.skCrest} />
              <Skeleton style={[styles.skTeam, { width: k ? "40%" : "48%" }]} />
            </View>
          ))}
          <View style={styles.fancyRows}>
            {[0, 1, 2].map((k) => (
              <View key={k} style={[styles.fancyRow, k > 0 && styles.skSep]}>
                <Skeleton style={[styles.skLine, { width: "36%" }]} />
                <Skeleton style={styles.skEdge} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Fixture match header (state, sides, scores / kick-off). */
export function MatchHeaderSkeleton() {
  return (
    <View style={styles.matchBox} testID="skeleton-match">
      <View style={styles.skMeta}>
        <Skeleton style={[styles.skLine, { width: 120 }]} />
        <Skeleton style={{ width: 36, height: 36, borderRadius: 18 }} />
      </View>
      {[0, 1].map((k) => (
        <View key={k} style={styles.skSide2}>
          <Skeleton style={styles.skCrest} />
          <Skeleton style={[styles.skTeam, { width: k ? "38%" : "46%", flex: 1 }]} />
          <Skeleton style={styles.skScore} />
        </View>
      ))}
      <Skeleton style={[styles.skLine, { width: "62%" }]} />
      <Skeleton style={[styles.skLine, { width: "48%", height: 9 }]} />
    </View>
  );
}

/** Player page body under the hero: gauge strip, chart, this-match card. */
export function PlayerSkeleton() {
  return (
    <View style={{ gap: space.stack }} testID="skeleton-player">
      <View style={styles.gaugeCard}>
        <View style={styles.gaugeRow}>
          {[0, 1, 2, 3].map((n) => (
            <View key={n} style={{ gap: 6, flex: 1 }}>
              <Skeleton style={[styles.skLine, { width: "70%" }]} />
              <Skeleton style={[styles.skBig, { width: "55%" }]} />
            </View>
          ))}
        </View>
        <Skeleton style={styles.gaugeRing} />
      </View>
      <View style={styles.segRow}>
        <Skeleton style={{ height: 36, flex: 1, borderRadius: 18 }} />
        <Skeleton style={{ height: 36, width: 120, borderRadius: 18 }} />
      </View>
      <Skeleton style={{ height: 220, borderRadius: radius.card }} />
      <View style={styles.matchBox}>
        <Skeleton style={[styles.skLine, { width: 72 }]} />
        <View style={styles.skSide2}>
          <Skeleton style={styles.skCrest} />
          <Skeleton style={[styles.skTeam, { width: "50%" }]} />
        </View>
        <View style={styles.twoCol}>
          <Skeleton style={{ height: 56, flex: 1, borderRadius: radius.card }} />
          <Skeleton style={{ height: 56, flex: 1, borderRadius: radius.card }} />
        </View>
      </View>
      <ListSkeleton rows={4} />
    </View>
  );
}

/** Player grid: name column + game cells. */
export function GridSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <View style={styles.gridBox} testID="skeleton-grid">
      <View style={[styles.gridRow, styles.skSep]}>
        <Skeleton style={[styles.skLine, { width: 56 }]} />
        <View style={{ flex: 1 }} />
        {[0, 1, 2, 3].map((n) => <Skeleton key={n} style={{ width: 36, height: 28, borderRadius: 6 }} />)}
      </View>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.gridRow, i > 0 && styles.skSep, { opacity: Math.max(0.4, 1 - i * 0.08) }]}>
          <Skeleton style={{ width: 20, height: 20, borderRadius: 10 }} />
          <Skeleton style={[styles.skLine, { width: "28%", flex: 1 }]} />
          {[0, 1, 2, 3].map((n) => <Skeleton key={n} style={{ width: 36, height: 24, borderRadius: 6 }} />)}
        </View>
      ))}
    </View>
  );
}

/** Label / value rows (markets, glossary, saved lists). */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View style={styles.listBox} testID="skeleton-list">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.listRow, i > 0 && styles.skSep]}>
          <Skeleton style={[styles.skLine, { width: "42%" }]} />
          <Skeleton style={[styles.skLine, { width: 36 }]} />
          <Skeleton style={[styles.skLine, { width: 36 }]} />
        </View>
      ))}
    </View>
  );
}

/** Leagues tab: chips then leaders / lists. */
export function LeagueSkeleton() {
  return (
    <View style={{ gap: space.stack }} testID="skeleton-league">
      <View style={styles.chips}>
        {[72, 96, 64, 88].map((w, i) => <Skeleton key={i} style={{ height: 36, width: w, borderRadius: 18 }} />)}
      </View>
      <View style={styles.twoCol}>
        {[0, 1, 2, 3].map((n) => <Skeleton key={n} style={{ height: 64, flex: 1, minWidth: "45%", borderRadius: radius.card }} />)}
      </View>
      <ListSkeleton rows={5} />
    </View>
  );
}

/** Competitions directory: rows with crest + name. */
export function CompsSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <View testID="skeleton-comps">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.compRow, i > 0 && styles.skSep, { opacity: Math.max(0.45, 1 - i * 0.08) }]}>
          <Skeleton style={styles.skCrest} />
          <Skeleton style={[styles.skTeam, { width: `${48 + (i % 4) * 8}%`, flex: 1 }]} />
          <Skeleton style={{ width: 14, height: 14, borderRadius: 4 }} />
        </View>
      ))}
    </View>
  );
}

/** Ground page: venue title, metric tiles, form list. */
export function GroundSkeleton() {
  return (
    <View style={{ gap: space.stack, paddingHorizontal: space.gutter }} testID="skeleton-ground">
      <Skeleton style={[styles.skBig, { width: "70%" }]} />
      <Skeleton style={[styles.skLine, { width: "45%" }]} />
      <View style={styles.twoCol}>
        {[0, 1, 2, 3].map((n) => <Skeleton key={n} style={{ height: 72, flex: 1, minWidth: "45%", borderRadius: radius.card }} />)}
      </View>
      <ListSkeleton rows={4} />
    </View>
  );
}

/** Fancy market drill-in: header + chart panel. */
export function MarketSkeleton() {
  return (
    <View style={{ gap: space.stack }} testID="skeleton-market">
      <MatchHeaderSkeleton />
      <View style={styles.matchBox}>
        <Skeleton style={[styles.skBig, { width: "40%" }]} />
        <View style={styles.segRow}>
          <Skeleton style={{ height: 40, width: 72, borderRadius: 8 }} />
          <Skeleton style={{ height: 28, width: 56, borderRadius: 6 }} />
          <Skeleton style={{ height: 28, width: 72, borderRadius: 6 }} />
        </View>
        <Skeleton style={{ height: 140, borderRadius: radius.card }} />
        <View style={styles.twoCol}>
          <Skeleton style={{ height: 88, flex: 1, borderRadius: radius.card }} />
          <Skeleton style={{ height: 88, flex: 1, borderRadius: radius.card }} />
        </View>
      </View>
    </View>
  );
}

export type SkeletonShape =
  | "rows"
  | "fancy"
  | "match"
  | "player"
  | "grid"
  | "list"
  | "league"
  | "comps"
  | "ground"
  | "tape"
  | "market"
  | "card";

const SHAPES: Record<SkeletonShape, (p: { rows?: number }) => ReactNode> = {
  rows: ({ rows }) => <RowsSkeleton rows={rows ?? 3} />,
  fancy: () => <FancyCardSkeleton />,
  match: () => <MatchHeaderSkeleton />,
  player: () => <PlayerSkeleton />,
  grid: ({ rows }) => <GridSkeleton rows={rows ?? 8} />,
  list: ({ rows }) => <ListSkeleton rows={rows ?? 5} />,
  league: () => <LeagueSkeleton />,
  comps: ({ rows }) => <CompsSkeleton rows={rows ?? 8} />,
  ground: () => <GroundSkeleton />,
  tape: () => <TapeSkeleton />,
  market: () => <MarketSkeleton />,
  card: () => <CardSkeleton width={280} />,
};

/** Resolve a named shape for Working / tests. */
export function renderSkeleton(shape: SkeletonShape, rows?: number) {
  return SHAPES[shape]({ rows });
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  block: { backgroundColor: "rgba(255,255,255,0.09)", borderRadius: radius.card },
  skRow: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.gutter, paddingVertical: space.snug },
  skSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  skAvatar: { width: 44, height: 44, borderRadius: 22 },
  skText: { flex: 1, gap: 7 },
  skLine: { height: 10, borderRadius: 5 },
  skBig: { height: 18, borderRadius: 6 },
  skSide: { alignItems: "flex-end", gap: 8 },
  skEdge: { width: 46, height: 18, borderRadius: 6 },
  skTag: { width: 28, height: 9, borderRadius: 4.5 },
  skCard: { flexShrink: 0, height: 190, backgroundColor: color.card, borderRadius: radius.card, padding: space.inset, justifyContent: "space-between" },
  skMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  skSides: { gap: space.snug },
  skSide2: { flexDirection: "row", alignItems: "center", gap: space.snug },
  skCrest: { width: 36, height: 36, borderRadius: 18 },
  skTeam: { height: 14, borderRadius: 7 },
  skScore: { width: 56, height: 14, borderRadius: 7, marginLeft: "auto" },
  tape: { marginHorizontal: space.gutter, backgroundColor: color.primary, borderRadius: radius.card, padding: space.inset, gap: space.tight, overflow: "hidden" },
  tapeRow: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingVertical: space.tight },
  tear: { height: 20, justifyContent: "center", marginVertical: space.tight },
  tearLine: { height: StyleSheet.hairlineWidth, borderStyle: "dashed", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.35)" },
  notch: { position: "absolute", width: 16, height: 16, borderRadius: 8, backgroundColor: color.background, top: 2 },
  notchL: { left: -8 },
  notchR: { right: -8 },
  fancyCard: { backgroundColor: color.card, borderRadius: radius.card, padding: space.inset, gap: space.snug },
  fancyRows: { marginTop: space.tight },
  fancyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: space.snug },
  matchBox: { backgroundColor: color.card, borderRadius: radius.card, padding: space.inset, gap: space.snug, marginHorizontal: space.gutter },
  gaugeCard: { backgroundColor: color.card, borderRadius: radius.card, padding: space.inset, gap: space.stack, marginHorizontal: space.gutter },
  gaugeRow: { flexDirection: "row", gap: space.snug },
  gaugeRing: { width: 88, height: 88, borderRadius: 44, alignSelf: "center" },
  segRow: { flexDirection: "row", gap: space.snug, paddingHorizontal: space.gutter },
  gridBox: { marginHorizontal: space.gutter, backgroundColor: color.card, borderRadius: radius.card, overflow: "hidden" },
  gridRow: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.inset, paddingVertical: space.snug },
  listBox: { marginHorizontal: space.gutter, backgroundColor: color.card, borderRadius: radius.card, overflow: "hidden" },
  listRow: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.inset, paddingVertical: space.snug },
  chips: { flexDirection: "row", gap: space.snug, paddingHorizontal: space.gutter },
  twoCol: { flexDirection: "row", flexWrap: "wrap", gap: space.snug, paddingHorizontal: space.gutter },
  compRow: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.gutter, paddingVertical: space.snug },
});
