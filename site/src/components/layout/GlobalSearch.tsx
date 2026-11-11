/* eslint-disable @typescript-eslint/no-explicit-any */
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

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
  const trigger = useRef<HTMLElement | null>(null);
  const show = () => {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  };
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    trigger.current?.focus();
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (!open) show(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  return { open, setOpen, show, restoreFocus };
}

/** Search opens on activation and remains a normal tab stop. */
export function SearchField({ onOpen, className = "" }: { onOpen: () => void; className?: string }) {
  return (
    <button type="button" aria-haspopup="dialog" aria-label="Search" onClick={onOpen}
      className={`h-10 items-center gap-snug rounded-[var(--chip-radius)] bg-muted px-inset text-left text-body text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring ${className}`}>
      <MagnifyingGlassIcon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">Search players, teams, matches, grounds</span>
      <Kbd aria-hidden>⌘K</Kbd>
    </button>
  );
}

export function SearchDialog({ open, onOpenChange, onCloseAutoFocus }: { open: boolean; onOpenChange: (o: boolean) => void; onCloseAutoFocus: (event: Event) => void }) {
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
    <CommandDialog onCloseAutoFocus={onCloseAutoFocus} open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setText(""); }} title="Search" description="Search players, teams, matches and grounds">
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
