import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCombos } from "@/lib/saved";
import { DEFAULTS, INNS_LABEL, MIN_STEPS, SORT_LABEL, WIN_LABEL, activeFilters, screenerQuery, type Inns, type Screener, type Sort, type Win } from "@/lib/screener";
import { Chip } from "./chip";

export interface FilterChoices {
  days: [string, string][];
  matches: { id: string; label: string }[];
  teams: string[];
  formats: string[];
  comps: string[];
  winLabel: Record<string, string>;
}

/** A section's header: its name and, when it is not at the default, the value it holds (so closed sections still say what is set). */
function Head({ name, value }: { name: string; value?: string }) {
  return <span className="flex min-w-0 items-center gap-snug text-body font-semibold">{name}{value ? <span className="truncate rounded-[var(--chip-radius)] bg-primary/15 px-snug py-hair text-footnote font-medium text-primary">{value}</span> : null}</span>;
}

const Section = ({ id, name, value, children }: { id: string; name: string; value?: string; children: ReactNode }) => (
  <AccordionItem value={id} className="border-b border-hairline">
    <AccordionTrigger className="min-h-row py-snug text-body hover:no-underline"><Head name={name} value={value} /></AccordionTrigger>
    <AccordionContent className="flex flex-wrap gap-snug pb-stack">{children}</AccordionContent>
  </AccordionItem>
);

/**
 * The Props filters. Below lg it is a full-screen view (a phone filters with room to read and a sticky Apply); from lg it is a right-hand drawer.
 * Edits are held in a draft until Apply; Clear all resets the draft; every section shows what it holds. Choices come from the rows on screen,
 * so only values that exist are offered. Saving a combination stores the resulting query (it is also the shareable link).
 */
