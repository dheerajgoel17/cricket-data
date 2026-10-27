/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { useData } from "@/lib/data";
import { PlayerBadge, TeamBadge } from "@/components/app/badges";

/** (CommandDialog does not expose cmdk's shouldFilter, so each item's value carries the typed text and always passes cmdk's own filter.)
 * Search state shared by the header field (desktop) and the icon button (phones): a shadcn command dialog opened with Cmd/Ctrl+K. Players are typo tolerant (engine resolver), plus teams. */
export function useSearchDialog() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  return { open, setOpen };
}

/** The header field: a read-only shadcn InputGroup that opens the dialog. */
export function SearchField({ onOpen, className = "" }: { onOpen: () => void; className?: string }) {
  return (
    <InputGroup className={`h-9 cursor-pointer rounded-[10px] border-0 bg-white/10 ${className}`} onClick={onOpen}>
      <InputGroupAddon><Search /></InputGroupAddon>
      <InputGroupInput readOnly placeholder="Search" aria-label="Search" className="cursor-pointer text-[17px]" onFocus={onOpen} />
      <InputGroupAddon align="inline-end"><Kbd>⌘K</Kbd></InputGroupAddon>
    </InputGroup>
  );
}

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { store, rz } = useData();
  const nav = useNavigate();
  const [text, setText] = useState("");
  const items = useMemo(() => {
    const t = text.trim();
    if (t.length < 2) return { teams: [] as any[], players: [] as any[] };
    const team = rz.team(t);
    return { teams: team ? [team] : [], players: rz.players(t, {}, 8) as any[] };
  }, [text, rz]);
  const go = (to: string) => { onOpenChange(false); setText(""); nav(to); };
  return (
    <CommandDialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setText(""); }} title="Search" description="Search players and teams">
      <CommandInput value={text} onValueChange={setText} placeholder="Search players, teams" />
      <CommandList>
        {text.trim().length >= 2 && items.teams.length + items.players.length === 0 && <CommandEmpty>No player or team matches “{text.trim()}”</CommandEmpty>}
        {items.teams.length > 0 && <CommandGroup heading="Teams">{items.teams.map((t: any) => <CommandItem key={`t${t.idx}`} value={`${text} t${t.idx}`} onSelect={() => go(`/team/${t.idx}`)}><TeamBadge name={t.name} size="xs" />{t.name}</CommandItem>)}</CommandGroup>}
        {items.players.length > 0 && <CommandGroup heading="Players">{items.players.map((p: any) => <CommandItem key={`p${p.idx}`} value={`${text} p${p.idx}`} onSelect={() => go(`/player/${p.idx}`)}><PlayerBadge idx={p.idx} size="xs" />{p.name}<span className="ml-auto text-xs text-muted-foreground">{store.teamName(p.team)}</span></CommandItem>)}</CommandGroup>}
      </CommandList>
    </CommandDialog>
  );
}
