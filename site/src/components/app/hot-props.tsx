/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bookLinesFor } from "@/engine/lines.js";
import { runPlan } from "@/engine/plan.js";
import { STATS } from "@/engine/rules.js";
import { fmtIndex } from "@/engine/util.js";
import { barState, windowRate } from "@/engine/windows.js";
import { useData } from "@/lib/data";
import { loadLines } from "@/lib/feeds";
import { abbr, odds } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PillTabs } from "./pill-tabs";
import { PlayerBadge, TeamBadge } from "./badges";

const MAX_ROWS = 30;
const norm = (n: string) => String(n || "").toLowerCase().replace(/\(w\)|women'?s?/g, "").replace(/[^a-z0-9]/g, "");
const sameDay = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
const pct = (p: number | null) => (p == null ? "–" : `${Math.round(p * 100)}%`);
const pctClass = (p: number | null) => (p == null ? "text-muted-foreground" : p >= 0.7 ? "text-primary" : p <= 0.4 ? "text-miss" : "text-foreground");
const BAR = { hit: "bg-primary", miss: "bg-miss", push: "bg-amber", dnp: "bg-dnp/50", void: "bg-dnp/50", na: "bg-dnp/50" } as Record<string, string>;

interface Row { idx: number; name: string; team: string; opp: string; stat: string; line: number; fmt: string; match: string; start: string; over: number; l10: any; season: any; h2h: any; edge: number | null; last: { v: number | null; s: string }[]; max: number }

/** Today's bookmaker player lines, each scored from the player's own history by the engine: L10 hit rate, this year's, vs today's opponent, and the edge of the best over price against the all-time hit rate. */
function useHotRows() {
  const { store, rz } = useData();
  const doc = useQuery({ queryKey: ["lines"], queryFn: loadLines, staleTime: 10 * 60_000 });
  const today = new Date().toDateString();
  return useQuery({
    queryKey: ["hot-props", doc.data?.generated_at_utc, today],
    enabled: !!doc.data,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Row[]> => {
      const now = Date.now();
      const todays = { lines: (doc.data.lines || []).filter((l: any) => l.start_utc && sameDay(l.start_utc) && Date.parse(l.start_utc) > now - 3 * 3600e3 && l.books?.length) };
      const keys = new Map<string, any>();
      for (const l of todays.lines) keys.set(`${l.pid}|${l.stat}|${l.fmt}`, l);
      const year = String(new Date().getFullYear());
      const out: Row[] = [];
      const work = [...keys.values()].map((l) => async () => {
        const idx = store.P.id.indexOf(l.pid);
        const b = bookLinesFor(todays, l.pid, l.stat, l.fmt, now);
        if (idx < 0 || !b) return;
        const main = b.main, over = Math.max(...main.books.map((x: any) => x.over || 0));
        const r: any = await runPlan(store, rz, { kind: "player_prop", stat: l.stat, line: main.line, side: "over", filters: { format: l.fmt }, split_by: [] }, { playerIdx: idx });
        const entries: any[] = r?.ok ? r.chart?.entries || [] : [];
        if (!entries.length) return;
        const [a, c] = String(b.match).split(/\s+vs\s+/i);
        const opp = norm(l.team) === norm(a) ? c : a;
        const l10 = windowRate(entries, 10, main.line);
        const season = windowRate(entries.filter((e) => String(e.date).startsWith(year)), 0, main.line);
        const h2h = windowRate(entries.filter((e) => norm(e.opp) === norm(opp)), 0, main.line);
        const p = r.summary?.pOver, n = r.summary?.n || 0;
        const last = entries.slice(-10).map((e) => ({ v: e.value as number | null, s: barState(e, main.line) as string }));
        out.push({ idx, name: store.playerName(idx), team: l.team, opp, stat: l.stat, line: main.line, fmt: l.fmt, match: b.match, start: b.start_utc, over, l10, season, h2h,
          edge: p != null && n >= 10 && over > 1 ? over * p - 1 : null, last, max: Math.max(main.line * 1.5, ...last.map((x) => x.v ?? 0), 1) });
      });
      for (let i = 0; i < work.length; i += 8) await Promise.all(work.slice(i, i + 8).map((w) => w()));
      return out.filter((x) => x.l10.played >= 6).sort((x, y) => (y.l10.p ?? 0) - (x.l10.p ?? 0) || (y.edge ?? -1) - (x.edge ?? -1)).slice(0, MAX_ROWS);
    },
  });
}

function Spark({ r }: { r: Row }) {
  const linePct = Math.min(100, (r.line / r.max) * 100);
  return (
    <div className="relative flex h-9 w-[104px] items-end gap-[3px]" role="img" aria-label={`Last ${r.last.length}: ${r.last.map((x) => x.v ?? "DNP").join(", ")} against a line of ${r.line}`}>
      {r.last.map((x, i) => <span key={i} className={cn("w-2.5 rounded-[2px]", BAR[x.s] || "bg-dnp/50")} style={{ height: `${Math.max(x.v == null ? 8 : (x.v / r.max) * 100, 8)}%` }} />)}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/40" style={{ bottom: `${linePct}%` }} />
    </div>
  );
}

const Skel = () => <div className="grid gap-px">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[62px] rounded-none" />)}</div>;

/** "Hot player props" for today's matches, in the props.cash lines-table style: stat tabs, then one ranked row per bookmaker line. */
export function HotProps() {
  const { data, isLoading } = useHotRows();
  const [stat, setStat] = useState("all");
  const tabs = useMemo(() => {
    const have = new Set((data || []).map((r) => r.stat));
    return [["all", "All props"], ...Object.entries(STATS).filter(([k]) => have.has(k)).map(([k, v]: any) => [k, v.label])] as [string, string][];
  }, [data]);
  const rows = (data || []).filter((r) => stat === "all" || r.stat === stat);
  return (
    <section aria-label="Hot player props today">
      <div className="flex flex-wrap items-end justify-between gap-2 pt-3">
        <div><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Hot Player Props</h1>
          <p className="mt-1 text-sm text-muted-foreground">Today's bookmaker lines, ranked by hit rate over the last 10 games · {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p></div>
      </div>
      {tabs.length > 1 && <PillTabs scrollable layoutId="hot-stat" tabs={tabs} value={stat} onChange={setStat} className="mt-3" />}
      <div className="mt-2 overflow-hidden rounded-xl border bg-card">
        {isLoading ? <Skel /> : !rows.length ? <p className="p-6 text-sm text-muted-foreground">No bookmaker player lines for today yet. They appear a few hours before each match.</p> : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 pl-4 font-condensed text-[13px] uppercase tracking-wider">Lines</TableHead>
                <TableHead className="hidden font-condensed text-[13px] uppercase tracking-wider sm:table-cell">L10 chart</TableHead>
                <TableHead className="font-condensed text-[13px] uppercase tracking-wider">Odds</TableHead>
                <TableHead className="font-condensed text-[13px] uppercase tracking-wider">L10</TableHead>
                <TableHead className="hidden font-condensed text-[13px] uppercase tracking-wider md:table-cell">{new Date().getFullYear()}</TableHead>
                <TableHead className="hidden font-condensed text-[13px] uppercase tracking-wider md:table-cell">H2H</TableHead>
                <TableHead className="hidden font-condensed text-[13px] uppercase tracking-wider lg:table-cell">Matchup</TableHead>
                <TableHead className="pr-4 text-right font-condensed text-[13px] uppercase tracking-wider">Edge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={`${r.idx}${r.stat}${r.fmt}`} className="group h-[62px] cursor-pointer">
                  <TableCell className="py-2 pl-4">
                    <Link to={`/player/${r.idx}?stat=${r.stat}&line=${r.line}&fmt=${fmtIndex(r.fmt)}`} className="flex items-center gap-3 outline-none after:absolute after:inset-0 focus-visible:underline">
                      <PlayerBadge idx={r.idx} size="md" />
                      <span className="min-w-0"><b className="block truncate text-[15px] font-medium">{r.name}<span className="ml-1.5 font-condensed text-xs font-normal uppercase tracking-wide text-muted-foreground">{abbr(r.team)}</span></b>
                        <span className="text-[13px] text-primary">O {r.line} <span className="text-muted-foreground">{(STATS as any)[r.stat]?.label}</span></span></span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell"><Spark r={r} /></TableCell>
                  <TableCell className="tabular-nums">{odds(r.over)}</TableCell>
                  <TableCell className={cn("font-medium tabular-nums", pctClass(r.l10.p))}>{pct(r.l10.p)}</TableCell>
                  <TableCell className={cn("hidden tabular-nums md:table-cell", pctClass(r.season.p))}>{pct(r.season.p)}</TableCell>
                  <TableCell className={cn("hidden tabular-nums md:table-cell", pctClass(r.h2h.p))} title={r.h2h.played ? `${r.h2h.hits} of ${r.h2h.played} vs ${r.opp}` : "No games against this opponent"}>{pct(r.h2h.p)}</TableCell>
                  <TableCell className="hidden lg:table-cell"><span className="flex items-center gap-2 text-sm" title={r.match}><TeamBadge name={r.opp} size="xs" />{abbr(r.opp)}</span></TableCell>
                  <TableCell className={cn("pr-4 text-right font-medium tabular-nums", r.edge == null ? "text-muted-foreground" : r.edge > 0 ? "text-primary" : "text-miss")}>{r.edge == null ? "–" : `${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(0)}%`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Odds are the best decimal price on the over from the books we track. L10, season and H2H are hit rates over the line from the player's own history in that format; Edge is the best over price × the all-time hit rate − 1 (needs 10+ games). A guide, not betting advice.</p>
    </section>
  );
}
