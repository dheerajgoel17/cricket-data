/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowLeft, Minus, Plus, Share2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TabsContent } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { bookLinesFor, bookName } from "@/engine/lines.js";
import { SPLITS } from "@/engine/props.js";
import { STATS } from "@/engine/rules.js";
import { FORMATS } from "@/engine/util.js";
import { barState, windowRate, windowRates } from "@/engine/windows.js";
import { useData } from "@/lib/data";
import { loadLines } from "@/lib/feeds";
import { localWhen, num, odds, pc, shortDate } from "@/lib/format";
import { setTitle } from "@/lib/title";
import { cn } from "@/lib/utils";
import { useRunPlan } from "@/hooks/useEngine";
import { Field, HOME_AWAY, LiveForm, NativeSelect } from "@/components/app/forms";
import { PlayerPhoto, TeamBadge } from "@/components/app/badges";
import { ChartBars } from "@/components/app/chart";
import { PillTabs } from "@/components/app/pill-tabs";
import { StarButton } from "@/components/app/star";
import { Chips, DataTable, EmptyNote, Muted, Panel } from "@/components/app/page";
import { LadderTable, SplitTables } from "@/components/app/result";

const FILTER_SKIP = new Set(["Player", "Stat", "Format", "Line", "Side"]); // those are on screen already
const band = (p: number | null) => (p == null ? "" : p >= 0.6 ? "hi" : p >= 0.4 ? "mid" : "lo");
const bandText = { hi: "text-primary", mid: "text-amber", lo: "text-destructive", "": "" } as const;
const STAT_TABS: [string, string][] = Object.entries(STATS).map(([k, v]: any) => [k, v.label]);

/** The URL's query string as it is right now (the chart keeps line / side in the URL with replaceState, so the router's copy can be stale). */
const liveQ = () => Object.fromEntries(new URLSearchParams(location.search));

function Stat({ k, v, tone }: { k: string; v: React.ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="grid">
      <span className="font-condensed text-[13px] uppercase leading-snug text-muted-foreground md:text-base">{k}</span>
      <b className="text-[15px] font-medium leading-snug md:text-base">{tone ? <span className={cn("mr-1.5 align-[2px] text-[9px]", tone === "up" ? "text-primary" : "text-destructive")}>{tone === "up" ? "▲" : "▼"}</span> : null}{v}</b>
    </div>
  );
}

