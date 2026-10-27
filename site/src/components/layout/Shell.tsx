import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
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
    <Sidebar variant="inset" collapsible="icon" aria-label="Main" className="top-[60px] hidden h-[calc(100svh-60px)] md:block">
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {MAIN_NAV.map(({ to, label, icon: Icon, match }) => (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton asChild isActive={match(pathname)} tooltip={label} className="h-10 text-[15px] font-medium data-[active=true]:text-primary">
                  <NavLink to={to}><Icon /><span>{label}</span></NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            <Collapsible asChild defaultOpen={moreActive} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="More" className="h-10 text-[15px] font-medium"><MoreHorizontal /><span>More</span><ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" /></SidebarMenuButton>
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

/** Phones: iOS-style tab bar. Full width, translucent blur over a hairline top border, 49pt tall plus the home-indicator inset, 10pt labels, tint on the active tab, a press-in on tap. */
function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-60 flex border-t border-white/10 bg-background/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl backdrop-saturate-[1.8] md:hidden" aria-label="Sections">
      {TAB_NAV.map(({ to, label, icon: Icon, match }) => {
        const on = match(pathname);
        return (
          <NavLink key={to} to={to} aria-current={on ? "page" : undefined} className={cn("flex h-[49px] flex-1 flex-col items-center justify-center gap-[3px] pt-1 text-[10px] font-medium tracking-[.01em] transition-colors", on ? "text-primary" : "text-muted-foreground")}>
            <motion.span whileTap={{ scale: 0.86 }} transition={{ type: "spring", stiffness: 600, damping: 30 }} className="grid justify-items-center gap-[3px]">
              <Icon className="size-[25px]" strokeWidth={on ? 2.2 : 1.7} />{label}
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
    <SidebarProvider className="min-h-screen flex-col pb-[calc(49px+env(safe-area-inset-bottom))] md:pb-0">
      <div className={cn(playerScreen && "max-md:hidden")}><Header /></div>
      <div className="flex flex-1">
        <AppSidebar />
        <SidebarInset className="min-w-0 overflow-x-clip border bg-[#131313] md:peer-data-[variant=inset]:min-h-[calc(100svh-60px-1rem)]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.main key={pathname} id="main" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }} className="min-w-0 px-4 pb-8 md:px-8">
              <Outlet />
            </motion.main>
          </AnimatePresence>
        </SidebarInset>
      </div>
      <TabBar />
    </SidebarProvider>
  );
}
