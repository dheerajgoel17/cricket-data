import { useEffect, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Brand, Header } from "@/components/layout/Header";
import { IosTabBar } from "@/components/layout/IosTabBar";
import { HeaderSlotProvider } from "@/lib/header-slot";
import { goProduct, isDesignCataloguePath, isDesignHost } from "@/lib/design-host";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/** Header destinations. `ids` mark which `/docs/:id` topics light that group. */
export const NAV_LINKS = [
  { title: "Foundations", detail: "Typography, colour, spacing, and motion.", to: "/docs/type", ids: ["type", "color", "space", "motion"] },
  { title: "Components", detail: "Buttons, chips, tables, forms, and feedback.", to: "/docs/components", ids: ["components", "buttons", "chips", "feedback", "data", "forms", "icons"] },
  { title: "Patterns", detail: "Research, filtering, and live data flows.", to: "/docs/patterns", ids: ["patterns", "platforms"] },
  { title: "Resources", detail: "Tokens, registry, and source modules.", to: "/docs/component-registry", ids: ["token-reference", "component-registry"] },
] as const;

export type NavGroupTitle = (typeof NAV_LINKS)[number]["title"];

/** Which primary nav group is active for a docs topic id (or search). */
export function navGroupFor(topicId: string | undefined, search = false): NavGroupTitle | "Search" | undefined {
  if (search) return "Search";
  if (!topicId) return undefined;
  return NAV_LINKS.find((link) => (link.ids as readonly string[]).includes(topicId))?.title;
}

const navBtn = "h-control rounded-lg text-callout font-label hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:font-label data-[active=true]:text-primary";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Shared max-width shell for catalogue page content. */
export function DesignShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-screen-xl px-gutter", className)}>{children}</div>;
}

/** Product paths opened on the design host (Saved, tab bar, deep links) go to the live site. */
function ProductHandoff() {
  const { pathname, search, hash } = useLocation();
  useEffect(() => {
    if (!isDesignHost() || isDesignCataloguePath(pathname)) return;
    goProduct(pathname + search + hash);
  }, [pathname, search, hash]);
  return null;
}

