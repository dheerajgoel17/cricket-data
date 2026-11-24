import { Platform } from "react-native";
import tokens from "@cricket/tokens/tokens.json";
import { remPx } from "@cricket/tokens/rem.js";
import { tint } from "@/ui/tokens";

const P = tokens.platform;

/**
 * What differs by platform, in one place (values from `site/packages/tokens/tokens.json` → `platform`; the rule is documented in docs/DESIGN_SYSTEM.md "Platform conventions").
 * One design, three native idioms: iOS presses scale and settle, Android answers with Material's ripple (drawn on the render thread, free for JavaScript), the browser keeps hover.
 */
export const isAndroid = Platform.OS === "android";
export const isIOS = Platform.OS === "ios";

/** Smallest touch target (iOS HIG 44 pt, Material 48 dp, web 44 px). Controls drawn smaller extend their hit area with `hitSlopFor`, never grow the drawing. */
export const TOUCH = remPx(isAndroid ? P["touch-android"] : isIOS ? P["touch-ios"] : P["touch-web"]);

/** `hitSlop` that tops a control of `w × h` up to the platform's minimum target. */
export function hitSlopFor(w: number, h: number = w) {
  const x = Math.max(0, Math.ceil((TOUCH - w) / 2)), y = Math.max(0, Math.ceil((TOUCH - h) / 2));
  return x || y ? { left: x, right: x, top: y, bottom: y } : undefined;
}

/** Vertical `hitSlop` that tops a full-width chip (the 36-point control height) up to the platform's minimum target: chips are drawn at the control height, never taller. */
export const CHIP_SLOP = hitSlopFor(TOUCH, 36);

/** Press feedback numbers shared with the web's `:active` (scale 0.97, 120 ms). */
export const PRESS = { scale: Number(P["press-scale"]), ms: Number(P["press-ms"]) } as const;

/** Material ripple for pressables that do not scale (full-width rows) on Android; undefined elsewhere. Foreground so it draws over the row's own fill. */
export const RIPPLE = isAndroid ? { color: tint.white(0.08), foreground: true } : undefined;

/** The most the phone's font-size setting may enlarge text (iOS Dynamic Type / Android font scale): honoured, but capped so dense stat rows keep fitting. */
export const FONT_SCALE_MAX = Number(isAndroid ? P["font-scale-max-android"] : isIOS ? P["font-scale-max-ios"] : P["font-scale-max-web"]);

/**
 * Elevation, one set for both idioms (tokens.json `elevation_native`; the web twins are the `--shadow-*` values): iOS draws a shadow, Android a Material elevation (its shadow props are ignored).
 * Spread one onto a style: `{ ...elevation.raised }`. Never write `shadow*` or `elevation` in a screen (`tokens.test.ts`).
 */
const EL = tokens.elevation_native as unknown as Record<string, { opacity: number; radius: number; offsetY: number; elevation: number }>;
const make = (k: string) => (isAndroid
  ? { elevation: EL[k].elevation }
  : { shadowColor: tint.black(1), shadowOpacity: EL[k].opacity, shadowRadius: EL[k].radius, shadowOffset: { width: 0, height: EL[k].offsetY } });
export const elevation = { raised: make("raised"), sheet: make("sheet"), fab: make("fab"), thumb: make("thumb") } as const;
