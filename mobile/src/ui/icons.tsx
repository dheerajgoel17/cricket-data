import Svg, { Path } from "react-native-svg";

const outline = { fill: "none", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Heroicons (MIT), the same drawings the site uses. */
export function ChevronRight({ size = 16, color }: { size?: number; color: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...outline}><Path d="m8.25 4.5 7.5 7.5-7.5 7.5" /></Svg>;
}

export function TrendingUp({ size = 16, color }: { size?: number; color: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...outline}><Path d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" /></Svg>;
}

export function TrendingDown({ size = 16, color }: { size?: number; color: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...outline}><Path d="M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 4.306 6.43l.776 2.898m0 0 3.182-5.511m-3.182 5.51-5.511-3.181" /></Svg>;
}

export function ArrowUp({ size = 12, color }: { size?: number; color: string }) {
  return <Svg width={size} height={size} viewBox="0 0 20 20" fill={color}><Path fillRule="evenodd" clipRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z" /></Svg>;
}

export function ArrowDown({ size = 12, color }: { size?: number; color: string }) {
  return <Svg width={size} height={size} viewBox="0 0 20 20" fill={color}><Path fillRule="evenodd" clipRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3Z" /></Svg>;
}

export function ChevronLeft({ size = 22, color }: { size?: number; color: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...outline}><Path d="M15.75 19.5 8.25 12l7.5-7.5" /></Svg>;
}

export function Minus({ size = 18, color }: { size?: number; color: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...outline}><Path d="M5 12h14" /></Svg>;
}

export function Plus({ size = 18, color }: { size?: number; color: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...outline}><Path d="M12 4.5v15m7.5-7.5h-15" /></Svg>;
}