export function ScreenerFilters({ open, onOpenChange, state, onApply, choices }: {
  open: boolean; onOpenChange: (o: boolean) => void; state: Screener; onApply: (s: Screener) => void; choices: FilterChoices;
}) {
  const wide = !useIsMobile();
  const [draft, setDraft] = useState(state);
  const [name, setName] = useState("");
  const { save } = useCombos();
  useEffect(() => { if (open) setDraft(state); }, [open, state]);
  const set = (patch: Partial<Screener>) => setDraft((d) => ({ ...d, ...patch }));
  const dayName = (d: string) => choices.days.find(([k]) => k === d)?.[1] ?? d;
  const matchName = (id: string) => choices.matches.find((m) => m.id === id)?.label ?? id;
  const active = useMemo(() => activeFilters(draft, { day: dayName, match: matchName }).length, [draft, choices]); // eslint-disable-line react-hooks/exhaustive-deps
  const one = <T extends string>(field: keyof Screener, items: [T, string][], cur: string) => items.map(([k, l]) => <Chip key={k} on={cur === k} onClick={() => set({ [field]: k } as Partial<Screener>)}>{l}</Chip>);
  const link = () => `${location.origin}/props${screenerQuery(draft)}`;
  const apply = () => { onApply(draft); onOpenChange(false); };
  const copy = async () => { try { await navigator.clipboard.writeText(link()); toast("Link copied"); } catch { toast("Copy failed: select the address bar instead"); } };
  const keep = () => { if (!screenerQuery(draft)) return toast("Set a filter first, then save it."); const n = name.trim() || "My filters"; save(n, screenerQuery(draft)); setName(""); toast(`Saved as “${n}”. Find it under Saved.`); };
  const all = (v: string) => ["all", v] as [string, string];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={wide ? "right" : "bottom"} showCloseButton={false}
        className={wide ? "w-[26rem] max-w-full gap-0 border-l border-hairline sm:max-w-[26rem]" : "h-dvh max-h-dvh gap-0 rounded-none border-0 pt-[env(safe-area-inset-top)]"}>
        <header className="flex h-header shrink-0 items-center justify-between gap-snug border-b border-hairline px-gutter">
          <SheetTitle className="text-title font-bold tracking-tight">Filters{active ? <span className="ml-snug rounded-full bg-primary px-snug py-hair text-footnote font-bold text-primary-foreground">{active}</span> : null}</SheetTitle>
          <SheetDescription className="sr-only">Narrow the props by day, match, team, format, competition, hit rate and sort order.</SheetDescription>
          <button type="button" aria-label="Close filters" onClick={() => onOpenChange(false)} className="grid size-control place-items-center rounded-full bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring"><XMarkIcon className="size-5" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-gutter">
          <Accordion type="multiple" defaultValue={["day", "window"]}>
            <Section id="day" name="Day" value={draft.day !== DEFAULTS.day ? dayName(draft.day) : undefined}>{one("day", choices.days, draft.day)}</Section>
            {choices.matches.length > 0 && <Section id="match" name="Match" value={draft.match !== "all" ? matchName(draft.match) : undefined}>{one("match", [all("All matches"), ...choices.matches.map((m) => [m.id, m.label] as [string, string])], draft.match)}</Section>}
            {choices.teams.length > 1 && <Section id="team" name="Team" value={draft.team !== "all" ? draft.team : undefined}>{one("team", [all("Any team"), ...choices.teams.map((t) => [t, t] as [string, string])], draft.team)}</Section>}
            {choices.formats.length > 1 && <Section id="fmt" name="Format" value={draft.fmt !== "all" ? draft.fmt : undefined}>{one("fmt", [all("All formats"), ...choices.formats.map((t) => [t, t] as [string, string])], draft.fmt)}</Section>}
            {choices.comps.length > 1 && <Section id="comp" name="Competition" value={draft.comp !== "all" ? draft.comp : undefined}>{one("comp", [all("All competitions"), ...choices.comps.map((t) => [t, t] as [string, string])], draft.comp)}</Section>}
            <Section id="window" name="Hit-rate window" value={draft.win !== DEFAULTS.win || draft.min ? `${WIN_LABEL[draft.win]}${draft.min ? ` · ${draft.min}%+` : ""}` : undefined}>
              <div className="grid w-full gap-snug">
                <div className="flex flex-wrap gap-snug">{(Object.keys(WIN_LABEL) as Win[]).map((w) => <Chip key={w} on={draft.win === w} onClick={() => set({ win: w })}>{choices.winLabel[w] ?? WIN_LABEL[w]}</Chip>)}</div>
                <span className="text-footnote text-muted-foreground">Minimum hit rate in this window. Rows with too few games in it are left out, never guessed.</span>
                <div className="flex flex-wrap gap-snug">{MIN_STEPS.map((m) => <Chip key={m} on={draft.min === m} onClick={() => set({ min: m })}>{m ? `${m}%+` : "Any"}</Chip>)}</div>
              </div>
            </Section>
            <Section id="inns" name="Batting innings" value={draft.inns !== "all" ? INNS_LABEL[draft.inns] : undefined}>
              <div className="grid w-full gap-snug">
                <div className="flex flex-wrap gap-snug">{(Object.keys(INNS_LABEL) as Inns[]).map((i) => <Chip key={i} on={draft.inns === i} onClick={() => set({ inns: i })}>{INNS_LABEL[i]}</Chip>)}</div>
                <span className="text-footnote text-muted-foreground">Scores every row again using only the games where his side batted first (or chased). Matches without innings detail are left out, so samples are smaller.</span>
              </div>
            </Section>
            <Section id="sort" name="Sort" value={draft.sort !== DEFAULTS.sort ? SORT_LABEL[draft.sort] : undefined}>
              {(Object.keys(SORT_LABEL) as Sort[]).map((s) => <Chip key={s} on={draft.sort === s} onClick={() => set({ sort: s })}>{SORT_LABEL[s]}</Chip>)}
            </Section>
            <Section id="show" name="Display" value={draft.value || !draft.bars ? [draft.value && "Edge > 0", !draft.bars && "No charts"].filter(Boolean).join(" · ") : undefined}>
              <div className="grid w-full gap-snug">
                <label className="flex min-h-row items-center justify-between gap-stack text-body">Only positive edge<Switch checked={draft.value} onCheckedChange={(v) => set({ value: v })} aria-label="Only positive edge" /></label>
                <label className="flex min-h-row items-center justify-between gap-stack text-body">Form charts<Switch checked={draft.bars} onCheckedChange={(v) => set({ bars: v })} aria-label="Form charts" /></label>
              </div>
            </Section>
            <Section id="share" name="Save and share">
              <div className="grid w-full gap-snug">
                <div className="flex gap-snug"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this combination" aria-label="Name this combination" maxLength={40} className="h-control" /><Button type="button" variant="secondary" className="h-control rounded-full" onClick={keep}>Save</Button></div>
                <Button type="button" variant="secondary" className="h-control justify-self-start rounded-full" onClick={copy}>Copy link to these filters</Button>
                <span className="text-footnote text-muted-foreground">Saved on this device only; the link opens the same view anywhere.</span>
              </div>
            </Section>
          </Accordion>
        </div>
        <footer className="flex shrink-0 items-center gap-snug border-t border-hairline bg-background px-gutter pt-snug pb-[max(var(--space-snug),env(safe-area-inset-bottom))]">
          <Button type="button" variant="secondary" className="h-(--touch) flex-1 rounded-full text-body" disabled={!active && draft.stat === state.stat} onClick={() => setDraft({ ...DEFAULTS })}>Clear all</Button>
          <Button type="button" className="h-(--touch) flex-[2] rounded-full bg-primary text-body font-semibold text-primary-foreground" onClick={apply}>Apply</Button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
