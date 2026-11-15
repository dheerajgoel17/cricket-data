import { useEffect, useRef, useState, type ReactNode } from "react";
import { useChoice } from "@/lib/use-choice";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { color, font, space, type, spring, t } from "@/ui/tokens";

/** The underline's glide: a spring with a little life in it, settled in about a third of a second. */
const GLIDE = spring.settle;

/**
 * Underline tabs on a hairline (the site's `Tabs variant="line"`: Home's In play / Pre-match / Completed, a player's formats): text tabs as wide as their labels, the chosen one in
 * the accent colour, and one underline that glides to it on a spring (UI thread; its first placement, and reduce motion, are instant). A tab may carry a quieter count. `right` sits
 * at the end of the row (More, Filters). Wrap is transparent so a parent canvas / `BlurBar` accent wash shows through (opaque `color.background` punched a hole in player atmosphere).
 */
export function LineTabs<T extends string>({ items, value: valueProp, onChange: onChangeProp, label, right, flush }: { items: [id: T, label: string, count?: number | string][]; value: T; onChange: (id: T) => void; label: string; right?: ReactNode; /** No hairline under the row (it sits inside another bar that has one). */ flush?: boolean }) {
  const [value, onChange] = useChoice(valueProp, onChangeProp);
  const calm = useReducedMotion();
  const [boxes, setBoxes] = useState<Record<string, { x: number; w: number }>>({});
  const x = useSharedValue(0), w = useSharedValue(0);
  const placed = useRef(false);
  const at = boxes[value];
  useEffect(() => {
    if (!at) return;
    if (!placed.current || calm) { x.value = at.x; w.value = at.w; placed.current = true; return; }
    x.value = withSpring(at.x, GLIDE);
    w.value = withSpring(at.w, GLIDE);
  }, [at?.x, at?.w, calm, x, w]); // eslint-disable-line react-hooks/exhaustive-deps
  const glide = useAnimatedStyle(() => ({ width: w.value, transform: [{ translateX: x.value }] }));
  return (
    <View style={[styles.wrap, !flush && styles.hairline]}>
      <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.row}>
        {items.map(([id, text, count]) => {
          const on = id === value;
          return (
            <Press
              key={id}
              scale={0.97}
              hitSlop={6}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => { if (on) return; void Haptics.selectionAsync(); onChange(id); }}
              onLayout={(e) => { const { x: bx, width: bw } = e.nativeEvent.layout; setBoxes((b) => (b[id]?.x === bx && b[id]?.w === bw ? b : { ...b, [id]: { x: bx, w: bw } })); }}
              style={styles.tab}
            >
              <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
                {text}{count != null ? <Text style={styles.count}> {count}</Text> : null}
              </Text>
            </Press>
          );
        })}
        {at ? <Animated.View pointerEvents="none" style={[styles.glide, glide]} /> : null}
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.gutter },
  hairline: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  row: { flexDirection: "row", alignItems: "stretch", gap: space.stack },
  tab: { alignItems: "center", paddingTop: space.stack },
  label: { ...t.calloutLabel, color: color["muted-foreground"], paddingBottom: space.stack },
  labelOn: { color: color.primary },
  count: { ...t.captionLabel, opacity: 0.7 },
  // absolute and childless, so animating its width re-lays-out nothing else
  glide: { position: "absolute", left: 0, bottom: 0, height: 2, borderRadius: 1, backgroundColor: color.primary },
  right: { marginLeft: "auto", alignSelf: "center" },
});
