import { useEffect, type ComponentProps } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { ReduceMotion, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Rect } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import type { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTabDock } from "@/components/tab-dock-scroll";
import { TABS } from "@/lib/tabs";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { easeInOut } from "@/ui/curves";
import { TAB_DOCK_MARGIN } from "@/ui/insets";
import { color, duration, icon, TAB_BAR_HEIGHT, t, tint } from "@/ui/tokens";

type Props = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const DOCK_FILL = tint.hex(color.card, 0.94);

export function TabBar({ state, emitter, navigateToTab, insets }: Props) {
  const route = state.routes[state.index];
  const active = TABS.find(({ name }) => name === route?.name);
  const { compact, expand } = useTabDock(route?.key);
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const left = Math.max(12, insets.left);
  const right = Math.max(12, insets.right);
  const availableWidth = width - left - right;
  const tabWidth = Math.min(80, availableWidth / TABS.length);
  const expandedWidth = tabWidth * TABS.length;
  const expandedLeft = (availableWidth - expandedWidth) / 2;
  const progress = useSharedValue(compact ? 1 : 0);
  // Morph the SVG surface without changing the tabs' or scroll view's layout.
  const surfaceProps = useAnimatedProps(() => {
    const shape = reduceMotion ? Number(compact) : progress.get();
    return {
      x: expandedLeft * (1 - shape),
      width: expandedWidth + (TAB_BAR_HEIGHT - expandedWidth) * shape,
    };
  });
  const expandedStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - progress.get() * 2),
  }));
  const compactStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, progress.get() * 2 - 1),
  }));
  useEffect(() => {
    progress.set(withTiming(compact ? 1 : 0, {
      duration: reduceMotion ? duration.instant : duration.base,
      easing: easeInOut,
      reduceMotion: ReduceMotion.Never,
    }));
  }, [compact, progress, reduceMotion]);

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
  return (
    <View pointerEvents="box-none" style={[styles.dock, { bottom, left, right }]}>
      <View pointerEvents="none" aria-hidden style={StyleSheet.absoluteFill}>
        <Svg width="100%" height={TAB_BAR_HEIGHT}>
          <AnimatedRect animatedProps={surfaceProps} height={TAB_BAR_HEIGHT} rx={TAB_BAR_HEIGHT / 2} fill={DOCK_FILL} />
        </Svg>
      </View>
      <GestureDetector gesture={swipe.enabled(!compact)} touchAction="pan-y">
        <Animated.View accessibilityRole="tablist" pointerEvents={compact ? "none" : "auto"}
          accessibilityElementsHidden={compact} aria-hidden={compact} importantForAccessibility={compact ? "no-hide-descendants" : "auto"}
          style={[styles.bar, expandedStyle]}>
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
                style={[styles.tab, { width: tabWidth }]}>
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
          style={[styles.compact, compactStyle]}>
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
  bar: { flexDirection: "row", justifyContent: "center", maxWidth: "100%" },
  compact: { position: "absolute", left: 0, bottom: 0 },
  compactButton: { width: TAB_BAR_HEIGHT, height: TAB_BAR_HEIGHT, alignItems: "center", justifyContent: "center" },
  tab: { height: TAB_BAR_HEIGHT, alignItems: "center", justifyContent: "center", gap: 2 },
  label: { ...t.captionLabel, maxWidth: "100%" },
});
