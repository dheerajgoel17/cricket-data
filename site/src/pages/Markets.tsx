/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MATCH_MARKETS, marketReport, selectMatches } from "@/engine/markets.js";
import { STATS } from "@/engine/rules.js";
import { FORMATS } from "@/engine/util.js";
import { useData } from "@/lib/data";
import { collectGrid } from "@/lib/grid";
import { num, pc } from "@/lib/format";
import { setTitle } from "@/lib/title";
import { useFixtures, useRunPlan } from "@/hooks/useEngine";
import { Field, HOME_AWAY, LiveForm, NativeSelect, useQ } from "@/components/app/forms";
import { EntityHero } from "@/components/app/entity-hero";
import { PillTabs } from "@/components/app/pill-tabs";
import { GridTable } from "@/components/app/grid";
import { TeamBadge } from "@/components/app/badges";
import { StarButton } from "@/components/app/star";
import { Crumbs, DataTable, EmptyNote, Muted, PageTitle, Panel } from "@/components/app/page";
import { ResultView } from "@/components/app/result";
import { NextMatch } from "./Home";
import { ListSkeleton } from "@/components/app/skeletons";

const MARKETS: [string, string][] = [["", "all markets"], ["match_sixes", "match sixes"], ["match_fours", "match fours"], ["match_runs", "match runs"], ["match_30s", "30s"], ["match_50s", "50s"], ["highest_over", "highest over"], ["max_conceded", "most conceded by a bowler"], ["top_score", "top score"]];
const caps = (s: string) => s.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();

// ------------------------------------------------------------------ competitions
export function CompetitionsPage() {
  setTitle("Cricket competitions");
  const { store } = useData();
  const [q, setQ] = useQ();
  const [text, setText] = useState(q.q || "");
  const all = useMemo(() => { const cnt = new Map<number, number>(); for (let m = 0; m < store.n; m++) { const e = store.M.e[m]; if (e) cnt.set(e, (cnt.get(e) || 0) + 1); } return [...cnt.entries()].filter(([, c]) => c >= 8).sort((a, b) => b[1] - a[1]); }, [store]);
  const t = text.trim().toLowerCase();
  const rows = all.filter(([e]) => !t || store.events[e].toLowerCase().includes(t)).slice(0, 80);
  return (
    <div>
      <Crumbs items={[["Home", "/"], ["Competitions"]]} />
      <PageTitle>Competitions</PageTitle>
      <Input type="search" placeholder="Search competitions" value={text} onChange={(e) => { setText(e.target.value); setQ({ q: e.target.value }); }} className="mb-3" />
      <Panel flat>{rows.map(([e, c]) => <Link key={e} to={`/league/${e}`} className="flex items-center gap-3.5 border-b px-4 py-3 last:border-b-0 hover:bg-[#151515]"><span className="grid size-9 place-items-center rounded-lg bg-secondary text-xs font-extrabold text-primary">{caps(store.events[e])}</span><span className="flex-1 font-medium">{store.events[e]}</span><span className="text-[13px] text-muted-foreground">{c} matches</span><ArrowRight className="size-4 text-muted-foreground" /></Link>)}</Panel>
    </div>
  );
}

