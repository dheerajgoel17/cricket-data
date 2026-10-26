/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useData } from "@/lib/data";
import { PlayerBadge } from "./badges";

/** Text input with a typo-tolerant player dropdown (engine resolver). Calls onPick(playerIdx). */
export function PlayerPicker({ placeholder, initial, onPick, className }: { placeholder: string; initial?: number | null; onPick: (idx: number) => void; className?: string }) {
  const { store, rz } = useData();
  const [text, setText] = useState(initial != null ? store.playerName(initial) : "");
  const [open, setOpen] = useState(false);
  const items = useMemo(() => (text.trim().length < 2 ? [] : (rz.players(text.trim(), {}, 8) as any[])), [text, rz]);
  return (
    <Popover open={open && items.length > 0} onOpenChange={setOpen}>
      <PopoverAnchor asChild><Input value={text} placeholder={placeholder} onChange={(e) => { setText(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} className={className ?? "w-52"} autoComplete="off" /></PopoverAnchor>
      <PopoverContent align="start" onOpenAutoFocus={(e) => e.preventDefault()} className="w-72 p-1">
        <Command shouldFilter={false}><CommandList><CommandGroup>{items.map((p) => (
          <CommandItem key={p.idx} value={`p${p.idx}`} onSelect={() => { setText(p.name); setOpen(false); onPick(p.idx); }}><PlayerBadge idx={p.idx} size="xs" />{p.name}<span className="ml-auto text-xs text-muted-foreground">{store.teamName(p.team)} · {p.last.slice(0, 4)}</span></CommandItem>))}</CommandGroup></CommandList></Command>
      </PopoverContent>
    </Popover>
  );
}
