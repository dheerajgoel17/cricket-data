import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail } from "@/components/ui/sidebar";
import { Header } from "./Header";
import { IosTabBar } from "./IosTabBar";
import { MAIN_NAV, MORE_NAV } from "./nav";
import { useMetaSync } from "@/lib/title";

const navBtn = "h-control rounded-lg text-callout font-medium hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold [&[data-active=true]>svg]:text-primary [&>svg]:size-[18px]";

/** shadcn Sidebar under the header: full labels at xl, collapses to an icon rail (Ctrl/Cmd+B or the header trigger). Phones and tablets use the tab bar instead. */
function AppSidebar() {
  const { pathname } = useLocation();
  return (
    <Sidebar collapsible="icon" aria-label="Main" className="top-header h-[calc(100svh-var(--header-h))] border-0 [&_[data-sidebar=sidebar]]:bg-sidebar [&_[data-sidebar=sidebar]]:ring-1 [&_[data-sidebar=sidebar]]:ring-hairline">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">Play</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAIN_NAV.map(({ to, label, icon: Icon, match }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton asChild isActive={match(pathname)} tooltip={label} className={navBtn}>
                    <NavLink to={to}><Icon /><span>{label}</span></NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">More</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MORE_NAV.map(([label, to]) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton asChild isActive={pathname === to || (to !== "/" && pathname.startsWith(to))} tooltip={label} className={navBtn}>
                    <NavLink to={to}><span>{label}</span></NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

/** Page chrome: header, left rail (>= lg), bottom tab bar (phones and tablets), animated route outlet. */
export function Shell() {
  const { pathname } = useLocation();
  useMetaSync(pathname);
  return (
    <SidebarProvider className="min-h-screen flex-col pb-[calc(var(--tabbar-h)+var(--tabbar-pad)+env(safe-area-inset-bottom))] lg:pb-0">
      <div className="sticky top-0 z-50"><Header /></div>
      <div className="flex flex-1">
        <AppSidebar />
        <SidebarInset className="min-w-0 overflow-x-clip bg-transparent">
          {/* a CSS fade-in, not a mount/unmount sequence: waiting for the old page to animate out before the new one mounted could leave the new one invisible (two mains, one stuck at opacity 0) */}
          <main key={pathname} id="main" className="mx-auto w-full min-w-0 max-w-(--content-max) animate-in fade-in-0 slide-in-from-bottom-2 px-gutter pb-section pt-stack duration-200">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
      <IosTabBar />
    </SidebarProvider>
  );
}