export function LeaguePage() {
  const { store } = useData();
  const { id } = useParams();
  const e = Number(id);
  const [q, setQ] = useQ();
  const valid = e >= 0 && e < store.events.length;
  const data = useMemo(() => {
    if (!valid) return null;
    const ms: number[] = []; for (let m = 0; m < store.n; m++) if (store.M.e[m] === e) ms.push(m);
    const fc = [0, 0, 0, 0]; for (const m of ms) fc[store.M.f[m]]++;
    const fmt = fc.indexOf(Math.max(...fc)), fmtName = FORMATS[fmt];
    const vm = selectMatches(store, { fmt, event: [e] });
    const seasons = [...new Set(ms.map((m) => store.M.d[m].slice(0, 4)))].sort().reverse();
    const tt = new Map<number, any>();
    for (const m of ms) for (const t of [store.M.a[m], store.M.b[m]]) { const r = tt.get(t) || { n: 0, w: 0, l: 0 }; r.n++; if (store.M.w[m] === t) r.w++; else if (store.M.w[m] >= 0) r.l++; tt.set(t, r); }
    const teams = [...tt.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 40);
    const mk = ["match_runs", "match_sixes", "match_fours", "match_50s", "highest_over", "top_score"].map((k) => { const r = marketReport(store, vm, k); return [(MATCH_MARKETS as any)[k].label, num(r.summary.median), num(r.summary.mean), r.n]; });
    const recent = ms.slice(-15).reverse().map((m) => { const inn = store.M.inn[m]; const sc = (i: number) => (inn[i] ? `${inn[i][1]}/${inn[i][2]}` : "–"); return [store.M.d[m], `${store.teamName(store.M.a[m], true)} v ${store.teamName(store.M.b[m], true)}`, store.venueName(store.M.v[m]), inn.length ? `${sc(0)} · ${sc(1)}` : "–", store.M.w[m] >= 0 ? store.teamName(store.M.w[m], true) : "–"]; });
    return { ms, fmtName, seasons, tt, teams, mk, recent };
  }, [store, e, valid]);
  setTitle(valid ? `${store.events[e]}: team tables, totals and top scores` : "Competition stats");
  if (!valid || !data) return <EmptyNote>Unknown competition.</EmptyNote>;
  const tab = ["overview", "teams", "results"].includes(q.tab) ? q.tab : "overview";
  const name = store.events[e];
  return (
    <div>
      <Crumbs items={[["Home", "/"], ["Competitions", "/competitions"], [name]]} />
      <EntityHero badge={<span className="grid size-16 place-items-center rounded-full bg-secondary text-lg font-bold text-muted-foreground">{caps(name)}</span>} name={name} sub={`${data.ms.length} matches · ${data.seasons[data.seasons.length - 1]}–${data.seasons[0]}`} meta={[data.fmtName, `${data.tt.size} teams`]} />
      <PillTabs layoutId="lg-tab" tabs={[["overview", "Markets"], ["teams", "Teams"], ["results", "Results"]]} value={tab} onChange={(t) => setQ({ tab: t })}>
        <TabsContent value="overview"><Panel flat><DataTable columns={["Market", "Median", "Mean", "Matches"]} rows={data.mk} /></Panel><Muted className="mt-2">{data.fmtName} matches that count for summary markets (void games excluded).</Muted></TabsContent>
        <TabsContent value="teams"><Panel flat><DataTable columns={["Team", "Played", "Won", "Lost", "Win %"]} rows={data.teams.map(([t, r]: any) => [<Link key={t} className="text-primary" to={`/team/${t}?fmt=${data.fmtName}`}>{store.teamName(t)}</Link>, r.n, r.w, r.l, pc(r.n ? r.w / r.n : null)])} /></Panel></TabsContent>
        <TabsContent value="results"><Panel flat><DataTable columns={["Date", "Match", "Venue", "Innings runs", "Winner"]} rows={data.recent} /></Panel></TabsContent>
      </PillTabs>
    </div>
  );
}

