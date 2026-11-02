import { useState, type ComponentProps } from "react";
import { Pressable, type PressableStateCallbackType, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// A short, tight spring: it follows the finger down at once and settles back with a small overshoot, like a physical key.
const DOWN = { damping: 20, stiffness: 520, mass: 0.5 };
const UP = { damping: 13, stiffness: 380, mass: 0.6 };

type Props = Omit<ComponentProps<typeof Pressable>, "style"> & {
  /** How far it shrinks under the finger (1 = not at all; rows that span the width stay at 1 and only change colour). */
  scale?: number;
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
};

/**
 * The app's one pressable: it shrinks a little under the finger and springs back, all on the UI thread, so a tap answers at once even when JavaScript is busy. Same API as
 * `Pressable` (its style may be a function of `pressed`).
 */
export function Press({ scale = 0.97, style, onPressIn, onPressOut, children, ...rest }: Props) {
  const s = useSharedValue(1);
  const calm = useReducedMotion(); // the phone's "reduce motion" setting: no springing
  const [pressed, setPressed] = useState(false);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const base = typeof style === "function" ? style({ pressed } as PressableStateCallbackType) : style;
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => { if (!calm) s.value = withSpring(scale, DOWN); setPressed(true); onPressIn?.(e); }}
      onPressOut={(e) => { if (!calm) s.value = withSpring(1, UP); setPressed(false); onPressOut?.(e); }}
      style={[base, anim]}>
      {children as never}
    </AnimatedPressable>
  );
}
