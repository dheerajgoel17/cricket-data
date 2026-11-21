import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { HOME_PHASES, type HomePhase } from "@/lib/home-phase";

/** Line-tab chrome for the home phase bar: primary text + underline on the hairline; no focus/active chrome. */
const phaseTab = cn(
  "h-auto flex-none justify-start rounded-none border-0 bg-transparent px-0 py-stack outline-none",
  "text-callout font-label text-muted-foreground shadow-none hover:text-foreground",
  "after:bg-primary group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-0 group-data-[orientation=horizontal]/tabs:after:h-0.5",
  "data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none",
  "dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-primary",
  "focus:outline-none focus-visible:border-transparent focus-visible:bg-transparent focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
  "dark:focus-visible:border-transparent dark:focus-visible:bg-transparent",
);

/** Match-state underline tabs (In play / Pre-match / Completed): left-aligned, content-width, edge-to-edge hairline, equal stack padding, theme primary on the selected tab. */
export function HomePhaseBar({ value, counts, onChange }: { value: HomePhase; counts: Record<HomePhase, number>; onChange: (p: HomePhase) => void }) {
  const pick = (p: string) => {
    if (p === value) return;
    track("home_phase", { phase: p });
    onChange(p as HomePhase);
  };
  return (
    <nav data-flush aria-label="Match state" className="-mx-gutter border-b border-hairline px-gutter">
      <Tabs value={value} onValueChange={pick} className="min-w-0 gap-0">
        <TabsList variant="line" aria-label="Fixture phase" className="h-auto w-full justify-start gap-stack rounded-none bg-transparent p-0 group-data-[orientation=horizontal]/tabs:h-auto">
          {HOME_PHASES.map(([id, label]) => (
            <TabsTrigger key={id} value={id} className={phaseTab}>
              <span className="flex items-center gap-hair">
                {label}
                <span className="text-caption font-label tabular-nums opacity-70">{counts[id]}</span>
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </nav>
  );
}

export const EMPTY_PHASE: Record<HomePhase, { title: string; body: string }> = {
  live: { title: "Nothing in play", body: "Pre-match lists the next games with priced lines." },
  pre: { title: "No pre-match props yet", body: "Lines usually land a few hours before the toss." },
  final: { title: "No resulted matches", body: "Finished priced games stay listed for a day after the start." },
};
