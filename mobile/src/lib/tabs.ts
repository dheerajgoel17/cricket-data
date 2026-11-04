import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

type Icon = ComponentProps<typeof Ionicons>["name"];

/** The bottom tabs, as the site's `MAIN_NAV` (site/src/components/layout/nav.ts). `icon` / `on` are the Android and preview icons; iOS uses the same icons as images (app-tabs.tsx, assets/tab-icons). */
export const TABS: { name: string; href: string; label: string; icon: Icon; on: Icon }[] = [
  { name: "index", href: "/", label: "Fixtures", icon: "calendar-outline", on: "calendar" },
  { name: "props", href: "/props", label: "Props", icon: "stats-chart-outline", on: "stats-chart" },
  { name: "fancy", href: "/fancy", label: "Fancy", icon: "dice-outline", on: "dice" },
  { name: "leagues", href: "/leagues", label: "Leagues", icon: "trophy-outline", on: "trophy" },
  { name: "saved", href: "/saved", label: "Saved", icon: "bookmark-outline", on: "bookmark" },
  { name: "contact", href: "/contact", label: "Contact", icon: "mail-outline", on: "mail" },
];
