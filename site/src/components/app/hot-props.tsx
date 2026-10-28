/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { AnimatedHeight } from "./animated-height";
import { RowsSkeleton } from "./skeletons";
import { liveForFixture, lineNotIn, lineStanding } from "@/engine/live.js";
import { SCOPE_LABEL, bookLinesFor, lineScope, sameFixture } from "@/engine/lines.js";
import { runPlan } from "@/engine/plan.js";
import { STATS } from "@/engine/rules.js";
import { fmtIndex } from "@/engine/util.js";
import { barState, windowRate } from "@/engine/windows.js";
import { useLiveDoc } from "@/hooks/useLive";
import { useData } from "@/lib/data";
import { byShard, dayOffset, hotLines, norm, pool, sameMatch } from "@/lib/hot-lines";
import { odds } from "@/lib/format";
import { linesQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Badge } from "@/components/ui/badge";
import { PlayerBadge, TeamBadge, TeamFlag } from "./badges";
import { PillGroup } from "./pill-group";
import { MiniBars } from "./mini-bars";

const MAX_ROWS = 30;
type Win = "season" | "h2h" | "l5" | "l10";
const WINS: [Win, string, number][] = [["season", String(new Date().getFullYear()), 6], ["h2h", "H2H", 2], ["l5", "L5", 5], ["l10", "L10", 6]]; // [key, label, games needed to rank]
const SHARDS_AT_ONCE = 8; // player files fetched at a time: several at once (they are latency-bound), few enough that the first ones land early
const PUBLISH_MS = 300; // rows already scored are shown at most this often while the rest are still coming, and only once there are a full page of them (a shorter list would only be reshuffled)
const pct = (p: number | null) => (p == null ? "–" : `${Math.round(p * 100)}%`);
const pctClass = (p: number | null) => (p == null ? "text-muted-foreground" : p >= 0.7 ? "text-primary" : p <= 0.4 ? "text-miss" : "text-foreground");

interface Row { day: number; idx: number; pid: string; inn: number; name: string; bookName: string; settled?: number | null; stored?: number | null; team: string; opp: string; stat: string; line: number; fmt: string; match: string; start: string; over: number; l5: any; l10: any; season: any; h2h: any; edge: number | null; last: { v: number | null; s: string }[]; max: number }

/**
 * The bookmaker player lines of one day (`day`: 0 today, 1 tomorrow) or, with `teams`, of one match, each scored from the player's own history by the engine: L10 hit rate, this
 * year's, vs today's opponent, and the edge of the best over price against the all-time hit rate. Only those lines are scored (each costs a player file), the files come
 * several at a time, and the rows are in `data` as they finish (`scoring` says more are coming).
 */
