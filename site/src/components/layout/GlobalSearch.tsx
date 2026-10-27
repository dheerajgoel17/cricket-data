import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useData } from "@/lib/data";
import { PlayerBadge, TeamBadge } from "@/components/app/badges";

/** Header search: players (typo tolerant, from the engine's resolver) and teams. */
export function GlobalSearch({ className = "" }: { className?: string }) {
  const { store, rz } = useData();
  const nav = useNavigate();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); ref.current?.focus(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  const items = useMemo(() => {
    const t = text.trim();
    if (t.length < 2) return { teams: [] as any[], players: [] as any[] }; // eslint-disable-line @typescript-eslint/no-explicit-any
    const team = rz.team(t);
    return { teams: team ? [team] : [], players: rz.players(t, {}, 6) };
  }, [text, rz]);
  const go = (to: string) => { setText(""); setOpen(false); nav(to); };
  const has = text.trim().length >= 2;
  const none = items.teams.length + items.players.length === 0;
  return (
    <Popover open={open && has} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={`group relative ${className}`}>
          <div aria-hidden className={`absolute -inset-px rounded-full bg-gradient-to-r from-primary/0 via-primary/60 to-primary/0 blur-md transition-opacity duration-300 ${focused ? "opacity-70" : "opacity-0 group-hover:opacity-30"}`} />
          <Search className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <input ref={ref} type="search" value={text} onChange={(e) => { setText(e.target.value); setOpen(true); }} onFocus={() => { setOpen(true); setFocused(true); }} onBlur={() => setFocused(false)} placeholder="Search players, teams" aria-label="Search" autoComplete="off"
            className="relative h-10 w-full rounded-full border border-border bg-input/90 pl-11 pr-4 text-[15px] outline-none transition-colors placeholder:text-[#9f9f9f] hover:border-primary/40 focus-visible:border-primary md:pr-16 [&::-webkit-search-cancel-button]:hidden" />
          <kbd aria-hidden className={`pointer-events-none absolute right-3.5 top-1/2 z-10 hidden -translate-y-1/2 rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground md:block ${focused || text ? "md:hidden" : ""}`}>⌘K</kbd>
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" onOpenAutoFocus={(e) => e.preventDefault()} className="w-(--radix-popover-trigger-width) min-w-72 p-1">
        <Command shouldFilter={false}>
          <CommandList>
            {none && <div className="px-3 py-6 text-center text-sm text-muted-foreground">No player or team matches “{text.trim()}”</div>}
            {items.teams.length > 0 && <CommandGroup heading="Teams">{items.teams.map((t: any) => <CommandItem key={`t${t.idx}`} value={`t${t.idx}`} onSelect={() => go(`/team/${t.idx}`)}><TeamBadge name={t.name} size="xs" />{t.name}</CommandItem>)}</CommandGroup>}
            {items.players.length > 0 && <CommandGroup heading="Players">{items.players.map((p: any) => <CommandItem key={`p${p.idx}`} value={`p${p.idx}`} onSelect={() => go(`/player/${p.idx}`)}><PlayerBadge idx={p.idx} size="xs" />{p.name}<span className="ml-auto text-xs text-muted-foreground">{store.teamName(p.team)}</span></CommandItem>)}</CommandGroup>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
