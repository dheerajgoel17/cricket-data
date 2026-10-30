/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { AdjustmentsHorizontalIcon, ChevronLeftIcon, InformationCircleIcon, ShareIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SCOPE_LABEL, bookFormatFor, bookLinesFor, bookScopesFor, bookStatsFor, sameFixture, teamKey } from "@/engine/lines.js";
import { BookBadge } from "@/components/app/book-badge";
import { SPLITS } from "@/engine/props.js";
import { STATS } from "@/engine/rules.js";
import { sideEdge } from "@/engine/stats.js";
import { FORMATS, fmtIndex } from "@/engine/util.js";
import { barState, windowRate, windowRates } from "@/engine/windows.js";
import { useData } from "@/lib/data";
import { linesQuery } from "@/lib/queries";
import { fixtureStart, localWhen, num, odds, pc, shortDate } from "@/lib/format";
import { setTitle } from "@/lib/title";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { useFixtures, useRunPlan } from "@/hooks/useEngine";
import { useLiveDoc } from "@/hooks/useLive";
import { liveForFixture } from "@/engine/live.js";
import { venueStem } from "@/engine/markets.js";
import { NextFilters, NextMatch } from "@/components/app/next-match";
import { Field, HOME_AWAY, LiveForm, NativeSelect } from "@/components/app/forms";
import { PlayerPhoto, TeamBadge } from "@/components/app/badges";
import { ChartBars } from "@/components/app/chart";
import { AnimatedHeight } from "@/components/app/animated-height";
import { PillGroup } from "@/components/app/pill-group";
import { StarButton } from "@/components/app/star";
import { sharePlayerUrl } from "@/lib/share";
import { DataTable, EmptyNote } from "@/components/app/page";
import { LadderTable, SplitTables } from "@/components/app/result";
import { PlayerSkeleton } from "@/components/app/skeletons";
import { LineStepper } from "@/components/app/line-stepper";
import { OutcomeDonut } from "@/components/app/viz";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const FILTER_SKIP = new Set(["Player", "Stat", "Format", "Line", "Side", "Test innings"]); // those are on screen already (the Scope switch for the last)
const band = (p: number | null) => (p == null ? "" : p >= 0.6 ? "hi" : p >= 0.4 ? "mid" : "lo");
const bandText = { hi: "text-primary", mid: "text-amber", lo: "text-miss", "": "" } as const;
const STAT_OPTIONS: [string, string][] = Object.entries(STATS).map(([k, v]: any) => [k, v.label]);
const CARD = "rounded-2xl bg-card ring-1 ring-hairline";

/** The URL's query string as it is right now (the chart keeps line / side in the URL with replaceState, so the router's copy can be stale). */
const liveQ = () => Object.fromEntries(new URLSearchParams(location.search));

function Metric({ k, v, tone }: { k: string; v: ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="grid min-w-0 gap-hair">
      <span className="text-footnote leading-tight text-muted-foreground">{k}</span>
      <b className={cn("truncate text-metric font-bold tabular-nums", tone === "up" && "text-primary", tone === "down" && "text-miss")}>{v}</b>
    </div>
  );
}

/** Hit-rate ring: green from 60%, amber from 40%, red below. */
function Gauge({ p, caption }: { p: number | null; caption: string }) {
  const arc = p == null ? 0 : Math.max(0, Math.min(1, p));
  const tone = arc >= 0.6 ? "var(--primary)" : arc >= 0.4 ? "var(--amber)" : "var(--miss)";
  const ring = (stroke: string, dash: string) => <circle cx="24" cy="24" r="19" fill="none" stroke={stroke} strokeWidth="4" strokeDasharray={dash} strokeLinecap="round" transform="rotate(135 24 24)" />;
  return (
    <div className="grid shrink-0 justify-items-center gap-hair">
      <svg viewBox="0 0 48 48" className="size-20" role="img" aria-label={`${caption} ${p == null ? "none" : `${Math.round(arc * 100)}%`}`}>
        {ring("var(--border)", "89.6 29.9")}<motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{ring(tone, `${(89.6 * arc).toFixed(1)} 200`)}</motion.g>
        <text x="24" y="28" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">{p == null ? "–" : `${Math.round(arc * 100)}%`}</text>
      </svg>
      <span className="text-caption text-muted-foreground">{caption}</span>
    </div>
  );
}

