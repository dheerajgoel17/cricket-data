import type { ComponentRef, Ref } from "react";
import { Dimensions, Platform, StyleSheet, Text as RNText, TextInput as RNTextInput, type StyleProp, type TextInputProps, type TextProps, type TextStyle } from "react-native";
import Animated from "react-native-reanimated";
import { fit, layoutWidth } from "@/lib/fit";
import { FONT_SCALE_MAX } from "@/ui/platform";

/**
 * The one text component of the app (import `Text` and `TextInput` from here, not from react-native), so the sizes are tuned in one place:
 * - the system font size setting is honoured (iOS Dynamic Type, Android font scale) up to `FONT_SCALE_MAX` (1.3 iOS, 1.2 Android, from tokens.json `platform`), so dense rows keep fitting
 *   while people who need larger text get it; the design's sizes are further scaled by the screen's width (below);
 * - on a narrower screen than the design's (a 360 dp Android, a 320 dp one, a phone set to a larger display size) sizes shrink in proportion (`FIT`, never below 0.85, never above 1) so the same
 *   rows fit; it follows the window (a fold, a rotation, a resized browser) for what is drawn after the change; in a browser the width counts only up to the app's column;
 * - on Android the font's extra top and bottom padding is off, which otherwise sits text low in its box and makes it look larger than on iOS, and lines break the simple (greedy) way
 *   iOS does, not by Android's slower balancing "high quality" strategy.
 */
let FIT = fit(layoutWidth(Dimensions.get("window").width, Platform.OS));
Dimensions.addEventListener("change", ({ window }: { window: { width: number } }) => { FIT = fit(layoutWidth(window.width, Platform.OS)); });

const NO_PAD: TextStyle = { includeFontPadding: false };

/** `style` with Android's font padding off and, on a narrow phone, the font size and line height scaled down. The common case (a phone as wide as the design) adds one small object and no work. */
export function tuned(style: StyleProp<TextStyle>): StyleProp<TextStyle> {
  if (FIT === 1) return Platform.OS === "android" ? [style, NO_PAD] : style;
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const out = { ...flat } as { -readonly [K in keyof TextStyle]: TextStyle[K] };
  if (typeof flat.fontSize === "number") out.fontSize = Math.round(flat.fontSize * FIT * 2) / 2;
  if (typeof flat.lineHeight === "number") out.lineHeight = Math.round(flat.lineHeight * FIT * 2) / 2;
  if (Platform.OS === "android") out.includeFontPadding = false;
  return out;
}

export function Text({ style, ref, ...rest }: TextProps & { ref?: Ref<ComponentRef<typeof RNText>> }) {
  return <RNText ref={ref} maxFontSizeMultiplier={FONT_SCALE_MAX} textBreakStrategy="simple" {...rest} style={tuned(style)} />;
}

export function TextInput({ style, ref, ...rest }: TextInputProps & { ref?: Ref<ComponentRef<typeof RNTextInput>> }) {
  return <RNTextInput ref={ref} maxFontSizeMultiplier={FONT_SCALE_MAX} {...rest} style={tuned(style) as TextInputProps["style"]} />;
}

/** `Text` whose style can be animated on the UI thread (the chips' colour fade). */
export const AnimatedText = Animated.createAnimatedComponent(Text);
