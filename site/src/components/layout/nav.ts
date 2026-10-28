import { BarChart3, CalendarDays, User, type LucideIcon } from "lucide-react";

export interface NavItem { to: string; label: string; icon: LucideIcon; match: (p: string) => boolean }
export const MAIN_NAV: NavItem[] = [
  { to: "/", label: "Fixtures", icon: CalendarDays, match: (p) => p === "/" || p.startsWith("/fixture") },
  { to: "/players", label: "Players", icon: User, match: (p) => p.startsWith("/players") || p.startsWith("/player/") },
];
export const TAB_NAV: NavItem[] = [...MAIN_NAV];
export const MORE_NAV: [string, string][] = [["Player trends", "/trends"], ["Competitions", "/competitions"], ["Partnerships", "/pair"], ["Price calculator", "/odds"], ["Free tools", "/tools"], ["Stats explained", "/glossary"], ["Saved", "/saved"], ["Rules & data", "/about"]];
export { BarChart3 };
