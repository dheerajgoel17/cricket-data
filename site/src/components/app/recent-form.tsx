/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { teamForm } from "@cricket/engine/form.js";
import { FORMATS } from "@cricket/engine/util.js";
import { useData } from "@/lib/data";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TeamBadge } from "./badges";

const CHIP: Record<string, string> = { W: "bg-[#2fa84f] text-white", L: "bg-[#e5484d] text-white", T: "bg-[#8e8e93] text-white", D: "bg-[#8e8e93] text-white", NR: "bg-[#8e8e93] text-white" };
const WORD: Record<string, string> = { W: "Won", L: "Lost", T: "Tied", D: "Drawn", NR: "No result" };
/** Closed row: last 3 so both sides fit on a phone; the open body is still last 5. */
const HEADLINE_N = 3;

/** W / L / NR chips, oldest to newest. Full size underlines the latest; compact is the closed-row size. */
export function FormChips({ results, className, compact }: { results: string[]; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center", compact ? "shrink-0 gap-hair" : "gap-tight", className)} role="img" aria-label={`Recent results, oldest first: ${results.map((r) => WORD[r]).join(", ")}`}>
      {results.map((r, i) => (
        <span key={i} className={cn("grid shrink-0 justify-items-center", !compact && "gap-hair")}>
          <span className={cn("grid place-items-center rounded-md font-bold", compact ? "size-5 text-caption" : "size-7 text-footnote", CHIP[r])}>{r}</span>
          {!compact && <span className={cn("h-0.5 w-5 rounded-full", i === results.length - 1 ? "bg-foreground/60" : "bg-transparent")} />}
        </span>))}
    </div>
  );
}

/** Closed accordion row: last 3 W/L chips per side. */
export function FormHeadline({ teams, fmt }: { teams: [string, number][]; fmt: string }) {
  const { store } = useData();
  const forms = useMemo(() => recentForms(store, teams, fmt, HEADLINE_N), [store, teams, fmt]);
  return (
    <span className="flex min-w-0 flex-1 items-center gap-snug">
      <span className="shrink-0 text-body font-semibold">Recent form</span>
      <span className="ml-auto flex min-w-0 items-center justify-end gap-snug">
        {forms.filter((f) => f.games.length).map(({ name, idx, games }) => (
          <span key={idx} className="flex shrink-0 items-center gap-tight" title={name}>
            <TeamBadge name={name} size="xs" />
            <FormChips compact results={games.map((g) => g.result)} />
          </span>
        ))}
      </span>
    </span>
  );
}

function FormGames({ games, store }: { games: any[]; store: any }) {
  return (
    <ul>
      {[...games].reverse().map((g) => (
        <li key={g.m} className="flex items-center gap-snug border-t border-hairline py-snug">
          <span className={cn("grid size-7 shrink-0 place-items-center rounded-md text-footnote font-bold", CHIP[g.result])}>{g.result}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-callout font-medium">vs <Link to={`/team/${g.opp}`} className="hover:underline">{store.teamName(g.opp)}</Link></div>
            <div className="truncate text-footnote text-muted-foreground">{shortDate(g.date)}{g.event != null && store.events[g.event] ? ` · ${store.events[g.event]}` : ""}</div>
          </div>
          <div className="shrink-0 text-right text-footnote tabular-nums text-muted-foreground"><div className="font-medium text-foreground">{g.own ?? "–"}</div><div>{g.theirs ?? "–"}</div></div>
        </li>))}
    </ul>
  );
}

/** Last results in this format (never mixed). Body only — the fixture accordion wraps the heading. */
export function RecentForm({ teams, fmt }: { teams: [string, number][]; fmt: string }) {
  const { store } = useData();
  const forms = useMemo(() => recentForms(store, teams, fmt), [store, teams, fmt]);
  if (!forms.some((f) => f.games.length)) return null;
  return (
    <div className="flex flex-col" aria-label="Recent form">
      {forms.map(({ name, idx, games }) => (
        <div key={idx}>
          <div className="flex items-center gap-snug py-snug">
            <TeamBadge name={name} size="sm" />
            <span className="min-w-0 flex-1 truncate text-callout font-medium">{name}</span>
            {games.length ? <FormChips results={games.map((g) => g.result)} /> : <span className="text-callout text-muted-foreground">No {fmt} results</span>}
          </div>
          {!!games.length && <FormGames games={games} store={store} />}
        </div>
      ))}
    </div>
  );
}

export function recentForms(store: any, teams: [string, number][], fmt: string, n = 5) {
  const fmtIdx = FORMATS.indexOf(fmt);
  return teams.filter(([, i]) => i >= 0).map(([name, i]) => ({ name, idx: i, games: teamForm(store, i, fmtIdx, n) as any[] }));
}
