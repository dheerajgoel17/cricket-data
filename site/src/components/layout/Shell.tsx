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

function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-60 flex border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Sections">
      {TAB_NAV.map(({ to, label, icon: Icon, match }) => (
        <NavLink key={to} to={to} className={cn("grid flex-1 justify-items-center gap-0.5 pb-2.5 pt-2 text-xs font-semibold", match(pathname) ? "text-foreground" : "text-muted-foreground")}>
          <Icon className="size-6" strokeWidth={1.7} />{label}
        </NavLink>
      ))}
    </nav>
  );
}

function Footer() {
  const col = (title: string, items: [string, string][]) => (
    <div><h4 className="mb-2 text-sm font-medium">{title}</h4>{items.map(([l, to]) => (to.startsWith("http") ? <a key={l} href={to} rel="noopener" className="block py-1 text-sm text-muted-foreground hover:text-primary">{l}</a> : <Link key={l} to={to} className="block py-1 text-sm text-muted-foreground hover:text-primary">{l}</Link>))}</div>
  );
  return (
    <footer className="mt-10 border-t px-4 py-8 text-xs text-muted-foreground md:px-8">
      <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {col("Tools & features", [["Free tools", "/tools"], ["Player trends", "/trends"], ["Prop Hunter", "/props"], ["Odds calculator", "/odds"], ["Partnerships", "/pair"], ["Ask anything", "/ask"]])}
        {col("Popular competitions", [["IPL", "/competitions?q=indian premier"], ["Big Bash", "/competitions?q=big bash"], ["PSL", "/competitions?q=pakistan super"], ["World Cups", "/competitions?q=world cup"], ["All competitions", "/competitions"]])}
        {col("Resources", [["Cricket stats explained", "/glossary"], ["Rules & data", "/about"], ["Saved", "/saved"], ["Cricsheet", "https://cricsheet.org"]])}
      </div>
      <p className="mt-6 border-t pt-4">Free cricket stats and player props. Photos: Wikimedia Commons (free licences, where available). Data: Cricsheet ball-by-ball (ODbL) plus provisional scorecards. Decimal odds only; fair odds are 1 ÷ historical hit rate with no margin: a guide, not betting advice. 18+, gamble responsibly.</p>
    </footer>
  );
}

/** Page chrome: header, left rail (>= md), bottom tab bar (phones), animated route outlet. The player screen brings its own phone bar. */
export function Shell() {
  const { pathname } = useLocation();
  const playerScreen = pathname.startsWith("/player/");
  return (
    <SidebarProvider className="min-h-screen flex-col pb-20 md:pb-0">
      <div className={cn(playerScreen && "max-md:hidden")}><Header /></div>
      <div className="flex flex-1">
        <AppSidebar />
        <SidebarInset className="min-w-0 overflow-x-clip border bg-[#131313] md:peer-data-[variant=inset]:min-h-[calc(100svh-60px-1rem)]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.main key={pathname} id="main" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }} className="min-w-0 px-4 pb-8 md:px-8">
              <Outlet />
            </motion.main>
          </AnimatePresence>
          <Footer />
        </SidebarInset>
      </div>
      <TabBar />
    </SidebarProvider>
  );
}
