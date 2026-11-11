import { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Chip } from "./chip";

export type FancySample = "" | "1" | "h2h";

const WINDOWS = [5, 10, 20, 30];

/** Match Fancy sample filters (window + ground), same sheet chrome as the Props screener. Edits are held until Apply. */
export function FancyFilters({ open, onOpenChange, win, sample, venueName, hasVenue, hasPair, onApply }: {
  open: boolean; onOpenChange: (o: boolean) => void; win: number; sample: FancySample; venueName: string; hasVenue: boolean; hasPair: boolean;
  onApply: (next: { win: number; sample: FancySample }) => void;
}) {
  const wide = !useIsMobile();
  const [draftWin, setDraftWin] = useState(win);
  const [draftSample, setDraftSample] = useState(sample);
  useEffect(() => { if (open) { setDraftWin(win); setDraftSample(sample); } }, [open, win, sample]);
  const dirty = draftWin !== win || draftSample !== sample;
  const apply = () => { onApply({ win: draftWin, sample: draftSample }); onOpenChange(false); };
  const clear = () => { setDraftWin(20); setDraftSample(""); };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={wide ? "right" : "bottom"} showCloseButton={false}
        className={wide ? "w-[26rem] max-w-full gap-0 border-l border-hairline sm:max-w-[26rem]" : "h-auto max-h-[85dvh] gap-0 rounded-t-[1.25rem] border-0 pt-snug"}>
        <header className="flex h-header shrink-0 items-center justify-between gap-snug border-b border-hairline px-gutter">
          <SheetTitle className="text-title font-bold tracking-tight">Filters</SheetTitle>
          <SheetDescription className="sr-only">Choose how many past matches to score, and whether to use recent team matches, venue history, or head-to-head history.</SheetDescription>
          <button type="button" aria-label="Close filters" onClick={() => onOpenChange(false)} className="grid size-control place-items-center rounded-full bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring"><XMarkIcon className="size-5" /></button>
        </header>
        <div className="flex flex-col gap-stack overflow-y-auto px-gutter py-stack">
          <section className="flex flex-col gap-snug">
            <h3 className="text-body font-medium">Hit-rate window</h3>
            <div className="flex flex-wrap gap-snug">{WINDOWS.map((n) => <Chip key={n} on={draftWin === n} onClick={() => setDraftWin(n)}>L{n}</Chip>)}</div>
            <p className="text-footnote text-muted-foreground">How many recent matches in this format to score each market against.</p>
          </section>
          {(hasVenue || hasPair) && (
            <section className="flex flex-col gap-snug">
              <h3 className="text-body font-medium">Matches from</h3>
              <div className="flex flex-wrap gap-snug">
                <Chip on={!draftSample} onClick={() => setDraftSample("")}>Recent team matches</Chip>
                {hasVenue && <Chip on={draftSample === "1"} onClick={() => setDraftSample("1")}>At {venueName}</Chip>}
                {hasPair && <Chip on={draftSample === "h2h"} onClick={() => setDraftSample("h2h")}>Head-to-head</Chip>}
              </div>
              <p className="text-footnote text-muted-foreground">The window applies to each team in recent form, or to the matching games in the selected split.</p>
            </section>
          )}
        </div>
        <footer className="flex shrink-0 items-center gap-snug border-t border-hairline bg-background px-gutter pt-snug pb-[max(var(--space-snug),env(safe-area-inset-bottom))]">
          <Button type="button" variant="secondary" className="h-(--touch) flex-1 rounded-full text-body" disabled={draftWin === 20 && !draftSample} onClick={clear}>Clear</Button>
          <Button type="button" className="h-(--touch) flex-[2] rounded-full bg-primary text-body font-medium text-primary-foreground" onClick={apply}>{dirty ? "Apply" : "Done"}</Button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
