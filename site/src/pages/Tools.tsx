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
import { fromIst, localWhen, odds } from "@/lib/format";
import { setTitle } from "@/lib/title";
import { Field, HOME_AWAY, NativeSelect, useGo, useQ } from "@/components/app/forms";
import { PlayerPicker } from "@/components/app/player-picker";
import { Input } from "@/components/ui/input";
import { Crumbs, EmptyNote, Muted, OddsText, PageTitle } from "@/components/app/page";
import { ResultView } from "@/components/app/result";
import { useRunPlan } from "@/hooks/useEngine";
import { ListSkeleton } from "@/components/app/skeletons";

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
