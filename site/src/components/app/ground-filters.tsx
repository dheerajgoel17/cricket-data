import { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Chip } from "./chip";
import type { GenderFilter } from "@/lib/ground";

export type { GenderFilter } from "@/lib/ground";

/** Ground gender filter sheet — same chrome as Props / Match Fancy filters. Edits held until Apply. */
export function GroundGenderSheet({ open, onOpenChange, gender, onApply }: {
  open: boolean; onOpenChange: (o: boolean) => void; gender: GenderFilter;
  onApply: (next: GenderFilter) => void;
}) {
  const wide = !useIsMobile();
  const [draft, setDraft] = useState<GenderFilter>(gender);
  useEffect(() => { if (open) setDraft(gender); }, [open, gender]);
  const dirty = draft !== gender;
  const apply = () => { onApply(draft); onOpenChange(false); };
  const clear = () => setDraft("");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={wide ? "right" : "bottom"} showCloseButton={false}
        className={wide ? "w-[26rem] max-w-full gap-0 border-l border-hairline sm:max-w-[26rem]" : "h-auto max-h-[85dvh] gap-0 rounded-t-[1.25rem] border-0 pt-snug"}>
        <header className="flex h-header shrink-0 items-center justify-between gap-snug border-b border-hairline px-gutter">
          <SheetTitle className="text-title font-emphasis tracking-tight">Filters</SheetTitle>
          <SheetDescription className="sr-only">Choose men's, women's or all matches at this ground.</SheetDescription>
          <button type="button" aria-label="Close filters" onClick={() => onOpenChange(false)} className="grid size-control place-items-center rounded-full bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring"><XMarkIcon className="size-5" /></button>
        </header>
        <div className="flex flex-col gap-stack overflow-y-auto px-gutter py-stack">
          <section className="flex flex-col gap-snug">
            <h3 className="text-body font-label">Gender</h3>
            <div className="flex flex-wrap gap-snug">
              <Chip on={draft === ""} onClick={() => setDraft("")}>All</Chip>
              <Chip on={draft === "male"} onClick={() => setDraft("male")}>Men</Chip>
              <Chip on={draft === "female"} onClick={() => setDraft("female")}>Women</Chip>
            </div>
            <p className="text-footnote text-muted-foreground">Men's and women's cricket are never mixed in the stats. Pick one, or All for the match list only.</p>
          </section>
        </div>
        <footer className="flex shrink-0 items-center gap-snug border-t border-hairline bg-background px-gutter pt-snug pb-[max(var(--space-snug),env(safe-area-inset-bottom))]">
          <Button type="button" variant="secondary" className="h-(--touch) flex-1 rounded-full text-body" disabled={!draft} onClick={clear}>Clear</Button>
          <Button type="button" className="h-(--touch) flex-[2] rounded-full bg-primary text-body font-label text-primary-foreground" onClick={apply}>{dirty ? "Apply" : "Done"}</Button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
