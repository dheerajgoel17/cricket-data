/* eslint-disable @typescript-eslint/no-explicit-any */
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { MATCH_MARKETS, marketReport, selectMatches } from "@/engine/markets.js";
import { STATS } from "@/engine/rules.js";
import { FORMATS } from "@/engine/util.js";
import { useData } from "@/lib/data";
import { collectGrid } from "@/lib/grid";
import { fixtureStart, fixtureWhen, num } from "@/lib/format";
import { setTitle } from "@/lib/title";
import { useFixtures } from "@/hooks/useEngine";
import { Field, LiveForm, NativeSelect, useQ } from "@/components/app/forms";
import { EntityHero } from "@/components/app/entity-hero";
import { PillTabs } from "@/components/app/pill-tabs";
import { GridTable, TrendCards } from "@/components/app/grid";
import { TeamBadge } from "@/components/app/badges";
import { Crumbs, DataTable, EmptyNote, Muted, PageTitle, Panel } from "@/components/app/page";
import { Input } from "@/components/ui/input";
import { NextMatch } from "./Home";

const STAT_OPTIONS: [string, string][] = Object.entries(STATS).map(([k, v]: any) => [k, v.label]);
const GAMES: [number, string][] = [5, 10, 15, 20, 30].map((n) => [n, `Last ${n}`]);
const HITS: [number, string][] = [[0.5, "50%+"], [0.6, "60%+"], [0.7, "70%+"], [0.8, "80%+"]];
const fmtOf = (f: any) => (FORMATS.includes(f?.fmt) ? f.fmt : "T20");

function MarketCard({ name, idx, fmt }: { name: string; idx: number; fmt: string }) {
  const { store } = useData();
  const ms = selectMatches(store, { fmt: FORMATS.indexOf(fmt), team: idx, lastN: 30 });
  const rows = ["match_runs", "match_sixes", "match_fours", "match_50s", "highest_over"].map((k) => { const r = marketReport(store, ms, k); return [(MATCH_MARKETS as any)[k].label, num(r.summary.median), num(r.summary.mean)]; });
  return <Panel title={`${name}: last ${ms.length} ${fmt} matches`}><DataTable columns={["Market", "Median", "Mean"]} rows={rows} /><p className="mt-2"><Link className="text-primary" to={`/team/${idx}?fmt=${fmt}`}>Full team page →</Link></p></Panel>;
}

