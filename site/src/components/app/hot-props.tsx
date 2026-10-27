/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Bookmark, CalendarDays } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";
import { type ColumnDef, TableBody, TableCell, TableColumnHeader, TableHead, TableHeader, TableHeaderGroup, TableProvider, TableRow } from "@/components/kibo-ui/table";
import { bookLinesFor } from "@/engine/lines.js";
import { runPlan } from "@/engine/plan.js";
import { STATS } from "@/engine/rules.js";
import { fmtIndex } from "@/engine/util.js";
import { barState, windowRate } from "@/engine/windows.js";
import { useData } from "@/lib/data";
import { loadLines } from "@/lib/feeds";
import { useSaved } from "@/lib/saved";
import { odds } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { PlayerBadge, TeamFlag } from "./badges";
import { PillGroup } from "./pill-group";

const MAX_ROWS = 30;
type Win = "season" | "h2h" | "l5" | "l10";
const WINS: [Win, string, number][] = [["season", String(new Date().getFullYear()), 6], ["h2h", "H2H", 2], ["l5", "L5", 5], ["l10", "L10", 6]]; // [key, label, games needed to rank]
const sameMatch = (match: string, [a, b]: [string, string]) => { const [x, y] = String(match).split(/\s+vs\s+/i); const s = new Set([norm(x), norm(y)]); return s.has(norm(a)) && s.has(norm(b)); };
const norm = (n: string) => String(n || "").toLowerCase().replace(/\(w\)|women'?s?/g, "").replace(/[^a-z0-9]/g, "");
/** 0 = today, 1 = tomorrow (viewer's local days), else -1. */
const dayOffset = (iso: string) => { const d = new Date(iso), t = new Date(); d.setHours(0, 0, 0, 0); t.setHours(0, 0, 0, 0); const n = Math.round((d.getTime() - t.getTime()) / 864e5); return n === 0 || n === 1 ? n : -1; };
const pct = (p: number | null) => (p == null ? "–" : `${Math.round(p * 100)}%`);
const pctClass = (p: number | null) => (p == null ? "text-muted-foreground" : p >= 0.7 ? "text-primary" : p <= 0.4 ? "text-miss" : "text-foreground");
const BAR = { hit: "bg-primary", miss: "bg-miss", push: "bg-amber", dnp: "bg-dnp/50", void: "bg-dnp/50", na: "bg-dnp/50" } as Record<string, string>;

interface Row { day: number; idx: number; name: string; team: string; opp: string; stat: string; line: number; fmt: string; match: string; start: string; over: number; l5: any; l10: any; season: any; h2h: any; edge: number | null; last: { v: number | null; s: string }[]; max: number }

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
      const todays = { lines: (doc.data.lines || []).filter((l: any) => l.start_utc && dayOffset(l.start_utc) >= 0 && Date.parse(l.start_utc) > now - 3 * 3600e3 && l.books?.length) };
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
        const l5 = windowRate(entries, 5, main.line), l10 = windowRate(entries, 10, main.line);
        const season = windowRate(entries.filter((e) => String(e.date).startsWith(year)), 0, main.line);
        const h2h = windowRate(entries.filter((e) => norm(e.opp) === norm(opp)), 0, main.line);
        const p = r.summary?.pOver, n = r.summary?.n || 0;
        const last = entries.slice(-10).map((e) => ({ v: e.value as number | null, s: barState(e, main.line) as string }));
        out.push({ day: dayOffset(b.start_utc), idx, name: store.playerName(idx), team: l.team, opp, stat: l.stat, line: main.line, fmt: l.fmt, match: b.match, start: b.start_utc, over, l5, l10, season, h2h,
          edge: p != null && n >= 10 && over > 1 ? over * p - 1 : null, last, max: Math.max(main.line * 1.5, ...last.map((x) => x.v ?? 0), 1) });
      });
      for (let i = 0; i < work.length; i += 8) await Promise.all(work.slice(i, i + 8).map((w) => w()));
      return out;
    },
  });
}

function Spark({ r }: { r: Row }) {
  const linePct = Math.min(100, (r.line / r.max) * 100);
  return (
    <div className="relative flex h-9 w-[84px] shrink-0 items-end gap-[2px] sm:w-[104px] sm:gap-[3px]" role="img" aria-label={`Last ${r.last.length}: ${r.last.map((x) => x.v ?? "DNP").join(", ")} against a line of ${r.line}`}>
      {r.last.map((x, i) => <span key={i} className={cn("w-2 rounded-[2px] sm:w-2.5", BAR[x.s] || "bg-dnp/50")} style={{ height: `${Math.max(x.v == null ? 8 : (x.v / r.max) * 100, 8)}%` }} />)}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/40" style={{ bottom: `${linePct}%` }} />
    </div>
  );
}

