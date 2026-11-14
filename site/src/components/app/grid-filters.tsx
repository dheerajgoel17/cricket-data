import { useEffect, useState } from "react";
import { AdjustmentsHorizontalIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { ActiveChip, Chip } from "./chip";
import { LineStepper } from "./line-stepper";
import { PillGroup } from "./pill-group";

const GAMES = [5, 10, 15, 20, 30];
const HITS: [string, string][] = [["0.5", "50%+"], ["0.6", "60%+"], ["0.7", "70%+"], ["0.8", "80%+"]];
const DEFAULT_LINE = 0.5;
const DEFAULT_GAMES = 10;
const DEFAULT_HIT = "0.6";

/** Sheet for Grid / Custom line: custom line, games window, and (on Custom line) the hit-rate floor. Same chrome as Props / Fancy filters. */
export function GridLineSheet({ open, onOpenChange, line, games, hit, onApply }: {
  open: boolean; onOpenChange: (o: boolean) => void; line: number; games: number; hit?: string;
  onApply: (next: { line: number; games: number; hit?: string }) => void;
}) {
  const wide = !useIsMobile();
  const withHit = hit !== undefined;
  const [draftLine, setDraftLine] = useState(line);
  const [draftGames, setDraftGames] = useState(games);
  const [draftHit, setDraftHit] = useState(hit ?? DEFAULT_HIT);
  useEffect(() => { if (open) { setDraftLine(line); setDraftGames(games); setDraftHit(hit ?? DEFAULT_HIT); } }, [open, line, games, hit]);
  const dirty = draftLine !== line || draftGames !== games || (withHit && draftHit !== hit);
  const apply = () => { onApply({ line: draftLine, games: draftGames, ...(withHit ? { hit: draftHit } : {}) }); onOpenChange(false); };
  const clear = () => { setDraftLine(DEFAULT_LINE); setDraftGames(DEFAULT_GAMES); if (withHit) setDraftHit(DEFAULT_HIT); };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={wide ? "right" : "bottom"} showCloseButton={false}
        className={wide ? "w-[26rem] max-w-full gap-0 border-l border-hairline sm:max-w-[26rem]" : "h-auto max-h-[85dvh] gap-0 rounded-t-[1.25rem] border-0 pt-snug"}>
        <header className="flex h-header shrink-0 items-center justify-between gap-snug border-b border-hairline px-gutter">
          <SheetTitle className="text-title font-emphasis tracking-tight">Filters</SheetTitle>
          <SheetDescription className="sr-only">Set the custom line, how many recent games to score, and the minimum hit rate.</SheetDescription>
          <button type="button" aria-label="Close filters" onClick={() => onOpenChange(false)} className="grid size-control place-items-center rounded-full bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring"><XMarkIcon className="size-5" /></button>
        </header>
        <div className="flex flex-col gap-stack overflow-y-auto px-gutter py-stack">
          <section className="flex flex-col gap-snug">
            <h3 className="text-body font-label">Custom line</h3>
            <LineStepper value={draftLine} label="O" min={0} onStep={(d) => setDraftLine(Math.max(0, Math.round((draftLine + d) * 2) / 2))} />
            <p className="text-footnote text-muted-foreground">The over line each cell and streak is scored against.</p>
          </section>
          <section className="flex flex-col gap-snug">
            <h3 className="text-body font-label">Hit-rate window</h3>
            <div className="flex flex-wrap gap-snug">{GAMES.map((n) => <Chip key={n} on={draftGames === n} onClick={() => setDraftGames(n)}>L{n}</Chip>)}</div>
            <p className="text-footnote text-muted-foreground">How many of each team's recent games in this format to show.</p>
          </section>
          {withHit && (
            <section className="flex flex-col gap-snug">
              <h3 className="text-body font-label">Minimum hit rate</h3>
              <div className="flex flex-wrap gap-snug">{HITS.map(([v, l]) => <Chip key={v} on={draftHit === v} onClick={() => setDraftHit(v)}>{l}</Chip>)}</div>
              <p className="text-footnote text-muted-foreground">Only list players who clear the custom line at least this often in the window.</p>
            </section>
          )}
        </div>
        <footer className="flex shrink-0 items-center gap-snug border-t border-hairline bg-background px-gutter pt-snug pb-[max(var(--space-snug),env(safe-area-inset-bottom))]">
          <Button type="button" variant="secondary" className="h-(--touch) flex-1 rounded-full text-body" disabled={draftLine === DEFAULT_LINE && draftGames === DEFAULT_GAMES && (!withHit || draftHit === DEFAULT_HIT)} onClick={clear}>Clear</Button>
          <Button type="button" className="h-(--touch) flex-[2] rounded-full bg-primary text-body font-label text-primary-foreground" onClick={apply}>{dirty ? "Apply" : "Done"}</Button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}

/** Stat chips + Filters button (Props / Fancy pattern) for the Grid and Custom line tabs. */
export function GridFilterBar({ stat, line, games, hit, items, setQ }: {
  stat: string; line: number; games: number; hit?: string; items: [string, string][];
  setQ: (p: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const active: { key: string; label: string; value: string }[] = [];
  if (line !== DEFAULT_LINE) active.push({ key: "line", label: "Line", value: `O ${line}` });
  if (games !== DEFAULT_GAMES) active.push({ key: "n", label: "Window", value: `L${games}` });
  if (hit !== undefined && hit !== DEFAULT_HIT) active.push({ key: "hit", label: "Hit", value: HITS.find(([v]) => v === hit)?.[1] ?? hit });
  const clearKey = (key: string) => {
    if (key === "line") setQ({ line: "" });
    else if (key === "n") setQ({ n: "" });
    else if (key === "hit") setQ({ hit: "" });
  };
  return (
    <div className="flex flex-col gap-snug">
      <div className="flex items-center gap-snug">
        <PillGroup layoutId="fx-stat" label="Stat" value={stat} onChange={(v) => setQ({ stat: v })} items={items} className="min-w-0 flex-1" />
        <Button type="button" variant="secondary" size="sm" aria-label={`Filters${active.length ? `, ${active.length} active` : ""}`} onClick={() => setOpen(true)}
          className="relative h-control shrink-0 rounded-[var(--chip-radius)] bg-card px-snug text-callout shadow-none">
          <AdjustmentsHorizontalIcon className="size-4" />L{games}
          {active.length > 0 && <span className="absolute -right-hair -top-hair grid min-w-4 place-items-center rounded-full bg-primary px-hair text-caption font-emphasis text-primary-foreground ring-2 ring-background">{active.length}</span>}
        </Button>
      </div>
      {active.length > 0 && (
        <div className="-mx-gutter flex items-center gap-snug overflow-x-auto px-gutter [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Active filters">
          {active.map((f) => <ActiveChip key={f.key} label={f.label} value={f.value} onRemove={() => clearKey(f.key)} />)}
          <button type="button" onClick={() => setQ({ line: "", n: "", ...(hit !== undefined ? { hit: "" } : {}) })} className="h-control shrink-0 px-snug text-callout font-label text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">Clear all</button>
        </div>
      )}
      <GridLineSheet open={open} onOpenChange={setOpen} line={line} games={games} hit={hit}
        onApply={({ line: l, games: g, hit: h }) => setQ({ line: l === DEFAULT_LINE ? "" : l, n: g === DEFAULT_GAMES ? "" : g, ...(hit !== undefined ? { hit: h === DEFAULT_HIT ? "" : h } : {}) })} />
    </div>
  );
}
