import { useMemo, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { entityAccent } from "@cricket/engine/entity-accents.js";
import { color, tint } from "@/ui/tokens";

/**
 * Elevated page canvas only. Scrollable entity pages bind tint with `EntityHeroWash` inside the scroll hero
 * (industry pattern) — do not pin a screen-level wash that fights scroll.
 */
export function PageAtmosphere({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.root, style]}>{children}</View>;
}

/**
 * Entity tint behind a scroll hero (Spotify / Apple Music style). Scrolls away with the hero.
 * Unknown sides: pass null and brand primary is used.
 */
export function EntityHeroWash({
  accent,
  style,
  children,
  onLayout,
}: {
  accent?: string | null;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  const hex = accent || color.primary;
  return (
    <View style={[styles.heroWash, style]} onLayout={onLayout}>
      <LinearGradient
        pointerEvents="none"
        colors={[tint.hex(hex, 0.34), tint.hex(hex, 0.14), tint.hex(hex, 0.04), "transparent"]}
        locations={[0, 0.4, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

/** Curated side accent hex, or null when unmapped. */
export function useEntityAccent(side?: string | null) {
  return useMemo(() => (side ? entityAccent(side) : null), [side]);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  heroWash: { overflow: "hidden" },
});
