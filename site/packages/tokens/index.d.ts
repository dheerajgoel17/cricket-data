type Group = Record<string, string>;
export interface Tokens { color: Group; size: Group; type: Group; space: Group; font: Group; chart: Group; elevation: Group; breakpoint: Group }
declare const tokens: Tokens;
export default tokens;
export const color: Group, size: Group, type: Group, space: Group, font: Group, chart: Group, elevation: Group, breakpoint: Group;
export const breakpointPx: Record<string, number>;
/** CSS length → device pixels (16 px rem). Handles rem, px, and clamp (uses max). */
export function remPx(value: string | number, base?: number): number;
