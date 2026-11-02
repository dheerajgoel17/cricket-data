import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ChevronRight } from "@/ui/icons";
import { color, space, type } from "@/ui/tokens";

/**
 * A collapsible section (the site's accordion): a header with the title, what is chosen inside it, and a chevron that turns; the content's height and fade are animated on the
 * UI thread. `open` / `onToggle` make it controlled (an accordion group); without them it keeps its own state.
 */
export function Accordion({ title, value, right, defaultOpen = false, open, onToggle, children, badge }: {
  title: string; value?: string; right?: ReactNode; defaultOpen?: boolean; open?: boolean; onToggle?: (open: boolean) => void; children: ReactNode; badge?: string | number;
}) {
  const [own, setOwn] = useState(defaultOpen);
  const isOpen = open ?? own;
  const [h, setH] = useState(0);
  const p = useSharedValue(isOpen ? 1 : 0);
  useEffect(() => { p.value = withTiming(isOpen ? 1 : 0, { duration: 260, easing: Easing.out(Easing.cubic) }); }, [isOpen, p]);
  const body = useAnimatedStyle(() => ({ height: interpolate(p.value, [0, 1], [0, h]), opacity: p.value }));
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${interpolate(p.value, [0, 1], [0, 90])}deg` }] }));
  const toggle = () => { void Haptics.selectionAsync(); const next = !isOpen; if (onToggle) onToggle(next); else setOwn(next); };
  return (
    <View style={styles.item}>
      <Press scale={1} onPress={toggle} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} style={({ pressed }) => [styles.head, pressed && styles.pressed]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {badge != null ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
        </View>
        {right ?? (value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null)}
        <Animated.View style={chevron}><ChevronRight color={color["muted-foreground"]} /></Animated.View>
      </Press>
      <Animated.View style={[styles.clip, h > 0 ? body : { height: isOpen ? undefined : 0 }]}>
        <View onLayout={(e) => { const next = Math.round(e.nativeEvent.layout.height); if (next && next !== h) setH(next); }} style={h > 0 ? styles.measured : undefined}>{children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  head: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: space.snug },
  pressed: { opacity: 0.6 },
  titleRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.tight },
  title: { ...type.body, color: color.foreground },
  badge: { backgroundColor: color.secondary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  badgeText: { ...type.caption, color: color["muted-foreground"] },
  value: { ...type.callout, color: color["muted-foreground"], maxWidth: "50%" },
  clip: { overflow: "hidden" },
  measured: { position: "absolute", left: 0, right: 0, top: 0 },
});