export function useHotRows(archive?: any, teams?: [string, string], day = 0) {
  const { store, rz } = useData();
  const qc = useQueryClient();
  const lines = useQuery(linesQuery);
  const doc = { data: archive ?? lines.data }; // `archive`: the book doc with an archived match added, for that match's own page
  const today = new Date().toDateString();
  const key = ["hot-props", doc.data?.generated_at_utc, today, archive ? `${teams?.join("|")}|${doc.data?.lines?.length}` : "", teams ? teams.join("|") : day];
  const rows = useQuery({
    queryKey: key,
    enabled: !!doc.data,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Row[]> => {
      const now = Date.now();
      // an archived match is read whatever its age: only that match's lines, none of the day filters
      const todays = { lines: hotLines(doc.data.lines || [], teams ? { teams, archive: !!archive } : { day }, now) };
      // one row per player, stat and match: a series has several matches between the same sides, each priced on its own
      const keys = new Map<string, any>();
      for (const l of todays.lines) keys.set(`${l.pid}|${l.stat}|${l.fmt}|${l.start_utc}|${lineScope(l)}`, l); // a Test's first-innings line is a row of its own beside the match line
      const year = String(new Date().getFullYear());
      const out: Row[] = [];
      const score = async (l: any) => {
        const idx = store.P.id.indexOf(l.pid);
        const inn = lineScope(l);
        const b = bookLinesFor({ lines: todays.lines.filter((x: any) => x.start_utc === l.start_utc) }, l.pid, l.stat, l.fmt, now, archive ? Infinity : 40 * 3600e3, inn);
        if (idx < 0 || !b) return;
        const main = b.main, over = Math.max(...main.books.map((x: any) => x.over || 0));
        const r: any = await runPlan(store, rz, { kind: "player_prop", stat: l.stat, line: main.line, side: "over", filters: { format: l.fmt, team_innings: inn || null }, split_by: [] }, { playerIdx: idx });
        const entries: any[] = r?.ok ? r.chart?.entries || [] : [];
        if (!entries.length) return;
        const [a, c] = String(b.match).split(/\s+vs\s+/i);
        const opp = norm(l.team) === norm(a) ? c : a;
        const l5 = windowRate(entries, 5, main.line), l10 = windowRate(entries, 10, main.line);
        const season = windowRate(entries.filter((e) => String(e.date).startsWith(year)), 0, main.line);
        const h2h = windowRate(entries.filter((e) => norm(e.opp) === norm(opp)), 0, main.line);
        const p = r.summary?.pOver, n = r.summary?.n || 0;
        const last = entries.slice(-10).map((e) => ({ v: e.value as number | null, s: barState(e, main.line) as string }));
        // once the match itself is in the data its result is his latest game: same opponent, within a day of the start
        const lastE = entries[entries.length - 1];
        const settled: number | null | undefined = lastE && norm(lastE.opp) === norm(opp) && Math.abs(Date.parse(String(lastE.date)) - Date.parse(String(b.start_utc).slice(0, 10))) <= 86400e3 ? lastE.value : undefined;
        out.push({ day: dayOffset(b.start_utc), idx, pid: l.pid, inn, name: store.playerName(idx), bookName: l.book_name || "", team: l.team, opp, stat: l.stat, line: main.line, fmt: l.fmt, match: b.match, start: b.start_utc, over, l5, l10, season, h2h,
          edge: p != null && n >= 10 && over > 1 ? over * p - 1 : null, last, settled, stored: l.result ?? null, max: Math.max(main.line * 1.5, ...last.map((x) => x.v ?? 0), 1) }); // `result`: the archive file's stored result for this player and stat
      };
      // The player files come several at a time and a file's lines are scored as soon as it is in, a few plans at once, giving the main thread back in between: on a phone the
      // whole batch is seconds of work, and typing in search waited behind it. The rows so far are put in the cache as they come (not all at the end).
      const yieldToMain = () => new Promise<void>((r) => { const s = (globalThis as any).scheduler; if (s?.yield) s.yield().then(r); else setTimeout(r, 0); });
      let published = 0;
      await pool(byShard([...keys.values()], (pid) => store.P.id.indexOf(pid), (i) => store.shardOf(i)), SHARDS_AT_ONCE, async (g) => {
        await store.shard(g.shard).catch(() => {}); // a file that does not load costs its own rows (the plan answers "not ok" for them), not the page
        for (let i = 0; i < g.lines.length; i += 4) { await Promise.all(g.lines.slice(i, i + 4).map(score)); await yieldToMain(); }
        if (out.length >= MAX_ROWS && Date.now() - published >= PUBLISH_MS) { published = Date.now(); qc.setQueryData(key, [...out]); }
      });
      return out;
    },
  });
  const otherDay = useMemo(() => (teams ? 0 : hotLines(doc.data?.lines || [], { day: 1 - day }).length), [doc.data, teams, day]); // the other day's lines, only counted: the day switch stays when this day has none
  // while the bookmaker file is still loading the query is idle (not "loading"): treat that as loading too, so the empty message never flashes
  return { ...rows, isLoading: rows.isLoading || (!rows.data && !rows.isError), scoring: rows.isFetching, otherDay };
}

const Spark = ({ r }: { r: Row }) => <MiniBars last={r.last} line={r.line} max={r.max} />;

/** List row built from shadcn Item parts, iOS style at every width: photo, name and line, then the edge and the hit rate over the last-10 bars; a chevron marks it as tappable. */
type SoFar = { v: number; state: "live" | "out" | "final"; verdict: "cleared" | "missed" | "push" | null };
const VERDICT = { cleared: "Cleared", missed: "Missed", push: "Push" } as const; // the words the player page's chart uses