function Gauge({ p, caption }: { p: number | null; caption: string }) {
  const arc = p == null ? 0 : Math.max(0, Math.min(1, p));
  const tone = arc >= 0.6 ? "var(--primary)" : arc >= 0.4 ? "var(--amber)" : "var(--destructive)";
  const ring = (stroke: string, dash: string) => <circle cx="24" cy="24" r="19" fill="none" stroke={stroke} strokeWidth="4" strokeDasharray={dash} strokeLinecap="round" transform="rotate(135 24 24)" />;
  return (
    <div className="grid h-24 w-28 shrink-0 content-center justify-items-center gap-0.5 rounded-lg border bg-popover text-sm">
      <svg viewBox="0 0 48 48" width="52" height="52">{ring("var(--border)", "89.6 29.9")}<motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{ring(tone, `${(89.6 * arc).toFixed(1)} 200`)}</motion.g>
        <text x="24" y="28" textAnchor="middle" fontSize="11" fontWeight="600" fill="currentColor">{p == null ? "–" : `${Math.round(arc * 100)}%`}</text></svg>
      <span>{caption}</span>
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
  const fmtVal = Number(q.fmt ?? (fmts.length ? fmts[0][0] : 0));
  const stat = q.stat || "runs";
  setTitle("Player stats, hit rates and form chart");

  const lines = useQuery({ queryKey: ["lines"], queryFn: loadLines, staleTime: 10 * 60_000 });
  const book = lines.data ? bookLinesFor(lines.data, store.P.id[idx], stat, FORMATS[fmtVal]) : null;
  const bookDefault = !!book && (q.line === undefined || q.line === "");
  const plan = {
    kind: "player_prop", stat, line: q.line !== undefined && q.line !== "" ? Number(q.line) : bookDefault ? book.main.line : null, side: q.side || "over",
    competition: q.comp || null, split_by: SPLITS,
    filters: { format: FORMATS[fmtVal], opposition: q.opp || null, venue_type: q.vt || null, innings: q.inn || null, position: q.pos || null, since: q.since || null, until: q.until || null,
      last_n: q.last ? Number(q.last) : null, international: q.lvl === "intl" ? true : q.lvl === "club" ? false : null },
    venue: q.venue || null,
  };
  const res = useRunPlan(plan, { playerIdx: idx }, !lines.isLoading);
  const back = () => (history.length > 1 ? nav(-1) : nav("/players"));
  const share = () => { const u = location.href; (navigator.share ? navigator.share({ title: name, url: u }) : navigator.clipboard.writeText(u).then(() => toast("Link copied"))).catch(() => {}); };

  return (
    <div className="-mx-4 md:mx-0">
      <div className="sticky top-0 z-[45] flex h-[52px] items-center gap-1.5 border-b bg-background px-2.5 md:hidden">
        <button type="button" aria-label="Back" onClick={back} className="grid size-10 place-items-center rounded-full"><ArrowLeft className="size-5" /></button>
        <div className="flex-1 truncate font-bold">{name}</div><StarButton kind="player" idx={idx} className="size-10" />
      </div>
      <div className="sticky top-[52px] z-40 border-b bg-background px-4 py-2 md:top-[60px] md:px-0">
        <PillTabs scrollable layoutId="stat-rail" tabs={STAT_TABS} value={stat} onChange={(k) => navigateWith({ stat: k, line: "", side: q.side })} />
      </div>
      <div className="px-4 md:px-0">
        {res.data && res.data.ok ? <Loaded key={`${stat}-${fmtVal}-${JSON.stringify(plan.filters)}-${plan.venue}-${plan.competition}-${book ? 1 : 0}`} {...{ idx, name, team, res: res.data, q, book, bookDefault, fmts, fmtVal, navigateWith, share }} />
          : <Hero {...{ idx, name, team, fmts, share }} stats={null} />}
        {res.data && !res.data.ok ? <EmptyNote>{res.data.error}</EmptyNote> : null}
        {res.isLoading ? <Muted className="py-6">Loading…</Muted> : null}
      </div>
    </div>
  );
}

function Hero({ idx, name, team, fmts, share, stats }: { idx: number; name: string; team: string; fmts: [number, string][]; share: () => void; stats: React.ReactNode }) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 border-b pt-4 [grid-template-areas:'id_photo''stats_stats'] md:grid-cols-[190px_minmax(0,1fr)_auto] md:items-center md:gap-x-6 md:pt-5 md:[grid-template-areas:'photo_id_stats']">
      <div className="h-[138px] w-[150px] [grid-area:photo] md:h-[168px] md:w-[190px] md:self-end"><PlayerPhoto idx={idx} className="size-full" /></div>
      <div className="self-start pb-3.5 [grid-area:id] md:self-center md:pb-0">
        <h1 className="text-2xl font-medium leading-tight md:text-3xl xl:text-[40px]">{name}</h1>
        <div className="text-sm text-muted-foreground md:text-base">{team}</div><div className="text-sm text-muted-foreground md:text-base">{fmts.map(([, f]) => f).join(" · ")}</div>
        <div className="mt-3.5 flex gap-3"><span className="grid size-11 place-items-center overflow-hidden rounded-full bg-secondary"><TeamBadge name={team} size="md" className="border-0" /></span><StarButton kind="player" idx={idx} /><motion.button type="button" aria-label="Share" whileTap={{ scale: 0.9 }} onClick={share} className="grid size-11 cursor-pointer place-items-center rounded-full bg-secondary"><Share2 className="size-5" /></motion.button></div>
      </div>
      <div className="-mx-4 mt-0 flex items-center justify-between gap-3 border-t px-4 py-3.5 [grid-area:stats] md:mx-0 md:gap-10 md:border-t-0 md:p-0">{stats}</div>
    </section>
  );
}

