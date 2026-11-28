import { Easing } from "react-native-reanimated";
import { ease } from "@/ui/tokens";

/**
 * The app's motion curves and springs in one place (worklet-safe objects built once). Write `easeOutCubic` / `easeOutExpo` / `bounce` instead of repeating a curve or a spring in a component;
 * `ui/tokens.test.ts` fails on a literal `damping`, `stiffness` or `Easing.bezier` anywhere else. Durations stay in `duration` (tokens), entrances in `spring` (tokens).
 */
export const easeOutCubic = Easing.out(Easing.cubic);
export const easeOutExpo = Easing.bezier(...ease.out);
export const easeInOut = Easing.bezier(...ease.inOut);

/** `withSpring` configs for overshoot moments (a star filling, the splash ball landing). */
export const bounce = {
  in: { damping: 6, stiffness: 420 },
  settle: { damping: 12 },
  splash: { damping: 9, stiffness: 240, mass: 0.7 },
  /** The liquid pull-to-refresh: the list holds at the line and springs back. */
  liquid: { damping: 14, stiffness: 170, mass: 0.9 },
} as const;
