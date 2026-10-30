import { useId } from "react";
import { Link } from "react-router-dom";
import { BRAND } from "@/lib/brand";
import { BookmarkIcon, BookOpenIcon, InformationCircleIcon, MagnifyingGlassIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSaved } from "@/lib/saved";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SearchDialog, SearchField, useSearchDialog } from "./GlobalSearch";
import { ThemeRadios, ThemeToggle } from "./ThemeToggle";

/** The Fancy.cash mark: a rounded dark tile with a green F whose top arm ends in a ball. Inline SVG, so it is crisp at any size and needs no file. */
export function BrandMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3cf0a6" /><stop offset="1" stopColor="#1fb877" /></linearGradient></defs>
      <rect width="64" height="64" rx="15" fill="var(--primary-foreground)" />
      <g fill={`url(#${id})`}><rect x="17" y="14" width="10" height="37" rx="5" /><rect x="17" y="14" width="25" height="10" rx="5" /><rect x="17" y="29.5" width="18" height="10" rx="5" /><circle cx="48.5" cy="19" r="6" /></g>
    </svg>
  );
}

/** Wordmark: the mark and "Fancy.cash" in a heavy weight, the dot in the accent colour. */
export function Brand() {
  return (
    <Link to="/" aria-label={`${BRAND} home`} className="group flex shrink-0 items-center gap-snug rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <BrandMark className="size-9 transition-transform duration-300 group-hover:-rotate-6 group-active:scale-95" />
      <span className="text-title font-extrabold leading-none tracking-tight text-primary-foreground">Fancy.cash</span>
    </Link>
  );
}

/** Guest profile: there are no accounts (free, static site), so this is the personal corner: saved list, appearance, and the secondary pages. */
function Profile() {
  const { list } = useSaved();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Profile menu" className="relative rounded-full outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="size-9 border-0 bg-primary-foreground transition hover:opacity-90">
          <AvatarFallback className="bg-primary-foreground text-callout font-semibold text-primary">G</AvatarFallback>
        </Avatar>
        {list.length > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-caption font-bold text-primary-foreground">{list.length}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal"><div className="text-callout font-semibold">Guest</div><div className="text-footnote text-muted-foreground">Saved on this device only</div></DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/saved"><BookmarkIcon />Saved{list.length > 0 && <span className="ml-auto text-footnote text-muted-foreground">{list.length}</span>}</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/tools"><WrenchScrewdriverIcon />Free tools</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-footnote font-medium text-muted-foreground">Appearance</DropdownMenuLabel>
        <ThemeRadios />
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/glossary"><BookOpenIcon />Stats explained</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/about"><InformationCircleIcon />Rules & data</Link></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Top bar: the logo at the left (after the sidebar toggle on wide screens), the search field centred on wide screens, search, theme and profile at the right. A solid bar in the theme colour with dark text and a dark logo tile. */
export function Header() {
  const search = useSearchDialog();
  return (
    <header className="sticky top-0 z-50 h-header bg-primary text-primary-foreground shadow-[0_1px_0_rgba(0,0,0,0.12)]">
      <div className="mx-auto flex h-full items-center gap-snug px-gutter">
        <SidebarTrigger className="-ml-2 hidden text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground lg:inline-flex" aria-label="Toggle sidebar" />
        <Brand />
        <SearchField onOpen={() => search.setOpen(true)} className="hidden md:mx-auto md:flex md:max-w-[32rem] md:flex-1 lg:max-w-[40rem]" />
        <div className="ml-auto flex shrink-0 items-center gap-snug">
          <button type="button" aria-label="Search" onClick={() => search.setOpen(true)} className="grid size-control place-items-center rounded-full bg-primary-foreground/15 md:hidden"><MagnifyingGlassIcon className="size-4" /></button>
          <ThemeToggle />
          <Profile />
        </div>
      </div>
      <SearchDialog open={search.open} onOpenChange={search.setOpen} />
    </header>
  );
}
