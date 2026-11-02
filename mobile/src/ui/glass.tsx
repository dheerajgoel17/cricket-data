import type { ComponentProps, ComponentRef, ReactNode, RefObject } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";

type Target = ComponentProps<typeof BlurView>["blurTarget"];

/**
 * A translucent surface. iOS 26 and later: the system's liquid glass. Older iOS: a system blur. Android has no system glass and a live blur is too heavy there: a solid dark tint.
 */
export function GlassSurface({ style, children, blurTarget }: { style?: StyleProp<ViewStyle>; children?: ReactNode; blurTarget?: RefObject<ComponentRef<typeof View> | null> | null }) {
  if (Platform.OS === "ios") {
    if (isGlassEffectAPIAvailable() && isLiquidGlassAvailable()) return <GlassView glassEffectStyle="regular" style={style}>{children}</GlassView>;
    return <BlurView tint="systemChromeMaterialDark" intensity={80} style={[style, styles.clip]}>{children}</BlurView>;
  }
  return <View style={[style, styles.solid]}>{children}</View>;
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  solid: { backgroundColor: "rgba(28,28,30,0.92)" },
});
