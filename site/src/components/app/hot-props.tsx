/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AdjustmentsHorizontalIcon, ChartBarIcon, ChevronDownIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatedHeight } from "./animated-height";
import { RowsSkeleton } from "./skeletons";
import { LIVE_TTL_MS, liveForFixture, lineNotIn, lineStanding } from "@cricket/engine/live.js";
import { groupByChip, missingLiveLines, patchHotQuotes, rowLineKey, scoreLine } from "@cricket/engine/hot-rows.js";
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
import { BookTable } from "./book-table";
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
  // books generation only — live_sig must not rebuild history; quotes/live rows are patched after (see merge below)
  const key = [...scopeKey, fixtures.isLoading, doc.data?.generated_at_utc, archive ? doc.data?.lines?.length : null];
  const liveSig = archive ? "" : (doc.data?.live_sig ?? "");
  const rows = useQuery({
    queryKey: key,
    placeholderData: (previous, query) => query?.queryKey[1] === scope ? previous : undefined,
    enabled: !!doc.data && !fixtures.isLoading && matchesReady !== false,
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
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
  const liveExtra = useQuery({
    queryKey: ["hot-props-live", scope, doc.data?.generated_at_utc, liveSig],
    enabled: !archive && !!rows.data && !!liveSig && !!doc.data && matchesReady !== false,
    staleTime: LIVE_TTL_MS,
    gcTime: 60 * 60_000,
    placeholderData: (prev: Row[] | undefined) => prev,
    queryFn: async (): Promise<Row[]> => {
      const missing = missingLiveLines(rows.data || [], doc.data.lines || []);
      if (!missing.length) return [];
      const now = Date.now(), year = String(new Date().getFullYear());
      const byChip = groupByChip(doc.data.lines || []);
      const out: Row[] = [];
      for (const l of missing) {
        const idx = store.P.id.indexOf(l.pid);
        if (idx < 0) continue;
        await store.shard(store.shardOf(idx)).catch(() => {});
        const r = await scoreLine({ store, rz, l, byChip, fixtures: fixtures.data || [], now, year });
        if (!r) continue;
        const fixture = (fixtures.data || []).find((f: any) => sameFixture({ match: r.match, start_utc: r.start, fmt: l.fmt }, f));
        out.push({ ...r, day: hotDay(r.start, l.fmt, now), gender: fixture?.gender === "female" ? 1 : fixture?.gender === "male" ? 0 : null } as Row);
      }
      return out;
    },
  });
  const data = useMemo((): Row[] => {
    const base = rows.data || [];
    const keys = new Set(base.map(rowLineKey));
    const merged = base.slice();
    for (const r of liveExtra.data || []) { if (!keys.has(rowLineKey(r))) { merged.push(r); keys.add(rowLineKey(r)); } }
    return patchHotQuotes(merged, doc.data?.lines || []) as Row[];
  }, [rows.data, liveExtra.data, doc.data?.lines]);
  const otherDay = useMemo(() => (teams ? 0 : otherHotCount(doc.data?.lines || [], day)), [doc.data, teams, day]); // other days' lines, only counted: the day switch stays when this day has none
  // while the bookmaker file is still loading the query is idle (not "loading"): treat that as loading too, so the empty message never flashes
  const scoring = (rows.isFetching && !rows.isPlaceholderData) || (liveExtra.isFetching && !liveExtra.isPlaceholderData);
  return { ...rows, data, isLoading: !data.length && (rows.isLoading || (!rows.isError && !doc.data)), scoring, otherDay };
}

const Spark = ({ r }: { r: Row }) => <MiniBars last={r.last} line={r.line} max={r.max} />;

/** List card: face + name, hero OVER line (condensed), book price, model edge. */
type SoFar = { v: number; state: "live" | "out" | "final"; verdict: "cleared" | "missed" | "push" | null };

/** Face Over and Under each own their book (shared line is the usual player-prop case); extras sit behind `BookTable` (+N books). */
export function BookQuotes({ quotes, className, rowLine }: { quotes: Quote[]; className?: string; rowLine?: number }) {
  if (!quotes.length) return null;
  const overQ = quotes.reduce<Quote | null>((best, q) => {
    if (q.over == null) return best;
    if (!best || (q.over > (best.over ?? 0)) || (q.over === best.over && q.line < best.line)) return q;
    return best;
  }, null);
  const underQ = quotes.reduce<Quote | null>((best, q) => {
    const price = q.underAt?.price ?? q.under;
    const line = q.underAt?.line ?? q.line;
    if (price == null) return best;
    const bestPrice = best ? (best.underAt?.price ?? best.under) : null;
    const bestLine = best ? (best.underAt?.line ?? best.line) : Infinity;
    if (bestPrice == null || price > bestPrice || (price === bestPrice && line > bestLine)) return q;
    return best;
  }, null);
  const overLine = overQ?.line;
  const underLine = underQ ? (underQ.underAt?.line ?? underQ.line) : undefined;
  const underPrice = underQ ? (underQ.underAt?.price ?? underQ.under) : null;
  const shown = [overQ?.source, underQ?.source];
  const books = quotes.map((q) => ({ source: q.source, over: q.over, under: q.underAt?.price ?? q.under }));
  const splitLine = overLine != null && underLine != null && overLine !== underLine;
  const live = quotes.find((q) => q.live);
  return (
    <div className={cn("flex flex-col gap-hair text-callout tabular-nums text-muted-foreground", className)} onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-x-snug gap-y-hair">
        {overQ?.over != null && (
          <span className="inline-flex min-w-0 items-center gap-tight whitespace-nowrap font-condensed">
            <span className="text-muted-foreground">O{splitLine || (rowLine != null && overLine !== rowLine) ? ` ${overLine}` : ""}</span>
            <Tick quiet value={overQ.over} className="text-body font-bold text-foreground">{odds(overQ.over)}</Tick>
            <BookBadge source={overQ.source} className="min-w-0 truncate" />
          </span>
        )}
        {underPrice != null && (
          <span className="inline-flex min-w-0 items-center gap-tight whitespace-nowrap font-condensed">
            <span className="text-muted-foreground">U{splitLine || (rowLine != null && underLine !== rowLine) ? ` ${underLine}` : ""}</span>
            <Tick quiet value={underPrice} className="text-body font-bold text-foreground">{odds(underPrice)}</Tick>
            <BookBadge source={underQ!.source} className="min-w-0 truncate" />
          </span>
        )}
        {live && <LiveOpened opened={live.opened} line={live.line} label={rowLine != null ? "Opened at" : undefined} />}
      </div>
      <BookTable books={books} shown={shown} />
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
  const ground = win !== "ven" ? groundNote(r.ven) : null;
  return (
    <li className="relative border-t border-hairline first:border-t-0">
      <div className="grid min-h-row w-full grid-cols-[var(--control)_minmax(0,1fr)_auto] items-center gap-tight px-gutter py-snug text-left">
        <PlayerAvatar idx={r.idx} team={r.team} test={r.fmt === "Test"} className="size-control" />
        <span className="grid min-w-0 gap-hair">
          <span className="flex min-w-0 items-center gap-tight text-body font-medium leading-snug">
            <Link to={`/player/${r.idx}?stat=${r.stat}&line=${r.line}&fmt=${fmtIndex(r.fmt)}${r.start ? `&start=${encodeURIComponent(r.start)}` : ""}${r.inn ? `&scope=${r.inn}` : ""}`} className="truncate outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"><PlayerName idx={r.idx} fallback={r.name} /></Link>
            <TeamFlag name={r.team} />
            {!out && r.quotes.some((q: Quote) => q.live) && <LiveBadge />}
            {out && <Badge variant="outline" className="shrink-0 px-snug py-hair text-caption font-medium text-muted-foreground">Not in XI</Badge>}
          </span>
          <span className="flex flex-wrap items-baseline gap-x-snug gap-y-hair">
            <span className="font-condensed text-metric font-bold leading-none tracking-tight tabular-nums text-foreground">{out ? r.line : `O/U ${r.line}`}</span>
            <span className="label-cap text-footnote"><span className="text-primary">{label}</span>{scopeTag(r.fmt, r.inn) && <span className="text-muted-foreground"> · {scopeTag(r.fmt, r.inn)}</span>}</span>
          </span>
          {!out && (r.quotes.length ? <BookQuotes quotes={r.quotes} rowLine={r.line} /> : (
            <span className="font-condensed text-callout tabular-nums text-muted-foreground">Over <b className="text-foreground">{odds(r.over)}</b> · Under <b className="text-foreground">{odds(r.under)}</b></span>
          ))}
          <PropProgress r={r} soFar={soFar} out={out} />
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-snug gap-y-hair text-footnote text-muted-foreground">
            {!hideMatch && soFar == null && <span className="truncate">{r.fmt}{r.match ? ` · ${r.match}` : ""}</span>}
            {ground && <span className={cn("truncate", ground.tone === "good" ? "font-medium text-primary" : ground.tone === "bad" ? "font-medium text-miss" : undefined)} title={r.venue}>{ground.hits}/{ground.played} at {shortVenue(r.venue)}</span>}
            <span className={cn("font-condensed tabular-nums", pctClass(r[win].p))}>{r[win].hits} in {wl}</span>
          </span>
        </span>
        <span className="grid self-start justify-items-end gap-hair pt-control">
          {!out && <span className="grid justify-items-end gap-hair text-right">
            <span className="flex items-baseline gap-tight whitespace-nowrap">
              <span className="label-cap text-caption text-muted-foreground">Model</span>
              <span className={cn("font-condensed text-title font-bold leading-none tabular-nums", out || r.edge == null ? "text-muted-foreground" : r.edge > 0 ? "text-primary" : "text-miss")}>{r.edge == null ? "–" : `${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(0)}%`}</span>
            </span>
            {r.edge != null && <span className="label-cap text-caption text-muted-foreground">{edgeTag(r.edge, r.side)}</span>}
          </span>}
          <Spark r={r} />
        </span>
      </div>
      <PropStar idx={r.idx} stat={r.stat} line={r.line} fmt={fmtIndex(r.fmt)} className="absolute z-10 right-[calc(var(--gutter)-var(--spacing-tight))] top-snug" />
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
              <tr key={`${r.idx}${r.stat}${r.fmt}${r.start}${r.inn}${r.quotes.some((q: Quote) => q.live) ? "L" : ""}`}
                className="cursor-pointer border-b border-hairline last:border-b-0 hover:bg-surface-hover"
                onClick={() => nav(to)}>
                <td className="px-snug py-snug">
                  <span className="flex items-center gap-snug">
                    <PlayerAvatar idx={r.idx} team={r.team} test={r.fmt === "Test"} className="size-control" />
                    <span className="grid min-w-0 gap-hair">
                      <span className="flex min-w-0 items-center gap-tight text-body font-medium leading-snug"><Link to={to} className="truncate hover:underline focus-visible:underline" onClick={(e) => e.stopPropagation()}><PlayerName idx={r.idx} fallback={r.name} /></Link><TeamFlag name={r.team} />{!out && r.quotes.some((q: Quote) => q.live) && <LiveBadge />}{out && <Badge variant="outline" className="shrink-0 px-snug py-hair text-caption font-medium text-muted-foreground">Not in XI</Badge>}</span>
                      <span className="flex flex-wrap items-baseline gap-x-snug gap-y-hair">
                        <span className="font-condensed text-metric font-bold leading-none tracking-tight tabular-nums">{out ? r.line : `${r.side === "under" ? "Under" : "Over"} ${r.line}`}</span>
                        <span className="label-cap text-footnote"><span className="text-primary">{(STATS as any)[r.stat]?.label}</span>{scopeTag(r.fmt, r.inn) && <span className="text-muted-foreground"> · {scopeTag(r.fmt, r.inn)}</span>}</span>
                      </span>
                      {!out && r.quotes.length > 0 && <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}><BookQuotes quotes={r.quotes} /></span>}
                      <PropProgress r={r} soFar={soFar} out={out} />
                    </span>
                  </span>
                </td>
                {bars ? <td className="px-snug py-snug"><Spark r={r} /></td> : null}
                <td className="px-snug py-snug font-condensed text-title font-bold tabular-nums">{out ? "–" : <><Tick quiet value={r.over}>{odds(r.over)}</Tick>{r.under > 1 && <span className="ml-snug text-callout font-medium text-muted-foreground">U {odds(r.under)}</span>}</>}</td>
                <td className="px-snug py-snug"><RateCell p={r.season.p} n={r.season.played} /></td>
                <td className="px-snug py-snug"><RateCell p={r.h2h.p} n={r.h2h.played} /></td>
                <td className="px-snug py-snug" title={r.venue}><span className="grid gap-hair"><RateCell p={r.ven.p} n={r.ven.played} />{ground ? <span className="truncate text-caption text-muted-foreground">{ground}</span> : null}</span></td>
                <td className={cn("px-snug py-snug text-right font-condensed text-title font-bold tabular-nums", out || r.edge == null ? "text-muted-foreground" : r.edge > 0 ? "text-primary" : "text-miss")}>{out || r.edge == null ? "–" : <><span>{`${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(1)}`}</span><span className="block label-cap text-caption font-medium text-muted-foreground">{edgeTag(r.edge, r.side)}</span></>}</td>
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
export function HotProps({ teams, start, fmt, archive, phase, syncUrl }: { teams?: [string, string]; start?: string; fmt?: string; archive?: any; phase?: HomePhase; syncUrl?: boolean } = {}) {
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
  const scored = useMemo(() => (data || []).map((r) => {
    const match = matchOf(r);
    const out = lineNotIn(match, asLine(r), identity);
    return { ...r, ...modelSide(r[win], r.prior, r.over, r.under), out, live: match?.status === "live" };
  })
    .filter((r) => (teams ? onThis(r) : r.day === Number(day) && (pick === "all" || matchChipId(r.match, r.start, r.fmt) === pick)) && (stat === "all" || r.stat === stat) && enoughHistory(r, win, need)),
  [data, stat, win, need, day, teams, start, fmt, live.data, identity, pick]); // eslint-disable-line react-hooks/exhaustive-deps
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
      <div className={cn("flex flex-col", urlState && "sticky top-header z-30 -mx-gutter bg-background/85 backdrop-blur-xl backdrop-saturate-150")}>
        {/* HomePhaseBar / Fancy shape: hairline chip row + Filters, prop pills under when sticky on /props. */}
        <div className={cn("flex min-w-0 items-stretch gap-snug border-b border-hairline", urlState && "px-gutter")}>
          <PillGroup layoutId="hot-stat" label="Prop type" resetValue={teams ? "all" : undefined} value={stat} onChange={(v) => update({ stat: v })} items={tabs} className="min-w-0 flex-1" />
          <Button type="button" variant="secondary" size="sm" aria-label={`Filters${active.length ? `, ${active.length} active` : ""}`} onClick={() => setFiltersOpen(true)}
            className="relative my-auto h-control shrink-0 rounded-[var(--chip-radius)] bg-card px-snug text-callout shadow-none">
            <AdjustmentsHorizontalIcon className="size-4" />Filters
            {active.length > 0 && <span className="absolute -right-hair -top-hair grid min-w-4 place-items-center rounded-full bg-primary px-hair text-caption font-bold text-primary-foreground ring-2 ring-background">{active.length}</span>}
          </Button>
        </div>
        {active.length > 0 && (
          <div className={cn("flex items-center gap-snug overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", urlState ? "px-gutter pb-tight pt-tight" : "-mx-gutter px-gutter")} aria-label="Active filters">
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
              {rows.map((r) => <PropRow key={`${r.idx}${r.stat}${r.fmt}${r.start}${r.inn}${r.quotes.some((q: Quote) => q.live) ? "L" : ""}`} r={r} win={win} wl={wl} soFar={soFarOf(r)} out={r.out} hideMatch={!!teams} />)}
            </ul>
            <div className="hidden lg:block">
              <PropTable rows={rows} win={win} onWin={(w) => update({ win: w })} bars={bars} soFarOf={soFarOf} outOf={(r) => lineNotIn(matchOf(r), asLine(r), identity)} />
            </div>
          </>
        )}
      </AnimatedHeight>
      {/* on a phone the rows come first and the tape follows them (it used to push the first prop below the fold) */}
      {!waiting ? <div className="lg:hidden"><MarketTape quiet rows={tapeRows} /></div> : null}
    </section>
  );
}
