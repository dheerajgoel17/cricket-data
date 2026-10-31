/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { motion } from "motion/react";
import { dayKey, dayLabel, fixtureStart, localTime } from "@/lib/format";
import { setTitle } from "@/lib/title";
import { HotProps } from "@/components/app/hot-props";
import { BookTable } from "@/components/app/book-table";
import { OverviewRow, fancyFm } from "@/components/app/match-fancy";
import { useFancyCards } from "@/hooks/useFancyCards";
import { TeamBadge } from "@/components/app/badges";
import { RowsSkeleton } from "@/components/app/skeletons";

/** Player props: the hot props of every priced match, with the day switch and filters the component carries. */
export function PropsPage() {
  setTitle("Cricket player props: hit rates and listed lines");
  // The filters live in the URL. Coming back to Props from another tab (a bare /props) restores the last view of this session; a shared link with filters wins.
  const nav = useNavigate();
  const { search } = useLocation();
  const mounted = useRef(false);
  useEffect(() => {
    try {
      const first = !mounted.current;
      mounted.current = true;
      if (search) sessionStorage.setItem(LAST, search);
      else if (first) { const last = sessionStorage.getItem(LAST); if (last) nav(`/props${last}`, { replace: true }); }
      else sessionStorage.removeItem(LAST); // cleared on purpose
    } catch { /* storage blocked: the plain screener */ }
  }, [search, nav]);
  return (
    <div className="flex flex-col gap-stack">
      <h1 className="text-title font-bold tracking-tight lg:hidden">Player props</h1>
      <HotProps heading="Player props" syncUrl />
    </div>
  );
}
const LAST = "cph-props-last";

const SHOWN_ROWS = 4; // the best-edge markets on the card; the rest are one tap away on the match's Fancy tab

/** Fancy: every priced match with its best-edge markets (the book's line, the edge and the last ten results against it), each match linking to its own Fancy tab. Matches in play lead, same as the home rail. */
export function FancyPage() {
  setTitle("Cricket fancy lines: match totals and over/unders");
  const { cards, ready } = useFancyCards();
  const rows = cards.filter((r: any) => r.rows.length > 0); // a match with lines up but nothing to show (no past matches to score them on) is left out
  if (!ready) return <RowsSkeleton />;
  return (
    <div className="flex flex-col gap-stack">
      <h1 className="text-title font-bold tracking-tight">Fancy</h1>
      {!rows.length ? <p className="text-callout text-muted-foreground">No fancy lines with history to show yet. They open a day or two before a match, once there are past matches to score them on.</p> : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-stack md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r: any, i: number) => <FancyCard key={r.f.id || `${r.f.a}${r.f.b}${r.f.start}`} {...r} i={i} />)}
        </div>)}
    </div>
  );
}

/** One match's fancy markets, laid out like the fixture card (format and ground on top, the two sides with the start time) with the best-edge market rows of the Match Fancy tab under them. */
function FancyCard({ f, ms, rows, i }: { f: any; ms: number[]; rows: any[]; i: number }) {
  const nav = useNavigate();
  const when = fixtureStart(f);
  const ground = String(f.venue || "").split(",")[0].replace(/\(.*\)/, "").trim();
  const to = (fm?: string) => `/fixture/${f.id}?tab=fancy${fm ? `&fm=${fm}` : ""}`;
  return (
    <motion.div className="h-full" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 6) * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
      <div className="h-full border-b border-hairline pb-stack">
        <div className="flex h-full flex-col gap-snug">
          <Link to={to()} className="flex flex-col gap-snug outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex items-center gap-tight text-footnote font-medium text-muted-foreground">
              <span className="label-cap text-footnote">{f.fmt || "T20"}{f.gender === "female" ? " · W" : ""}</span>
              {ground && <span className="ml-auto min-w-0 truncate" title={f.venue}>{ground}</span>}
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-snug gap-y-snug">
              {[f.a, f.b].map((t: string, k: number) => (
                <div key={t} className="contents">
                  <div className="flex min-w-0 items-center gap-snug" title={t}><TeamBadge name={t} size="md" eager /><span className="truncate text-body font-semibold">{t}</span></div>
                  {k === 0 && <span className="row-span-2 grid justify-items-end text-right"><span className="text-footnote text-muted-foreground">{dayLabel(dayKey(f))}</span><span className="text-callout font-semibold tabular-nums">{localTime(when)}</span></span>}
                </div>
              ))}
            </div>
          </Link>
          {rows.length ? (
            <ul className="-mx-gutter border-t border-hairline">
              {rows.slice(0, SHOWN_ROWS).map((r: any) => <li key={r.id || r.key} className="border-t border-hairline first:border-t-0"><OverviewRow r={r} onOpen={() => nav(to(fancyFm(r.key, r.inn || 0) + (r.scope >= 0 ? `&sc=${r.scope}` : "")))} /><BookTable books={r.books} shown={[r.overBook, r.underBook]} className="px-gutter pb-snug" /></li>)}
            </ul>
          ) : <p className="border-t border-hairline py-snug text-callout text-muted-foreground">{ms.length ? "Lines are up; none of them score on past matches in this format." : "Lines are up; no past matches to score them on."}</p>}
          <Link to={to()} className="mt-auto flex items-center justify-between gap-snug pt-tight outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="truncate text-caption text-muted-foreground">{f.series || ""}{ms.length ? ` · last ${ms.length} matches` : ""}</span>
            <span className="inline-flex shrink-0 items-center text-footnote font-semibold text-primary">{rows.length > SHOWN_ROWS ? `All ${rows.length} markets` : "Fancy"}<ChevronRightIcon className="size-4" aria-hidden /></span>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
