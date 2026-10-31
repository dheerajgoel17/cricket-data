import type { ComponentType, SVGProps } from "react";
import { CalendarDaysIcon, ChartBarIcon, PuzzlePieceIcon } from "@heroicons/react/24/outline";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;
export interface NavItem { to: string; label: string; icon: Icon; match: (p: string) => boolean }

export const MAIN_NAV: NavItem[] = [
  { to: "/", label: "Fixtures", icon: CalendarDaysIcon, match: (p) => p === "/" || p.startsWith("/fixture") },
  { to: "/props", label: "Player props", icon: ChartBarIcon, match: (p) => p.startsWith("/props") || p.startsWith("/player/") },
  { to: "/fancy", label: "Fancy", icon: PuzzlePieceIcon, match: (p) => p.startsWith("/fancy") },
];
export const TAB_NAV: NavItem[] = [...MAIN_NAV];
export const MORE_NAV: [string, string][] = [["Players", "/players"], ["Player trends", "/trends"], ["Competitions", "/competitions"], ["Partnerships", "/pair"], ["Price calculator", "/odds"], ["Free tools", "/tools"], ["Stats explained", "/glossary"], ["Saved", "/saved"], ["Rules & data", "/about"]];
/** Typed URLs only (not in the chrome, sitemap or search index): `/privacy-policy`, `/terms-of-use`, `/docs`. */
export const LEGAL_NAV: [string, string][] = [["Privacy", "/privacy-policy"], ["Terms", "/terms-of-use"], ["Docs", "/docs"]];
