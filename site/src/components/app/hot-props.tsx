/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useId, useMemo, useState, type ReactNode } from "react";
import { track } from "@/lib/analytics";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AdjustmentsHorizontalIcon, ChartBarIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatedHeight } from "./animated-height";
import { RowsSkeleton } from "./skeletons";
import { liveForFixture, lineNotIn, lineStanding } from "@cricket/engine/live.js";
import { MarketTape } from "./market-tape";
import { Tick } from "./tick";
import { bookLinesFor, bookQuotes, keepMsFor, lineScope, sameFixture, scopeTag } from "@cricket/engine/lines.js";
import { runPlan } from "@cricket/engine/plan.js";
import { STATS } from "@cricket/engine/rules.js";
import { edgeTag, groundNote, modelSide } from "@cricket/engine/props-view.js";
import { fmtIndex } from "@cricket/engine/util.js";
import { venueStem } from "@cricket/engine/markets.js";
import { barState, windowRate } from "@cricket/engine/windows.js";
import { fixtureState } from "@/hooks/useEngine";
import { useLiveDoc } from "@/hooks/useLive";
import { useRail } from "@/hooks/useRail";
import { arrangeFixtures, homeTeam } from "@/lib/priority";
import { useFixtures } from "@/hooks/useEngine";
import { useData } from "@/lib/data";
import { EmptyState } from "./empty-state";
import { EMPTY_PHASE } from "./home-phase-bar";
import { byShard, hotDay, hotDayLabels, hotLines, hotOrder, matchChipId, norm, otherHotCount, pool, prioritizeHotGroups } from "@/lib/hot-lines";
import { lineHomePhase, type HomePhase } from "@/lib/home-phase";
import { abbr, odds, shortVenue } from "@/lib/format";
import { useLinesLive } from "@/hooks/useLinesLive";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookBadge } from "./book-badge";
import { TeamFlag } from "./badges";
import { PillGroup } from "./pill-group";
import { MiniBars } from "./mini-bars";
import { MatchChip } from "./fixture-card";
import { ActiveChip } from "./chip";
import { ScreenerFilters } from "./screener-filters";
import { PropStar } from "./star";
import { PlayerName } from "./player-name";
import { BatterSpot, LiveBadge, LiveOpened, LineProgress } from "./live-spot";
import { PlayerAvatar } from "./portrait";
import { DEFAULTS, activeFilters, clearFilter, enoughHistory, narrow, options, order, parseScreener, screenerParams, type Screener } from "@/lib/screener";
import { propKey } from "@/lib/saved";

const MAX_ROWS = 30;
type Win = "season" | "h2h" | "ven" | "l5" | "l10";
const WINS: [Win, string, number][] = [["season", String(new Date().getFullYear()), 6], ["h2h", "H2H", 2], ["ven", "Venue", 2], ["l5", "L5", 5], ["l10", "L10", 6]]; // [key, label, games needed to rank]
const SHARDS_AT_ONCE = 8; // after the first file, player files fetched at a time: several at once (they are latency-bound)
const PUBLISH_MS = 300; // rows already scored are shown at most this often while the rest are still coming
const pct = (p: number | null) => (p == null ? "–" : `${Math.round(p * 100)}%`);
const pctClass = (p: number | null) => (p == null ? "text-muted-foreground" : p >= 0.7 ? "text-primary" : p <= 0.4 ? "text-miss" : "text-foreground");

/** One book's own line and over price for the row's player and stat (`bookQuotes`); `best` marks the friendliest one when 2+ books quote. */
type Quote = { source: string; name: string; line: number; over: number | null; under: number | null; best: boolean; live?: boolean; opened?: number; underAt?: { line: number; price: number }; underOnly?: boolean };
interface Row { gender: number | null; comp: string; day: number; idx: number; pid: string; inn: number; name: string; bookName: string; settled?: number | null; stored?: number | null; team: string; opp: string; stat: string; line: number; fmt: string; match: string; start: string; over: number; under: number; quotes: Quote[]; prior: number | null; l5: any; l10: any; season: any; h2h: any; ven: any; venue: string; edge: number | null; side?: "over" | "under"; last: { v: number | null; s: string }[]; max: number }

