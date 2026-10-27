import { Link } from "react-router-dom";
import { Bookmark, BookOpen, Info, MessageSquare, Wrench } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSaved } from "@/lib/saved";
import { GlobalSearch } from "./GlobalSearch";

/** Props.Cash wordmark: three rising bars + "Props.Cash". Inline SVG so it stays crisp and needs no asset. */
export function Brand() {
  return (
    <Link to="/" aria-label="Props.Cash home" className="group flex shrink-0 items-center gap-2">
      <svg viewBox="0 0 28 26" className="h-6 w-6 transition-transform duration-300 group-hover:-translate-y-0.5" aria-hidden>
        <rect x="0" y="15" width="7" height="11" rx="1.5" fill="var(--primary)" opacity=".55" />
        <rect x="10.5" y="8" width="7" height="18" rx="1.5" fill="var(--primary)" opacity=".8" />
        <rect x="21" y="0" width="7" height="26" rx="1.5" fill="var(--primary)" />
      </svg>
      <span className="hidden text-[22px] font-extrabold leading-none tracking-tight sm:inline">Props<span className="text-primary">.</span>Cash</span>
    </Link>
  );
}

/** Guest profile: there are no accounts (free, static site), so this is the personal corner: saved list and the secondary pages. */
function Profile() {
  const { list } = useSaved();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Profile menu" className="relative rounded-full outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="size-9 border border-primary/40 bg-input transition hover:border-primary hover:shadow-[0_0_14px_-2px_var(--primary)]">
          <AvatarFallback className="bg-input text-sm font-semibold text-primary">G</AvatarFallback>
        </Avatar>
        {list.length > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{list.length}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal"><div className="text-sm font-semibold">Guest</div><div className="text-xs text-muted-foreground">Saved on this device only</div></DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/saved"><Bookmark />Saved{list.length > 0 && <span className="ml-auto text-xs text-muted-foreground">{list.length}</span>}</Link></DropdownMenuItem>
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
  return (
    <header className="sticky top-0 z-50 h-14 border-b border-border/60 bg-background/70 backdrop-blur-xl backdrop-saturate-150 md:h-[60px]">
      <div className="relative mx-auto flex h-full items-center gap-3 px-4 md:px-6">
        <Brand />
        <GlobalSearch className="ml-auto w-full max-w-[220px] md:absolute md:left-1/2 md:ml-0 md:max-w-[620px] md:-translate-x-1/2" />
        <div className="md:ml-auto"><Profile /></div>
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </header>
  );
}
