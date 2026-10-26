import { useMemo, useState } from "react";
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
  const items = useMemo(() => {
    const t = text.trim();
    if (t.length < 2) return { teams: [] as any[], players: [] as any[] }; // eslint-disable-line @typescript-eslint/no-explicit-any
    const team = rz.team(t);
    return { teams: team ? [team] : [], players: rz.players(t, {}, 6) };
  }, [text, rz]);
  const go = (to: string) => { setText(""); setOpen(false); nav(to); };
  const has = items.teams.length + items.players.length > 0;
  return (
    <Popover open={open && has} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={`relative ${className}`}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input type="search" value={text} onChange={(e) => { setText(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search players, teams" aria-label="Search" autoComplete="off"
            className="h-10 w-full rounded-full border border-border bg-input pl-10 pr-4 text-[15px] outline-none placeholder:text-[#9f9f9f] focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" onOpenAutoFocus={(e) => e.preventDefault()} className="w-(--radix-popover-trigger-width) min-w-72 p-1">
        <Command shouldFilter={false}>
          <CommandList>
            {items.teams.length > 0 && <CommandGroup heading="Teams">{items.teams.map((t: any) => <CommandItem key={`t${t.idx}`} value={`t${t.idx}`} onSelect={() => go(`/team/${t.idx}`)}><TeamBadge name={t.name} size="xs" />{t.name}</CommandItem>)}</CommandGroup>}
            {items.players.length > 0 && <CommandGroup heading="Players">{items.players.map((p: any) => <CommandItem key={`p${p.idx}`} value={`p${p.idx}`} onSelect={() => go(`/player/${p.idx}`)}><PlayerBadge idx={p.idx} size="xs" />{p.name}<span className="ml-auto text-xs text-muted-foreground">{store.teamName(p.team)}</span></CommandItem>)}</CommandGroup>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