export function PlayerPage() {
  const { store } = useData();
  const { id } = useParams();
  const idx = Number(id);
  if (!(idx >= 0 && idx < store.P.id.length)) return <EmptyNote>Unknown player.</EmptyNote>;
  return <PlayerScreen key={idx} idx={idx} />;
}

/** Back row, then the player flat on the page (no card): photo, name, team and formats, save and share. */
function PlayerHeader({ idx, name, team, fmts, share }: { idx: number; name: string; team: string; fmts: [number, string][]; share: () => void }) {
  const { store } = useData();
  const nav = useNavigate();
  const teamIx = store.P.tm[idx];
  return (
    <section className="flex flex-col gap-stack">
      <button type="button" aria-label="Back" onClick={() => (history.length > 1 ? nav(-1) : nav("/players"))} className="-ml-2 flex items-center self-start rounded-lg px-tight py-tight text-body text-primary transition-opacity active:opacity-40"><ChevronLeftIcon className="size-5" />Back</button>
      <div className="flex items-center gap-snug">
        <PlayerPhoto idx={idx} className="size-20 shrink-0 rounded-full bg-secondary" />
        <div className="grid min-w-0 flex-1 gap-tight">
          <h1 className="truncate text-display font-bold leading-tight tracking-tight">{name}</h1>
          <Link to={`/team/${teamIx}`} className="flex min-w-0 items-center gap-tight text-callout text-muted-foreground active:opacity-70"><TeamBadge name={team} size="sm" /><span className="truncate">{team}</span></Link>
          <div className="flex flex-wrap items-center gap-tight">{fmts.map(([i, f]) => <Badge key={i} variant="outline" className="px-snug py-hair text-caption font-semibold">{f}</Badge>)}</div>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-tight">
          <StarButton kind="player" idx={idx} />
          <motion.button type="button" aria-label="Share" whileTap={{ scale: 0.9 }} onClick={share} className="grid size-control cursor-pointer place-items-center rounded-full bg-secondary"><ShareIcon className="size-5" /></motion.button>
        </div>
      </div>
    </section>
  );
}

