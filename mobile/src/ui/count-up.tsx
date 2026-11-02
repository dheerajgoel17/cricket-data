import { useEffect } from "react";
import { TextInput as RNTextInput, type StyleProp, type TextStyle } from "react-native";
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { tuned } from "@/ui/text";

const AnimatedInput = Animated.createAnimatedComponent(RNTextInput);
const flat = { padding: 0, margin: 0 } as const;

/**
 * A figure that counts to its value on the UI thread (Reanimated drives a `TextInput`'s text, so React never re-renders to animate it): the hit rate climbing to 55%, a price settling.
 * A new value counts on from the one shown, not from zero. Static when the phone's "reduce motion" is on.
 */
export function CountUp({ value, digits = 0, prefix = "", suffix = "", duration = 700, style }: { value: number; digits?: number; prefix?: string; suffix?: string; duration?: number; style?: StyleProp<TextStyle> }) {
  const calm = useReducedMotion();
  const v = useSharedValue(calm ? value : 0);
  useEffect(() => { v.value = calm ? value : withTiming(value, { duration, easing: Easing.out(Easing.cubic) }); }, [value, calm, duration, v]);
  const props = useAnimatedProps(() => {
    const t = `${prefix}${v.value.toFixed(digits)}${suffix}`;
    return { text: t, defaultValue: t } as object;
  });
  return (
    <AnimatedInput editable={false} pointerEvents="none" underlineColorAndroid="transparent" allowFontScaling={false} accessibilityLabel={`${prefix}${value.toFixed(digits)}${suffix}`} style={[flat, tuned(style)] as StyleProp<TextStyle>} animatedProps={props} />
  );
}

/** A label whose text is a shared value (a chart's tooltip while a finger moves over it): changes without a React render. */
export function ReText({ text, style }: { text: SharedValue<string>; style?: StyleProp<TextStyle> }) {
  const props = useAnimatedProps(() => ({ text: text.value, defaultValue: text.value }) as object);
  return <AnimatedInput editable={false} pointerEvents="none" underlineColorAndroid="transparent" allowFontScaling={false} style={[flat, tuned(style)] as StyleProp<TextStyle>} animatedProps={props} />;
}