function DocsSidebar({
  groups,
  currentId,
  topicPath,
}: {
  groups: readonly { title: string; sections: readonly (readonly [string, string])[] }[];
  currentId?: string;
  topicPath: (id: string) => string;
}) {
  return (
    <Sidebar collapsible="icon" aria-label="Documentation" className="top-header h-[calc(100svh-var(--header-h))] border-0 [&_[data-sidebar=sidebar]]:bg-sidebar [&_[data-sidebar=sidebar]]:ring-1 [&_[data-sidebar=sidebar]]:ring-hairline">
      <SidebarContent>
        {groups.map(({ title, sections }) => (
          <SidebarGroup key={title}>
            <SidebarGroupLabel className="label-cap text-footnote text-muted-foreground">{title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sections.map(([id, label]) => (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton asChild isActive={currentId === id} tooltip={label} className={navBtn}>
                      <NavLink to={topicPath(id)}><span>{label}</span></NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

/**
 * Product chrome on the catalogue host: Header (Auth, Saved, GlobalSearch) + Sidebar + IosTabBar.
 * Entity routes hand off to fancy.cash.
 */
export function DesignDocsShell({
  groups,
  currentId,
  topicPath,
  children,
  showSidebar = true,
}: {
  groups: readonly { title: string; sections: readonly (readonly [string, string])[] }[];
  currentId?: string;
  topicPath: (id: string) => string;
  children: ReactNode;
  showSidebar?: boolean;
}) {
  return (
    <HeaderSlotProvider>
      <SidebarProvider className="flex min-h-svh flex-col pb-[calc(var(--phone-dock-h,calc(var(--tabbar-h)+var(--tabbar-pad)+env(safe-area-inset-bottom))))] lg:pb-0">
        <ProductHandoff />
        <div className="sticky top-0 z-50"><Header /></div>
        <div className="flex flex-1">
          {showSidebar ? <DocsSidebar groups={groups} currentId={currentId} topicPath={topicPath} /> : null}
          <SidebarInset id="main" tabIndex={-1} className="min-w-0 overflow-x-clip bg-transparent">
            {/* Docs need a wider inset than product phone gutters — 14–24px reads as flush against the rail. */}
            <div className="mx-auto w-full min-w-0 max-w-screen-xl px-6 pb-section pt-stack sm:px-8 lg:px-12">
              {children}
            </div>
          </SidebarInset>
        </div>
        <DesignFooter />
        <IosTabBar />
      </SidebarProvider>
    </HeaderSlotProvider>
  );
}

export function DesignFooter() {
  return (
    <footer className="mt-auto border-t border-hairline bg-muted/40">
      <DesignShell className="flex flex-wrap items-center justify-between gap-stack py-group">
        <div className="grid gap-hair">
          <Brand />
          <a href="https://fancy.cash/" className={cn("text-footnote text-muted-foreground underline underline-offset-4", focusRing)}>fancy.cash</a>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-stack">
          {NAV_LINKS.map(({ to, title }) => (
            <Link key={to} to={to} className={cn("text-callout text-muted-foreground hover:text-foreground hover:underline", focusRing)}>{title}</Link>
          ))}
        </nav>
      </DesignShell>
    </footer>
  );
}

/** Home: product Header + Card destinations; docs sidebar hidden; tab bar opens the live app. */
export function DesignHome({ brandColor, groups, topicPath }: {
  brandColor: string;
  groups: readonly { title: string; sections: readonly (readonly [string, string])[] }[];
  topicPath: (id: string) => string;
}) {
  return (
    <DesignDocsShell groups={groups} topicPath={topicPath} showSidebar={false}>
      <div className="grid gap-section py-section lg:py-16">
        <div className="grid max-w-3xl gap-stack">
          <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95] font-emphasis tracking-[-0.04em]">
            Fancy.cash
            <span className="block text-muted-foreground">Design</span>
          </h1>
          <p className="max-w-[40ch] text-title text-muted-foreground">
            UI library for Fancy.cash — tokens, components, and patterns for web, iOS, and Android.
          </p>
        </div>

        <nav aria-label="Explore documentation" className="grid gap-snug md:grid-cols-2 xl:grid-cols-4">
          {NAV_LINKS.map(({ title, detail, to }) => (
            <Link key={to} to={to} className={cn("group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
              <Card className="h-full gap-0 overflow-hidden py-0 shadow-none transition-colors group-hover:border-primary/40 group-hover:bg-surface">
                <div
                  className="grid min-h-28 place-items-center border-b border-hairline bg-muted/50"
                  style={title === "Foundations" ? { background: brandColor } : undefined}
                >
                  {title === "Foundations" ? (
                    <span className="font-condensed text-4xl font-emphasis tabular-nums text-[#10251b]">172/4</span>
                  ) : title === "Components" ? (
                    <span className="inline-flex h-control items-center rounded-full bg-primary px-stack text-callout font-label text-primary-foreground">Pill control</span>
                  ) : title === "Patterns" ? (
                    <span className="text-callout font-label text-muted-foreground">Filters → Apply → Rows</span>
                  ) : (
                    <code className="text-footnote text-muted-foreground">tokens.json</code>
                  )}
                </div>
                <CardHeader className="gap-hair p-inset [.border-b]:pb-inset">
                  <CardTitle className="flex items-center justify-between gap-snug text-title font-emphasis">
                    {title}
                    <ArrowRightIcon className="size-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                  </CardTitle>
                  <CardDescription className="text-callout">{detail}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </nav>

        <div className="flex flex-wrap gap-snug">
          <Button asChild>
            <Link to="/docs/type">Get started</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/docs/components">Browse components</Link>
          </Button>
        </div>
      </div>
    </DesignDocsShell>
  );
}