/** Phone row built from shadcn Item parts (props.cash list style): photo, name and line, then the hit rate over the last-10 bars and the edge. */
function MobileRow({ r, win, wl, bars, i }: { r: Row; win: Win; wl: string; bars: boolean; i: number }) {
  return (
    <motion.li className="relative after:absolute after:bottom-0 after:left-[68px] after:right-0 after:h-px after:bg-white/10 last:after:hidden" layout="position" initial={{ opacity: 0, y: 10, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, filter: "blur(6px)" }}
      transition={{ layout: { type: "spring", stiffness: 420, damping: 38 }, delay: Math.min(i, 8) * 0.03, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
      <Item asChild size="sm" className="rounded-none border-0 px-3 py-3 transition-colors active:bg-card">
        <Link to={`/player/${r.idx}?stat=${r.stat}&line=${r.line}&fmt=${fmtIndex(r.fmt)}`}>
          <ItemMedia><PlayerBadge idx={r.idx} size="md" /></ItemMedia>
          <ItemContent className="min-w-0 gap-0.5">
            <ItemTitle className="max-w-full"><span className="truncate">{r.name}</span><TeamFlag name={r.team} /></ItemTitle>
            <ItemDescription className="truncate text-[13px] text-primary">O {r.line} <span className="text-muted-foreground">{(STATS as any)[r.stat]?.label} · {odds(r.over)}</span></ItemDescription>
          </ItemContent>
          <ItemActions className="gap-3">
            <span className="grid justify-items-end text-right">
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground">EDGE</span>
              <span className={cn("text-sm font-semibold tabular-nums", r.edge == null ? "text-muted-foreground" : r.edge > 0 ? "text-primary" : "text-miss")}>{r.edge == null ? "–" : `${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(0)}%`}</span>
            </span>
            <span className="grid justify-items-end gap-0.5">
              <span className={cn("text-[11px] font-semibold tabular-nums", pctClass(r[win].p))}>{pct(r[win].p)} <span className="font-normal text-muted-foreground">{wl}</span></span>
              {bars && <Spark r={r} />}
            </span>
          </ItemActions>
        </Link>
      </Item>
    </motion.li>
  );
}

const Skel = () => <div className="grid gap-px">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[62px] rounded-none" />)}</div>;

/** "Hot player props" for today's matches, in the props.cash lines-table style: stat tabs, then one ranked row per bookmaker line. */
export function HotProps({ teams }: { teams?: [string, string] } = {}) {
  const { data, isLoading } = useHotRows();
  const [stat, setStat] = useState("all");
  const [win, setWin] = useState<Win>("l10");
  const saved = useSaved();
  const [day, setDay] = useState("0");
  const [bars, setBars] = useState(true);
  const tabs = useMemo(() => {
    const have = new Set((data || []).map((r) => r.stat));
    return [["all", "All props"], ...Object.entries(STATS).filter(([k]) => have.has(k)).map(([k, v]: any) => [k, v.label])] as [string, string][];
  }, [data]);
  const need = WINS.find(([k]) => k === win)![2], wl = WINS.find(([k]) => k === win)![1];
  const rows = useMemo(() => (data || []).filter((r) => (teams ? sameMatch(r.match, teams) : r.day === Number(day)) && (stat === "all" || r.stat === stat) && r[win].played >= need)
    .sort((x, y) => (y[win].p ?? 0) - (x[win].p ?? 0) || (y.edge ?? -1) - (x.edge ?? -1)).slice(0, MAX_ROWS), [data, stat, win, need, day, teams]);
  const columns = useMemo<ColumnDef<Row>[]>(() => {
    const head = (title: string) => ({ column }: { column: any }) => <TableColumnHeader column={column} title={title} />;
    const rate = (id: string, title: string, get: (r: Row) => any, tip?: boolean): ColumnDef<Row> => ({ id, accessorFn: (r) => get(r).p ?? -1, header: head(title), sortUndefined: "last",
      cell: ({ row }) => { const w = get(row.original); return <span className={cn("font-medium tabular-nums", pctClass(w.p))} title={tip && w.played ? `${w.hits} of ${w.played} vs ${row.original.opp}` : undefined}>{pct(w.p)}</span>; } });
    return [
      { id: "player", accessorFn: (r) => r.name, header: head("Lines"), cell: ({ row: { original: r } }) => (
        <Link to={`/player/${r.idx}?stat=${r.stat}&line=${r.line}&fmt=${fmtIndex(r.fmt)}`} className="flex items-center gap-3 outline-none focus-visible:underline">
          <PlayerBadge idx={r.idx} size="md" />
          <span className="min-w-0"><b className="flex items-center gap-1.5 text-[15px] font-medium"><span className="truncate">{r.name}</span><TeamFlag name={r.team} /></b>
            <span className="text-[13px] text-primary">O {r.line} <span className="text-muted-foreground">{(STATS as any)[r.stat]?.label}</span></span></span>
        </Link>) },
      { id: "chart", header: "L10 chart", enableSorting: false, cell: ({ row }) => <Spark r={row.original} /> },
      { id: "odds", accessorFn: (r) => r.over, header: head("Price"), cell: ({ row }) => <span className="tabular-nums">{odds(row.original.over)}</span> },
      rate("win", wl, (r) => r[win]),
      rate("season", String(new Date().getFullYear()), (r) => r.season),
      rate("h2h", "H2H", (r) => r.h2h, true),
      { id: "matchup", header: "Matchup", enableSorting: false, cell: ({ row: { original: r } }) => <span title={r.match}><TeamFlag name={r.opp} className="h-5 w-7" /></span> },
      { id: "edge", accessorFn: (r) => r.edge ?? -9, header: head("Edge"), cell: ({ row: { original: r } }) => <span className={cn("font-medium tabular-nums", r.edge == null ? "text-muted-foreground" : r.edge > 0 ? "text-primary" : "text-miss")}>{r.edge == null ? "–" : `${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(0)}%`}</span> },
    ];
  }, [win, wl]);
  return (
    <section aria-label="Hot player props today">
      {!teams && <div className="pt-8 md:pt-10"><h1 className="text-[32px] font-bold leading-tight tracking-[-0.022em] md:text-[34px]">Hot Player Props{day === "1" && <span className="font-medium text-muted-foreground"> · Tomorrow</span>}</h1></div>}
      <div className="mt-3 flex items-center gap-2">
        <button type="button" aria-label={bars ? "Hide form charts" : "Show form charts"} aria-pressed={bars} onClick={() => setBars((v) => !v)} className={cn("relative grid size-11 shrink-0 place-items-center rounded-full bg-card transition-colors active:bg-accent", bars && "text-primary")}><BarChart3 className="size-[18px]" /></button>
        <PillGroup segmented layoutId="hot-window" label="Hit-rate window" value={win} onChange={(v) => setWin(v as Win)} items={WINS.map(([k, l]) => [k, l])} className="min-w-0 flex-1 sm:w-80 sm:flex-none" />
      </div>
      {tabs.length > 1 && (
        <div className="mt-2 flex items-center gap-2">
          {!teams && <DropdownMenu>
            <DropdownMenuTrigger aria-label="Choose day" className={cn("relative grid size-11 shrink-0 place-items-center rounded-full bg-card transition-colors active:bg-accent", day !== "0" && "text-primary")}><CalendarDays className="size-[18px]" /></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuRadioGroup value={day} onValueChange={setDay}>
                <DropdownMenuRadioItem value="0">Today</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="1">Tomorrow</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>}
          <Link to="/saved" aria-label={`Saved (${saved.list.length})`} className="relative grid size-11 shrink-0 place-items-center rounded-full bg-card transition-colors active:bg-accent"><Bookmark className="size-[18px]" />
            {saved.list.length > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{saved.list.length}</span>}</Link>
          <PillGroup layoutId="hot-stat" label="Prop type" value={stat} onChange={setStat} items={tabs} className="min-w-0 flex-1 sm:w-fit sm:flex-none" />
        </div>
      )}
      <div className="-mx-4 mt-2 border-t sm:mx-0 sm:border-t-0">
        {isLoading ? <Skel /> : !rows.length ? <p className="p-6 text-sm text-muted-foreground">No bookmaker player lines for this day yet. They appear a few hours before each match.</p> : (
          <>
          <ul className="sm:hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              {rows.map((r, i) => <MobileRow key={`${r.idx}${r.stat}${r.fmt}`} r={r} win={win} wl={wl} bars={bars} i={i} />)}
            </AnimatePresence>
          </ul>
          <TableProvider key={`${win}-${stat}-${day}`} columns={columns as ColumnDef<unknown, unknown>[]} data={rows} className="hidden sm:table">
            <TableHeader>{({ headerGroup }) => <TableHeaderGroup key={headerGroup.id} headerGroup={headerGroup}>{({ header }) => <TableHead key={header.id} header={header} className="h-11 text-[13px] font-medium text-muted-foreground" />}</TableHeaderGroup>}</TableHeader>
            <TableBody className="rows-stagger">{({ row }) => <TableRow key={row.id} row={row} className="h-[62px]">{({ cell }) => <TableCell key={cell.id} cell={cell} />}</TableRow>}</TableBody>
          </TableProvider>
          </>
        )}
      </div>
    </section>
  );
}
