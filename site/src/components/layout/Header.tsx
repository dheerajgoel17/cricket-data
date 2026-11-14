import { useId, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BRAND } from "@/lib/brand";
import { BookmarkIcon, ChevronLeftIcon, MagnifyingGlassIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/lib/auth";
import { useSaved } from "@/lib/saved";
import { isDesignHost, PRODUCT_ORIGIN } from "@/lib/design-host";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SearchDialog, SearchField, useSearchDialog } from "./GlobalSearch";
import { isTopLevel } from "./nav";
import { useHeaderSlot } from "@/lib/header-slot";
import { cn } from "@/lib/utils";

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
      <BrandMark className="size-9 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:-rotate-6 group-active:scale-[0.97]" />
      <span className="text-title font-emphasis leading-none tracking-tight text-foreground">Fancy.cash</span>
    </Link>
  );
}

function SavedLink() {
  const { list } = useSaved();
  const label = list.length ? `Saved, ${list.length}` : "Saved";
  const className = "relative grid size-control place-items-center rounded-full bg-muted text-foreground transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-surface-hover active:scale-[0.97]";
  const badge = list.length > 0 ? <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-caption font-emphasis text-primary-foreground">{list.length}</span> : null;
  // Design host has no /saved route — open the product app.
  if (isDesignHost()) {
    return (
      <a href={`${PRODUCT_ORIGIN}/saved`} aria-label={label} className={className}>
        <BookmarkIcon className="size-4" />
        {badge}
      </a>
    );
  }
  return (
    <Link to="/saved" aria-label={label} className={className}>
      <BookmarkIcon className="size-4" />
      {badge}
    </Link>
  );
}

function AccountControl() {
  const { user, openSignIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) {
    return (
      <button type="button" aria-label="Sign in" onClick={openSignIn}
        className="grid size-control place-items-center rounded-full bg-muted text-foreground transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-surface-hover active:scale-[0.97]">
        <UserCircleIcon className="size-5" />
      </button>
    );
  }
  const label = user.email || "Account";
  return (
    <div className="relative">
      <button type="button" aria-label={`Account, ${label}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}
        className="grid size-control place-items-center rounded-full bg-muted text-foreground transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-surface-hover active:scale-[0.97]">
        <UserCircleIcon className="size-5 text-primary" />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+var(--spacing-tight))] z-50 min-w-48 overflow-hidden rounded-xl bg-card py-tight ring-1 ring-hairline" role="menu">
          <p className="truncate px-inset py-tight text-footnote text-muted-foreground" title={label}>{label}</p>
          <button type="button" role="menuitem" className="block w-full px-inset py-snug text-left text-callout hover:bg-muted" onClick={() => { setOpen(false); void signOut(); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}

/** Top bar: logo, centred search on wide screens, account + saved on the right. */
export function Header() {
  const search = useSearchDialog();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const down = !isTopLevel(pathname); // one level down (a player, a team, a match): a back button on phones, where there is no sidebar
  const back = () => (history.state?.idx > 0 ? nav(-1) : nav("/"));
  const slot = useHeaderSlot(), own = !!slot?.active; // a page that brings its own actions gets the slot; from lg the brand stays (phone still swaps title into the bar)
  return (
    <header className={cn("sticky top-0 z-50 h-header text-foreground", slot?.flush ? "bg-card" : "bg-background ring-1 ring-hairline")}>
      <div className="mx-auto flex h-full items-center gap-snug px-gutter">
        <SidebarTrigger className="-ml-2 hidden text-foreground hover:bg-muted hover:text-foreground lg:inline-flex" aria-label="Toggle sidebar" />
        {down && <button type="button" aria-label="Back" onClick={back} className="-ml-2 grid size-(--touch) shrink-0 place-items-center rounded-full text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-muted lg:hidden"><ChevronLeftIcon className="size-6" /></button>}
        {own ? <span className="hidden lg:contents"><Brand /></span> : <Brand />}
        {own ? null : <SearchField onOpen={search.show} className="hidden md:mx-auto md:flex md:max-w-[32rem] md:flex-1 lg:max-w-[40rem]" />}
        {/* When a page owns the bar, actions land here. On phones they replace the brand; from lg the brand stays and this slot holds trailing actions. */}
        <div ref={slot?.setEl} className={own ? "flex min-w-0 flex-1 items-center gap-snug" : "hidden"} />
        {own ? null : <div className="ml-auto flex shrink-0 items-center gap-snug">
          <button type="button" aria-label="Search" onClick={search.show} className="grid size-control place-items-center rounded-full bg-muted md:hidden"><MagnifyingGlassIcon className="size-4" /></button>
          <AccountControl />
          <span className="hidden lg:contents"><SavedLink /></span>
        </div>}
      </div>
      <SearchDialog open={search.open} onOpenChange={search.setOpen} onCloseAutoFocus={search.restoreFocus} />
    </header>
  );
}
