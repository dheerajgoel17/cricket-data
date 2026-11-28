import { useEffect, type ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import type { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTabDock } from "@/components/tab-dock-scroll";
import { TABS } from "@/lib/tabs";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { easeOutExpo } from "@/ui/curves";
import { TAB_DOCK_MARGIN } from "@/ui/insets";
import { color, duration, icon, radius, TAB_BAR_HEIGHT, t, tint } from "@/ui/tokens";

type Props = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

export function TabBar({ state, emitter, navigateToTab, insets }: Props) {
  const route = state.routes[state.index];
  const active = TABS.find(({ name }) => name === route?.name);
  const { compact, expand } = useTabDock(route?.key);
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(compact ? 1 : 0);
  const expandedStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.get(),
    transform: [{ scale: reduceMotion ? 1 : 1 - 0.04 * progress.get() }],
  }));
  const compactStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: reduceMotion ? 1 : 0.96 + 0.04 * progress.get() }],
  }));
  useEffect(() => {
    progress.set(withTiming(compact ? 1 : 0, { duration: duration.fast, easing: easeOutExpo }));
  }, [compact, progress]);

  function select(index: number) {
    const route = state.routes[index];
    if (!route) return;
    const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (index === state.index || event.defaultPrevented) return;
    expand();
    void Haptics.selectionAsync();
    navigateToTab(route.key);
  }

  const swipe = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .maxPointers(1)
    .runOnJS(true)
    .onEnd(({ translationX, translationY }, success) => {
      if (!success || Math.abs(translationX) < 36 || Math.abs(translationX) <= Math.abs(translationY)) return;
      select(state.index + (translationX < 0 ? 1 : -1));
    });

  const bottom = Math.max(TAB_DOCK_MARGIN, insets.bottom);
  const left = Math.max(12, insets.left);
  const right = Math.max(12, insets.right);
  return (
    <View pointerEvents="box-none" style={[styles.dock, { bottom, left, right }]}>
      <GestureDetector gesture={swipe.enabled(!compact)} touchAction="pan-y">
        <Animated.View accessibilityRole="tablist" pointerEvents={compact ? "none" : "auto"}
          accessibilityElementsHidden={compact} aria-hidden={compact} importantForAccessibility={compact ? "no-hide-descendants" : "auto"}
          style={[styles.surface, styles.bar, expandedStyle]}>
          {state.routes.map((route, i) => {
            const t = TABS.find((x) => x.name === route.name);
            if (!t) return null;
            const on = state.index === i;
            const tint = on ? color.primary : color["muted-foreground"];
            return (
              <Press
                key={route.key}
                scale={0.94}
                accessibilityRole="tab"
                accessibilityLabel={t.label}
                accessibilityState={{ selected: on }}
                tabIndex={compact ? -1 : 0}
                onPress={() => select(i)}
                style={styles.tab}>
                <Ionicons name={on ? t.on : t.icon} size={icon.lg} color={tint} />
                <Text style={[styles.label, { color: tint }]} numberOfLines={1}>{t.label}</Text>
              </Press>
            );
          })}
        </Animated.View>
      </GestureDetector>
      {active && (
        <Animated.View pointerEvents={compact ? "auto" : "none"}
          accessibilityElementsHidden={!compact} aria-hidden={!compact} importantForAccessibility={compact ? "auto" : "no-hide-descendants"}
          style={[styles.surface, styles.compact, compactStyle]}>
          <Press accessibilityRole="button" accessibilityLabel={`Show navigation tabs, current section ${active.label}`}
            tabIndex={compact ? 0 : -1} onPress={expand} style={styles.compactButton}>
            <Ionicons name={active.on} size={icon.lg} color={color.primary} />
          </Press>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { position: "absolute", zIndex: 10, alignItems: "center" },
  surface: { backgroundColor: tint.hex(color.card, 0.94), borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderRadius: radius.chip },
  bar: { flexDirection: "row", justifyContent: "center", maxWidth: "100%", transformOrigin: "left center" },
  compact: { position: "absolute", left: 0, bottom: 0 },
  compactButton: { width: TAB_BAR_HEIGHT, height: TAB_BAR_HEIGHT, alignItems: "center", justifyContent: "center" },
  tab: { width: 80, flexShrink: 1, minWidth: 0, height: TAB_BAR_HEIGHT, alignItems: "center", justifyContent: "center", gap: 2 },
  label: { ...t.captionLabel, maxWidth: "100%" },
});
