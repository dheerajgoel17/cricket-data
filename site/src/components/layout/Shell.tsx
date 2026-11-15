import { PageSkeleton } from "@/components/app/skeletons";
import { cn } from "@/lib/utils";
import { Suspense, useLayoutEffect, useRef } from "react";
import { NavLink, Outlet, useLocation, useNavigationType } from "react-router-dom";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail } from "@/components/ui/sidebar";
import { AndroidAppBanner } from "@/components/app/android-app-banner";
import { Header } from "./Header";
import { IosTabBar } from "./IosTabBar";
import { MAIN_NAV, MORE_NAV } from "./nav";
import { useMetaSync } from "@/lib/title";
import { HeaderSlotProvider, usePageWashColor, useScrolled } from "@/lib/header-slot";

const navBtn = "h-control rounded-lg text-callout font-label hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:font-label [&[data-active=true]>svg]:text-primary [&>svg]:size-[18px]";

/** shadcn Sidebar under the header: full labels at xl, collapses to an icon rail (Ctrl/Cmd+B or the header trigger). Phones and tablets use the tab bar instead. */
function AppSidebar() {
  const { pathname } = useLocation();
  const clear = !!usePageWashColor() && !useScrolled(); // over a page wash the rail is clear until the page scrolls, like the header
  return (
    <Sidebar collapsible="icon" aria-label="Main" className={cn("top-header h-[calc(100svh-var(--header-h))] border-0 [&_[data-sidebar=sidebar]]:transition-colors [&_[data-sidebar=sidebar]]:duration-200", clear ? "[&_[data-sidebar=sidebar]]:bg-transparent [&_[data-sidebar=sidebar]]:ring-0" : "[&_[data-sidebar=sidebar]]:bg-sidebar [&_[data-sidebar=sidebar]]:ring-1 [&_[data-sidebar=sidebar]]:ring-hairline")}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="label-cap text-footnote text-muted-foreground">Play</SidebarGroupLabel>
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
          <SidebarGroupLabel className="label-cap text-footnote text-muted-foreground">More</SidebarGroupLabel>
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

/** Page chrome: header, left rail (>= lg), bottom tab bar (phones and tablets), stable outlet (no pathname remount). */
/** The page-level tint (player, team): one gradient from the very top, behind the header and the sticky chips, so the colour flows through them (they go solid once the page scrolls). Scrolls away with the page. */
function PageWashLayer() {
  const hex = usePageWashColor();
  if (!hex) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[26rem]"
      style={{ background: `linear-gradient(to bottom, color-mix(in srgb, ${hex} 35%, transparent), color-mix(in srgb, ${hex} 12%, transparent) 55%, transparent)` }} />
  );
}

export function Shell() {
  const { pathname, key } = useLocation();
  const action = useNavigationType();
  const positions = useRef(new Map<string, number>());
  const currentKey = useRef(key);
  const content = useRef<HTMLDivElement>(null);
  useMetaSync(pathname);
  useLayoutEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";
    return () => { history.scrollRestoration = previous; };
  }, []);
  useLayoutEffect(() => {
    const top = action === "POP" ? positions.current.get(key) ?? 0 : 0;
    const observer = new ResizeObserver(restore);
    function restore() {
      window.scrollTo({ top, behavior: "instant" });
      if (window.scrollY >= top) observer.disconnect();
    }
    if (top && content.current) observer.observe(content.current);
    restore();
    const save = () => positions.current.set(currentKey.current, window.scrollY);
    const stop = () => observer.disconnect();
    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("keydown", stop);
    return () => {
      stop();
      window.removeEventListener("scroll", save);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [pathname]); // Query-only changes keep the current scroll.
  useLayoutEffect(() => {
    if (currentKey.current !== key && !positions.current.has(key)) {
      positions.current.set(key, window.scrollY);
    }
    currentKey.current = key;
  }, [key]);
  return (
    <HeaderSlotProvider>
    <SidebarProvider className="relative min-h-screen flex-col pb-[calc(var(--phone-dock-h,calc(var(--tabbar-h)+var(--tabbar-pad)+env(safe-area-inset-bottom))))] lg:pb-0">
      <a href="#main" className="sr-only z-[70] focus:not-sr-only focus:fixed focus:left-gutter focus:top-snug focus:rounded-lg focus:bg-card focus:p-snug">Skip to content</a>
      <PageWashLayer />
      <div className="sticky top-0 z-50">
        <AndroidAppBanner />
        <Header />
      </div>
      <div className="flex flex-1">
        <AppSidebar />
        <SidebarInset id="main" tabIndex={-1} className="min-w-0 overflow-x-clip bg-transparent">
          {/* No key={pathname}: remounting the outlet on every route flashed PageSkeleton / rail skeletons even when feeds were cached (Player → Fixture / Home). Scroll restore stays on pathname below. */}
          <div ref={content} className="relative z-10 mx-auto w-full min-w-0 max-w-(--content-max) px-gutter pb-section pt-stack has-[[data-flush]]:pt-0">
            <Suspense fallback={<PageSkeleton />}><Outlet /></Suspense>
          </div>
        </SidebarInset>
      </div>
      <IosTabBar />
    </SidebarProvider>
    </HeaderSlotProvider>
  );
}