/**
 * The bookmaker player lines of one day (`day`: 0 today, 1 tomorrow) or, with `teams`, of one match, each scored from the player's own history by the engine: L10 hit rate, this
 * year's, vs today's opponent, and the model's edge on the better side (`modelSide`, `engine/props-view.js`): the hit rate of the window shown pulled toward the market's no-vig chance, for the over and for the under.
 * Only those lines are scored (each costs a player file), the files come several at a time, and the rows are in `data` as they finish (`scoring` says more are coming).
 */
export function useHotRows(archive?: any, teams?: [string, string], day = 0, inns: "all" | "first" | "second" = "all") {
  const { store, rz, matchesReady } = useData();
  const qc = useQueryClient();
  const lines = useLinesLive();
  const fixtures = useFixtures(); // each match's ground, for the venue window
  const doc = { data: archive ?? lines.data }; // `archive`: the book doc with an archived match added, for that match's own page
  const today = new Date().toDateString();
  const scope = JSON.stringify([today, inns, teams ?? day, !!archive]);
  const scopeKey = ["hot-props", scope] as const;
  const key = [...scopeKey, fixtures.isLoading, doc.data?.generated_at_utc, doc.data?.live_sig ?? "", archive ? doc.data?.lines?.length : null];
  const rows = useQuery({
    queryKey: key,
    placeholderData: (previous, query) => query?.queryKey[1] === scope ? previous : undefined,
    enabled: !!doc.data && !fixtures.isLoading && matchesReady !== false,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Row[]> => {
      const now = Date.now();
      // an archived match is read whatever its age: only that match's lines, none of the day filters
      const todays = { lines: hotLines(doc.data.lines || [], teams ? { teams, archive: !!archive } : { day }, now) };
      // one row per player, stat and match: a series has several matches between the same sides, each priced on its own. A live line is a row of its own beside the pre-match one: that stays (it is the bet we settle) and the live line is added once it is passed
      const isLive = (l: any) => !!l.books?.some((x: any) => x.live);
      const keys = new Map<string, any>();
      for (const l of todays.lines) keys.set(`${l.pid}|${l.stat}|${l.fmt}|${matchChipId(l.match, l.start_utc, l.fmt)}|${lineScope(l)}|${isLive(l) ? "live" : ""}`, l); // a Test's first-innings line is a row of its own beside the match line; two stamps of one limited-overs fixture share a row
      const year = String(new Date().getFullYear());
      const out: Row[] = [];
      const score = async (l: any) => {
        const idx = store.P.id.indexOf(l.pid);
        const inn = lineScope(l);
        const chip = matchChipId(l.match, l.start_utc, l.fmt);
        const b = bookLinesFor({ lines: todays.lines.filter((x: any) => matchChipId(x.match, x.start_utc, x.fmt) === chip && isLive(x) === isLive(l)) }, l.pid, l.stat, l.fmt, now, archive ? Infinity : keepMsFor(l.fmt), inn);
        if (idx < 0 || !b) return;
        const main = b.main, over = Math.max(...main.books.map((x: any) => x.over || 0)), under = Math.max(...main.books.map((x: any) => x.under || 0));
        const r: any = await runPlan(store, rz, { kind: "player_prop", stat: l.stat, line: main.line, side: "over", filters: { format: l.fmt, team_innings: inn || null, innings: inns === "all" ? null : inns }, split_by: [] }, { playerIdx: idx });
        const entries: any[] = r?.ok ? r.chart?.entries || [] : [];
        if (!entries.length) return;
        const [a, c] = String(b.match).split(/\s+vs\s+/i);
        const opp = norm(l.team) === norm(a) ? c : a;
        const l5 = windowRate(entries, 5, main.line), l10 = windowRate(entries, 10, main.line);
        const season = windowRate(entries.filter((e) => String(e.date).startsWith(year)), 0, main.line);
        const h2h = windowRate(entries.filter((e) => norm(e.opp) === norm(opp)), 0, main.line);
        const fixture = (fixtures.data || []).find((f: any) => sameFixture({ match: b.match, start_utc: b.start_utc, fmt: l.fmt }, f));
        const venue = String(fixture?.venue || "");
        const gender = fixture?.gender === "female" ? 1 : fixture?.gender === "male" ? 0 : null;
        const ven = windowRate(venue ? entries.filter((e) => venueStem(e.venueName) === venueStem(venue)) : [], 0, main.line); // his games at the match's ground (the data spells a ground several ways)
        const last = entries.slice(-10).map((e) => ({ v: e.value as number | null, s: barState(e, main.line) as string }));
        // once the match itself is in the data its result is his latest game: same opponent, within a day of the start
        const lastE = entries[entries.length - 1];
        const settled: number | null | undefined = lastE && norm(lastE.opp) === norm(opp) && Math.abs(Date.parse(String(lastE.date)) - Date.parse(String(b.start_utc).slice(0, 10))) <= 86400e3 ? lastE.value : undefined;
        out.push({ gender, comp: String(b.competition || l.competition || ""), day: hotDay(b.start_utc, l.fmt, now), idx, pid: l.pid, inn, name: /^[0-9a-f]{8}$/.test(store.playerName(idx)) ? l.book_name || store.playerName(idx) : store.playerName(idx), bookName: l.book_name || "", team: l.team, opp, stat: l.stat, line: main.line, fmt: l.fmt, match: b.match, start: b.start_utc, over, under, quotes: bookQuotes(b.lines), l5, l10, season, h2h, ven, venue,
          prior: main.prob ?? null, edge: null, last, settled, stored: l.result ?? null, max: Math.max(main.line * 1.5, ...last.map((x) => x.v ?? 0), 1) }); // `result`: the archive file's stored result for this player and stat
      };
      // Started matches' files go first, and that first file is fetched alone so its rows can show before the rest of the day's files.
      // Later files come several at a time. A few plans run at once, giving the main thread back in between. Rows are published as they land.
      const yieldToMain = () => new Promise<void>((r) => { const s = (globalThis as any).scheduler; if (s?.yield) s.yield().then(r); else setTimeout(r, 0); });
      // Keep a complete snapshot visible while its replacement is scored. Only the
      // first load of a scope streams partial rows as player files arrive.
      const refreshing = qc.getQueriesData<Row[]>({ queryKey: scopeKey }).some(([, data]) => data !== undefined);
      let published = 0;
      const publish = () => {
        if (refreshing || !out.length || (published && Date.now() - published < PUBLISH_MS)) return;
        published = Date.now();
        qc.setQueryData(key, [...out]);
      };
      const groups = prioritizeHotGroups(byShard([...keys.values()], (pid) => store.P.id.indexOf(pid), (i) => store.shardOf(i)), now);
      const scoreGroup = async (g: { shard: number; lines: any[] }) => {
        await store.shard(g.shard).catch(() => {}); // a file that does not load costs its own rows (the plan answers "not ok" for them), not the page
        for (let i = 0; i < g.lines.length; i += 4) { await Promise.all(g.lines.slice(i, i + 4).map(score)); publish(); await yieldToMain(); }
      };
      if (groups[0]) await scoreGroup(groups[0]);
      await pool(groups.slice(1), SHARDS_AT_ONCE, scoreGroup);
      return out;
    },
  });
  const otherDay = useMemo(() => (teams ? 0 : otherHotCount(doc.data?.lines || [], day)), [doc.data, teams, day]); // other days' lines, only counted: the day switch stays when this day has none
  // while the bookmaker file is still loading the query is idle (not "loading"): treat that as loading too, so the empty message never flashes
  return { ...rows, isLoading: rows.isLoading || (!rows.data && !rows.isError), scoring: rows.isFetching && !rows.isPlaceholderData, otherDay };
}

