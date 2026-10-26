import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useData } from "@/lib/data";
import { localWhen, tzName } from "@/lib/format";
import { GlobalSearch } from "./GlobalSearch";
import { MAIN_NAV, MORE_NAV, TAB_NAV } from "./nav";

const Brand = () => <Link to="/" className="font-brand text-[28px] leading-none tracking-wider text-primary md:text-[26px]">CRICKET<b className="font-normal text-foreground">PROPS</b>HUB</Link>;

function Header() {
  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:h-[60px]">
      <Brand />
      <GlobalSearch className="ml-auto w-full max-w-[200px] md:absolute md:left-1/2 md:ml-0 md:max-w-[620px] md:-translate-x-1/2" />
      <Link to="/ask" className="grid h-[34px] place-items-center rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground md:ml-auto">Ask</Link>
    </header>
  );
}

function SideNav() {
  const { pathname } = useLocation();
  const [more, setMore] = useState(false);
  return (
    <aside className="fixed bottom-0 left-0 top-[60px] z-40 hidden w-[268px] flex-col gap-1 overflow-y-auto border-r bg-background p-3 md:flex" aria-label="Main">
      {MAIN_NAV.map(({ to, label, icon: Icon, match }) => (
        <NavLink key={to} to={to} className={cn("flex h-11 items-center gap-3 rounded-3xl px-3.5 text-[15.5px] font-semibold transition-colors hover:bg-pill", match(pathname) ? "text-primary" : "text-foreground")}><Icon className="size-5" />{label}</NavLink>
      ))}
      <Collapsible open={more} onOpenChange={setMore}>
        <CollapsibleTrigger className="flex h-11 w-full items-center gap-3 rounded-3xl px-3.5 text-[15.5px] font-semibold hover:bg-pill"><ChevronDown className={cn("size-5 transition-transform", more && "rotate-180")} />More</CollapsibleTrigger>
        <CollapsibleContent className="grid gap-0.5 pl-8">{MORE_NAV.map(([label, to]) => <NavLink key={to} to={to} className={({ isActive }) => cn("rounded-full px-3 py-2 text-sm hover:bg-pill", isActive ? "text-primary" : "text-muted-foreground")}>{label}</NavLink>)}</CollapsibleContent>
      </Collapsible>
    </aside>
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

function Freshness() {
  const { store } = useData();
  const f = store.freshness();
  return (
    <div role="status" className="border-b px-4 py-1.5 text-[12.5px] text-muted-foreground md:px-8">
      Cricsheet data through <b className="text-foreground">{f.newestCricsheet}</b>
      {f.provisionalIncluded ? <> · includes <b className="text-foreground">{f.provisionalMatches}</b> provisional matches up to <b className="text-foreground">{f.newestProvisional || "?"}</b></> : " · no provisional matches included"}
      {f.builtAt ? ` · built ${localWhen(f.builtAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} (${tzName()})` : ""}
    </div>
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
    <div className="min-h-screen pb-20 md:pb-0">
      <div className={cn(playerScreen && "max-md:hidden")}><Header /></div>
      <SideNav />
      <div className="min-w-0 overflow-x-clip md:pl-[268px]">
        <div className={cn(playerScreen && "max-md:hidden")}><Freshness /></div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.main key={pathname} id="main" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }} className="min-w-0 px-4 pb-8 md:px-8">
            <Outlet />
          </motion.main>
        </AnimatePresence>
        <Footer />
      </div>
      <TabBar />
    </div>
  );
}
