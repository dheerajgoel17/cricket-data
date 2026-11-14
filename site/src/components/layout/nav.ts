import type { ComponentType, SVGProps } from "react";
import { BookmarkIcon, CalendarDaysIcon, ChartBarIcon, EnvelopeIcon, PuzzlePieceIcon, TrophyIcon } from "@heroicons/react/24/outline";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;
export interface NavItem { to: string; label: string; icon: Icon; match: (p: string) => boolean }

export const MAIN_NAV: NavItem[] = [
  { to: "/", label: "Fixtures", icon: CalendarDaysIcon, match: (p) => p === "/" || p.startsWith("/fixture") },
  { to: "/props", label: "Player props", icon: ChartBarIcon, match: (p) => p.startsWith("/props") || p.startsWith("/player/") },
  { to: "/fancy", label: "Fancy", icon: PuzzlePieceIcon, match: (p) => p.startsWith("/fancy") },
  { to: "/leagues", label: "Leagues", icon: TrophyIcon, match: (p) => p.startsWith("/league") || p.startsWith("/competitions") },
  { to: "/saved", label: "Saved", icon: BookmarkIcon, match: (p) => p.startsWith("/saved") },
  { to: "/contact", label: "Contact", icon: EnvelopeIcon, match: (p) => p.startsWith("/contact") },
];
/** Pages that are a top-level destination: no back button in the phone header. Everything else (a player, a team, a match) is one level down. */
export const isTopLevel = (p: string) => TAB_NAV.some((t) => t.match(p) && (t.to === "/" ? p === "/" : p === t.to)) || ["/players", "/teams", "/competitions", "/tools", "/trends", "/about", "/design-system"].includes(p);
export const TAB_NAV: NavItem[] = [...MAIN_NAV];
export const MORE_NAV: [string, string][] = [["Players", "/players"], ["Player trends", "/trends"], ["Competitions", "/competitions"], ["Partnerships", "/pair"], ["Price calculator", "/odds"], ["Free tools", "/tools"], ["Stats explained", "/glossary"], ["Rules & data", "/about"], ["Design system", "/design-system"]];
/** Typed URLs only (not in the chrome, sitemap or search index): `/privacy-policy`, `/terms-of-use`, `/docs`. */
export const LEGAL_NAV: [string, string][] = [["Privacy", "/privacy-policy"], ["Terms", "/terms-of-use"], ["Docs", "/docs"]];