function PropRow({ r, win, wl, bars, i, soFar, out }: { r: Row; win: Win; wl: string; bars: boolean; i: number; soFar: SoFar | null; out: boolean }) {
  return (
    <motion.li className="relative after:absolute after:bottom-0 after:left-[calc(var(--gutter)+var(--control)+var(--spacing-snug))] after:right-0 after:h-px after:bg-white/10 last:after:hidden" layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ layout: { type: "spring", stiffness: 420, damping: 38 }, delay: Math.min(i, 6) * 0.025, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
      <Item asChild size="sm" className={cn("min-h-row rounded-none border-0 px-gutter py-snug transition-colors active:bg-card", out && "opacity-60")}>
        <Link to={`/player/${r.idx}?stat=${r.stat}&line=${r.line}&fmt=${fmtIndex(r.fmt)}${r.inn ? `&scope=${r.inn}` : ""}`}>
          <ItemMedia><PlayerBadge idx={r.idx} size="md" className="size-control" /></ItemMedia>
          <ItemContent className="min-w-0 gap-hair">
            <ItemTitle className="max-w-full text-body font-semibold leading-snug"><span className="truncate">{r.name}</span><TeamFlag name={r.team} />{out && <Badge variant="outline" className="shrink-0 px-snug py-hair text-caption font-semibold text-muted-foreground">Not in XI</Badge>}</ItemTitle>
            <ItemDescription className="truncate text-callout text-primary">O {r.line} <span className="text-muted-foreground">{(STATS as any)[r.stat]?.label}{r.inn ? ` · ${SCOPE_LABEL[r.inn]}` : ""} · {odds(r.over)}</span>{soFar != null && <span className={cn("tabular-nums", soFar.verdict === "cleared" ? "text-primary" : soFar.verdict === "missed" ? "text-miss" : "text-muted-foreground")}> · {soFar.v} {soFar.state === "live" ? "so far" : soFar.state}{soFar.verdict && <b className="font-semibold"> · {VERDICT[soFar.verdict]}</b>}</span>}</ItemDescription>
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
export function HotProps({ teams, start, archive }: { teams?: [string, string]; start?: string; archive?: any } = {}) {
  const [day, setDay] = useState("0");
  const { data: all, isLoading, scoring, otherDay } = useHotRows(archive, teams, Number(day));
  const onThis = (r: Row) => sameFixture({ match: r.match, start_utc: r.start }, { a: teams![0], b: teams![1], start }); // this match: the same two sides and the same start, not the series' next game
  const live = useLiveDoc();
  // a match stays for 3 hours after the start, and for as long as the live feed still lists it as being played (an ODI or a Test runs far longer)
  const onFixture = !!teams;
  const data = useMemo(() => (all || []).filter((r) => {
    if (onFixture) return true; // a fixture's own page shows every line it has, whatever the match's age: props are never taken away
    if (Date.parse(r.start) > Date.now() - 3 * 3600e3 || r.settled != null) return true;
    const [a, b] = String(r.match).split(/\s+vs\s+/i);
    return ["live", "final"].includes(liveForFixture(live.data, { a, b, start: r.start })?.status ?? ""); // a finished match keeps its props with their results
  }), [all, live.data, onFixture]);
  const { identity } = useData();
  // Where a priced line stands is settled on the server (`lines` on each live match, /api/live) and an old match's results are stored in its archive file: `lineStanding`
  // shows those first and reads the card itself only as the fallback.
  const matchOf = (r: Row) => { const [a, b] = String(r.match).split(/\s+vs\s+/i); return liveForFixture(live.data, { a, b, start: r.start }); };
  const asLine = (r: Row) => ({ pid: r.pid, player: r.name, book_name: r.bookName, team: r.team, stat: r.stat, line: r.line, inn: r.inn });
  const soFarOf = (r: Row): SoFar | null => lineStanding(matchOf(r), asLine(r), identity, { stored: r.stored, settled: r.settled });
  const outOf = (r: Row) => lineNotIn(matchOf(r), asLine(r), identity);
  const [stat, setStat] = useState("all");
  const [win, setWin] = useState<Win>("l10");
  const [bars, setBars] = useState(true);
  const [team, setTeam] = useState("all");
  const tabs = useMemo(() => {
    const have = new Set((data || []).map((r) => r.stat));
    return [["all", "All props"], ...Object.entries(STATS).filter(([k]) => have.has(k)).map(([k, v]: any) => [k, v.label])] as [string, string][];
  }, [data]);
  const dirty = win !== "l10" || (teams ? team !== "all" : day !== "0") || !bars;
  const need = WINS.find(([k]) => k === win)![2], wl = WINS.find(([k]) => k === win)![1];
  const rows = useMemo(() => (data || []).filter((r) => (teams ? onThis(r) && (team === "all" || norm(r.team) === norm(team)) : r.day === Number(day)) && (stat === "all" || r.stat === stat) && r[win].played >= need)
    .sort((x, y) => (y[win].p ?? 0) - (x[win].p ?? 0) || (y.edge ?? -1) - (x.edge ?? -1)).slice(0, MAX_ROWS), [data, stat, win, need, day, teams, team, start]);
  const priced = useMemo(() => (data || []).filter((r) => (teams ? onThis(r) : true)), [data, teams, start]);
  if (!isLoading && !scoring && !priced.length && !otherDay) return null;
  const waiting = isLoading || (scoring && !rows.length); // rows are still coming in and none of those so far is in this window: not "no rows" yet
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
        {waiting ? <RowsSkeleton /> : !rows.length ? <p className="p-6 text-callout text-muted-foreground">No rows in this window. Open Filters to widen it.</p> : (
          <ul className="-mx-gutter">
            <AnimatePresence mode="popLayout" initial={false}>
              {rows.map((r, i) => <PropRow key={`${r.idx}${r.stat}${r.fmt}${r.start}${r.inn}`} r={r} win={win} wl={wl} bars={bars} i={i} soFar={soFarOf(r)} out={outOf(r)} />)}
            </AnimatePresence>
          </ul>
        )}
      </AnimatedHeight>
    </section>
  );
}
