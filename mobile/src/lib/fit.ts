import { WEB_MAX_WIDTH } from "@/ui/tokens";

/** The screen width the type is drawn for (a 390 pt phone), and how far it may shrink on a narrower one. */
export const DESIGN_WIDTH = 390, MIN_FIT = 0.85;

/** The factor sizes are scaled by on a screen `width` wide: 1 at the design width or wider, in proportion below it, never under `MIN_FIT`. */
export const fit = (width: number) => Math.min(1, Math.max(MIN_FIT, width / DESIGN_WIDTH));

/** The width the layout really has: the window, and in a browser no more than the app's column (`WEB_MAX_WIDTH`). */
export const layoutWidth = (window: number, platform: string) => (platform === "web" ? Math.min(window, WEB_MAX_WIDTH) : window);
