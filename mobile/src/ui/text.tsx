import type { ComponentRef, Ref } from "react";
import { Dimensions, Platform, StyleSheet, Text as RNText, TextInput as RNTextInput, type StyleProp, type TextInputProps, type TextProps, type TextStyle } from "react-native";
import Animated from "react-native-reanimated";

/**
 * The one text component of the app (import `Text` and `TextInput` from here, not from react-native), so the sizes are tuned in one place:
 * - the system font size setting is ignored (`allowFontScaling` off): a phone set to a larger or smaller font than the default broke the rows and made the same screen look different on every
 *   phone. Sizes are the design's, scaled only by the screen's width (below);
 * - on a narrower phone than the design's (a 360 dp Android), sizes shrink a little (`FIT`, never below 0.9) so the same rows fit;
 * - on Android the font's extra top and bottom padding is off, which otherwise sits text low in its box and makes it look larger than on iOS, and lines break the simple (greedy) way
 *   iOS does, not by Android's slower balancing "high quality" strategy.
 */
const DESIGN_WIDTH = 390;
export const fit = (width: number) => Math.min(1, Math.max(0.9, width / DESIGN_WIDTH));
const FIT = fit(Dimensions.get("window").width);

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
  return <RNText ref={ref} allowFontScaling={false} textBreakStrategy="simple" {...rest} style={tuned(style)} />;
}

export function TextInput({ style, ref, ...rest }: TextInputProps & { ref?: Ref<ComponentRef<typeof RNTextInput>> }) {
  return <RNTextInput ref={ref} allowFontScaling={false} {...rest} style={tuned(style) as TextInputProps["style"]} />;
}

/** `Text` whose style can be animated on the UI thread (the chips' colour fade). */
export const AnimatedText = Animated.createAnimatedComponent(Text);
