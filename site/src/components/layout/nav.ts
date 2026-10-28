import { BarChart3, CalendarDays, ChartColumn, Dices, type LucideIcon } from "lucide-react";

export interface NavItem { to: string; label: string; icon: LucideIcon; match: (p: string) => boolean }
export const MAIN_NAV: NavItem[] = [
  { to: "/", label: "Fixtures", icon: CalendarDays, match: (p) => p === "/" || p.startsWith("/fixture") },
  { to: "/props", label: "Player props", icon: ChartColumn, match: (p) => p.startsWith("/props") || p.startsWith("/player/") },
  { to: "/fancy", label: "Fancy", icon: Dices, match: (p) => p.startsWith("/fancy") },
];
export const TAB_NAV: NavItem[] = [...MAIN_NAV];
export const MORE_NAV: [string, string][] = [["Players", "/players"], ["Player trends", "/trends"], ["Competitions", "/competitions"], ["Partnerships", "/pair"], ["Price calculator", "/odds"], ["Free tools", "/tools"], ["Stats explained", "/glossary"], ["Saved", "/saved"], ["Rules & data", "/about"]];
export { BarChart3 };