function Loaded({ idx, name, team, res, q, book, bookDefault, fmts, fmtVal, navigateWith, share }: any) {
  const { store } = useData();
  const c = res.chart;
  const entries: any[] = c ? c.entries : [];
  const nav = useNavigate();
  const [line, setLine] = useState<number>(c ? c.line : 0.5);
  const [side, setSide] = useState<string>(c ? c.side : "over");
  const [win, setWin] = useState<number>(entries.length >= 20 ? 20 : 0);
  const [tab, setTab] = useState<string>(["lines", "logs", "splits"].includes(q.tab) ? q.tab : "lines");
  const [game, setGame] = useState<{ e: any; s: string } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [logCount, setLogCount] = useState(30);
  const keep = (patch: Record<string, unknown>) => { const next = new URLSearchParams(location.search); for (const [k, v] of Object.entries(patch)) { if (v === "" || v == null) next.delete(k); else next.set(k, String(v)); } history.replaceState(null, "", `${location.pathname}?${next}`); };

  const ws = entries.length ? windowRates(entries, line, side) : [];
  const cur = ws.find((w: any) => w.n === win) || ws[ws.length - 1];
  const shown = cur ? (cur.n ? entries.slice(-cur.n) : entries) : [];
  const played = shown.filter((e) => e.value != null);
  const auxAvg = played.length ? played.reduce((t, e) => t + (e.aux || 0), 0) / played.length : null;
  const bookAt = book ? book.lines.find((l: any) => l.line === line) : null;
  const bestPrice = bookAt ? Math.max(0, ...bookAt.books.map((b: any) => b[side] || 0)) : 0;
  const edge = bestPrice && cur?.p ? bestPrice * cur.p - 1 : 0;
  const active = (res.filters || []).filter(([k]: [string]) => !FILTER_SKIP.has(k));
  const logs = [...entries].reverse();
  const stepLine = (d: number) => { const v = Math.max(0.5, Math.round((line + d) * 100) / 100); setLine(v); keep({ line: v, side }); };

  const stats = cur ? (
    <>
      <div className="grid grid-cols-3 gap-x-5 gap-y-3.5 md:grid-cols-[repeat(3,96px)] md:gap-x-2">
        <Stat k={`${cur.label} avg`} v={num(cur.mean == null ? null : Math.round(cur.mean * 100) / 100)} tone={cur.p != null && (cur.mean ?? 0) > line ? "up" : undefined} />
        <Stat k="Line" v={`${side === "over" ? "O" : "U"} ${line}`} />
        <Stat k="Prop" v={res.statLabel} />
        <Stat k="Hit rate" v={cur.p == null ? "–" : `${Math.round(cur.p * 100)}%`} tone={cur.p == null ? undefined : cur.p >= 0.6 ? "up" : cur.p < 0.4 ? "down" : undefined} />
        <Stat k={`Avg ${(c.auxLabel || "").toLowerCase()}`} v={num(auxAvg == null ? null : Math.round(auxAvg * 100) / 100)} />
        <Stat k="Fair price" v={cur.p ? odds(1 / cur.p) : "–"} />
      </div>
      <Gauge p={cur.p} caption={`${cur.label} hit`} />
    </>
  ) : null;

  return (
    <>
      <Hero {...{ idx, name, team, fmts, share }} stats={stats} />
      {fmts.length > 1 && (
        <ToggleGroup type="single" value={String(fmtVal)} onValueChange={(v) => v && navigateWith({ fmt: v, line: "" })} className="my-3 w-full rounded-full border p-1">
          {fmts.map(([i, f]: [number, string]) => <ToggleGroupItem key={i} value={String(i)} className="h-9 flex-1 rounded-full data-[state=on]:bg-accent">{f}</ToggleGroupItem>)}
        </ToggleGroup>)}
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="grid min-w-0 gap-3">
          <section className="grid gap-3">
            {!entries.length || !cur ? <EmptyNote>No fixtures match these filters.</EmptyNote> : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <ToggleGroup type="single" value={side} onValueChange={(v) => { if (v) { setSide(v); keep({ line, side: v }); } }} className="rounded-full border p-1">
                    {["over", "under"].map((s) => <ToggleGroupItem key={s} value={s} className="h-9 rounded-full px-5 capitalize data-[state=on]:bg-accent">{s}</ToggleGroupItem>)}
                  </ToggleGroup>
                  <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
                    <Button size="icon" variant="ghost" aria-label="Lower line" className="size-9 rounded-full bg-[#3a3a3a]" onClick={() => stepLine(-0.5)}><Minus /></Button>
                    <b className="min-w-12 text-center text-base tabular-nums">{line}</b>
                    <Button size="icon" variant="ghost" aria-label="Raise line" className="size-9 rounded-full bg-[#3a3a3a]" onClick={() => stepLine(0.5)}><Plus /></Button>
                  </div>
                </div>
                <ChartBars entries={shown} line={line} side={side} height={340} animateKey={`${win}-${shown.length}`} onSelect={(e, s) => setGame({ e, s })} label={`${res.statLabel} ${side} ${line}`} />
                <ToggleGroup type="single" value={String(cur.n)} onValueChange={(v) => v !== "" && setWin(Number(v))} className="w-full rounded-full border p-1">
                  {ws.map((w: any) => (
                    <ToggleGroupItem key={w.n} value={String(w.n)} className="relative h-[52px] flex-1 rounded-full data-[state=on]:bg-accent">
                      <span className="grid gap-px text-sm leading-tight"><span>{w.label}</span><b className={cn("font-medium", bandText[band(w.p) as keyof typeof bandText])}>{w.p == null ? "–" : `${Math.round(w.p * 100)}%`}</b></span>
                    </ToggleGroupItem>))}
                </ToggleGroup>
                <p className="text-center text-sm text-muted-foreground">{res.statLabel} {side} {line} · green = cleared, red = missed · DNP/VOID fixtures are not counted</p>
              </>)}
          </section>

          {book && cur && (
            <Panel title="Bookmaker lines">
              <Muted>{book.match}{book.start_utc ? ` · ${localWhen(book.start_utc)}` : ""}{book.competition ? ` · ${book.competition}` : ""}. Decimal prices, over / under. Tap a line to put it on the chart.{bookDefault ? " The chart opened on the main line." : ""}</Muted>
              <DataTable columns={["Line", "Price", "Market", `Hit ${cur.label}`]} rows={book.lines.map((l: any) => {
                const hist = windowRate(entries, cur.n, l.line, "over");
                return [<button key={l.line} type="button" onClick={() => { setLine(l.line); keep({ line: l.line, side }); }} className={cn("inline-flex min-w-14 cursor-pointer flex-col items-center rounded-xl border px-2.5 py-1.5 font-bold leading-tight", line === l.line ? "border-transparent bg-primary text-primary-foreground" : "bg-pill")}>{l.line}{l === book.main ? <small className="text-[10px] font-semibold uppercase opacity-70">main</small> : null}</button>,
                  <span key="o" className="grid gap-0.5">{l.books.map((b: any) => <span key={b.source}><em className="mr-1.5 text-[11px] not-italic text-muted-foreground">{bookName(b.source)}</em>{odds(b.over)} / {odds(b.under)}</span>)}</span>,
                  l.prob == null ? "–" : pc(l.prob), hist.p == null ? "–" : pc(hist.p)];
              })} />
              <Muted className="mt-2">Market = the chance of the over once each book's margin is removed. Hit rate = how often he has gone over that line in the games shown on the chart.{bestPrice && cur.p ? ` At ${line}: best price ${odds(bestPrice)}, ${edge >= 0 ? "+" : ""}${Math.round(edge * 100)}% vs his hit rate.` : ""}</Muted>
            </Panel>)}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setFiltersOpen(true)}><SlidersHorizontal />Filters{active.length ? ` · ${active.length}` : ""}</Button>
            {active.length ? <Chips list={active} /> : <span className="text-sm text-muted-foreground">All matches</span>}
            {active.length ? <Button variant="link" className="text-muted-foreground" onClick={() => navigateWith(Object.fromEntries(["opp", "venue", "vt", "inn", "pos", "since", "until", "last", "comp", "lvl", "line", "side"].map((k) => [k, ""])))}>Clear</Button> : null}
          </div>

          <PillTabs layoutId="pl-tab" tabs={[["lines", "Lines"], ["logs", "Game log"], ["splits", "Splits"]]} value={tab} onChange={(t) => { setTab(t); keep({ tab: t }); }}>
            <TabsContent value="lines" className="grid gap-3">
              <Panel title="Hit rate at every line" flat><LadderTable ladder={res.ladder} /></Panel>
              {res.corr ? <Panel title={`When ${res.statLabel.toLowerCase()} ${res.plan.side || "over"} ${c?.line ?? res.line} hits`}><Muted>{res.corr.n} of {res.corr.of} {res.sample.unit}: how often his other props also clear in those games.</Muted>
                <DataTable columns={["Prop", "Normal", "When it hits", "Lift"]} rows={res.corr.rows.map((x: any) => [`${x.label} over ${x.line}`, pc(x.base), pc(x.cond), `${x.lift >= 0 ? "+" : ""}${Math.round(x.lift * 100)}pp`])} /></Panel> : null}
            </TabsContent>
            <TabsContent value="logs">
              <Panel flat>{logs.slice(0, logCount).map((e, i) => { const s = barState(e, line, side) as string; return (
                <button key={i} type="button" onClick={() => setGame({ e, s })} className="flex w-full cursor-pointer items-center justify-between gap-3 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-[#151515]">
                  <span className="flex min-w-0 items-center gap-2.5"><TeamBadge name={e.opp} /><span className="grid min-w-0"><b className="truncate font-medium">{e.opp}</b><small className="truncate text-xs text-muted-foreground">{e.date}{e.venueName ? ` · ${e.venueName}` : ""}</small></span></span>
                  <span className={cn("min-w-14 rounded-lg px-2 py-1.5 text-center font-bold", s === "hit" ? "bg-primary/20 text-primary" : s === "miss" ? "bg-destructive/20 text-destructive" : s === "push" ? "bg-amber/20 text-amber" : "bg-secondary")}>{e.value == null ? (s === "void" ? "VOID" : s === "na" ? "N/A" : "DNP") : e.value}</span>
                </button>); })}
                {logs.length > logCount ? <div className="p-3 text-center"><Button variant="secondary" className="rounded-full" onClick={() => setLogCount(logCount + 30)}>Show more ({logs.length - logCount} left)</Button></div> : null}
              </Panel>
            </TabsContent>
            <TabsContent value="splits" className="grid gap-3"><SplitTables splits={res.splits} /></TabsContent>
          </PillTabs>
        </div>
        <aside className="hidden gap-3 xl:grid xl:sticky xl:top-[130px]">
          <Panel title="At a glance"><p>{res.headline}</p><Muted className="mt-2">{res.freshness}</Muted></Panel>
        </aside>
      </div>

      <Sheet open={!!game} onOpenChange={(o) => !o && setGame(null)}>
        <SheetContent side="bottom" className="mx-auto max-w-xl rounded-t-2xl">
          {game && <><SheetHeader><SheetTitle>{name} · {shortDate(game.e.date)}</SheetTitle><SheetDescription className="sr-only">Game details</SheetDescription></SheetHeader>
            <div className="px-4 pb-6">{[["Date", game.e.date], ["Opponent", game.e.opp], game.e.venueName ? ["Venue", game.e.venueName] : null,
              [res.statLabel, game.e.value == null ? ({ void: "VOID: in the XI, did not bat/bowl", na: "N/A: XI not recorded", dnp: "DNP: not in the XI" } as any)[game.s] : String(game.e.value)],
              game.e.value != null && c.auxLabel ? [c.auxLabel, game.e.aux ?? "–"] : null, game.e.pos ? ["Batting position", `No. ${game.e.pos}`] : null].filter(Boolean).map(([k, v]: any) => <div key={k} className="flex justify-between border-b py-3 last:border-b-0"><span className="text-muted-foreground">{k}</span><b>{v}</b></div>)}</div></>}
        </SheetContent>
      </Sheet>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="mx-auto max-h-[90vh] max-w-xl overflow-y-auto rounded-t-2xl">
          <SheetHeader><SheetTitle>Filters</SheetTitle><SheetDescription>Filters apply as you change them.</SheetDescription></SheetHeader>
          <datalist id="dl-teams">{[...new Set<string>(store.teams.map((t: any) => t.n))].map((n) => <option key={n} value={n} />)}</datalist>
          <datalist id="dl-venues">{store.venues.map((n: string) => <option key={n} value={n} />)}</datalist>
          <LiveForm onValues={(v) => { navigateWith({ ...v, line: "", side: "" }); }} className="grid grid-cols-2 border-0 bg-transparent px-4 pb-6">
            <Field label="Opposition"><Input name="opp" list="dl-teams" defaultValue={q.opp} /></Field>
            <Field label="Venue"><Input name="venue" list="dl-venues" defaultValue={q.venue} /></Field>
            <Field label="Home/away"><NativeSelect name="vt" options={HOME_AWAY} defaultValue={q.vt} className="w-full" /></Field>
            <Field label="Innings"><NativeSelect name="inn" options={[["", "any"], ["first", "batting first"], ["second", "chasing"]]} defaultValue={q.inn} className="w-full" /></Field>
            <Field label="Position"><NativeSelect name="pos" options={[["", "any"], ["1-2", "openers"], ["1-3", "top 3"], ["4-6", "middle"], ["7-11", "lower"], ...Array.from({ length: 11 }, (_, i) => [`${i + 1}`, `No. ${i + 1}`] as [string, string])]} defaultValue={q.pos} className="w-full" /></Field>
            <Field label="Level"><NativeSelect name="lvl" options={[["", "all"], ["intl", "international"], ["club", "club / league"]]} defaultValue={q.lvl} className="w-full" /></Field>
            <Field label="From"><Input name="since" type="date" defaultValue={q.since} /></Field>
            <Field label="To"><Input name="until" type="date" defaultValue={q.until} /></Field>
            <Field label="Last N"><Input name="last" type="number" min="1" defaultValue={q.last} /></Field>
            <Field label="Competition"><Input name="comp" placeholder="IPL, BBL…" defaultValue={q.comp} /></Field>
          </LiveForm>
        </SheetContent>
      </Sheet>
      <Link to="/players" className="sr-only" onClick={(e) => { e.preventDefault(); nav("/players"); }}>All players</Link>
      <Badge className="hidden">{String(tab)}</Badge>
    </>
  );
}