export function FixturePage() {
  const { store } = useData();
  const { "*": id = "" } = useParams();
  const [q, setQ] = useQ();
  const { data: all, isLoading } = useFixtures();
  const fx = (all || []).find((f) => f.id === id);
  const fmt = FORMATS.includes(q.fmt) ? q.fmt : fx ? fmtOf(fx) : "T20";
  const stat = (STATS as any)[q.stat] ? q.stat : "sixes";
  const line = q.line !== undefined && q.line !== "" ? Number(q.line) : 0.5;
  const games = [5, 10, 15, 20, 30].includes(Number(q.n)) ? Number(q.n) : 10;
  const tab = ["grid", "trends", "markets"].includes(q.tab) ? q.tab : "grid";
  const teams: [string, number][] = fx ? [[fx.a, fx.a_ix], [fx.b, fx.b_ix]] : [];
  const known = teams.filter(([, i]) => i >= 0);
  const grids = useQuery({ queryKey: ["fx-grids", id, fmt, stat, games], enabled: !!fx && fx.fmt !== "FC", queryFn: async () => Promise.all(known.map(async ([name, i]) => ({ name, team: i, g: await collectGrid(store, i, fmt, stat, games) }))) });
  setTitle("Match preview, player grid and trends");
  if (isLoading) return <Muted className="py-6">Loading…</Muted>;
  if (!fx) return <div><Crumbs items={[["Home", "/"], ["Fixture"]]} /><EmptyNote>That fixture is no longer in the schedule.</EmptyNote></div>;
  const title = `${fx.a} v ${fx.b}`;
  if (fx.fmt === "FC") return <div><Crumbs items={[["Home", "/"], ["Fixtures", "/"], [title]]} /><Panel title={title}><Muted>{fx.series || ""} · {fx.venue || ""}</Muted><p className="mt-2">This is a first-class match. First-class cricket is not part of the stats here (no Test or limited-overs form is mixed in), so there is no player grid or trends for it.</p></Panel></div>;
  const when = fixtureStart(fx);
  const form = (
    <LiveForm onValues={(v) => setQ(v)} className="mb-3">
      <Field label="Format"><NativeSelect name="fmt" options={FORMATS.map((f: string) => [f, f])} defaultValue={fmt} /></Field>
      <Field label="Stat"><NativeSelect name="stat" options={STAT_OPTIONS} defaultValue={stat} /></Field>
      <Field label="Line"><Input name="line" type="number" step="0.5" defaultValue={line} className="w-24" /></Field>
      <Field label="Games"><NativeSelect name="n" options={GAMES} defaultValue={games} /></Field>
      <Field label="Min hit rate (trends)"><NativeSelect name="hit" options={HITS} defaultValue={q.hit || "0.6"} /></Field>
    </LiveForm>);
  return (
    <div>
      <Crumbs items={[["Home", "/"], ["Fixtures", "/"], [title]]} />
      <EntityHero badge={<div className="flex items-center gap-2"><TeamBadge name={fx.a} size="lg" /><span className="text-muted-foreground">v</span><TeamBadge name={fx.b} size="lg" /></div>} name={title} sub={fx.venue || ""} meta={[fmt, fx.gender === "female" ? "Women" : "Men", fixtureWhen(fx)]} />
      <NextMatch f={fx} />
      <PillTabs layoutId="fx-tab" tabs={[["grid", "Player grid"], ["trends", "Trends"], ["markets", "Team markets"]]} value={tab} onChange={(t) => setQ({ tab: t })}>
        <TabsContent value="grid">{form}{grids.data?.map(({ name, team, g }) => <div key={name} className="mb-4"><h2 className="mb-2 text-xl font-medium">{name}: {(STATS as any)[stat].label} over {line}</h2><GridTable g={g} teamIdx={team} line={line} /></div>)}{!known.length && <EmptyNote>These teams are not in the dataset yet.</EmptyNote>}</TabsContent>
        <TabsContent value="trends">{form}{grids.data && <TrendCards grids={grids.data} line={line} minHit={Number(q.hit || 0.6)} stat={stat} />}</TabsContent>
        <TabsContent value="markets">{known.length ? <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">{known.map(([name, i]) => <MarketCard key={i} name={name} idx={i} fmt={fmt} />)}</div> : <EmptyNote>No team data.</EmptyNote>}</TabsContent>
      </PillTabs>
    </div>
  );
}

export function TrendsPage() {
  setTitle("Player trends");
  const { store } = useData();
  const [q, setQ] = useQ();
  const { data } = useFixtures();
  const fxs = (data || []).filter((f) => f.a_ix >= 0 && f.b_ix >= 0 && (f.start.length > 10 ? Date.parse(f.start) > Date.now() - 4 * 36e5 : true)).slice(0, 40);
  const sel = fxs.find((f) => f.id === q.f) || fxs[0];
  const fmt = FORMATS.includes(q.fmt) ? q.fmt : sel ? fmtOf(sel) : "T20";
  const stat = (STATS as any)[q.stat] ? q.stat : "sixes";
  const line = q.line !== undefined && q.line !== "" ? Number(q.line) : 0.5;
  const n = Number(q.n) || 10;
  const grids = useQuery({ queryKey: ["trend-grids", sel?.id, fmt, stat, n], enabled: !!sel, queryFn: async () => Promise.all([[sel.a, sel.a_ix], [sel.b, sel.b_ix]].map(async ([name, i]: any) => ({ name, team: i, g: await collectGrid(store, i, fmt, stat, n) }))) });
  return (
    <div>
      <Crumbs items={[["Home", "/"], ["Tools", "/tools"], ["Player trends"]]} />
      <PageTitle sub="Strongest recent hit-rate streaks for the players in an upcoming match.">Player trends</PageTitle>
      <LiveForm onValues={(v) => setQ(v)} className="mb-3" key={sel?.id}>
        <Field label="Fixture"><NativeSelect name="f" defaultValue={sel?.id} options={fxs.map((f) => [f.id, `${fixtureWhen(f, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}  ${f.a} v ${f.b} (${f.fmt || "T20"})`])} className="max-w-72" /></Field>
        <Field label="Format"><NativeSelect name="fmt" options={FORMATS.map((f: string) => [f, f])} defaultValue={fmt} /></Field>
        <Field label="Stat"><NativeSelect name="stat" options={STAT_OPTIONS} defaultValue={stat} /></Field>
        <Field label="Line"><Input name="line" type="number" step="0.5" defaultValue={line} className="w-24" /></Field>
        <Field label="Games"><NativeSelect name="n" options={GAMES} defaultValue={n} /></Field>
        <Field label="Min hit rate"><NativeSelect name="hit" options={HITS} defaultValue={q.hit || "0.6"} /></Field>
      </LiveForm>
      {!sel ? <EmptyNote>No upcoming fixtures with known teams right now.</EmptyNote> : (
        <div><h2 className="mb-2 text-xl font-medium">{sel.a} v {sel.b}</h2>
          {grids.data ? <TrendCards grids={grids.data} line={line} minHit={Number(q.hit || 0.6)} stat={stat} /> : <Muted>Loading…</Muted>}
          <Muted className="mt-3">Players whose last {n} {fmt} games for their team cleared {(STATS as any)[stat].label.toLowerCase()} over {line}. Games he did not feature in are excluded.</Muted></div>)}
    </div>
  );
}
void Card;
