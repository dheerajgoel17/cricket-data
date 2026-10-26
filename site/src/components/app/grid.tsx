/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { STATS } from "@/engine/rules.js";
import { useData } from "@/lib/data";
import type { Grid } from "@/lib/grid";
import { num, odds, pc, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PlayerBadge, TeamBadge } from "./badges";
import { EmptyNote, Muted, OddsText } from "./page";

/** Players down, the team's last fixtures across; a cell is the stat value (green when it clears the line). */
export function GridTable({ g, teamIdx, line }: { g: Grid; teamIdx: number; line: number }) {
  const { store } = useData(), M = store.M;
  if (!g.fx.length) return <Muted>No fixtures for this format.</Muted>;
  return (
    <Card className="overflow-x-auto py-0 shadow-none">
      <table className="w-full text-sm">
        <thead><tr className="border-b text-muted-foreground">
          <th className="px-3 py-2 text-left font-condensed text-[13px] font-normal uppercase">Player</th><th className="px-2 font-condensed text-[13px] font-normal uppercase">Hit</th>
          {g.fx.map((m) => { const opp = M.a[m] === teamIdx ? M.b[m] : M.a[m]; return <th key={m} className="px-1 py-2 font-normal"><div className="grid justify-items-center gap-0.5 text-[10.5px]"><TeamBadge name={store.teamName(opp, true)} size="xs" />{shortDate(M.d[m])}</div></th>; })}
        </tr></thead>
        <tbody>{g.body.map(({ p, map, xi }) => {
          const vals = g.fx.filter((m) => map.has(m)).map((m) => map.get(m)[g.def.key]);
          const k = vals.filter((v: number) => v > line).length;
          return (
            <tr key={p} className="border-b last:border-b-0">
              <td className="whitespace-nowrap px-3 py-1.5"><Link to={`/player/${p}`} className="flex items-center gap-2 hover:text-primary"><PlayerBadge idx={p} size="xs" />{store.playerName(p)}</Link></td>
              <td className="px-2 text-center font-semibold text-primary">{vals.length ? `${k}/${vals.length}` : "–"}</td>
              {g.fx.map((m) => { const x = map.get(m); return (
                <td key={m} className="px-1 py-1 text-center">{x ? <span className={cn("inline-block min-w-8 rounded-md px-1.5 py-0.5 font-semibold", x[g.def.key] > line ? "bg-primary/20 text-primary" : "bg-destructive/15 text-destructive")}>{x[g.def.key]}</span>
                  : xi?.has(m) && store.M.xq?.[m] !== 0 ? <span title="In the XI but did not bat/bowl: bet void" className="rounded-md border border-dashed border-amber/60 px-1 text-[11px] text-amber">VOID</span> : <span className="text-muted-foreground">–</span>}</td>); })}
            </tr>);
        })}</tbody>
      </table>
    </Card>
  );
}

/** Players whose recent games clear the line most often (StatsHub "player trends" cards). */
export function TrendCards({ grids, line, minHit, stat }: { grids: { g: Grid; team: number }[]; line: number; minHit: number; stat: string }) {
  const { store } = useData();
  const items: any[] = [];
  for (const { g, team } of grids) for (const r of g.body) {
    const played = g.fx.filter((m) => r.map.has(m));
    const vals = played.map((m) => r.map.get(m)[g.def.key] as number);
    if (vals.length < 5) continue;
    const k = vals.filter((v) => v > line).length;
    items.push({ p: r.p, team, vals, k, rate: k / vals.length });
  }
  items.sort((a, b) => b.rate - a.rate || b.vals.length - a.vals.length);
  const list = items.filter((i) => i.rate >= minHit).slice(0, 24);
  if (!list.length) return <EmptyNote>No player clears that hit rate in the last games. Lower the hit-rate filter or line.</EmptyNote>;
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
      {list.map((i, n) => (
        <motion.div key={`${i.p}-${i.team}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(n * 0.025, 0.4) }} whileHover={{ y: -2 }}>
          <Link to={`/player/${i.p}`}>
            <Card className="gap-2 px-4 py-4 shadow-none hover:border-[#3a3a3a]">
              <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-3 font-semibold"><PlayerBadge idx={i.p} size="md" /><div>{store.playerName(i.p)}<small className="block font-normal text-muted-foreground">{store.teamName(i.team)}</small></div></div>
                <span className="rounded-full bg-secondary px-3.5 py-1.5 text-sm font-semibold">O {line} <OddsText>{odds(i.rate ? 1 / i.rate : null)}</OddsText></span></div>
              <div className="text-xl font-medium text-primary">{(STATS as any)[stat].label} over {line}</div>
              <div className="flex gap-6"><Stat v={`${i.k}/${i.vals.length}`} l="Record" /><Stat v={pc(i.rate)} l="Hit rate" /><Stat v={num(i.vals.reduce((a: number, b: number) => a + b, 0) / i.vals.length)} l="Avg" /></div>
              <div className="flex gap-1.5 overflow-x-auto pt-1">{i.vals.slice(-10).map((v: number, j: number) => <span key={j} className={cn("min-w-9 rounded-lg px-2 py-2 text-center text-[15px] font-extrabold", v > line ? "bg-primary/20 text-primary" : "bg-destructive/15 text-destructive")}>{v}</span>)}</div>
            </Card>
          </Link>
        </motion.div>))}
    </div>
  );
}
const Stat = ({ v, l }: { v: string; l: string }) => <div><b className="block text-xl font-extrabold tabular-nums text-primary">{v}</b><span className="text-xs text-muted-foreground">{l}</span></div>;
