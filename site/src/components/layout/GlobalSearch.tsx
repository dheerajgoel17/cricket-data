/* eslint-disable @typescript-eslint/no-explicit-any */
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { useData } from "@/lib/data";
import { useFixtures } from "@/hooks/useEngine";
import { useRecents } from "@/lib/saved";
import { dayKey, dayLabel } from "@/lib/format";
import { norm } from "@/lib/hot-lines";
import { PlayerBadge, TeamBadge } from "@/components/app/badges";
import { PlayerName } from "@/components/app/player-name";

/** (CommandDialog does not expose cmdk's shouldFilter, so each item's value carries the typed text and always passes cmdk's own filter.)
 * Search state shared by the header field (desktop) and the icon button (phones): a shadcn command dialog opened with Cmd/Ctrl+K. Players are typo tolerant (engine resolver), plus teams and grounds. */
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
    <InputGroup className={`h-10 cursor-pointer rounded-[var(--chip-radius)] border-0 bg-muted text-foreground [&_svg]:text-muted-foreground [&_input]:placeholder:text-primary-foreground/70 [&_kbd]:bg-primary-foreground/15 [&_kbd]:text-primary-foreground lg:bg-muted lg:text-foreground lg:[&_svg]:text-muted-foreground lg:[&_input]:placeholder:text-muted-foreground lg:[&_kbd]:bg-background lg:[&_kbd]:text-muted-foreground ${className}`} onClick={onOpen}>
      <InputGroupAddon><MagnifyingGlassIcon className="size-4" /></InputGroupAddon>
      <InputGroupInput readOnly placeholder="Search players, teams, grounds" aria-label="Search" className="cursor-pointer text-body" onFocus={onOpen} />
      <InputGroupAddon align="inline-end"><Kbd>⌘K</Kbd></InputGroupAddon>
    </InputGroup>
  );
}

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { store, rz } = useData();
  const nav = useNavigate();
  const [text, setText] = useState("");
  const query = useDeferredValue(text); // the field takes keystrokes at once; the lookup follows when the thread is free
  const fixtures = useFixtures();
  const { recents } = useRecents();
  const items = useMemo(() => {
    const t = query.trim();
    if (t.length < 2) return { teams: [] as any[], players: [] as any[], venues: [] as any[], fixtures: [] as any[] };
    const team = rz.team(t), q = norm(t);
    // matches whose sides or series match the text, the nearest to today first
    const now = Date.now(), gap = (f: any) => Math.abs((Date.parse(f.start) || now) - now);
    const games = (fixtures.data || []).filter((f: any) => f.id && (norm(f.a).includes(q) || norm(f.b).includes(q) || norm(f.series || "").includes(q))).sort((x: any, y: any) => gap(x) - gap(y)).slice(0, 4);
    return { teams: team ? [team] : [], players: rz.players(t, {}, 6) as any[], venues: rz.venues(t, 4) as any[], fixtures: games as any[] };
  }, [query, rz, fixtures.data]);
  const seen = useMemo(() => recents.filter((k) => k.startsWith("player:")).map((k) => +k.split(":")[1]).filter((i) => i >= 0 && i < store.P.id.length).slice(0, 5), [recents, store]);
  const go = (to: string) => { onOpenChange(false); setText(""); nav(to); };
  const n = items.teams.length + items.players.length + items.venues.length + items.fixtures.length;
  return (
    <CommandDialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setText(""); }} title="Search" description="Search players, teams, matches and grounds">
      <CommandInput value={text} onValueChange={setText} placeholder="Search players, teams, matches, grounds" />
      <CommandList>
        {query === text && text.trim().length >= 2 && n === 0 && <CommandEmpty>No player, team, match or ground matches “{text.trim()}”</CommandEmpty>}
        {text.trim().length < 2 && (
          <>
            <CommandGroup heading="Go to">{[["Player props", "/props"], ["Fancy lines", "/fancy"], ["Fixtures", "/"], ["Saved", "/saved"]].map(([l, to]) => <CommandItem key={to} value={`go ${l}`} onSelect={() => go(to)}>{l}</CommandItem>)}</CommandGroup>
            {seen.length > 0 && <CommandGroup heading="Recently viewed">{seen.map((i) => <CommandItem key={`r${i}`} value={`recent ${i}`} onSelect={() => go(`/player/${i}`)}><PlayerBadge idx={i} size="xs" />{store.playerName(i)}<span className="ml-auto text-footnote text-muted-foreground">{store.teamName(store.P.tm[i])}</span></CommandItem>)}</CommandGroup>}
          </>
        )}
        {items.fixtures.length > 0 && <CommandGroup heading="Matches">{items.fixtures.map((f: any) => <CommandItem key={`f${f.id}`} value={`${text} f${f.id}`} onSelect={() => go(`/fixture/${f.id}`)}><TeamBadge name={f.a} size="xs" />{f.a} v {f.b}<span className="ml-auto text-footnote text-muted-foreground">{dayLabel(dayKey(f))}</span></CommandItem>)}</CommandGroup>}
        {items.venues.length > 0 && <CommandGroup heading="Grounds">{items.venues.map((v: any) => <CommandItem key={`v${v.idx}`} value={`${text} v${v.idx}`} onSelect={() => go(`/venue/${v.idx}`)}>{v.name}</CommandItem>)}</CommandGroup>}
        {items.teams.length > 0 && <CommandGroup heading="Teams">{items.teams.map((t: any) => <CommandItem key={`t${t.idx}`} value={`${text} t${t.idx}`} onSelect={() => go(`/team/${t.idx}`)}><TeamBadge name={t.name} size="xs" />{t.name}</CommandItem>)}</CommandGroup>}
        {items.players.length > 0 && <CommandGroup heading="Players">{items.players.map((p: any) => <CommandItem key={`p${p.idx}`} value={`${text} p${p.idx}`} onSelect={() => go(`/player/${p.idx}`)}><PlayerBadge idx={p.idx} size="xs" /><PlayerName idx={p.idx} always fallback={p.name} /><span className="ml-auto text-footnote text-muted-foreground">{store.teamName(p.team)}</span></CommandItem>)}</CommandGroup>}
      </CommandList>
    </CommandDialog>
  );
}
