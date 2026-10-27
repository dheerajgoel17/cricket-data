import { Link } from "react-router-dom";
import { Bookmark, BookOpen, Info, MessageSquare, Search, Wrench } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSaved } from "@/lib/saved";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SearchDialog, SearchField, useSearchDialog } from "./GlobalSearch";

/** Props.Cash wordmark: three rising bars + "Props.Cash". Inline SVG so it stays crisp and needs no asset. */
export function Brand() {
  return (
    <Link to="/" aria-label="Props.Cash home" className="group flex shrink-0 items-center gap-tight">
      <svg viewBox="0 0 28 26" className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5" aria-hidden>
        <rect x="0" y="15" width="7" height="11" rx="1.5" fill="var(--primary)" opacity=".55" />
        <rect x="10.5" y="8" width="7" height="18" rx="1.5" fill="var(--primary)" opacity=".8" />
        <rect x="21" y="0" width="7" height="26" rx="1.5" fill="var(--primary)" />
      </svg>
      <span className="text-body font-extrabold leading-none tracking-tight">Props<span className="text-primary">.</span>Cash</span>
    </Link>
  );
}

/** Guest profile: there are no accounts (free, static site), so this is the personal corner: saved list and the secondary pages. */
function Profile() {
  const { list } = useSaved();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Profile menu" className="relative rounded-full outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="size-8 border border-primary/40 bg-input transition hover:border-primary hover:shadow-[0_0_14px_-2px_var(--primary)]">
          <AvatarFallback className="bg-input text-callout font-semibold text-primary">G</AvatarFallback>
        </Avatar>
        {list.length > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-caption font-bold text-primary-foreground">{list.length}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal"><div className="text-callout font-semibold">Guest</div><div className="text-footnote text-muted-foreground">Saved on this device only</div></DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/saved"><Bookmark />Saved{list.length > 0 && <span className="ml-auto text-footnote text-muted-foreground">{list.length}</span>}</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/ask"><MessageSquare />Ask anything</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/tools"><Wrench />Free tools</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/glossary"><BookOpen />Stats explained</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/about"><Info />Rules & data</Link></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Top bar: logo left, search centred on the page, profile right. Glass blur with a faint green glow line underneath. */
export function Header() {
  const search = useSearchDialog();
  return (
    <header className="sticky top-0 z-50 h-header border-b border-border/60 bg-background/70 backdrop-blur-xl backdrop-saturate-150">
      <div className="relative mx-auto flex h-full items-center gap-snug px-gutter">
        <SidebarTrigger className="-ml-2 hidden md:inline-flex" aria-label="Toggle sidebar" />
        {/* phones: centred logo with search and profile icons (props.cash style); md+: logo left, search field centred */}
        <div className="absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0"><Brand /></div>
        <SearchField onOpen={() => search.setOpen(true)} className="hidden md:mx-auto md:flex md:max-w-[560px] md:flex-1" />
        <div className="ml-auto flex shrink-0 items-center gap-tight">
          <button type="button" aria-label="Search" onClick={() => search.setOpen(true)} className="grid size-control place-items-center rounded-full bg-secondary md:hidden"><Search className="size-4" /></button>
          <Profile />
        </div>
      </div>
      <SearchDialog open={search.open} onOpenChange={search.setOpen} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </header>
  );
}
