/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { fancyByLine, fancyFor, fancyHeadline, fixtureBooks } from "@/engine/lines.js";
import { MATCH_MARKETS } from "@/engine/markets.js";
import { fixtureStart, localWhen, odds } from "@/lib/format";
import { setTitle } from "@/lib/title";
import { usePricedFixtures } from "@/hooks/useEngine";
import { HotProps } from "@/components/app/hot-props";
import { TeamBadge } from "@/components/app/badges";
import { RowsSkeleton } from "@/components/app/skeletons";

/** Player props: the hot props of every priced match, with the day switch and filters the component carries. */
export function PropsPage() {
  setTitle("Cricket player props: hit rates and book lines");
  return (
    <div className="flex flex-col gap-section">
      <h1 className="text-title font-bold tracking-tight">Player props</h1>
      <HotProps />
    </div>
  );
}

const SHOWN = ["match_runs", "first_innings_runs", "match_sixes", "match_fours", "match_boundaries", "match_wickets", "highest_over", "top_score"]; // the match markets, in the order the fixture's Fancy tab lists them

/** Fancy: every priced match's whole-match lines (the exchange-style over/under markets), each match linking to its own Fancy tab for the team markets and the stats behind them. */
export function FancyPage() {
  setTitle("Cricket fancy lines: match totals and over/unders");
  const { fixtures, ready, doc } = usePricedFixtures();
  const rows = useMemo(() => fixtures.filter((f: any) => !f.noProps && fixtureBooks(doc, f).fancy).map((f: any) => {
    const fx = { a: f.a, b: f.b, fmt: f.fmt, startMs: fixtureStart(f).getTime() };
    const lines = SHOWN.flatMap((k) => {
      const h = fancyHeadline(fancyByLine(fancyFor(doc, fx, k)));
      return h.over || h.under ? [{ key: k, label: (MATCH_MARKETS as any)[k]?.label ?? k, ...h }] : [];
    });
    return { f, lines };
  }).filter((r: any) => r.lines.length || fixtureBooks(doc, r.f).fancy), [fixtures, doc]);
  if (!ready) return <RowsSkeleton />;
  return (
    <div className="flex flex-col gap-stack">
      <h1 className="text-title font-bold tracking-tight">Fancy</h1>
      {!rows.length ? <p className="text-callout text-muted-foreground">No fancy lines are live yet. They open a day or two before a match.</p> : rows.map(({ f, lines }: any) => (
        <Link key={f.id || `${f.a}${f.b}${f.start}`} to={`/fixture/${f.id}?tab=fancy`} className="grid gap-snug rounded-2xl bg-card p-inset ring-1 ring-white/5 transition-colors active:bg-accent">
          <div className="flex items-center gap-snug">
            <TeamBadge name={f.a} size="sm" /><TeamBadge name={f.b} size="sm" />
            <div className="grid min-w-0 flex-1 gap-hair"><span className="truncate text-body font-semibold">{f.a} v {f.b}</span><span className="truncate text-footnote text-muted-foreground">{localWhen(fixtureStart(f).toISOString())}{f.series ? ` · ${f.series}` : ""}</span></div>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </div>
          {lines.length ? <ul className="grid gap-hair text-callout">
            {lines.map((l: any) => (
              <li key={l.key} className="flex items-baseline justify-between gap-snug">
                <span className="text-muted-foreground">{l.label}</span>
                <span className="tabular-nums text-primary">{l.over ? `O ${l.over.line} ${odds(l.over.over)}` : ""}{l.over && l.under ? <span className="text-muted-foreground"> · </span> : ""}{l.under ? `U ${l.under.line} ${odds(l.under.under)}` : ""}</span>
              </li>
            ))}
          </ul> : null}
        </Link>
      ))}
    </div>
  );
}
