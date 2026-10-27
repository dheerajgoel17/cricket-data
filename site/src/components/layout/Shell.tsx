import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarBlank, ChatCircleText, Crosshair, Flag, User, type Icon } from "@phosphor-icons/react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarProvider, SidebarRail } from "@/components/ui/sidebar";
import { Header } from "./Header";
import { MAIN_NAV, MORE_NAV, TAB_NAV } from "./nav";

/** shadcn Sidebar under the header: full labels at lg, collapses to an icon rail (Ctrl/Cmd+B or the header trigger). Phones use the tab bar instead. */
function AppSidebar() {
  const { pathname } = useLocation();
  const moreActive = MORE_NAV.some(([, to]) => pathname.startsWith(to));
  return (
    <Sidebar collapsible="icon" aria-label="Main" className="top-[60px] hidden h-[calc(100svh-60px)] border-0 md:block [&_[data-sidebar=sidebar]]:bg-white/[0.035] [&_[data-sidebar=sidebar]]:backdrop-blur-2xl [&_[data-sidebar=sidebar]]:backdrop-saturate-150">
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {MAIN_NAV.map(({ to, label, icon: Icon, match }) => (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton asChild isActive={match(pathname)} tooltip={label} className="h-11 rounded-xl text-body font-medium data-[active=true]:bg-white/10 data-[active=true]:text-foreground [&[data-active=true]>svg]:text-primary [&>svg]:size-[22px]">
                  <NavLink to={to}><Icon /><span>{label}</span></NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            <Collapsible asChild defaultOpen={moreActive} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="More" className="h-11 rounded-xl text-body font-medium [&>svg]:size-[22px]"><MoreHorizontal /><span>More</span><ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" /></SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {MORE_NAV.map(([label, to]) => (
                      <SidebarMenuSubItem key={to}><SidebarMenuSubButton asChild isActive={pathname.startsWith(to)}><NavLink to={to}>{label}</NavLink></SidebarMenuSubButton></SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

/** SF-Symbols-style tab icons (Phosphor): outline when idle, filled when selected, like iOS. */
const TAB_ICON: Record<string, Icon> = { "/": CalendarBlank, "/props": Crosshair, "/players": User, "/teams": Flag, "/ask": ChatCircleText };

/** Phones: iOS 26 style floating glass tab bar. A translucent capsule (heavy blur and saturation, inner top highlight), the selected tab marked by a glass pill that slides between tabs, filled icon and tint on the active tab, spring press. */
function TabBar() {
  const { pathname } = useLocation();
  const reduce = useReducedMotion();
  return (
    <nav className="fixed inset-x-4 bottom-[max(14px,env(safe-area-inset-bottom))] z-60 flex h-16 items-center rounded-[32px] border border-white/[0.14] bg-white/[0.07] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_12px_40px_rgba(0,0,0,.6)] backdrop-blur-2xl backdrop-saturate-[1.8] md:hidden" aria-label="Sections">
      {TAB_NAV.map(({ to, label, match }) => {
        const on = match(pathname), Ico = TAB_ICON[to] ?? CalendarBlank;
        return (
          <NavLink key={to} to={to} aria-current={on ? "page" : undefined} className={cn("relative flex h-full flex-1 flex-col items-center justify-center gap-hair rounded-[26px] text-caption font-medium tracking-[.01em] whitespace-nowrap transition-colors", on ? "text-primary" : "text-white/60")}>
            {on && <motion.span layoutId="tab-glass" aria-hidden className="absolute inset-0 rounded-[26px] bg-white/[0.14] shadow-[inset_0_1px_0_rgba(255,255,255,.22)]" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }} />}
            <motion.span whileTap={{ scale: 0.88 }} transition={{ type: "spring", stiffness: 600, damping: 30 }} className="relative grid justify-items-center gap-hair">
              <Ico className="size-6" weight={on ? "fill" : "regular"} />{label}
            </motion.span>
          </NavLink>
        );
      })}
    </nav>
  );
}

/** Page chrome: header, left rail (>= md), bottom tab bar (phones), animated route outlet. The player screen brings its own phone bar. */
export function Shell() {
  const { pathname } = useLocation();
  const playerScreen = pathname.startsWith("/player/");
  return (
    <SidebarProvider className="min-h-screen flex-col pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-0">
      <div className={cn("sticky top-0 z-50", playerScreen && "max-md:hidden")}><Header /></div>
      <div className="flex flex-1">
        <AppSidebar />
        <SidebarInset className="min-w-0 overflow-x-clip bg-transparent">
          <AnimatePresence mode="wait" initial={false}>
            <motion.main key={pathname} id="main" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }} className="mx-auto w-full min-w-0 max-w-[900px] px-gutter pb-section pt-stack">
              <Outlet />
            </motion.main>
          </AnimatePresence>
        </SidebarInset>
      </div>
      <TabBar />
    </SidebarProvider>
  );
}
