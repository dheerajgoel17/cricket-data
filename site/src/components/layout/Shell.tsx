import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarProvider, SidebarRail } from "@/components/ui/sidebar";
import { Header } from "./Header";
import { IosTabBar } from "./IosTabBar";
import { MAIN_NAV, MORE_NAV } from "./nav";
import { useMetaSync } from "@/lib/title";

/** shadcn Sidebar under the header: full labels at lg, collapses to an icon rail (Ctrl/Cmd+B or the header trigger). Phones use the tab bar instead. */
function AppSidebar() {
  const { pathname } = useLocation();
  const moreActive = MORE_NAV.some(([, to]) => pathname.startsWith(to));
  return (
    <Sidebar collapsible="icon" aria-label="Main" className="top-header hidden h-[calc(100svh-var(--header-h))] border-0 md:block [&_[data-sidebar=sidebar]]:bg-white/[0.035] [&_[data-sidebar=sidebar]]:backdrop-blur-2xl [&_[data-sidebar=sidebar]]:backdrop-saturate-150">
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {MAIN_NAV.map(({ to, label, icon: Icon, match }) => (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton asChild isActive={match(pathname)} tooltip={label} className="h-control rounded-lg text-callout font-medium data-[active=true]:bg-white/10 data-[active=true]:text-foreground [&[data-active=true]>svg]:text-primary [&>svg]:size-[18px]">
                  <NavLink to={to}><Icon /><span>{label}</span></NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            <Collapsible asChild defaultOpen={moreActive} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="More" className="h-control rounded-lg text-callout font-medium [&>svg]:size-[18px]"><MoreHorizontal /><span>More</span><ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" /></SidebarMenuButton>
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

/** Page chrome: header, left rail (>= md), bottom tab bar (phones), animated route outlet. */
export function Shell() {
  const { pathname } = useLocation();
  useMetaSync(pathname);
  return (
    <SidebarProvider className="min-h-screen flex-col pb-[calc(var(--tabbar-h)+var(--tabbar-pad)+env(safe-area-inset-bottom))] md:pb-0">
      <div className="sticky top-0 z-50"><Header /></div>
      <div className="flex flex-1">
        <AppSidebar />
        <SidebarInset className="min-w-0 overflow-x-clip bg-transparent">
          {/* a CSS fade-in, not a mount/unmount sequence: waiting for the old page to animate out before the new one mounted could leave the new one invisible (two mains, one stuck at opacity 0) */}
          <main key={pathname} id="main" className="mx-auto w-full min-w-0 max-w-[900px] animate-in fade-in-0 slide-in-from-bottom-2 px-gutter pb-section pt-stack duration-200">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
      <IosTabBar />
    </SidebarProvider>
  );
}
