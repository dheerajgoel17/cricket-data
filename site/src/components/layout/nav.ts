import { BarChart3, CalendarDays, Crosshair, MessageSquare, User, type LucideIcon } from "lucide-react";

export interface NavItem { to: string; label: string; icon: LucideIcon; match: (p: string) => boolean }
export const MAIN_NAV: NavItem[] = [
  { to: "/", label: "Fixtures", icon: CalendarDays, match: (p) => p === "/" || p.startsWith("/fixture") },
  { to: "/props", label: "Prop Hunter", icon: Crosshair, match: (p) => p.startsWith("/props") },
  { to: "/players", label: "Players", icon: User, match: (p) => p.startsWith("/players") || p.startsWith("/player/") },
];
export const TAB_NAV: NavItem[] = [...MAIN_NAV, { to: "/ask", label: "Ask", icon: MessageSquare, match: (p) => p.startsWith("/ask") }];
export const MORE_NAV: [string, string][] = [["Player trends", "/trends"], ["Competitions", "/competitions"], ["Partnerships", "/pair"], ["Price calculator", "/odds"], ["Free tools", "/tools"], ["Stats explained", "/glossary"], ["Saved", "/saved"], ["Rules & data", "/about"], ["Ask anything", "/ask"]];
export { BarChart3 };