// ------------------------------------------------------------------ team / venue market pages
export function MarketPage({ kind }: { kind: "team" | "venue" }) {
  const { store } = useData();
  const { id } = useParams();
  const idx = Number(id);
  const isTeam = kind === "team";
  const [q, setQ] = useQ();
  const label = isTeam ? store.teamName(idx) : store.venueName(idx);
  const fmt = q.fmt ?? "T20";
  const fmtName = FORMATS.includes(fmt) ? fmt : "T20";
  const tab = (isTeam ? ["grid", "markets", "top"] : ["markets", "top"]).includes(q.tab) ? q.tab : isTeam ? "grid" : "markets";
  const plan = { kind: "match_market", market: q.market || null, line: q.line ? Number(q.line) : null, side: "over",
    filters: { format: fmt, opposition: q.opp || null, venue_type: q.vt || null, since: q.since || null, until: q.until || null, last_n: q.last ? Number(q.last) : null, gender: isTeam ? (store.genderOfTeam(idx) ? "female" : "male") : null } };
  const hints = isTeam ? { teamIdx: idx } : { venueIdx: idx };
  const res = useRunPlan(plan, hints), top = useRunPlan({ ...plan, kind: "top_batter", market: null }, hints);
  const gstat = (STATS as any)[q.gstat] ? q.gstat : "sixes", gline = q.gline !== undefined && q.gline !== "" ? Number(q.gline) : 0.5;
  const grid = useQuery({ queryKey: ["team-grid", idx, fmtName, gstat], enabled: isTeam, queryFn: () => collectGrid(store, idx, fmtName, gstat) });
  const { data: fixtures } = useFixtures();
  const nextFx = isTeam ? (fixtures || []).find((f) => (f.a_ix === idx || f.b_ix === idx) && (f.start.length > 10 ? Date.parse(f.start) > Date.now() : f.start >= new Date().toISOString().slice(0, 10))) : null;
  setTitle(idx >= 0 && idx < (isTeam ? store.teams.length : store.venues.length) ? (isTeam ? `${store.teamName(idx)}: stats and player grid` : `${store.venues[idx]}: venue stats`) : isTeam ? "Team stats and player grid" : "Venue stats");
  if (!(idx >= 0 && idx < (isTeam ? store.teams.length : store.venues.length))) return <EmptyNote>Unknown {kind}.</EmptyNote>;
  const form = (
    <LiveForm onValues={(v) => setQ({ ...v })} className="mb-3">
      <Field label="Format"><NativeSelect name="fmt" options={FORMATS.map((f: string) => [f, f])} defaultValue={fmt} /></Field>
      {isTeam && <Field label="Opposition"><Input name="opp" list="dl-teams" defaultValue={q.opp} className="w-40" /></Field>}
      {isTeam && <Field label="Home/away"><NativeSelect name="vt" options={HOME_AWAY} defaultValue={q.vt} /></Field>}
      <Field label="Market"><NativeSelect name="market" options={MARKETS} defaultValue={q.market} /></Field>
      <Field label="Line"><Input name="line" type="number" step="0.5" defaultValue={q.line} className="w-24" /></Field>
      <Field label="From"><Input name="since" type="date" defaultValue={q.since} /></Field>
      <Field label="To"><Input name="until" type="date" defaultValue={q.until} /></Field>
      <Field label="Last N"><Input name="last" type="number" min="1" defaultValue={q.last} className="w-20" /></Field>
    </LiveForm>);
  const tabs: [string, string][] = isTeam ? [["grid", "Player grid"], ["markets", "Markets"], ["top", "Top batter"]] : [["markets", "Markets"], ["top", "Top batter"]];
  return (
    <div>
      <Crumbs items={[["Home", "/"], [isTeam ? "Teams" : "Venues", `/teams?tab=${isTeam ? "teams" : "venues"}`], [label]]} />
      <EntityHero badge={isTeam ? <TeamBadge name={store.teams[idx].n} size="xl" /> : undefined} name={label} sub={isTeam ? (store.teams[idx].g ? "Women's cricket" : "Men's cricket") : "Venue"}
        meta={[`${fmtName} markets`, isTeam ? "team markets use the side batting first" : "match markets"]} save={isTeam ? <StarButton kind="team" idx={idx} /> : undefined} />
      {nextFx ? <div className="my-3"><NextMatch f={nextFx} /></div> : null}
      <datalist id="dl-teams">{[...new Set<string>(store.teams.map((t: any) => t.n))].map((n) => <option key={n} value={n} />)}</datalist>
      <PillTabs layoutId="mk-tab" tabs={tabs} value={tab} onChange={(t) => setQ({ tab: t })}>
        {isTeam && <TabsContent value="grid">
          <LiveForm onValues={(v) => setQ({ gstat: v.gstat, gline: v.gline })} className="mb-3"><Field label="Stat"><NativeSelect name="gstat" options={Object.entries(STATS).map(([k, v]: any) => [k, v.label])} defaultValue={gstat} /></Field><Field label="Line"><Input name="gline" type="number" step="0.5" defaultValue={gline} className="w-24" /></Field></LiveForm>
          {grid.data ? <><GridTable g={grid.data} teamIdx={idx} line={gline} /><Muted className="mt-2">{(STATS as any)[gstat].label} over {gline} across this team's last {grid.data.fx.length} {fmtName} fixtures. A dash means the player was not in the XI; VOID means he was in the XI but did not {(STATS as any)[gstat].side === "bat" ? "bat" : "bowl"}, so the bet is void.</Muted></> : <ListSkeleton rows={4} />}
        </TabsContent>}
        <TabsContent value="markets">{form}{res.data ? <ResultView r={res.data} /> : <ListSkeleton rows={4} />}</TabsContent>
        <TabsContent value="top"><h2 className="mb-2 text-xl font-medium">{isTeam ? "Top batter (team batting first)" : "Top batter in the match"}</h2>{top.data ? <ResultView r={top.data} /> : <ListSkeleton rows={4} />}</TabsContent>
      </PillTabs>
      {isTeam && <Card className="mt-4 gap-1 px-4 py-4 shadow-none"><h3 className="text-lg font-medium">About {label}</h3><Muted>{label} {fmtName} stats: match markets (sixes, fours, 30s, 50s, highest over, top batter) and a player grid for the last fixtures. Every figure is computed from ball-by-ball data and shown with its sample size. Fair price are 1 ÷ hit rate and carry no margin.</Muted></Card>}
      <Link to="/teams" className="sr-only">Teams</Link>
    </div>
  );
}