function PlayerScreen({ idx }: { idx: number }) {
  const { store } = useData();
  const nav = useNavigate();
  const name = store.playerName(idx), team = store.teamName(store.P.tm[idx]);
  const [version, setVersion] = useState(0);          // bumps when the URL changes through the router (stat, format, filters)
  const q: Record<string, string> = useMemo(() => liveQ(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const f = () => setVersion((v) => v + 1); window.addEventListener("popstate", f); return () => window.removeEventListener("popstate", f); }, []);
  const navigateWith = (patch: Record<string, unknown>) => {
    const next = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === "") next.delete(k); else next.set(k, String(v)); }
    nav(`${location.pathname}?${next}`, { replace: true }); setVersion((v) => v + 1);
  };
  const fm = store.P.fm[idx];
  const fmts = FORMATS.map((f: string, i: number) => [i, f] as [number, string]).filter(([i]) => (fm >> i) & 1);
  const askedStat = q.stat || "";
  setTitle(`${store.playerName(idx)}: stats, hit rates and form`);

  const lines = useQuery(linesQuery);
  const pid = store.P.id[idx];
  const pricedIn = lines.data ? fmtIndex(bookFormatFor(lines.data, pid, askedStat) ?? "") : -1; // a link with no format opens where a book has a line out
  const fmtVal = Number(q.fmt ?? (fmts.some(([i]) => i === pricedIn) ? pricedIn : fmts.length ? fmts[0][0] : 0));
  const pricedStats = lines.data ? bookStatsFor(lines.data, pid, FORMATS[fmtVal]) : [];
  const statItems = STAT_OPTIONS.filter(([k]) => pricedStats.includes(k));
  const stat = pricedStats.includes(askedStat) ? askedStat : (pricedStats[0] || askedStat || "runs"); // only a listed prop, else the URL / runs for the form chart with no chips
  // A Test batter has three views, each its own lines and its own chart, never mixed: both innings combined (the match total, which a 72.5 line is), his side's 1st innings and its
  // 2nd. `?scope=` is 0, 1 or 2; with none, the page opens on the combined view when the books price it, else on the first scope they do price. The switch is always shown for a
  // Test batting stat (T20 and ODI have one innings a player), so a scope no book prices still charts that innings. The sheet's "batted first / chasing" filter is another thing.
  const testBat = FORMATS[fmtVal] === "Test" && (STATS as any)[stat]?.side === "bat";
  const priced: number[] = lines.data && testBat ? bookScopesFor(lines.data, pid, stat, FORMATS[fmtVal]) : [];
  const asked = q.scope === undefined || q.scope === "" ? null : Number(q.scope);
  const scope = !testBat ? 0 : asked != null && [0, 1, 2].includes(asked) ? asked : priced.length && !priced.includes(0) ? priced[0] : 0;
  const book = lines.data ? bookLinesFor(lines.data, pid, stat, FORMATS[fmtVal], undefined, undefined, scope) : null;
  const bookDefault = !!book && (q.line === undefined || q.line === "");
  const plan = {
    kind: "player_prop", stat, line: q.line !== undefined && q.line !== "" ? Number(q.line) : bookDefault ? book.main.line : null, side: q.side || "over",
    competition: q.comp || null, split_by: SPLITS,
    filters: { format: FORMATS[fmtVal], opposition: q.opp || null, venue_type: q.vt || null, innings: q.inn || null, position: q.pos || null, since: q.since || null, until: q.until || null,
      last_n: q.last ? Number(q.last) : null, international: q.lvl === "intl" ? true : q.lvl === "club" ? false : null, team_innings: scope || null },
    venue: q.venue || null,
  };
  const res = useRunPlan(plan, { playerIdx: idx }, !lines.isLoading);
  const lastGame = res.data?.ok ? res.data.chart?.entries?.at(-1) : undefined;
  const nextMatch = useNextMatch(lines.data, pid, idx, FORMATS[fmtVal], team, lastGame);
  // the shared link is a card for this player and, when a line is on show, this prop (stat, line and best price in the picture)
  const shareLine = q.line !== undefined && q.line !== "" ? Number(q.line) : book ? book.main.line : null;
  const share = () => { track("share", { kind: "player" }); const u = sharePlayerUrl(location.origin, idx, stat, shareLine); (navigator.share ? navigator.share({ title: name, url: u }) : navigator.clipboard.writeText(u).then(() => toast("Link copied"))).catch(() => {}); };
  const loading = lines.isLoading || res.isLoading || !res.data;

  return (
    <div className="flex flex-col gap-stack">
      <PlayerHeader {...{ idx, name, team, fmts, share }} />
      {statItems.length > 0 ? (
        <div className="sticky top-header z-30 -mx-gutter bg-background/80 px-gutter py-tight backdrop-blur-xl backdrop-saturate-150">
          <PillGroup layoutId="pl-stat" label="Prop" value={stat} onChange={(k) => navigateWith({ stat: k, line: "", side: q.side })} items={statItems} />
        </div>
      ) : null}
      {fmts.length > 1 && <PillGroup segmented layoutId="pl-fmt" label="Format" value={String(fmtVal)} onChange={(v) => navigateWith({ fmt: v, line: "", scope: "" })} items={fmts.map(([i, f]) => [String(i), f])} />}
      {testBat && <PillGroup segmented layoutId="pl-scope" label="Innings" value={String(scope)} onChange={(v) => navigateWith({ scope: v, line: "" })}
        items={[0, 1, 2].map((n) => [String(n), SCOPE_LABEL[n]] as [string, string])} />}
      {loading ? <PlayerSkeleton />
        : res.data.ok ? <Loaded key={`${stat}-${fmtVal}-${JSON.stringify(plan.filters)}-${plan.venue}-${plan.competition}-${book ? 1 : 0}`} {...{ idx, name, next: nextMatch, res: res.data, q, book, bookDefault, navigateWith, scope, fmt: FORMATS[fmtVal] }} />
        : <EmptyNote>{res.data.error}</EmptyNote>}
    </div>
  );
}

/**
 * His next match, while it has not started: from the books' lines for him in this format (the side they file him under, their start) else, with none priced, the schedule's next match
 * of his team in this format. The opponent and ground are the schedule's spelling (which the data knows). Null when there is none.
 */
