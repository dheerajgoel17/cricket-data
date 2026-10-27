/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { AnimatedHeight } from "./animated-height";
import { RowsSkeleton } from "./skeletons";
import { bookLinesFor } from "@/engine/lines.js";
import { runPlan } from "@/engine/plan.js";
import { STATS } from "@/engine/rules.js";
import { fmtIndex } from "@/engine/util.js";
import { barState, windowRate } from "@/engine/windows.js";
import { useData } from "@/lib/data";
import { loadLines } from "@/lib/feeds";
import { odds } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { PlayerBadge, TeamBadge, TeamFlag } from "./badges";
import { PillGroup } from "./pill-group";
import { MiniBars } from "./mini-bars";

const MAX_ROWS = 30;
type Win = "season" | "h2h" | "l5" | "l10";
const WINS: [Win, string, number][] = [["season", String(new Date().getFullYear()), 6], ["h2h", "H2H", 2], ["l5", "L5", 5], ["l10", "L10", 6]]; // [key, label, games needed to rank]
const sameMatch = (match: string, [a, b]: [string, string]) => { const [x, y] = String(match).split(/\s+vs\s+/i); const s = new Set([norm(x), norm(y)]); return s.has(norm(a)) && s.has(norm(b)); };
const norm = (n: string) => String(n || "").toLowerCase().replace(/\(w\)|women'?s?/g, "").replace(/[^a-z0-9]/g, "");
/** 0 = today, 1 = tomorrow (viewer's local days), else -1. */
const dayOffset = (iso: string) => { const d = new Date(iso), t = new Date(); d.setHours(0, 0, 0, 0); t.setHours(0, 0, 0, 0); const n = Math.round((d.getTime() - t.getTime()) / 864e5); return n === 0 || n === 1 ? n : -1; };
const pct = (p: number | null) => (p == null ? "–" : `${Math.round(p * 100)}%`);
const pctClass = (p: number | null) => (p == null ? "text-muted-foreground" : p >= 0.7 ? "text-primary" : p <= 0.4 ? "text-miss" : "text-foreground");

interface Row { day: number; idx: number; name: string; team: string; opp: string; stat: string; line: number; fmt: string; match: string; start: string; over: number; l5: any; l10: any; season: any; h2h: any; edge: number | null; last: { v: number | null; s: string }[]; max: number }

/** Today's bookmaker player lines, each scored from the player's own history by the engine: L10 hit rate, this year's, vs today's opponent, and the edge of the best over price against the all-time hit rate. */
function useHotRows() {
  const { store, rz } = useData();
  const doc = useQuery({ queryKey: ["lines"], queryFn: loadLines, staleTime: 10 * 60_000 });
  const today = new Date().toDateString();
  const rows = useQuery({
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
  // while the bookmaker file is still loading the query is idle (not "loading"): treat that as loading too, so the empty message never flashes
  return { ...rows, isLoading: rows.isLoading || (!rows.data && !rows.isError) };
}

const Spark = ({ r }: { r: Row }) => <MiniBars last={r.last} line={r.line} max={r.max} />;

/** List row built from shadcn Item parts, iOS style at every width: photo, name and line, then the edge and the hit rate over the last-10 bars; a chevron marks it as tappable. */
function PropRow({ r, win, wl, bars, i }: { r: Row; win: Win; wl: string; bars: boolean; i: number }) {
  return (
    <motion.li className="relative after:absolute after:bottom-0 after:left-[calc(var(--gutter)+var(--control)+var(--spacing-snug))] after:right-0 after:h-px after:bg-white/10 last:after:hidden" layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ layout: { type: "spring", stiffness: 420, damping: 38 }, delay: Math.min(i, 6) * 0.025, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
      <Item asChild size="sm" className="min-h-row rounded-none border-0 px-gutter py-snug transition-colors active:bg-card">
        <Link to={`/player/${r.idx}?stat=${r.stat}&line=${r.line}&fmt=${fmtIndex(r.fmt)}`}>
          <ItemMedia><PlayerBadge idx={r.idx} size="md" className="size-control" /></ItemMedia>
          <ItemContent className="min-w-0 gap-hair">
            <ItemTitle className="max-w-full text-body font-semibold leading-snug"><span className="truncate">{r.name}</span><TeamFlag name={r.team} /></ItemTitle>
            <ItemDescription className="truncate text-callout text-primary">O {r.line} <span className="text-muted-foreground">{(STATS as any)[r.stat]?.label} · {odds(r.over)}</span></ItemDescription>
          </ItemContent>
          <ItemActions className="gap-tight">
            <span className="grid justify-items-end text-right">
              <span className="text-caption font-semibold tracking-wider text-muted-foreground">EDGE</span>
              <span className={cn("text-body font-semibold tabular-nums", r.edge == null ? "text-muted-foreground" : r.edge > 0 ? "text-primary" : "text-miss")}>{r.edge == null ? "–" : `${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(0)}%`}</span>
            </span>
            <span className="grid justify-items-end gap-hair">
              <span className={cn("text-footnote font-semibold tabular-nums", pctClass(r[win].p))}>{pct(r[win].p)} <span className="font-normal text-muted-foreground">{wl}</span></span>
              {bars && <Spark r={r} />}
            </span>
          </ItemActions>
        </Link>
      </Item>
    </motion.li>
  );
}


/** "Hot player props" for today's matches, in the props.cash lines-table style: stat tabs, then one ranked row per bookmaker line. */
export function HotProps({ teams }: { teams?: [string, string] } = {}) {
  const { data, isLoading } = useHotRows();
  const [stat, setStat] = useState("all");
  const [win, setWin] = useState<Win>("l10");
  const [day, setDay] = useState("0");
  const [bars, setBars] = useState(true);
  const [team, setTeam] = useState("all");
  const tabs = useMemo(() => {
    const have = new Set((data || []).map((r) => r.stat));
    return [["all", "All props"], ...Object.entries(STATS).filter(([k]) => have.has(k)).map(([k, v]: any) => [k, v.label])] as [string, string][];
  }, [data]);
  const dirty = win !== "l10" || (teams ? team !== "all" : day !== "0") || !bars;
  const need = WINS.find(([k]) => k === win)![2], wl = WINS.find(([k]) => k === win)![1];
  const rows = useMemo(() => (data || []).filter((r) => (teams ? sameMatch(r.match, teams) && (team === "all" || norm(r.team) === norm(team)) : r.day === Number(day)) && (stat === "all" || r.stat === stat) && r[win].played >= need)
    .sort((x, y) => (y[win].p ?? 0) - (x[win].p ?? 0) || (y.edge ?? -1) - (x.edge ?? -1)).slice(0, MAX_ROWS), [data, stat, win, need, day, teams, team]);
  return (
    <section aria-label="Hot player props today" className="flex flex-col gap-stack">
      {!teams && <div><h1 className="text-display font-bold">Hot Player Props{day === "1" && <span className="font-medium text-muted-foreground"> · Tomorrow</span>}</h1></div>}
      {/* one chip row for the prop type, plus a Filters button (current window on it) that opens an iOS-style bottom sheet for the rest */}
      <div className="flex items-center gap-snug">
        <PillGroup layoutId="hot-stat" label="Prop type" value={stat} onChange={setStat} items={tabs} className="min-w-0 flex-1" />
        <Sheet>
          <SheetTrigger asChild>
            <button type="button" aria-label="Filters" className="relative flex h-control shrink-0 items-center gap-tight rounded-[var(--chip-radius)] bg-card px-3 text-callout font-medium transition-colors active:bg-accent">
              <SlidersHorizontal className="size-4" />{wl}
              {dirty && <span aria-hidden className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-primary ring-2 ring-background" />}
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" showCloseButton={false} className="rounded-t-3xl border-0 bg-popover/80 px-inset pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-snug backdrop-blur-2xl backdrop-saturate-150 sm:mx-auto sm:max-w-md">
            <div aria-hidden className="mx-auto h-1.5 w-10 rounded-full bg-white/25" />
            <SheetHeader className="flex-row items-center justify-between p-0 pt-stack">
              <SheetTitle className="text-title font-bold tracking-tight">Filters</SheetTitle>
              <SheetClose className="text-body font-semibold text-primary active:opacity-50">Done</SheetClose>
            </SheetHeader>
            <SheetDescription className="sr-only">Hit-rate window, {teams ? "team" : "day"} and form charts</SheetDescription>
            <div className="grid gap-group pt-group">
              <div className="grid gap-tight"><span className="text-footnote font-medium text-muted-foreground">Hit-rate window</span>
                <PillGroup segmented layoutId="hot-window" label="Hit-rate window" value={win} onChange={(v) => setWin(v as Win)} items={WINS.map(([k, l]) => [k, l])} /></div>
              {teams ? (
                <div className="grid gap-tight"><span className="text-footnote font-medium text-muted-foreground">Team</span>
                  <PillGroup segmented layoutId="hot-team" label="Team" value={team} onChange={setTeam}
                    items={[["all", "Both"], ...teams.map((t) => [t, <span key={t} className="flex items-center gap-tight"><TeamBadge name={t} size="xs" />{t}</span>] as [string, React.ReactNode])]} /></div>
              ) : (
                <div className="grid gap-tight"><span className="text-footnote font-medium text-muted-foreground">Day</span>
                  <PillGroup segmented layoutId="hot-day" label="Day" value={day} onChange={setDay} items={[["0", "Today"], ["1", "Tomorrow"]]} /></div>
              )}
              <label className="flex min-h-control items-center justify-between gap-stack rounded-xl bg-white/[0.06] px-3 py-tight text-body">Form charts<Switch checked={bars} onCheckedChange={setBars} aria-label="Show form charts" /></label>
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <AnimatedHeight>
        {isLoading ? <RowsSkeleton /> : !rows.length ? <p className="p-6 text-callout text-muted-foreground">{teams ? "The books have not priced player props for this match yet. Lines usually appear a few hours before the start." : "No bookmaker player lines for this day yet. They appear a few hours before each match."}</p> : (
          <ul className="-mx-gutter">
            <AnimatePresence mode="popLayout" initial={false}>
              {rows.map((r, i) => <PropRow key={`${r.idx}${r.stat}${r.fmt}`} r={r} win={win} wl={wl} bars={bars} i={i} />)}
            </AnimatePresence>
          </ul>
        )}
      </AnimatedHeight>
    </section>
  );
}
