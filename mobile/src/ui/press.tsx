import { useState, type ComponentProps } from "react";
import { Pressable, type PressableStateCallbackType, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Press feedback is a two-state change, so it is a CSS transition (Reanimated 4): the scale is eased on the UI thread with no shared value, no worklet and no per-frame JavaScript.
// Use a predefined name only — `cubicBezier(...)` still serialises to `cubic-bezier(...)` and Reanimated 4.7 rejects that string as an invalid "predefined" timing function.
const REST = { transform: [{ scale: 1 }], transitionProperty: "transform", transitionDuration: "120ms", transitionTimingFunction: "ease-out" } as const;
const downs = new Map<number, { transform: [{ scale: number }] }>();
const down = (scale: number) => downs.get(scale) ?? (downs.set(scale, { transform: [{ scale }] }), downs.get(scale)!);

type Props = Omit<ComponentProps<typeof Pressable>, "style"> & {
  /** How far it shrinks under the finger (1 = not at all; rows that span the width stay at 1 and only change colour). */
  scale?: number;
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
};

/**
 * The app's one pressable. Under the finger it shrinks a little (`scale`, 0.97 by default) and eases back on release, on the UI thread; a row that spans the width passes
 * `scale={1}` and only changes colour, and is then a plain `Pressable` with nothing animated to mount. Same API as `Pressable` (its style may be a function of `pressed`).
 * A finger that drifts a few points off the edge keeps its press (`pressRetentionOffset`). Static when the phone's reduce motion is on.
 */
export function Press({ scale = 0.97, style, onPressIn, onPressOut, children, ...rest }: Props) {
  const calm = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const base = typeof style === "function" ? style({ pressed } as PressableStateCallbackType) : style;
  const still = calm || scale === 1;
  const Box = still ? Pressable : AnimatedPressable;
  return (
    <Box
      pressRetentionOffset={16}
      {...rest}
      onPressIn={(e) => { setPressed(true); onPressIn?.(e); }}
      onPressOut={(e) => { setPressed(false); onPressOut?.(e); }}
      style={(still ? base : [base, REST, pressed && down(scale)]) as never}>
      {children as never}
    </Box>
  );
}