const Spark = ({ r }: { r: Row }) => <MiniBars last={r.last} line={r.line} max={r.max} />;

/** List card: face + name, hero OVER line (condensed), book price, model edge. */
type SoFar = { v: number; state: "live" | "out" | "final"; verdict: "cleared" | "missed" | "push" | null };

/** The book's mark and price are always shown, even when it is the only book. With 2+ books the lowest line (best price at it) is in the accent colour and a "+N books" toggle opens the rest. */
export function BookQuotes({ quotes, className }: { quotes: Quote[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const [top, ...rest] = quotes;
  if (!top) return null;
  return (
    <div className={cn("flex flex-col gap-hair text-callout tabular-nums text-muted-foreground", className)}>
      <div className="flex flex-wrap items-center gap-x-snug gap-y-hair">
        <span className={cn("inline-flex items-center gap-tight whitespace-nowrap font-condensed", top.best && "font-medium text-primary")}>
          <BookBadge source={top.source} />{" "}
          {top.over == null
            ? <><span className="font-bold">U {top.line}</span> <span className="text-body font-bold text-foreground">{odds(top.under)}</span></>
            : <><span className="font-bold">O {top.line}</span> <Tick quiet value={top.over} className={cn("text-body font-bold", top.best ? "text-primary" : "text-foreground")}>{odds(top.over)}</Tick>{top.underAt ? <span className="text-muted-foreground"> · U {top.underAt.line} {odds(top.underAt.price)}</span> : top.under != null ? <span className="text-muted-foreground"> · U {odds(top.under)}</span> : null}</>}
          {top.best && <span className="sr-only"> (lowest line, best price)</span>}
        </span>
        {top.live && <LiveOpened opened={top.opened} line={top.line} />}
        {rest.length > 0 && (
          <button type="button" aria-expanded={open} aria-controls={id} className="inline-flex items-center gap-hair rounded-full px-tight font-medium text-foreground/70 hover:bg-hairline"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); if (!open) track("books_open"); }}>
            {open ? "Hide" : `+${rest.length} book${rest.length > 1 ? "s" : ""}`}<ChevronDownIcon className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        )}
      </div>
            {open && (
        <table id={id} className="w-full max-w-sm text-left font-condensed">
          <thead><tr className="label-cap text-footnote"><th className="py-hair font-medium">Book</th><th className="py-hair font-medium">Line</th><th className="py-hair font-medium">Over</th><th className="py-hair font-medium">Under</th></tr></thead>
          <tbody>{rest.map((q) => <tr key={q.source}><td className="py-hair"><BookBadge source={q.source} /></td><td className="font-bold">{q.line}</td><td className="font-bold"><Tick quiet value={q.over}>{odds(q.over)}</Tick></td><td>{q.underAt ? `U ${q.underAt.line} ${odds(q.underAt.price)}` : odds(q.under)}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}

function PropProgress({ r, soFar, out }: { r: Row; soFar: SoFar | null; out: boolean }) {
  if (out) return null;
  const quote = r.quotes.find((q) => q.live);
  return (
    <>
      <LineProgress quiet standing={soFar} live={!!quote} line={r.line} opened={quote?.opened} />
      {quote && (!soFar || soFar.state === "live") && <BatterSpot r={r} />}
    </>
  );
}

/** Same row chrome as Match Fancy's OverviewRow: title, condensed line + caps label, books, model edge + last-N bars. */
export function PropRow({ r, win, wl, soFar, out, hideMatch }: { r: Row; win: Win; wl: string; soFar: SoFar | null; out: boolean; hideMatch?: boolean }) {
  const label = (STATS as any)[r.stat]?.label as string;
  const side = r.side === "under" ? "U" : "O";
  const ground = win !== "ven" ? groundNote(r.ven) : null;
  return (
    <li className="relative border-t border-hairline first:border-t-0">
      <Link to={`/player/${r.idx}?stat=${r.stat}&line=${r.line}&fmt=${fmtIndex(r.fmt)}${r.start ? `&start=${encodeURIComponent(r.start)}` : ""}${r.inn ? `&scope=${r.inn}` : ""}`}
        className={cn("grid min-h-row w-full grid-cols-[var(--control)_minmax(0,1fr)_auto] items-center gap-tight px-gutter py-snug text-left transition-colors active:bg-card", out && "opacity-60")}>
        <PlayerAvatar idx={r.idx} team={r.team} test={r.fmt === "Test"} className="size-control" />
        <span className="grid min-w-0 gap-hair">
          <span className="flex min-w-0 items-center gap-tight text-body font-medium leading-snug">
            <span className="truncate"><PlayerName idx={r.idx} fallback={r.name} /></span>
            <TeamFlag name={r.team} />
            {r.quotes.some((q: Quote) => q.live) && <LiveBadge />}
            {out && <Badge variant="outline" className="shrink-0 px-snug py-hair text-caption font-medium text-muted-foreground">Not in XI</Badge>}
          </span>
          <span className="flex flex-wrap items-baseline gap-x-snug gap-y-hair">
            <span className="font-condensed text-metric font-bold leading-none tracking-tight tabular-nums text-foreground">{side} {r.line}</span>
            <span className="label-cap text-footnote"><span className="text-primary">{label}</span>{scopeTag(r.fmt, r.inn) && <span className="text-muted-foreground"> · {scopeTag(r.fmt, r.inn)}</span>}</span>
          </span>
          {r.quotes.length > 0 ? <BookQuotes quotes={r.quotes} /> : r.over > 1 ? <Tick quiet value={r.over} className="font-condensed text-callout font-bold tabular-nums text-primary">{odds(r.over)}</Tick> : null}
          <PropProgress r={r} soFar={soFar} out={out} />
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-snug gap-y-hair text-footnote text-muted-foreground">
            {!hideMatch && soFar == null && <span className="truncate">{r.fmt}{r.match ? ` · ${r.match}` : ""}</span>}
            {ground && <span className={cn("truncate", ground.tone === "good" ? "font-medium text-primary" : ground.tone === "bad" ? "font-medium text-miss" : undefined)} title={r.venue}>{ground.hits}/{ground.played} at {shortVenue(r.venue)}</span>}
            <span className={cn("font-condensed tabular-nums", pctClass(r[win].p))}>{r[win].hits} in {wl}</span>
          </span>
        </span>
        <span className="grid self-start justify-items-end gap-hair pt-control">
          <span className="grid justify-items-end gap-hair text-right">
            <span className="flex items-baseline gap-tight whitespace-nowrap">
              <span className="label-cap text-caption text-muted-foreground">Model</span>
              <span className={cn("font-condensed text-title font-bold leading-none tabular-nums", r.edge == null ? "text-muted-foreground" : r.edge > 0 ? "text-primary" : "text-miss")}>{r.edge == null ? "–" : `${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(0)}%`}</span>
            </span>
            {r.edge != null && <span className="label-cap text-caption text-muted-foreground">{edgeTag(r.edge, r.side)}</span>}
          </span>
          <Spark r={r} />
        </span>
      </Link>
      <PropStar idx={r.idx} stat={r.stat} line={r.line} fmt={fmtIndex(r.fmt)} className="absolute right-[calc(var(--gutter)-var(--spacing-tight))] top-snug" />
    </li>
  );
}

function RateCell({ p, n }: { p: number | null; n?: number }) {
  return <span className={cn("font-condensed text-body font-medium tabular-nums", pctClass(p))}>{pct(p)}{n != null && n > 0 && n < 10 ? <span className="font-normal text-muted-foreground"> · {n}</span> : null}</span>;
}

function ColHead({ id, label, win, onWin, align, className }: { id?: Win; label: string; win: Win; onWin: (w: Win) => void; align?: "right"; className?: string }) {
  const active = !!id && win === id;
  const cls = cn("px-snug py-tight text-left label-cap text-footnote whitespace-nowrap", align === "right" && "text-right", active ? "text-foreground" : "text-muted-foreground", className);
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
            <ColHead label="Over / under" win={win} onWin={onWin} />
            <ColHead id="season" label={year} win={win} onWin={onWin} />
            <ColHead id="h2h" label="H2H" win={win} onWin={onWin} />
            <ColHead id="ven" label="Ground" win={win} onWin={onWin} />
            <ColHead label="Model edge" win={win} onWin={onWin} align="right" />
            <th className="w-10"><span className="sr-only">Watchlist</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const soFar = soFarOf(r), out = outOf(r);
            const to = `/player/${r.idx}?stat=${r.stat}&line=${r.line}&fmt=${fmtIndex(r.fmt)}${r.start ? `&start=${encodeURIComponent(r.start)}` : ""}${r.inn ? `&scope=${r.inn}` : ""}`;
            const ground = shortVenue(r.venue);
            return (
              <tr key={`${r.idx}${r.stat}${r.fmt}${r.start}${r.inn}${r.quotes.some((q: Quote) => q.live) ? "L" : ""}`} tabIndex={0} role="link"
                className={cn("cursor-pointer border-b border-hairline last:border-b-0 hover:bg-surface-hover", out && "opacity-60")}
                onClick={() => nav(to)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); nav(to); } }}>
                <td className="px-snug py-snug">
                  <span className="flex items-center gap-snug">
                    <PlayerAvatar idx={r.idx} team={r.team} test={r.fmt === "Test"} className="size-control" />
                    <span className="grid min-w-0 gap-hair">
                      <span className="flex min-w-0 items-center gap-tight text-body font-medium leading-snug"><span className="truncate"><PlayerName idx={r.idx} fallback={r.name} /></span><TeamFlag name={r.team} />{r.quotes.some((q: Quote) => q.live) && <LiveBadge />}{out && <Badge variant="outline" className="shrink-0 px-snug py-hair text-caption font-medium text-muted-foreground">Not in XI</Badge>}</span>
                      <span className="flex flex-wrap items-baseline gap-x-snug gap-y-hair">
                        <span className="font-condensed text-metric font-bold leading-none tracking-tight tabular-nums">{r.side === "under" ? "U" : "O"} {r.line}</span>
                        <span className="label-cap text-footnote"><span className="text-primary">{(STATS as any)[r.stat]?.label}</span>{scopeTag(r.fmt, r.inn) && <span className="text-muted-foreground"> · {scopeTag(r.fmt, r.inn)}</span>}</span>
                      </span>
                      {r.quotes.length > 0 && <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}><BookQuotes quotes={r.quotes} /></span>}
                      <PropProgress r={r} soFar={soFar} out={out} />
                    </span>
                  </span>
                </td>
                {bars ? <td className="px-snug py-snug"><Spark r={r} /></td> : null}
                <td className="px-snug py-snug font-condensed text-title font-bold tabular-nums"><Tick quiet value={r.over}>{odds(r.over)}</Tick>{r.under > 1 && <span className="ml-snug text-callout font-medium text-muted-foreground">U {odds(r.under)}</span>}</td>
                <td className="px-snug py-snug"><RateCell p={r.season.p} n={r.season.played} /></td>
                <td className="px-snug py-snug"><RateCell p={r.h2h.p} n={r.h2h.played} /></td>
                <td className="px-snug py-snug" title={r.venue}><span className="grid gap-hair"><RateCell p={r.ven.p} n={r.ven.played} />{ground ? <span className="truncate text-caption text-muted-foreground">{ground}</span> : null}</span></td>
                <td className={cn("px-snug py-snug text-right font-condensed text-title font-bold tabular-nums", r.edge == null ? "text-muted-foreground" : r.edge > 0 ? "text-primary" : "text-miss")}>{r.edge == null ? "–" : <><span>{`${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(1)}`}</span><span className="block label-cap text-caption font-medium text-muted-foreground">{edgeTag(r.edge, r.side)}</span></>}</td>
                <td className="px-tight"><PropStar idx={r.idx} stat={r.stat} line={r.line} fmt={fmtIndex(r.fmt)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** "Hot player props" for the selected day's matches (today by default, any of the next 10 days from Filters), in the props.cash lines-table style: stat tabs, then one ranked row per bookmaker line. */
export function HotProps({ teams, start, fmt, archive, heading, phase, syncUrl }: { teams?: [string, string]; start?: string; fmt?: string; archive?: any; heading?: string; phase?: HomePhase; syncUrl?: boolean } = {}) {
  // The screener's filters: in the URL on the Props page (a link or a refresh restores the view, and going to a player and back keeps it), plain state elsewhere (home, a fixture's own page).
  const [params, setParams] = useSearchParams();
  const [local, setLocal] = useState<Screener>(DEFAULTS);
  const urlState = !!syncUrl && !teams;
  const paramText = params.toString();
  const sc = useMemo(() => (urlState ? parseScreener(new URLSearchParams(paramText)) : local), [urlState, paramText, local]);
  const update = useCallback((patch: Partial<Screener>) => { const next = { ...sc, ...patch }; if (urlState) setParams(screenerParams(next), { replace: true }); else setLocal(next); }, [sc, urlState, setParams]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { day, stat, win, bars, team } = sc;
  const { data: all, isLoading, scoring, otherDay } = useHotRows(archive, teams, Number(day), sc.inns);
  const onThis = (r: Row) => sameFixture({ match: r.match, start_utc: r.start, fmt: r.fmt }, { a: teams![0], b: teams![1], start, fmt }); // this match: the same two sides, a Test on any of its days, not the series' next game
  const live = useLiveDoc();
  const { rail } = useRail();
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
  const matchKey = sc.match;
  const matchChips = useMemo(() => {
    const m = new Map<string, { id: string; a: string; b: string; start: string; fmt?: string; series?: string }>();
    for (const r of data || []) {
      const id = matchChipId(r.match, r.start, r.fmt);
      const [a, b] = String(r.match).split(/\s+vs\s+/i);
      const prev = m.get(id);
      if (!prev || Date.parse(r.start) < Date.parse(prev.start)) m.set(id, { id, a: a || r.team, b: b || r.opp, start: r.start, fmt: r.fmt, series: r.comp });
    }
    // same order as the home rail: in play first, then the next 24 hours, then later; the viewer's own team and the bigger matches ahead within each (src/lib/priority.ts)
    const state = (f: any) => fixtureState(f, liveForFixture(live.data, f)?.status);
    return arrangeFixtures([...m.values()], state, homeTeam(), rail);
  }, [data, live.data, rail]);
  const pick = matchChips.some((c) => c.id === matchKey) ? matchKey : "all";
  const tabs = useMemo(() => {
    // the prop types with the most lines come first (runs, wickets, sixes...), ties in the order the engine lists them
    const count = new Map<string, number>();
    for (const r of data || []) count.set(r.stat, (count.get(r.stat) || 0) + 1);
    const order = Object.keys(STATS);
    const have = [...count.keys()].filter((k) => (STATS as any)[k]).sort((x, y) => count.get(y)! - count.get(x)! || order.indexOf(x) - order.indexOf(y));
    return [["all", "All props"], ...have.map((k) => [k, (STATS as any)[k].label])] as [string, string][];
  }, [data]);
  const need = WINS.find(([k]) => k === win)![2], wl = WINS.find(([k]) => k === win)![1];
  // the edge is worked out from the window shown, so it moves with it; rows of a match in play come first (`hotOrder`), so they follow the live feed
  const scored = useMemo(() => (data || []).map((r) => ({ ...r, ...modelSide(r[win], r.prior, r.over, r.under), live: matchOf(r)?.status === "live" }))
    .filter((r) => (teams ? onThis(r) : r.day === Number(day) && (pick === "all" || matchChipId(r.match, r.start, r.fmt) === pick)) && (stat === "all" || r.stat === stat) && enoughHistory(r, win, need)),
  [data, stat, win, need, day, teams, start, fmt, live.data, pick]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => order(narrow(scored, sc), sc).slice(0, MAX_ROWS), [scored, sc]);
  // what the filter view may offer: the values the day's rows really have
  const dayRows = useMemo(() => (data || []).filter((r) => (teams ? onThis(r) : r.day === Number(day))), [data, teams, day, start]); // eslint-disable-line react-hooks/exhaustive-deps
  const choices = useMemo(() => ({
    days: teams ? [] : hotDayLabels(), matches: teams ? [] : matchChips.map((c) => ({ id: c.id, label: `${abbr(c.a)} v ${abbr(c.b)}` })),
    teams: options(dayRows as any, "team"), formats: options(dayRows as any, "fmt"), comps: options(dayRows as any, "comp"), winLabel: Object.fromEntries(WINS.map(([k, l]) => [k, l])),
  }), [dayRows, teams, matchChips]);
  const active = activeFilters(sc, { day: (d) => hotDayLabels().find(([k]) => k === d)?.[1] ?? d, match: (id) => choices.matches.find((m) => m.id === id)?.label ?? id });
  const priced = useMemo(() => (data || []).filter((r) => (teams ? onThis(r) : true)), [data, teams, start]);
  const tapeRows = useMemo(() => (data || []).map((r) => {
    const s = soFarOf(r);
    return { idx: r.idx, name: r.name, stat: r.stat, line: r.line, over: r.over, fmt: r.fmt, inn: r.inn, verdict: s?.verdict ?? null, v: s?.v };
  }), [data, live.data, identity]);
  if (!isLoading && !scoring && !priced.length && !otherDay) return null;
  const waiting = isLoading || (scoring && !rows.length); // rows are still coming in and none of those so far is in this window: not "no rows" yet
  return (
    <section aria-label="Player props" className="flex flex-col gap-stack">
      {heading ? <h1 className="hidden text-display font-bold tracking-tight lg:block">{heading}</h1> : null}
      {!waiting ? <div className="hidden lg:block"><MarketTape quiet rows={tapeRows} /></div> : null}
      {urlState && !isLoading && (
        <PillGroup layoutId="hot-day" label="Day" value={day} onChange={(v) => update({ day: v, match: "all" })} items={hotDayLabels()} className="min-w-0" />
      )}
      {!teams && matchChips.length > 0 && (
        <PillGroup
          layoutId="hot-match"
          label="Matches"
          value={pick}
          onChange={(v) => update({ match: v })}
          className="w-auto max-w-full"
          itemClassName="h-auto min-h-control whitespace-normal px-snug py-tight"
          items={[["all", "All"], ...matchChips.map((f) => [f.id, <MatchChip key={f.id} f={f} />] as [string, ReactNode])]}
        />
      )}
      <div className={cn("flex flex-col gap-snug", urlState && "sticky top-header z-30 -mx-gutter bg-background/85 px-gutter py-tight backdrop-blur-xl backdrop-saturate-150")}>
      {/* one chip row for the prop type, plus a Filters button (count of active filters on it) that opens the filter view: full screen on a phone, a right drawer from lg */}
      <div className="flex items-center gap-snug">
        <PillGroup layoutId="hot-stat" label="Prop type" resetValue={teams ? "all" : undefined} value={stat} onChange={(v) => update({ stat: v })} items={tabs} className="min-w-0 flex-1" />
        <Button type="button" variant="secondary" size="sm" aria-label={`Filters${active.length ? `, ${active.length} active` : ""}`} onClick={() => setFiltersOpen(true)}
          className={cn("relative h-control rounded-[var(--chip-radius)] bg-card px-snug text-callout shadow-none", urlState && "hidden lg:inline-flex")}>
          <AdjustmentsHorizontalIcon className="size-4" />{wl}
          {active.length > 0 && <span className="absolute -right-hair -top-hair grid min-w-4 place-items-center rounded-full bg-primary px-hair text-caption font-bold text-primary-foreground ring-2 ring-background">{active.length}</span>}
        </Button>
      </div>
      {active.length > 0 && (
        <div className="-mx-gutter flex items-center gap-snug overflow-x-auto px-gutter [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Active filters">
          {active.map((f) => <ActiveChip key={f.key} label={f.label} value={f.value} onRemove={() => update(clearFilter(sc, f.key))} />)}
          <button type="button" onClick={() => update(clearFilter(sc, "all"))} className="h-control shrink-0 px-snug text-callout font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">Clear all</button>
        </div>
      )}
      </div>
      <ScreenerFilters open={filtersOpen} onOpenChange={setFiltersOpen} state={sc} onApply={(s) => update({ ...s, stat: sc.stat === s.stat ? sc.stat : s.stat })} choices={choices} />
      <AnimatedHeight>
        {waiting ? <RowsSkeleton /> : !rows.length ? (
          <div className="px-inset py-stack">
            <EmptyState
              icon={<ChartBarIcon />}
              title={phase ? EMPTY_PHASE[phase].title : active.length ? "No props match these filters" : "No rows in this window"}
              body={phase ? EMPTY_PHASE[phase].body : active.length ? "Clear a filter to see the rest of the day's lines." : "Open Filters to widen the day, match or sample window."}
              action={active.length ? <button type="button" className="text-callout font-medium text-primary underline-offset-2 hover:underline" onClick={() => update(clearFilter(sc, "all"))}>Clear filters</button> : undefined}
            />
          </div>
        ) : (
          <>
            <ul className="-mx-gutter lg:hidden">
              {rows.map((r) => <PropRow key={`${r.idx}${r.stat}${r.fmt}${r.start}${r.inn}${r.quotes.some((q: Quote) => q.live) ? "L" : ""}`} r={r} win={win} wl={wl} soFar={soFarOf(r)} out={outOf(r)} hideMatch={!!teams} />)}
            </ul>
            <div className="hidden lg:block">
              <PropTable rows={rows} win={win} onWin={(w) => update({ win: w })} bars={bars} soFarOf={soFarOf} outOf={outOf} />
            </div>
          </>
        )}
      </AnimatedHeight>
      {/* on a phone the rows come first and the tape follows them (it used to push the first prop below the fold) */}
      {!waiting ? <div className="lg:hidden"><MarketTape quiet rows={tapeRows} /></div> : null}
      {urlState && (
        <button type="button" aria-label={`Filters${active.length ? `, ${active.length} active` : ""}`} onClick={() => setFiltersOpen(true)}
          className="fixed right-gutter bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+var(--space-stack))] z-50 grid size-(--fab) place-items-center rounded-full bg-primary text-primary-foreground shadow-(--shadow-fab) outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring active:scale-95 lg:hidden">
          <AdjustmentsHorizontalIcon className="size-6" />
          {active.length > 0 && <span className="absolute -right-hair -top-hair grid min-w-5 place-items-center rounded-full bg-foreground px-hair text-caption font-bold text-background">{active.length}</span>}
        </button>
      )}
    </section>
  );
}
