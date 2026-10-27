/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { odds, num, pc } from "@/lib/format";
import { Chips, DataTable, Muted, OddsText, Panel, StatGridCards, StatTile } from "./page";
import { ChartBars } from "./chart";

const band = (p: number | null) => (p == null ? "" : p >= 0.6 ? "text-primary" : p >= 0.4 ? "text-amber" : "text-destructive");
export const HitCell = ({ p }: { p: number | null }) => (p == null ? <>–</> : <span className={`rounded-md bg-muted px-2 py-0.5 font-semibold ${band(p)}`}>{pc(p)}</span>);

export const LadderTable = ({ ladder, label = "Line" }: { ladder: any[]; label?: string }) => (
  <DataTable columns={[label, "Over %", "Fair over", "Under %", "Fair under", "n"]}
    rows={ladder.filter((l) => l.n).map((l) => [`${l.line}`, <HitCell p={l.pOver} />, <OddsText>{odds(l.fairOver)}</OddsText>, <HitCell p={l.pUnder} />, <OddsText>{odds(l.fairUnder)}</OddsText>, l.n])} />
);

export function SplitTables({ splits, title = (k: string) => k }: { splits: Record<string, any[]>; title?: (k: string) => string }) {
  const items = Object.entries(splits).filter(([, rows]) => rows.length);
  if (!items.length) return null;
  return (
    <Card className="px-4 shadow-none">
      <Accordion type="multiple" defaultValue={items.filter(([k]) => k === "opposition" || k === "venue_type").map(([k]) => k)}>
        {items.map(([kind, rows]) => (
          <AccordionItem key={kind} value={kind}>
            <AccordionTrigger><span className="flex flex-1 items-center gap-2">Split by {title(kind).replace("_", " ")} <Badge variant="secondary">{rows.length}</Badge></span></AccordionTrigger>
            <AccordionContent className="overflow-x-auto">
              <DataTable columns={[title(kind).replace("_", " "), "n", "Median", "Mean", "Over %", "Fair over"]} rows={rows.map((x) => [x.label, x.n, num(x.median), num(x.mean), <HitCell p={x.pOver} />, <OddsText>{odds(x.fairOver)}</OddsText>])} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Card>
  );
}

/** Turns a runPlan() result into UI. Every number shown here was computed by the engine from the data. */
export function ResultView({ r, source }: { r: any; source?: string }) {
  if (!r.ok) return <Card className="border-destructive px-4 py-3 shadow-none"><p>{r.error}</p></Card>;
  return (
    <div className="grid gap-3">
      <Card className="gap-1 border-l-4 border-l-primary px-4 py-3 shadow-none">
        {source ? <Badge variant="secondary" className="w-fit">{source}</Badge> : null}
        <h2 className="text-xl font-semibold leading-snug">{r.headline}</h2>
        <Muted>Sample size: {r.sample.n} {r.sample.unit}.</Muted>
        <Chips list={r.filters} />
      </Card>
      {r.kind === "player_prop" && <PlayerProp r={r} />}
      {r.kind === "partnership" && <Partnership r={r} />}
      {r.kind === "match_market" && r.tables.filter((t: any) => t.n).map((t: any) => (
        <Panel key={t.label} title={t.label}>
          <Muted>{`n=${t.n} · median ${num(t.summary.median)} · mean ${num(t.summary.mean)} · range ${num(t.summary.min)}–${num(t.summary.max)}`}</Muted>
          {t.summary.line != null && <p className="my-2">Over {t.summary.line}: {pc(t.summary.pOver)} (fair <OddsText>{odds(t.summary.fairOver)}</OddsText>) · Under: {pc(t.summary.pUnder)} (fair <OddsText>{odds(t.summary.fairUnder)}</OddsText>)</p>}
          <LadderTable ladder={t.ladder} />
        </Panel>
      ))}
      {r.kind === "top_batter" && <Panel flat><DataTable columns={["Batter", "Sole top", "Tied top", "Share (sole)", "Fair price"]} rows={r.rows.map((x: any) => [x.name, x.sole, x.tied, pc(x.pSole), <OddsText>{odds(x.fairSole)}</OddsText>])} /></Panel>}
      {r.notes?.length ? <Panel title="Notes"><ul className="list-disc pl-5 text-sm">{r.notes.map((n: string) => <li key={n}>{n}</li>)}</ul></Panel> : null}
      <Muted>{r.freshness}</Muted>
    </div>
  );
}

function PlayerProp({ r }: { r: any }) {
  const s = r.summary, side = r.plan.side || "over";
  const logs = r.chart ? [...r.chart.entries].reverse() : [];
  return (
    <>
      <StatGridCards>
        <StatTile k="Sample" v={String(s.n)} s={r.sample.unit} />
        <StatTile k="Median" v={num(s.median)} s={`mean ${num(s.mean)}`} />
        {s.line != null && s.n ? <>
          <StatTile k={`${side === "over" ? "Over" : "Under"} ${s.line}`} v={pc(side === "over" ? s.pOver : s.pUnder)} s={`${side === "over" ? s.over : s.under} of ${s.n}${s.push ? `, ${s.push} push` : ""}`} />
          <StatTile k="Fair decimal price" v={<OddsText>{odds(side === "over" ? s.fairOver : s.fairUnder)}</OddsText>} s={`other side ${odds(side === "over" ? s.fairUnder : s.fairOver)}`} />
        </> : null}
      </StatGridCards>
      {r.player.alternatives?.length ? <Muted>Also matched: {r.player.alternatives.join(", ")} (be more specific to pick another).</Muted> : null}
      {r.chart?.entries.length ? <Panel title={`${r.player.name}: ${r.statLabel}`}><ChartBars entries={r.chart.entries.slice(-20)} line={r.chart.line} side={r.chart.side} height={260} animateKey={r.title} />
        <div className="mt-2 text-center"><Link className="text-sm text-primary" to={`/player/${r.player.idx}?stat=${r.plan.stat}&line=${r.chart.line}&side=${r.chart.side}`}>Open the full player page →</Link></div></Panel> : null}
      {r.corr ? <Panel title={`Correlated props: when ${r.statLabel.toLowerCase()} ${side} ${r.chart?.line ?? r.line} hits`}>
        <Muted>{r.corr.n} of {r.corr.of} {r.sample.unit}. Shows how often his other props also clear in those games versus his normal rate.</Muted>
        <DataTable columns={["Prop", "Normal", "When it hits", "Lift"]} rows={r.corr.rows.map((c: any) => [`${c.label} over ${c.line}`, pc(c.base), pc(c.cond), `${c.lift >= 0 ? "+" : ""}${Math.round(c.lift * 100)}pp`])} /></Panel> : null}
      <Panel title="Game log" flat><DataTable columns={["Date", "Opponent", "Venue", r.statLabel, r.chart?.auxLabel || "", "No."]}
        rows={logs.map((e: any) => [e.date, e.opp, e.venueName || "", e.value == null ? <Badge variant="outline">{e.void ? "VOID: in XI, did not bat/bowl" : e.unknown ? "N/A: XI not recorded" : "DNP"}</Badge> : e.value, e.aux ?? "–", e.pos ?? "–"])} /></Panel>
      <h2 className="mt-2 text-xl font-medium">Hit rate at every line</h2>
      <Panel flat><LadderTable ladder={r.ladder} /></Panel>
      <SplitTables splits={r.splits} />
    </>
  );
}

function Partnership({ r }: { r: any }) {
  const s = r.summary;
  return (
    <>
      <StatGridCards>
        <StatTile k="Stands" v={String(s.n)} s={`${s.ended} ended by a dismissal`} />
        <StatTile k={`${s.nameA} out first`} v={pc(s.pFirstOutA)} s={`${s.aOut}× · fair ${odds(s.fairFirstOutA)}`} />
        <StatTile k={`${s.nameB} out first`} v={pc(s.pFirstOutB)} s={`${s.bOut}× · fair ${odds(s.fairFirstOutB)}`} />
        <StatTile k="Median stand" v={num(s.medianRuns)} s={`mean ${num(s.avgRuns)} runs, 50+ stands ${s.stand50}`} />
      </StatGridCards>
      <Card className="px-4 shadow-none"><Accordion type="multiple" defaultValue={["format"]}>
        {Object.entries(r.splits).filter(([, rows]: any) => rows.length).map(([kind, rows]: any) => (
          <AccordionItem key={kind} value={kind}><AccordionTrigger>Split by {kind}</AccordionTrigger>
            <AccordionContent className="overflow-x-auto"><DataTable columns={[kind, "n", `${s.nameA} out`, `${s.nameB} out`, "Fair A first", "Fair B first", "Median stand"]} rows={rows.map((x: any) => [x.label, x.n, x.aOut, x.bOut, odds(x.fairFirstOutA), odds(x.fairFirstOutB), num(x.medianRuns)])} /></AccordionContent></AccordionItem>
        ))}
      </Accordion></Card>
      {r.last.length ? <><h2 className="text-xl font-medium">Latest stands</h2><Panel flat><DataTable columns={["Date", "Opponent", "Venue", "Runs", "Balls", "Wicket", "First out"]} rows={r.last.map((x: any) => [x.date, x.opp, x.venue, x.runs, x.balls, x.wicket, x.out])} /></Panel></> : null}
      {r.together?.length ? <Card className="px-4 shadow-none"><Accordion type="single" collapsible><AccordionItem value="t"><AccordionTrigger>Matches both batted for the same team ({r.together.length})</AccordionTrigger>
        <AccordionContent className="overflow-x-auto"><DataTable columns={["Date", "Format", "Opponent", "Source"]} rows={r.together.slice(-30).reverse().map((t: any) => [t.date, t.fmt, t.opp, t.pv ? "provisional (totals only)" : "ball-by-ball"])} /></AccordionContent></AccordionItem></Accordion></Card> : null}
    </>
  );
}
