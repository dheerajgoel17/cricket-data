import { useId } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BRAND } from "@/lib/brand";
import { BookmarkIcon, ChevronLeftIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useSaved } from "@/lib/saved";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SearchDialog, SearchField, useSearchDialog } from "./GlobalSearch";
import { isTopLevel } from "./nav";

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
      <span className="text-title font-extrabold leading-none tracking-tight text-foreground">Fancy.cash</span>
    </Link>
  );
}

function SavedLink() {
  const { list } = useSaved();
  return (
    <Link to="/saved" aria-label={list.length ? `Saved, ${list.length}` : "Saved"}
      className="relative grid size-control place-items-center rounded-full bg-muted text-foreground transition hover:bg-surface-hover">
      <BookmarkIcon className="size-4" />
      {list.length > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-caption font-bold text-primary-foreground">{list.length}</span>}
    </Link>
  );
}

/** Top bar: logo, centred search on wide screens, saved on the right. Phones keep the brand-green bar; from lg it is a surface bar with a hairline. No accounts, so no profile menu. */
export function Header() {
  const search = useSearchDialog();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const down = !isTopLevel(pathname); // one level down (a player, a team, a match): a back button on phones, where there is no sidebar
  const back = () => (history.state?.idx > 0 ? nav(-1) : nav("/"));
  return (
    <header className="sticky top-0 z-50 h-header bg-background text-foreground ring-1 ring-hairline">
      <div className="mx-auto flex h-full items-center gap-snug px-gutter">
        <SidebarTrigger className="-ml-2 hidden text-foreground hover:bg-muted hover:text-foreground lg:inline-flex" aria-label="Toggle sidebar" />
        {down && <button type="button" aria-label="Back" onClick={back} className="-ml-2 grid size-(--touch) shrink-0 place-items-center rounded-full text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-muted lg:hidden"><ChevronLeftIcon className="size-6" /></button>}
        <Brand />
        <SearchField onOpen={() => search.setOpen(true)} className="hidden md:mx-auto md:flex md:max-w-[32rem] md:flex-1 lg:max-w-[40rem]" />
        <div className="ml-auto flex shrink-0 items-center gap-snug">
          <button type="button" aria-label="Search" onClick={() => search.setOpen(true)} className="grid size-control place-items-center rounded-full bg-muted md:hidden"><MagnifyingGlassIcon className="size-4" /></button>
          <span className="hidden lg:contents"><SavedLink /></span>
        </div>
      </div>
      <SearchDialog open={search.open} onOpenChange={search.setOpen} />
    </header>
  );
}
