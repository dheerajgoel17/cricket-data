import tokens from "./tokens.json" with { type: "json" };

/** The design tokens as plain data (same file the web CSS is generated from): colours, sizes, type scale, spacing, chart colours, elevation, breakpoints. */
export default tokens;
export const { color, size, type, space, font, chart, elevation, breakpoint } = tokens;
/** Breakpoints in px as numbers, for JS (matchMedia, React Native useWindowDimensions). */
export const breakpointPx = Object.fromEntries(Object.entries(breakpoint).map(([k, v]) => [k, parseInt(v, 10)]));
