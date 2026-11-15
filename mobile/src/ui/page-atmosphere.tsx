import { useMemo, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { entityAccent } from "@cricket/engine/entity-accents.js";
import { color, tint } from "@/ui/tokens";

/** Tall enough for status bar + sticky chrome (format + caps + innings) + hero — one wash, no second header gradient. */
const DEFAULT_WASH_H = 420;

/**
 * Elevated page canvas (`color.background`) with an optional partial top hero wash.
 * Wash fades to transparent — never a full-page gradient. When `wash` is on and `accent` is null, uses brand primary.
 */
export function PageAtmosphere({
  children,
  accent,
  wash = false,
  washHeight = DEFAULT_WASH_H,
  style,
}: {
  children?: ReactNode;
  accent?: string | null;
  wash?: boolean;
  washHeight?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const washHex = wash ? accent || color.primary : null;
  return (
    <View style={[styles.root, style]}>
      {washHex ? (
        <LinearGradient
          pointerEvents="none"
          // Soft top → clear: avoids a solid colour slab behind the sticky chrome.
          colors={[tint.hex(washHex, 0.28), tint.hex(washHex, 0.14), tint.hex(washHex, 0.05), "transparent"]}
          locations={[0, 0.35, 0.65, 1]}
          style={[styles.wash, { height: washHeight }]}
        />
      ) : null}
      {children}
    </View>
  );
}

/** Curated side accent hex, or null when unmapped (PageAtmosphere brand-washes when wash is on). */
export function useEntityAccent(side?: string | null) {
  return useMemo(() => (side ? entityAccent(side) : null), [side]);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  wash: { position: "absolute", left: 0, right: 0, top: 0 },
});
