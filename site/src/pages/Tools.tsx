/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { parseQuestion } from "@/engine/nl.js";
import { runPlan } from "@/engine/plan.js";
import { FORMATS } from "@/engine/util.js";
import { useData } from "@/lib/data";
import { askApi, loadProps } from "@/lib/feeds";
import { fromIst, localWhen, odds } from "@/lib/format";
import { setTitle } from "@/lib/title";
import { Field, HOME_AWAY, NativeSelect, useGo, useQ } from "@/components/app/forms";
import { PlayerPicker } from "@/components/app/player-picker";
import { Input } from "@/components/ui/input";
import { Crumbs, EmptyNote, Muted, OddsText, PageTitle } from "@/components/app/page";
import { ResultView } from "@/components/app/result";
import { useRunPlan } from "@/hooks/useEngine";
import { ListSkeleton } from "@/components/app/skeletons";

// ------------------------------------------------------------------ Prop Hunter
export function PropsPage() {
  setTitle("Prop Hunter: value cricket props");
  const { rz } = useData();
  const { data, isLoading } = useQuery({ queryKey: ["props-feed"], queryFn: loadProps });
  if (isLoading) return <Muted className="py-6">Loading value bets…</Muted>;
  const snap = data?.snap;
  if (!snap) return <EmptyNote>Prop Hunter data is not available yet.</EmptyNote>;
  const now = Date.now();
  const bets = (snap.value_bets || []).filter((b: any) => !b.start_utc || Date.parse(b.start_utc) > now - 3600e3).sort((a: any, b: any) => b.edge_pct - a.edge_pct);
  const hist = (snap.recent_alerts || []).slice().reverse().filter((b: any) => !bets.some((x: any) => x.selection === b.selection && x.match === b.match));
  const link = (b: any) => { const nm = (b.player_matched_as || (b.selection || "").replace(/\s+(over|under|\d+\+).*$/i, "")).trim(); const p = nm && rz.player(nm); return p ? <Link className="text-primary hover:underline" to={`/player/${p.idx}`}>{b.selection}</Link> : b.selection; };
  const BetCard = ({ b }: { b: any }) => (
    <Card className="gap-2 px-4 py-4 shadow-none">
      <div className="flex items-center justify-between gap-2"><span className="text-sm text-muted-foreground" title="your local time">{localWhen(b.start_utc || fromIst(b.start_ist) || fromIst(b.alerted_at_ist)) || b.start_ist || b.alerted_at_ist || ""}</span>{b.edge_pct != null ? <Badge className="bg-primary/15 text-primary">{`+${b.edge_pct}%`}</Badge> : null}</div>
      <div className="font-semibold">{link(b)}<small className="block font-normal text-muted-foreground">{b.match}</small></div>
      <div className="text-xl font-medium text-primary">{b.market}</div>
      <div className="flex gap-6"><Fig v={odds(b.best_odds)} l={b.best_source || "Best price"} /><Fig v={odds(b.fair_odds)} l="Fair price" /><Fig v={b.kelly_quarter_stake_pct != null ? `${b.kelly_quarter_stake_pct}%` : "–"} l="¼-Kelly" /></div>
      {b.why ? <Muted>{b.why}</Muted> : null}
    </Card>);
  return (
    <div>
      <Crumbs items={[["Home", "/"], ["Prop Hunter"]]} />
      <PageTitle sub="Player-prop value bets for upcoming matches, produced hourly by the repo's value-bets pipeline (free price sources vs the model). Decimal prices. Not betting advice: most edges are information the model lacks (XIs, batting order, pitch, injuries).">Prop Hunter</PageTitle>
      <p className="mb-3 text-sm"><Badge variant={data?.live ? "default" : "secondary"}>{data?.live ? "live from GitHub" : "bundled snapshot"}</Badge> generated {snap.generated_at_ist || "?"}</p>
      {bets.length ? <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">{bets.map((b: any, i: number) => <BetCard key={i} b={b} />)}</div>
        : <Card className="gap-1 px-4 py-4 shadow-none"><p>No value bets passed the filters in the latest run.</p><Muted>Markets priced: {snap.stats?.markets_in_window ?? "?"} across {snap.stats?.events_in_window ?? "?"} matches in the next 24 h; sources: {Object.entries(snap.sources || {}).map(([k, v]: any) => `${k} ${v.status}`).join(", ") || "n/a"}.</Muted></Card>}
      {hist.length ? <><h2 className="mb-2 mt-6 text-xl font-medium">Recent alerts</h2><div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">{hist.slice(0, 12).map((b: any, i: number) => <BetCard key={i} b={b} />)}</div></> : null}
    </div>
  );
}
const Fig = ({ v, l }: { v: string; l: string }) => <div><b className="block text-xl font-extrabold tabular-nums text-primary">{v}</b><span className="text-xs text-muted-foreground">{l}</span></div>;

// ------------------------------------------------------------------ Ask
const EXAMPLES = ["Harry Brook ODI sixes over 0.5 away from England", "when Banton and Duckett open, who gets out first", "Jos Buttler T20 fours under 1.5 chasing last 20", "Babar Azam ODI runs over 49.5 vs India", "IPL match sixes at Wankhede", "England T20 team sixes batting first"];

/** LLM -> plan (only a structured query, validated by sanitizePlan), with a built-in parser fallback. Numbers always come from the engine. */
async function interpret(store: any, rz: any, question: string) {
  const llm = await askApi(question);
  const local = parseQuestion(question, rz, store);
  if (llm?.plan && llm.plan.kind !== "unknown") {
    const res = await runPlan(store, rz, llm.plan);
    if (res.ok) return { res, source: `AI parse (${llm.model || "Gemini free tier"}) · numbers computed from the data` };
    const res2 = await runPlan(store, rz, local);
    if (res2.ok) return { res: res2, source: "built-in parser (the AI reading could not be resolved)" };
    return { res, source: "AI parse" };
  }
  return { res: await runPlan(store, rz, local), source: llm?.error ? "built-in parser (AI unavailable)" : "built-in parser" };
}

export function AskPage() {
  setTitle("Ask anything about cricket stats");
  const { store, rz } = useData();
  const [q, setQ] = useQ();
  const [text, setText] = useState(q.q || "");
  const [asked, setAsked] = useState(q.q || "");
  const run = useQuery({ queryKey: ["ask", asked], enabled: !!asked.trim(), queryFn: () => interpret(store, rz, asked.trim()) });
  const submit = (t: string) => { if (!t.trim()) return; setAsked(t); setQ({ q: t }); };
  return (
    <div>
      <PageTitle sub="Write your question your own way. A free AI model only turns it into a structured query; the site then runs that query on the real data and shows the filters used and the sample size.">Ask anything</PageTitle>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Harry Brook ODI sixes over 0.5 away from England" aria-label="Your question" maxLength={300} />
        <div className="flex flex-wrap items-center gap-3"><Button type="submit" className="rounded-full font-semibold" disabled={run.isFetching}>{run.isFetching ? "Working…" : "Ask"}</Button><Muted>Typos are fine. Numbers always come from the data, never from the AI.</Muted></div>
        <div className="flex flex-wrap gap-2">{EXAMPLES.map((x) => <Button key={x} type="button" size="sm" variant="secondary" className="rounded-full font-normal" onClick={() => { setText(x); submit(x); }}>{x}</Button>)}</div>
      </form>
      <div className="mt-4">{run.isFetching ? <Muted>Reading your question…</Muted> : run.data ? <ResultView r={run.data.res} source={run.data.source} /> : run.error ? <EmptyNote>{(run.error as Error).message}</EmptyNote> : null}</div>
    </div>
  );
}

// ------------------------------------------------------------------ Partnerships
export function PairPage() {
  setTitle("Batting partnerships");
  const { store } = useData();
  const [q] = useQ();
  const go = useGo();
  const [a, setA] = useState<number | null>(q.a != null ? Number(q.a) : null), [b, setB] = useState<number | null>(q.b != null ? Number(q.b) : null);
  const [fmt, setFmt] = useState(q.fmt || ""), [open, setOpen] = useState(q.open === "1"), [opp, setOpp] = useState(q.opp || ""), [ven, setVen] = useState(q.venue || ""), [vt, setVt] = useState(q.vt || "");
  const ready = Number.isFinite(Number(q.a)) && q.a != null && q.b != null;
  const res = useRunPlan({ kind: "partnership", opening: q.open === "1", filters: { format: q.fmt || null, opposition: q.opp || null, venue_type: q.vt || null }, venue: q.venue || null }, { playerIdx: Number(q.a), player2Idx: Number(q.b) }, ready);
  return (
    <div>
      <Crumbs items={[["Home", "/"], ["Partnerships"]]} />
      <PageTitle sub="For any pair: who is dismissed first, stand sizes, split by format, opposition and venue. Needs ball-by-ball data, so only matches in the base data count.">Partnerships</PageTitle>
      <datalist id="dl-teams">{[...new Set<string>(store.teams.map((t: any) => t.n))].map((n) => <option key={n} value={n} />)}</datalist>
      <datalist id="dl-venues">{store.venues.map((n: string) => <option key={n} value={n} />)}</datalist>
      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border p-4" onSubmit={(e) => { e.preventDefault(); go("pair", { a, b, fmt, open: open ? "1" : "", opp, venue: ven, vt }); }}>
        <Field label="Batter 1"><PlayerPicker placeholder="Batter 1 (e.g. Duckett)" initial={a} onPick={setA} /></Field>
        <Field label="Batter 2"><PlayerPicker placeholder="Batter 2 (e.g. Banton)" initial={b} onPick={setB} /></Field>
        <Field label="Format"><NativeSelect name="fmt" options={[["", "auto"], ...FORMATS.map((f: string) => [f, f] as [string, string])]} defaultValue={fmt} onChange={(e) => setFmt(e.target.value)} /></Field>
        <Field label="Opening pair only"><label className="flex h-10 items-center"><Checkbox checked={open} onCheckedChange={(v) => setOpen(v === true)} /></label></Field>
        <Field label="Opposition"><Input list="dl-teams" value={opp} onChange={(e) => setOpp(e.target.value)} className="w-40" /></Field>
        <Field label="Venue"><Input list="dl-venues" value={ven} onChange={(e) => setVen(e.target.value)} className="w-44" /></Field>
        <Field label="Home/away"><NativeSelect name="vt" options={HOME_AWAY} defaultValue={vt} onChange={(e) => setVt(e.target.value)} /></Field>
        <Button type="submit" className="rounded-full font-semibold">Compare</Button>
      </form>
      {!ready ? <Muted>Pick two batters to see who gets out first, and how big their stands are.</Muted> : res.data ? <ResultView r={res.data} /> : <ListSkeleton rows={4} />}
    </div>
  );
}
void OddsText;