function useNextMatch(doc: any, pid: string, idx: number, fmt: string, team: string, lastGame?: any) {
  const { store } = useData();
  const fixtures = useFixtures();
  const live = useLiveDoc();
  return useMemo(() => {
    const now = Date.now(), fx = fixtures.data || [];
    const priced = (doc?.lines || []).filter((l: any) => l.pid === pid && l.fmt === fmt && l.books?.length && l.start_utc && Date.parse(l.start_utc) > now).sort((x: any, y: any) => Date.parse(x.start_utc) - Date.parse(y.start_utc))[0];
    let match: string, start: string, competition: string, club = "", row: any;
    // the side he last played for in this format (his profile team is often his country, and his next club game is the one that matters)
    let lastSide = "";
    const booked = (doc?.lines || []).filter((l: any) => l.pid === pid && l.fmt === fmt && l.team && l.start_utc).sort((x: any, y: any) => Date.parse(y.start_utc) - Date.parse(x.start_utc))[0]; // the club the books file him under now, even for a match that has begun: the data may not have his club's games yet
    // he is playing now: the match the books filed him under has begun and is not over (the live feed's word, else the first hours after the start): there is no "next" match to show
    if (booked && Date.parse(booked.start_utc) <= now) {
      const [h, w] = String(booked.match).split(/\s+vs\s+/i), st = liveForFixture(live.data, { a: h, b: w, start: booked.start_utc })?.status;
      if (st === "live" || (!st && now - Date.parse(booked.start_utc) < (fmt === "Test" ? 6 * 24 : 5) * 3600e3)) return null;
    }
    if (booked) lastSide = booked.team;
    else if (lastGame?.m != null) { const x = store.teamName(store.M.a[lastGame.m], true), y = store.teamName(store.M.b[lastGame.m], true); lastSide = teamKey(x) === teamKey(lastGame.opp) ? y : x; }
    if (priced) {
      match = priced.match; start = priced.start_utc; competition = priced.competition || ""; club = priced.team || "";
      row = fx.find((f: any) => sameFixture({ match, start_utc: start }, f));
    } else {
      const women = store.P.g[idx] === 1;
      row = fx.filter((f: any) => f.fmt === fmt && (f.gender === "female") === women && (teamKey(f.a) === teamKey(lastSide || team) || teamKey(f.b) === teamKey(lastSide || team)) && fixtureStart(f).getTime() > now).sort((x: any, y: any) => (x.start < y.start ? -1 : 1))[0];
      if (!row) return null;
      match = `${row.a} vs ${row.b}`; start = fixtureStart(row).toISOString(); competition = row.series || "";
    }
    const [a, b] = String(match).split(/\s+vs\s+/i);
    const other = (t: string) => (teamKey(t) === teamKey(a) ? b : teamKey(t) === teamKey(b) ? a : "");
    const mineRaw = club || lastSide || team;
    const oppRaw = other(club) || other(lastSide) || other(team); // the book's side first: a club player's profile team is often his country
    const listed = (t: string) => [row?.a, row?.b].find((x) => x && teamKey(x) === teamKey(t)) || t;
    const opp = listed(oppRaw);
    const mine = listed(mineRaw);
    const ground = String(row?.venue || "");
    const known = ground ? (store.venues as string[]).find((n) => venueStem(n) === venueStem(ground)) : undefined; // the data spells a ground several ways
    return { match, start, competition, team: mine, opp, ground, known, priced: !!priced };
  }, [doc, pid, idx, fmt, team, lastGame, fixtures.data, live.data, store]);
}

