/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { teamForm } from "@/engine/form.js";
import { FORMATS } from "@/engine/util.js";
import { useData } from "@/lib/data";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TeamBadge } from "./badges";

const CHIP: Record<string, string> = { W: "bg-[#2fa84f] text-white", L: "bg-[#e5484d] text-white", T: "bg-[#8e8e93] text-white", D: "bg-[#8e8e93] text-white", NR: "bg-[#8e8e93] text-white" };
const WORD: Record<string, string> = { W: "Won", L: "Lost", T: "Tied", D: "Drawn", NR: "No result" };

/** W / L / NR chips, oldest to newest; the latest result is underlined. */
export function FormChips({ results, className }: { results: string[]; className?: string }) {
  return (
    <div className={cn("flex items-center gap-tight", className)} role="img" aria-label={`Recent results, oldest first: ${results.map((r) => WORD[r]).join(", ")}`}>
      {results.map((r, i) => (
        <span key={i} className="grid justify-items-center gap-hair">
          <span className={cn("grid size-7 place-items-center rounded-md text-footnote font-bold", CHIP[r])}>{r}</span>
          <span className={cn("h-0.5 w-5 rounded-full", i === results.length - 1 ? "bg-foreground/60" : "bg-transparent")} />
        </span>))}
    </div>
  );
}

/** "Recent form": each team's last results in this format (never mixed), as chips; open a team to see opponent, score and date for each game. */
export function RecentForm({ teams, fmt }: { teams: [string, number][]; fmt: string }) {
  const { store } = useData();
  const fmtIdx = FORMATS.indexOf(fmt);
  const forms = useMemo(() => teams.filter(([, i]) => i >= 0).map(([name, i]) => ({ name, idx: i, games: teamForm(store, i, fmtIdx, 5) as any[] })), [store, teams, fmtIdx]);
  if (!forms.some((f) => f.games.length)) return null;
  return (
    <section className="mt-section" aria-label="Recent form">
      <h2 className="text-title font-bold tracking-tight">Recent form <span className="text-callout font-medium text-muted-foreground">· {fmt}</span></h2>
      <Accordion type="multiple" className="mt-tight">
        {forms.map(({ name, idx, games }) => (
          <AccordionItem key={idx} value={String(idx)} className="border-white/10">
            <AccordionTrigger className="items-center py-stack hover:no-underline">
              <span className="flex min-w-0 flex-1 items-center gap-snug">
                <TeamBadge name={name} size="sm" />
                <span className="truncate text-body font-semibold">{name}</span>
              </span>
              {games.length ? <FormChips results={games.map((g) => g.result)} className="mr-2" /> : <span className="mr-2 text-callout text-muted-foreground">No {fmt} results</span>}
            </AccordionTrigger>
            <AccordionContent className="pb-tight">
              <ul>
                {[...games].reverse().map((g) => (
                  <li key={g.m} className="flex items-center gap-snug border-t border-white/5 py-snug">
                    <span className={cn("grid size-7 shrink-0 place-items-center rounded-md text-footnote font-bold", CHIP[g.result])}>{g.result}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-callout font-medium">vs <Link to={`/team/${g.opp}`} className="hover:underline">{store.teamName(g.opp)}</Link></div>
                      <div className="truncate text-footnote text-muted-foreground">{shortDate(g.date)}{g.event != null && store.events[g.event] ? ` · ${store.events[g.event]}` : ""}</div>
                    </div>
                    <div className="shrink-0 text-right text-footnote tabular-nums text-muted-foreground"><div className="font-medium text-foreground">{g.own ?? "–"}</div><div>{g.theirs ?? "–"}</div></div>
                  </li>))}
              </ul>
            </AccordionContent>
          </AccordionItem>))}
      </Accordion>
    </section>
  );
}
