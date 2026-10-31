/* eslint-disable @typescript-eslint/no-explicit-any */
import { useId, useMemo, useState } from "react";
import { track } from "@/lib/analytics";
import { Link, useNavigate } from "react-router-dom";
import { AdjustmentsHorizontalIcon, ChevronDownIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { AnimatedHeight } from "./animated-height";
import { RowsSkeleton } from "./skeletons";
import { liveForFixture, lineNotIn, lineStanding } from "@/engine/live.js";
import { SCOPE_LABEL, bookLinesFor, bookQuotes, keepMsFor, lineScope, sameFixture } from "@/engine/lines.js";
import { runPlan } from "@/engine/plan.js";
import { STATS } from "@/engine/rules.js";
import { sideEdge } from "@/engine/stats.js";
import { fmtIndex } from "@/engine/util.js";
import { venueStem } from "@/engine/markets.js";
import { barState, windowRate } from "@/engine/windows.js";
import { useLiveDoc } from "@/hooks/useLive";
import { useFixtures } from "@/hooks/useEngine";
import { useData } from "@/lib/data";
import { EMPTY_PHASE } from "./home-phase-bar";
import { byShard, hotDay, hotDayLabels, hotLines, hotOrder, matchChipId, norm, otherHotCount, pool } from "@/lib/hot-lines";
import { lineHomePhase, type HomePhase } from "@/lib/home-phase";
import { odds } from "@/lib/format";
import { linesQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Badge } from "@/components/ui/badge";
import { BookBadge } from "./book-badge";
import { PlayerBadge, TeamBadge, TeamFlag } from "./badges";
import { PillGroup } from "./pill-group";
import { MiniBars } from "./mini-bars";
import { MatchChip } from "./fixture-card";

const MAX_ROWS = 30;
type Win = "season" | "h2h" | "ven" | "l5" | "l10";
const WINS: [Win, string, number][] = [["season", String(new Date().getFullYear()), 6], ["h2h", "H2H", 2], ["ven", "Venue", 2], ["l5", "L5", 5], ["l10", "L10", 6]]; // [key, label, games needed to rank]
const SHARDS_AT_ONCE = 8; // player files fetched at a time: several at once (they are latency-bound), few enough that the first ones land early
const PUBLISH_MS = 300; // rows already scored are shown at most this often while the rest are still coming, and only once there are a full page of them (a shorter list would only be reshuffled)
const pct = (p: number | null) => (p == null ? "–" : `${Math.round(p * 100)}%`);
const pctClass = (p: number | null) => (p == null ? "text-muted-foreground" : p >= 0.7 ? "text-primary" : p <= 0.4 ? "text-miss" : "text-foreground");

/** One book's own line and over price for the row's player and stat (`bookQuotes`); `best` marks the friendliest one when 2+ books quote. */
type Quote = { source: string; name: string; line: number; over: number | null; under: number | null; best: boolean; underAt?: { line: number; price: number }; underOnly?: boolean };
interface Row { day: number; idx: number; pid: string; inn: number; name: string; bookName: string; settled?: number | null; stored?: number | null; team: string; opp: string; stat: string; line: number; fmt: string; match: string; start: string; over: number; quotes: Quote[]; prior: number | null; l5: any; l10: any; season: any; h2h: any; ven: any; venue: string; edge: number | null; last: { v: number | null; s: string }[]; max: number }

/**
 * The bookmaker player lines of one day (`day`: 0 today, 1 tomorrow) or, with `teams`, of one match, each scored from the player's own history by the engine: L10 hit rate, this
 * year's, vs today's opponent, and the edge of the best over price: the hit rate of the window shown pulled toward the market's no-vig chance (`sideEdge`, `engine/stats.js`).
 * Only those lines are scored (each costs a player file), the files come several at a time, and the rows are in `data` as they finish (`scoring` says more are coming).
 */
export function useHotRows(archive?: any, teams?: [string, string], day = 0) {
  const { store, rz } = useData();
  const qc = useQueryClient();
  const lines = useQuery(linesQuery);
  const fixtures = useFixtures(); // each match's ground, for the venue window
  const doc = { data: archive ?? lines.data }; // `archive`: the book doc with an archived match added, for that match's own page
  const today = new Date().toDateString();
  const key = ["hot-props", fixtures.isLoading, doc.data?.generated_at_utc, today, archive ? `${teams?.join("|")}|${doc.data?.lines?.length}` : "", teams ? teams.join("|") : day];
  const rows = useQuery({
    queryKey: key,
    enabled: !!doc.data && !fixtures.isLoading,
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
        const b = bookLinesFor({ lines: todays.lines.filter((x: any) => x.start_utc === l.start_utc) }, l.pid, l.stat, l.fmt, now, archive ? Infinity : keepMsFor(l.fmt), inn);
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
        const venue = String((fixtures.data || []).find((f: any) => sameFixture({ match: b.match, start_utc: b.start_utc, fmt: l.fmt }, f))?.venue || "");
        const ven = windowRate(venue ? entries.filter((e) => venueStem(e.venueName) === venueStem(venue)) : [], 0, main.line); // his games at the match's ground (the data spells a ground several ways)
        const last = entries.slice(-10).map((e) => ({ v: e.value as number | null, s: barState(e, main.line) as string }));
        // once the match itself is in the data its result is his latest game: same opponent, within a day of the start
        const lastE = entries[entries.length - 1];
        const settled: number | null | undefined = lastE && norm(lastE.opp) === norm(opp) && Math.abs(Date.parse(String(lastE.date)) - Date.parse(String(b.start_utc).slice(0, 10))) <= 86400e3 ? lastE.value : undefined;
        out.push({ day: hotDay(b.start_utc, l.fmt, now), idx, pid: l.pid, inn, name: /^[0-9a-f]{8}$/.test(store.playerName(idx)) ? l.book_name || store.playerName(idx) : store.playerName(idx), bookName: l.book_name || "", team: l.team, opp, stat: l.stat, line: main.line, fmt: l.fmt, match: b.match, start: b.start_utc, over, quotes: bookQuotes(b.lines), l5, l10, season, h2h, ven, venue,
          prior: main.prob ?? null, edge: null, last, settled, stored: l.result ?? null, max: Math.max(main.line * 1.5, ...last.map((x) => x.v ?? 0), 1) }); // `result`: the archive file's stored result for this player and stat
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
  const otherDay = useMemo(() => (teams ? 0 : otherHotCount(doc.data?.lines || [], day)), [doc.data, teams, day]); // other days' lines, only counted: the day switch stays when this day has none
  // while the bookmaker file is still loading the query is idle (not "loading"): treat that as loading too, so the empty message never flashes
  return { ...rows, isLoading: rows.isLoading || (!rows.data && !rows.isError), scoring: rows.isFetching, otherDay };
}

const Spark = ({ r }: { r: Row }) => <MiniBars last={r.last} line={r.line} max={r.max} />;

/** List row built from shadcn Item parts, iOS style at every width: photo, name and line, then the edge and the hit rate over the last-10 bars; a chevron marks it as tappable. */
type SoFar = { v: number; state: "live" | "out" | "final"; verdict: "cleared" | "missed" | "push" | null };
const VERDICT = { cleared: "Cleared", missed: "Missed", push: "Push" } as const; // the words the player page's chart uses

/** The best quote up front (the lowest line, and the best price at it, in the accent colour) with its book; the other books' line, over and under prices sit in a table that a "+N books" toggle opens. */
export function BookQuotes({ quotes, className }: { quotes: Quote[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const [top, ...rest] = quotes;
  if (!top) return null;
  return (
    <div className={cn("flex flex-col gap-hair text-footnote tabular-nums text-muted-foreground", className)}>
      <div className="flex flex-wrap items-center gap-x-snug">
        <span className={cn("whitespace-nowrap", top.best && "font-semibold text-primary")}>
          <BookBadge source={top.source} /> {top.over == null ? `U ${top.line} ${odds(top.under)}` : <>O {top.line} {odds(top.over)}{top.underAt && <> · U {top.underAt.line} {odds(top.underAt.price)}</>}</>}{top.best && <span className="sr-only"> (lowest line, best price)</span>}
        </span>
        {rest.length > 0 && (
          <button type="button" aria-expanded={open} aria-controls={id} className="inline-flex items-center gap-hair rounded-full px-tight font-medium text-foreground/70 hover:bg-hairline"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); if (!open) track("books_open"); }}>
            {open ? "Hide" : `+${rest.length} book${rest.length > 1 ? "s" : ""}`}<ChevronDownIcon className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        )}
      </div>
      {open && (
        <table id={id} className="w-full max-w-sm text-left">
          <thead><tr className="text-caption uppercase tracking-wider"><th className="py-hair font-medium">Book</th><th className="py-hair font-medium">Line</th><th className="py-hair font-medium">Over</th><th className="py-hair font-medium">Under</th></tr></thead>
          <tbody>{rest.map((q) => <tr key={q.source}><td className="py-hair"><BookBadge source={q.source} /></td><td>{q.line}</td><td>{odds(q.over)}</td><td>{q.underAt ? `U ${q.underAt.line} ${odds(q.underAt.price)}` : odds(q.under)}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}

export function PropRow({ r, win, wl, bars, i, soFar, out }: { r: Row; win: Win; wl: string; bars: boolean; i: number; soFar: SoFar | null; out: boolean }) {
  const books = r.quotes.length > 1; // 2+ books price him: each shows its own line and price below, so the main line's price is not said twice
  return (
    <motion.li className="relative after:absolute after:bottom-0 after:left-[calc(var(--gutter)+var(--control)+var(--spacing-snug))] after:right-0 after:h-px after:bg-hairline last:after:hidden" layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ layout: { type: "spring", stiffness: 420, damping: 38 }, delay: Math.min(i, 6) * 0.025, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
      <Item asChild size="sm" className={cn("min-h-row gap-y-hair rounded-none border-0 px-gutter py-snug transition-colors active:bg-card", out && "opacity-60")}>
        <Link to={`/player/${r.idx}?stat=${r.stat}&line=${r.line}&fmt=${fmtIndex(r.fmt)}${r.inn ? `&scope=${r.inn}` : ""}`}>
          <ItemMedia><PlayerBadge idx={r.idx} size="md" className="size-control" /></ItemMedia>
          <ItemContent className="min-w-0 gap-hair">
            <ItemTitle className="max-w-full text-body font-semibold leading-snug"><span className="truncate">{r.name}</span><TeamFlag name={r.team} />{out && <Badge variant="outline" className="shrink-0 px-snug py-hair text-caption font-semibold text-muted-foreground">Not in XI</Badge>}</ItemTitle>
            <ItemDescription className="text-callout text-primary">O {r.line} <span className="text-muted-foreground">{(STATS as any)[r.stat]?.label}{r.inn ? ` · ${SCOPE_LABEL[r.inn]}` : ""}{!(books && r.quotes.some((q) => q.line === r.line)) && <> · {r.quotes.length === 1 && <><BookBadge source={r.quotes[0].source} />{" "}</>}{odds(r.over)}</>}</span>{soFar != null && <span className={cn("tabular-nums", soFar.verdict === "cleared" ? "text-primary" : soFar.verdict === "missed" ? "text-miss" : "text-muted-foreground")}> · {soFar.v} {soFar.state === "live" ? "so far" : soFar.state}{soFar.verdict && <b className="font-semibold"> · {VERDICT[soFar.verdict]}</b>}</span>}</ItemDescription>
          </ItemContent>
          <ItemActions className="gap-tight">
            <span className="grid justify-items-end text-right">
              <span className="text-caption font-semibold tracking-wider text-muted-foreground">EDGE</span>
              <span className={cn("text-body font-semibold tabular-nums", r.edge == null ? "text-muted-foreground" : r.edge > 0 ? "text-primary" : "text-miss")}>{r.edge == null ? "–" : `${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(0)}%`}</span>
            </span>
            <span className="grid justify-items-end gap-hair">
              <span className={cn("text-footnote font-semibold tabular-nums", pctClass(r[win].p))}>{pct(r[win].p)} <span className="font-normal text-muted-foreground">{wl}{(win === "h2h" || win === "ven") && r[win].played ? ` · ${r[win].played}` : ""}</span></span>
              {win !== "ven" && r.ven?.played >= 2 && <span className={cn("text-caption tabular-nums", (r.ven.p ?? 0) >= 0.75 ? "font-semibold text-primary" : (r.ven.p ?? 1) <= 0.25 ? "font-semibold text-miss" : "text-muted-foreground")} title={r.venue}>At {String(r.venue).split(",")[0]} {pct(r.ven.p)} · {r.ven.hits}/{r.ven.played}</span>}
              {bars && <Spark r={r} />}
            </span>
          </ItemActions>
          {books && <BookQuotes quotes={r.quotes} className="basis-full pl-[calc(var(--control)+var(--spacing-snug))]" />}
        </Link>
      </Item>
    </motion.li>
  );
}

function RateCell({ p, n }: { p: number | null; n?: number }) {
  return <span className={cn("font-semibold tabular-nums", pctClass(p))}>{pct(p)}{n != null && n > 0 && n < 10 ? <span className="font-normal text-muted-foreground"> · {n}</span> : null}</span>;
}

function ColHead({ id, label, win, onWin, align, className }: { id?: Win; label: string; win: Win; onWin: (w: Win) => void; align?: "right"; className?: string }) {
  const active = !!id && win === id;
  const cls = cn("px-snug py-tight text-left text-caption font-medium uppercase tracking-wider whitespace-nowrap", align === "right" && "text-right", active ? "text-foreground" : "text-muted-foreground", className);
  if (!id) return <th className={cls}>{label}</th>;
  return (
    <th className={cls}>
      <button type="button" className="inline-flex items-center gap-hair" onClick={() => onWin(id)}>
        {label}{active ? <ChevronDownIcon className="size-3" aria-hidden /> : <ChevronUpDownIcon className="size-3 opacity-40" aria-hidden />}
      </button>
    </th>
  );
}

/** Desktop prop table: one row per priced line, cricket windows as columns (year / H2H / ground), not a copy of another sport's sheet. */
export function PropTable({ rows, win, onWin, bars, soFarOf, outOf }: { rows: Row[]; win: Win; onWin: (w: Win) => void; bars: boolean; soFarOf: (r: Row) => SoFar | null; outOf: (r: Row) => boolean }) {
  const nav = useNavigate();
  const year = WINS[0][1];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-callout">
        <thead>
          <tr className="border-b border-hairline">
            <ColHead label="Lines" win={win} onWin={onWin} className="pl-[calc(var(--control)+var(--spacing-snug)*2)]" />
            {bars ? <ColHead id="l10" label="L10 chart" win={win} onWin={onWin} /> : null}
            <ColHead label="Odds" win={win} onWin={onWin} />
            <ColHead id="season" label={year} win={win} onWin={onWin} />
            <ColHead id="h2h" label="H2H" win={win} onWin={onWin} />
            <ColHead id="ven" label="Ground" win={win} onWin={onWin} />
            <ColHead label="Edge" win={win} onWin={onWin} align="right" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const soFar = soFarOf(r), out = outOf(r);
            const to = `/player/${r.idx}?stat=${r.stat}&line=${r.line}&fmt=${fmtIndex(r.fmt)}${r.inn ? `&scope=${r.inn}` : ""}`;
            const ground = String(r.venue || "").split(",")[0];
            return (
              <tr key={`${r.idx}${r.stat}${r.fmt}${r.start}${r.inn}`} tabIndex={0} role="link"
                className={cn("cursor-pointer border-b border-hairline last:border-b-0 hover:bg-surface-hover", out && "opacity-60")}
                onClick={() => nav(to)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); nav(to); } }}>
                <td className="px-snug py-snug">
                  <span className="flex items-center gap-snug">
                    <PlayerBadge idx={r.idx} size="sm" className="size-control" />
                    <span className="grid min-w-0">
                      <span className="flex min-w-0 items-center gap-tight text-body font-semibold leading-snug"><span className="truncate">{r.name}</span><TeamFlag name={r.team} />{out && <Badge variant="outline" className="shrink-0 px-snug py-hair text-caption font-semibold text-muted-foreground">Not in XI</Badge>}</span>
                      <span className="truncate text-callout text-muted-foreground">O {r.line} {(STATS as any)[r.stat]?.label}{r.inn ? ` · ${SCOPE_LABEL[r.inn]}` : ""}{soFar != null && <span className={cn("tabular-nums", soFar.verdict === "cleared" ? "text-primary" : soFar.verdict === "missed" ? "text-miss" : "")}> · {soFar.v}{soFar.verdict ? ` ${VERDICT[soFar.verdict]}` : " so far"}</span>}</span>
                      {r.quotes.length > 1 && <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}><BookQuotes quotes={r.quotes} /></span>}
                    </span>
                  </span>
                </td>
                {bars ? <td className="px-snug py-snug"><Spark r={r} /></td> : null}
                <td className="px-snug py-snug font-semibold tabular-nums">{odds(r.over)}</td>
                <td className="px-snug py-snug"><RateCell p={r.season.p} n={r.season.played} /></td>
                <td className="px-snug py-snug"><RateCell p={r.h2h.p} n={r.h2h.played} /></td>
                <td className="px-snug py-snug" title={r.venue}><span className="grid gap-hair"><RateCell p={r.ven.p} n={r.ven.played} />{ground ? <span className="truncate text-caption text-muted-foreground">{ground}</span> : null}</span></td>
                <td className={cn("px-snug py-snug text-right font-semibold tabular-nums", r.edge == null ? "text-muted-foreground" : r.edge > 0 ? "text-primary" : "text-miss")}>{r.edge == null ? "–" : `${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(1)}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** "Hot player props" for the selected day's matches (today by default, any of the next 10 days from Filters), in the props.cash lines-table style: stat tabs, then one ranked row per bookmaker line. */
export function HotProps({ teams, start, fmt, archive, heading, phase }: { teams?: [string, string]; start?: string; fmt?: string; archive?: any; heading?: string; phase?: HomePhase } = {}) {
  const [day, setDay] = useState("0");
  const { data: all, isLoading, scoring, otherDay } = useHotRows(archive, teams, Number(day));
  const onThis = (r: Row) => sameFixture({ match: r.match, start_utc: r.start, fmt: r.fmt }, { a: teams![0], b: teams![1], start, fmt }); // this match: the same two sides, a Test on any of its days, not the series' next game
  const live = useLiveDoc();
  // a match stays 24 hours after the start (6 days for a Test), and while the live feed still lists it as being played
  const onFixture = !!teams;
  const data = useMemo(() => (all || []).filter((r) => {
    if (onFixture) return true; // a fixture's own page shows every line it has, whatever the match's age: props are never taken away
    if (phase && lineHomePhase(r, live.data) !== phase) return false;
    if (Date.parse(r.start) > Date.now() - keepMsFor(r.fmt)) return true;
    const [a, b] = String(r.match).split(/\s+vs\s+/i);
    return liveForFixture(live.data, { a, b, start: r.start, fmt: r.fmt })?.status === "live";
  }), [all, live.data, onFixture, phase]);
  const { identity } = useData();
  // Where a priced line stands is settled on the server (`lines` on each live match, /api/live) and an old match's results are stored in its archive file: `lineStanding`
  // shows those first and reads the card itself only as the fallback.
  const matchOf = (r: Row) => { const [a, b] = String(r.match).split(/\s+vs\s+/i); return liveForFixture(live.data, { a, b, start: r.start, fmt: r.fmt }); };
  const asLine = (r: Row) => ({ pid: r.pid, player: r.name, book_name: r.bookName, team: r.team, stat: r.stat, line: r.line, inn: r.inn });
  const soFarOf = (r: Row): SoFar | null => lineStanding(matchOf(r), asLine(r), identity, { stored: r.stored, settled: r.settled });
  const outOf = (r: Row) => lineNotIn(matchOf(r), asLine(r), identity);
  const [stat, setStat] = useState("all");
  const [win, setWin] = useState<Win>("l10");
  const [bars, setBars] = useState(true);
  const [team, setTeam] = useState("all");
  const [matchKey, setMatchKey] = useState("all");
  const matchChips = useMemo(() => {
    const m = new Map<string, { id: string; a: string; b: string; start: string; fmt?: string }>();
    for (const r of data || []) {
      const id = matchChipId(r.match, r.start, r.fmt);
      const [a, b] = String(r.match).split(/\s+vs\s+/i);
      const prev = m.get(id);
      if (!prev || Date.parse(r.start) < Date.parse(prev.start)) m.set(id, { id, a: a || r.team, b: b || r.opp, start: r.start, fmt: r.fmt });
    }
    return [...m.values()];
  }, [data]);
  const pick = matchChips.some((c) => c.id === matchKey) ? matchKey : "all";
  const tabs = useMemo(() => {
    const have = new Set((data || []).map((r) => r.stat));
    return [["all", "All props"], ...Object.entries(STATS).filter(([k]) => have.has(k)).map(([k, v]: any) => [k, v.label])] as [string, string][];
  }, [data]);
  const dirty = win !== "l10" || (teams ? team !== "all" : day !== "0") || !bars;
  const need = WINS.find(([k]) => k === win)![2], wl = WINS.find(([k]) => k === win)![1];
  // the edge is worked out from the window shown, so it moves with it; rows of a match in play come first (`hotOrder`), so they follow the live feed
  const rows = useMemo(() => (data || []).map((r) => ({ ...r, edge: sideEdge(r[win].hits, r[win].played, r.prior, r.over), live: matchOf(r)?.status === "live" })).filter((r) => (teams ? onThis(r) && (team === "all" || norm(r.team) === norm(team)) : r.day === Number(day) && (pick === "all" || matchChipId(r.match, r.start, r.fmt) === pick)) && (stat === "all" || r.stat === stat) && r[win].played >= need)
    .sort((x, y) => hotOrder({ live: x.live, p: x[win].p, edge: x.edge }, { live: y.live, p: y[win].p, edge: y.edge })).slice(0, MAX_ROWS), [data, stat, win, need, day, teams, team, start, fmt, live.data, pick]);
  const priced = useMemo(() => (data || []).filter((r) => (teams ? onThis(r) : true)), [data, teams, start]);
  if (!isLoading && !scoring && !priced.length && !otherDay) return null;
  const waiting = isLoading || (scoring && !rows.length); // rows are still coming in and none of those so far is in this window: not "no rows" yet
  return (
    <section aria-label="Player props" className="flex flex-col gap-stack">
      {heading ? <h1 className="hidden text-display font-bold tracking-tight lg:block">{heading}</h1> : null}
      {!teams && matchChips.length > 0 && (
        <div className="hidden gap-tight overflow-x-auto [scrollbar-width:none] lg:flex [&::-webkit-scrollbar]:hidden" role="toolbar" aria-label="Matches">
          <button type="button" aria-pressed={pick === "all"} onClick={() => setMatchKey("all")}
            className={cn("flex h-control shrink-0 items-center rounded-[var(--chip-radius)] px-snug text-caption font-semibold ring-1", pick === "all" ? "bg-card ring-primary" : "bg-card ring-hairline hover:bg-surface-hover")}>All</button>
          {matchChips.map((f) => <MatchChip key={f.id} f={f} active={pick === f.id} onPick={(id) => setMatchKey(id || "all")} />)}
        </div>
      )}
      {/* one chip row for the prop type, plus a Filters button (current window on it) that opens an iOS-style bottom sheet for the rest */}
      <div className="flex items-center gap-snug">
        <PillGroup layoutId="hot-stat" label="Prop type" value={stat} onChange={setStat} items={tabs} className="min-w-0 flex-1" />
        <Sheet>
          <SheetTrigger asChild>
            <button type="button" aria-label="Filters" className="relative flex h-control shrink-0 items-center gap-tight rounded-[var(--chip-radius)] bg-card px-3 text-callout font-medium transition-colors active:bg-accent">
              <AdjustmentsHorizontalIcon className="size-4" />{wl}
              {dirty && <span aria-hidden className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-primary ring-2 ring-background" />}
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" showCloseButton={false} className="rounded-t-3xl border-0 bg-popover/80 px-inset pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-snug backdrop-blur-2xl backdrop-saturate-150 sm:mx-auto sm:max-w-md">
            <div aria-hidden className="mx-auto h-1.5 w-10 rounded-full bg-foreground/25" />
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
                  <PillGroup segmented layoutId="hot-day" label="Day" value={day} onChange={setDay} items={hotDayLabels()} /></div>
              )}
              <label className="flex min-h-control items-center justify-between gap-stack rounded-xl bg-surface-hover px-3 py-tight text-body">Form charts<Switch checked={bars} onCheckedChange={setBars} aria-label="Show form charts" /></label>
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <AnimatedHeight>
        {waiting ? <RowsSkeleton /> : !rows.length ? <p className="px-inset py-stack text-callout text-muted-foreground">{phase ? EMPTY_PHASE[phase] : "No rows in this window. Open Filters to widen it."}</p> : (
          <>
            <ul className="-mx-gutter lg:hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                {rows.map((r, i) => <PropRow key={`${r.idx}${r.stat}${r.fmt}${r.start}${r.inn}`} r={r} win={win} wl={wl} bars={bars} i={i} soFar={soFarOf(r)} out={outOf(r)} />)}
              </AnimatePresence>
            </ul>
            <div className="hidden lg:block">
              <PropTable rows={rows} win={win} onWin={setWin} bars={bars} soFarOf={soFarOf} outOf={outOf} />
            </div>
          </>
        )}
      </AnimatedHeight>
    </section>
  );
}