function Loaded({ name, next, res, q, book, bookDefault, navigateWith, scope, fmt }: any) {
  const { store } = useData();
  const c = res.chart;
  const entries: any[] = c ? c.entries : [];
  const [line, setLine] = useState<number>(c ? c.line : 0.5);
  const [side, setSide] = useState<string>(c ? c.side : "over");
  const [win, setWin] = useState<number>(entries.length >= 20 ? 20 : 0);
  const [tab, setTab] = useState<string>(["lines", "logs", "splits"].includes(q.tab) ? q.tab : "lines");
  const [game, setGame] = useState<{ e: any; s: string } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [logCount, setLogCount] = useState(30);
  const tabRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const keep = (patch: Record<string, unknown>) => { const next = new URLSearchParams(location.search); for (const [k, v] of Object.entries(patch)) { if (v === "" || v == null) next.delete(k); else next.set(k, String(v)); } history.replaceState(null, "", `${location.pathname}?${next}`); };
  const switchTab = (t: string) => {
    setTab(t); keep({ tab: t });
    requestAnimationFrame(() => tabRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" }));
  };

  const ws = entries.length ? windowRates(entries, line, side) : [];
  const cur = ws.find((w: any) => w.n === win) || ws[ws.length - 1];
  const shown = cur ? (cur.n ? entries.slice(-cur.n) : entries) : [];
  const played = shown.filter((e) => e.value != null);
  const auxAvg = played.length ? played.reduce((t, e) => t + (e.aux || 0), 0) / played.length : null;
  const bookAt = book ? book.lines.find((l: any) => l.line === line) : null;
  const bestPrice = bookAt ? Math.max(0, ...bookAt.books.map((b: any) => b[side] || 0)) : 0;
  const prior = bookAt?.prob == null ? null : side === "over" ? bookAt.prob : 1 - bookAt.prob; // the market's no-vig chance of this side
  const edge = bookAt && cur ? sideEdge(cur.hits, cur.played, prior, bestPrice) : null;
  const active = (res.filters || []).filter(([k]: [string]) => !FILTER_SKIP.has(k));
  const logs = [...entries].reverse();
  const stepLine = (d: number) => { const v = Math.max(0.5, Math.round((line + d) * 100) / 100); setLine(v); keep({ line: v, side }); };
  const pickLine = (v: number) => { setLine(v); keep({ line: v, side }); };
  const mix = { hit: 0, miss: 0, push: 0, out: 0 };
  for (const e of shown) {
    const s = barState(e, line, side);
    if (s === "hit") mix.hit += 1; else if (s === "miss") mix.miss += 1; else if (s === "push") mix.push += 1; else mix.out += 1;
  }
  const mixSlices = [
    { key: "hit", n: mix.hit, color: "var(--primary)" }, { key: "miss", n: mix.miss, color: "var(--miss)" },
    { key: "push", n: mix.push, color: "var(--amber)" }, { key: "out", n: mix.out, color: "var(--dnp)" },
  ].filter((s) => s.n > 0);

  return (
    <div className="flex flex-col gap-section">
      {next && Date.parse(next.start) > Date.now() && entries.length > 0 ? <NextMatch {...{ next, entries, line, side, book: next.priced ? book : null, statLabel: res.statLabel, fmt }} /> : null}
      {next && (next.opp || next.known) ? <div className="-mt-tight flex flex-wrap gap-snug"><NextFilters {...{ next, q, navigateWith }} /></div> : null}
      <div className="flex flex-col gap-section lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:items-start">
      {!entries.length || !cur ? <EmptyNote>No fixtures match these filters.</EmptyNote> : (
        <section className="flex flex-col gap-stack">
          <div className={cn("flex items-center justify-between gap-stack p-inset", CARD)}>
            <div className="grid min-w-0 flex-1 grid-cols-3 gap-x-snug gap-y-stack">
              <Metric k={`${cur.label} avg`} v={num(cur.mean == null ? null : Math.round(cur.mean * 100) / 100)} tone={cur.p != null && (cur.mean ?? 0) > line ? "up" : undefined} />
              <Metric k="Hit rate" v={cur.p == null ? "–" : `${Math.round(cur.p * 100)}%`} tone={cur.p == null ? undefined : cur.p >= 0.6 ? "up" : cur.p < 0.4 ? "down" : undefined} />
              <Metric k="Fair price" v={cur.p ? odds(1 / cur.p) : "–"} />
              <Metric k="Line" v={`${side === "over" ? "O" : "U"} ${line}`} />
              <Metric k="Prop" v={res.statLabel} />
              <Metric k={`Avg ${(c.auxLabel || "").toLowerCase()}`} v={num(auxAvg == null ? null : Math.round(auxAvg * 100) / 100)} />
            </div>
            {mixSlices.length >= 3
              ? <OutcomeDonut caption={`${cur.label} mix`} center={cur.p == null ? "–" : `${Math.round(cur.p * 100)}%`} slices={mixSlices} />
              : <Gauge p={cur.p} caption={`${cur.label} hit`} />}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-snug">
            <PillGroup segmented layoutId="pl-side" label="Side" value={side} onChange={(v) => { setSide(v); keep({ line, side: v }); }} items={[["over", "Over"], ["under", "Under"]]} />
            <LineStepper value={line} label={side === "over" ? "O" : "U"} onStep={stepLine} />
          </div>
          {book && (bookAt ? (
            <p className="-mt-tight text-callout text-muted-foreground">
              {bookAt.books.map((b: any) => <span key={b.source} className="mr-snug whitespace-nowrap"><BookBadge source={b.source} /> <b className={cn("font-semibold tabular-nums", side === "over" ? "text-foreground" : "")}>{odds(b.over)}</b> / <b className={cn("font-semibold tabular-nums", side === "under" ? "text-foreground" : "")}>{odds(b.under)}</b></span>)}
            </p>
          ) : (
            <p className="-mt-tight text-callout text-muted-foreground">The books price {book.main.line}, not {line}. <Button variant="link" className="h-auto p-0 text-callout" onClick={() => pickLine(book.main.line)}>Use {book.main.line}</Button></p>
          ))}

          <PillGroup segmented layoutId="pl-win" label="Games" value={String(cur.n)} onChange={(v) => setWin(Number(v))}
              items={ws.map((w: any) => [String(w.n), <span key={w.n}>{w.label} <b className={cn("font-semibold", bandText[band(w.p) as keyof typeof bandText])}>{w.p == null ? "–" : `${Math.round(w.p * 100)}%`}</b></span>] as [string, ReactNode])} className="max-w-full" />
          <div className={cn("flex flex-col gap-snug p-inset", CARD)}>
            <ChartBars entries={shown} line={line} side={side} height={300} animateKey={`${win}-${shown.length}`} onSelect={(e, s) => setGame({ e, s })} label={`${res.statLabel} ${side} ${line}`} />
            <p className="text-footnote text-muted-foreground">{res.statLabel} {side} {line}{scope ? `, ${SCOPE_LABEL[scope].toLowerCase()} only (what he made in his side's ${scope === 1 ? "first" : "second"} innings of each Test)` : ""}. Green cleared, red missed. DNP / VOID fixtures are not counted.</p>
          </div>
        </section>
      )}

      {book && cur && (
        <section className="flex flex-col gap-snug lg:sticky lg:top-[calc(var(--header-h)+var(--space-stack))]">
          <div className="flex items-baseline justify-between gap-snug">
            <h2 className="flex items-center gap-tight text-title font-bold tracking-tight">
              Lines{scope ? ` · ${SCOPE_LABEL[scope]}` : ""}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground" aria-label="About these lines"
                    title="Decimal over/under. Tap a line to put it on the chart. Market is the over chance with the margin off. Hit is how often he has cleared it on the chart.">
                    <InformationCircleIcon className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-56 text-callout">Decimal over / under. Tap a line for the chart. Market: over chance with the margin off. Hit: how often he has cleared it on the chart.{bookDefault ? " Opened on the main line." : ""}</TooltipContent>
              </Tooltip>
            </h2>
            {edge != null ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn("text-callout font-semibold tabular-nums", edge >= 0 ? "text-primary" : "text-miss")} title={`Best price ${odds(bestPrice)}`}>
                    {edge >= 0 ? "+" : ""}{Math.round(edge * 100)}%
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-56 text-callout">Edge at this line. Best price {odds(bestPrice)}. His {cur.label} hit rate pulled toward the market.</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          <p className="truncate text-footnote text-muted-foreground" title={[book.match, book.start_utc ? localWhen(book.start_utc) : "", book.competition].filter(Boolean).join(" · ")}>
            {book.match}{book.start_utc ? ` · ${localWhen(book.start_utc)}` : ""}
          </p>
          <ul className={cn("overflow-hidden", CARD)}>
            {book.lines.map((l: any) => {
              const hist = windowRate(entries, cur.n, l.line, "over");
              const bestO = Math.max(0, ...l.books.map((b: any) => b.over || 0)), bestU = Math.max(0, ...l.books.map((b: any) => b.under || 0)); // with several books, the best price of each side stands out
              return (
                <li key={l.line} className="border-t border-hairline first:border-t-0">
                  <button type="button" onClick={() => pickLine(l.line)} aria-label={`Use line ${l.line}`}
                    className={cn("grid min-h-row w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-snug px-inset py-snug text-left transition-colors active:bg-accent", line === l.line && "bg-accent/60")}>
                    <span className="grid min-w-0 gap-hair">
                      <span className="text-body font-semibold">O/U {l.line}{l === book.main && <span className="ml-tight text-caption font-semibold uppercase tracking-wider text-primary">main</span>}</span>
                      {l.books.map((b: any) => <span key={b.source} className="truncate text-callout text-muted-foreground"><BookBadge source={b.source} /> <span className={cn(l.books.length > 1 && b.over === bestO && "font-semibold text-primary")}>{odds(b.over)}</span> / <span className={cn(l.books.length > 1 && b.under === bestU && "font-semibold text-primary")}>{odds(b.under)}</span></span>)}
                    </span>
                    <span className="grid justify-items-end gap-hair text-right">
                      <span className="text-footnote text-muted-foreground" title="Over chance with each book's margin removed">Mkt <b className="font-semibold tabular-nums text-foreground">{l.prob == null ? "–" : pc(l.prob)}</b></span>
                      <span className="text-footnote text-muted-foreground" title={`How often he has gone over this line in the ${scope ? "innings" : "games"} on the chart`}>{cur.label} <b className="font-semibold tabular-nums text-foreground">{hist.p == null ? "–" : pc(hist.p)}</b></span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      </div>

      <section className="flex flex-col gap-stack">
        <div className="flex flex-wrap items-center gap-snug">
          <Button variant="secondary" className="h-control rounded-full px-snug text-callout" onClick={() => setFiltersOpen(true)}><AdjustmentsHorizontalIcon />Filters{active.length ? ` · ${active.length}` : ""}</Button>
          {active.length ? active.map(([k, v]: [string, unknown], i: number) => <Badge key={i} variant="secondary" className="rounded-full px-snug py-tight text-footnote font-normal">{k ? <b className="mr-tight font-semibold">{k}</b> : null}{String(v)}</Badge>)
            : <span className="text-callout text-muted-foreground">All matches</span>}
          {active.length ? <Button variant="link" className="h-control text-callout text-muted-foreground" onClick={() => navigateWith(Object.fromEntries(["opp", "venue", "vt", "inn", "pos", "since", "until", "last", "comp", "lvl", "line", "side"].map((k) => [k, ""])))}>Clear</Button> : null}
        </div>

        <div className={cn("flex flex-col gap-hair p-inset", CARD)}>
          <h2 className="text-body font-semibold">At a glance</h2>
          <p className="text-callout">{res.headline}</p>
          <p className="text-footnote text-muted-foreground">{res.freshness}</p>
        </div>

        <div ref={tabRef} className="flex scroll-mt-[calc(var(--header-h)+var(--control)+var(--space-tight)*2)] flex-col gap-stack">
        <PillGroup segmented layoutId="pl-tab" label="Sections" value={tab} onChange={switchTab} items={[["lines", "Lines"], ["logs", "Game log"], ["splits", "Splits"]]} />
        <AnimatedHeight>
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col gap-stack">
            {tab === "lines" && (
              <>
                <div className={cn("overflow-hidden", CARD)}><LadderTable ladder={res.ladder} /></div>
                {res.corr ? (
                  <div className={cn("flex flex-col gap-snug p-inset", CARD)}>
                    <h3 className="text-body font-semibold">When {res.statLabel.toLowerCase()} {res.plan.side || "over"} {c?.line ?? res.line} hits</h3>
                    <p className="text-footnote text-muted-foreground">{res.corr.n} of {res.corr.of} {res.sample.unit}: how often his other props also clear in those games.</p>
                    <DataTable columns={["Prop", "Normal", "When it hits", "Lift"]} rows={res.corr.rows.map((x: any) => [`${x.label} over ${x.line}`, pc(x.base), pc(x.cond), `${x.lift >= 0 ? "+" : ""}${Math.round(x.lift * 100)}pp`])} />
                  </div>
                ) : null}
              </>
            )}
            {tab === "logs" && (
              <>
                <ul className={cn("overflow-hidden", CARD)}>
                  {logs.slice(0, logCount).map((e, i) => {
                    const s = barState(e, line, side) as string;
                    return (
                      <li key={i} className="border-t border-hairline first:border-t-0">
                        <button type="button" onClick={() => setGame({ e, s })} className="flex min-h-row w-full items-center gap-snug px-inset py-snug text-left transition-colors active:bg-accent">
                          <TeamBadge name={e.opp} size="sm" />
                          <span className="grid min-w-0 flex-1 gap-hair"><span className="truncate text-body font-semibold">{e.opp}</span><span className="truncate text-footnote text-muted-foreground">{e.date}{e.venueName ? ` · ${e.venueName}` : ""}</span></span>
                          <span className={cn("min-w-14 rounded-lg px-snug py-tight text-center text-callout font-bold tabular-nums", s === "hit" ? "bg-primary/20 text-primary" : s === "miss" ? "bg-miss/20 text-miss" : s === "push" ? "bg-amber/20 text-amber" : "bg-secondary")}>{e.value == null ? (s === "void" ? "VOID" : s === "na" ? "N/A" : "DNP") : e.value}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {logs.length > logCount ? <Button variant="secondary" className="h-control self-center rounded-full" onClick={() => setLogCount(logCount + 30)}>Show more ({logs.length - logCount} left)</Button> : null}
              </>
            )}
            {tab === "splits" && <SplitTables splits={res.splits} />}
          </motion.div>
        </AnimatedHeight>
        </div>
      </section>

      <Sheet open={!!game} onOpenChange={(o) => !o && setGame(null)}>
        <SheetContent side="bottom" className="z-[70] mx-auto max-w-xl rounded-t-2xl">
          {game && <><SheetHeader><SheetTitle>{name} · {shortDate(game.e.date)}</SheetTitle><SheetDescription className="sr-only">Game details</SheetDescription></SheetHeader>
            <div className="px-gutter pb-section">{[["Date", game.e.date], ["Opponent", game.e.opp], game.e.venueName ? ["Venue", game.e.venueName] : null,
              [res.statLabel, game.e.value == null ? ({ void: "VOID: in the XI, did not bat/bowl", na: "N/A: XI not recorded", dnp: "DNP: not in the XI" } as any)[game.s] : String(game.e.value)],
              game.e.value != null && c.auxLabel ? [c.auxLabel, game.e.aux ?? "–"] : null, game.e.pos ? ["Batting position", `No. ${game.e.pos}`] : null].filter(Boolean).map(([k, v]: any) => <div key={k} className="flex justify-between gap-snug border-b border-hairline py-snug text-body last:border-b-0"><span className="text-muted-foreground">{k}</span><b className="text-right font-semibold">{v}</b></div>)}</div></>}
        </SheetContent>
      </Sheet>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="z-[70] mx-auto max-h-[90vh] max-w-xl overflow-y-auto rounded-t-2xl">
          <SheetHeader><SheetTitle>Filters</SheetTitle><SheetDescription>Filters apply as you change them.</SheetDescription></SheetHeader>
          <datalist id="dl-teams">{[...new Set<string>(store.teams.map((t: any) => t.n))].map((n) => <option key={n} value={n} />)}</datalist>
          <datalist id="dl-venues">{store.venues.map((n: string) => <option key={n} value={n} />)}</datalist>
          <LiveForm onValues={(v) => { navigateWith({ ...v, line: "", side: "" }); }} className="grid grid-cols-2 border-0 bg-transparent px-gutter pb-section">
            <Field label="Opposition"><Input name="opp" list="dl-teams" defaultValue={q.opp} /></Field>
            <Field label="Venue"><Input name="venue" list="dl-venues" defaultValue={q.venue} /></Field>
            <Field label="Home/away"><NativeSelect name="vt" options={HOME_AWAY} defaultValue={q.vt} className="w-full" /></Field>
            <Field label="Batted first / chasing"><NativeSelect name="inn" options={[["", "any"], ["first", "batted first"], ["second", "chasing"]]} defaultValue={q.inn} className="w-full" /></Field>
            <Field label="Position"><NativeSelect name="pos" options={[["", "any"], ["1-2", "openers"], ["1-3", "top 3"], ["4-6", "middle"], ["7-11", "lower"], ...Array.from({ length: 11 }, (_, i) => [`${i + 1}`, `No. ${i + 1}`] as [string, string])]} defaultValue={q.pos} className="w-full" /></Field>
            <Field label="Level"><NativeSelect name="lvl" options={[["", "all"], ["intl", "international"], ["club", "club / league"]]} defaultValue={q.lvl} className="w-full" /></Field>
            <Field label="From"><Input name="since" type="date" defaultValue={q.since} /></Field>
            <Field label="To"><Input name="until" type="date" defaultValue={q.until} /></Field>
            <Field label="Last N"><Input name="last" type="number" min="1" defaultValue={q.last} /></Field>
            <Field label="Competition"><Input name="comp" placeholder="IPL, BBL…" defaultValue={q.comp} /></Field>
          </LiveForm>
        </SheetContent>
      </Sheet>
    </div>
  );
}
