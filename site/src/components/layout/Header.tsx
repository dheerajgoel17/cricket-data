import { useId } from "react";
import { Link } from "react-router-dom";
import { BRAND } from "@/lib/brand";
import { BookmarkIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useSaved } from "@/lib/saved";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SearchDialog, SearchField, useSearchDialog } from "./GlobalSearch";

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
      <span className="text-title font-extrabold leading-none tracking-tight text-primary-foreground lg:text-foreground">Fancy.cash</span>
    </Link>
  );
}

function SavedLink() {
  const { list } = useSaved();
  return (
    <Link to="/saved" aria-label={list.length ? `Saved, ${list.length}` : "Saved"}
      className="relative grid size-control place-items-center rounded-full bg-primary-foreground/15 text-primary-foreground transition hover:bg-primary-foreground/25 lg:bg-muted lg:text-foreground lg:hover:bg-surface-hover">
      <BookmarkIcon className="size-4" />
      {list.length > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-caption font-bold text-primary-foreground">{list.length}</span>}
    </Link>
  );
}

/** Top bar: logo, centred search on wide screens, saved on the right. Phones keep the brand-green bar; from lg it is a surface bar with a hairline. No accounts, so no profile menu. */
export function Header() {
  const search = useSearchDialog();
  return (
    <header className="sticky top-0 z-50 h-header bg-primary text-primary-foreground shadow-[0_1px_0_rgba(0,0,0,0.12)] lg:bg-background lg:text-foreground lg:shadow-none lg:ring-1 lg:ring-hairline">
      <div className="mx-auto flex h-full items-center gap-snug px-gutter">
        <SidebarTrigger className="-ml-2 hidden text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground lg:inline-flex lg:text-foreground lg:hover:bg-muted lg:hover:text-foreground" aria-label="Toggle sidebar" />
        <Brand />
        <SearchField onOpen={() => search.setOpen(true)} className="hidden md:mx-auto md:flex md:max-w-[32rem] md:flex-1 lg:max-w-[40rem]" />
        <div className="ml-auto flex shrink-0 items-center gap-snug">
          <button type="button" aria-label="Search" onClick={() => search.setOpen(true)} className="grid size-control place-items-center rounded-full bg-primary-foreground/15 md:hidden"><MagnifyingGlassIcon className="size-4" /></button>
          <SavedLink />
        </div>
      </div>
      <SearchDialog open={search.open} onOpenChange={search.setOpen} />
    </header>
  );
}
