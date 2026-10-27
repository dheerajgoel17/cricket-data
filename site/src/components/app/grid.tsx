/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { STATS } from "@/engine/rules.js";
import { useData } from "@/lib/data";
import type { Grid } from "@/lib/grid";
import { odds, pc, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PlayerBadge, TeamFlag } from "./badges";
import { EmptyNote, Muted } from "./page";
import { MiniBars } from "./mini-bars";

/** Players down, the team's last fixtures across; a cell is the stat value (green when it clears the line). */
export function GridTable({ g, teamIdx, line }: { g: Grid; teamIdx: number; line: number }) {
  const { store } = useData(), M = store.M;
  if (!g.fx.length) return <Muted>No fixtures for this format.</Muted>;
  return (
    <Card className="overflow-x-auto rounded-2xl border-0 py-0 shadow-none ring-1 ring-white/5">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-white/10 text-muted-foreground">
          <th className="sticky left-0 z-10 bg-card px-3 py-2.5 text-left text-xs font-medium">Player</th><th className="px-2 text-xs font-medium">Hit</th>
          {g.fx.map((m) => { const opp = M.a[m] === teamIdx ? M.b[m] : M.a[m]; return <th key={m} className="px-1 py-2 font-normal"><div className="grid justify-items-center gap-1 text-[10.5px]"><TeamFlag name={store.teamName(opp, true)} className="h-3.5 w-5" />{shortDate(M.d[m])}</div></th>; })}
        </tr></thead>
        <tbody>{g.body.map(({ p, map, xi }) => {
          const vals = g.fx.filter((m) => map.has(m)).map((m) => map.get(m)[g.def.key]);
          const k = vals.filter((v: number) => v > line).length;
          return (
            <tr key={p} className="border-b border-white/5 last:border-b-0">
              <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-3 py-2"><Link to={`/player/${p}`} className="flex items-center gap-2 hover:text-primary"><PlayerBadge idx={p} size="xs" />{store.playerName(p)}</Link></td>
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

/** Players whose recent games clear the line most often, as light list rows (photo, line and record, hit rate, last-10 bars). */
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
  const label = (STATS as any)[stat].label;
  return (
    <ul className="-mx-4 sm:mx-0">
      {list.map((i, n) => (
        <motion.li key={`${i.p}-${i.team}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(n, 6) * 0.025, duration: 0.3 }}
          className="relative after:absolute after:bottom-0 after:left-[68px] after:right-0 after:h-px after:bg-white/10 last:after:hidden">
          <Item asChild size="sm" className="rounded-none border-0 px-3 py-3 transition-colors active:bg-card">
            <Link to={`/player/${i.p}`}>
              <ItemMedia><PlayerBadge idx={i.p} size="md" /></ItemMedia>
              <ItemContent className="min-w-0 gap-0.5">
                <ItemTitle className="max-w-full"><span className="truncate">{store.playerName(i.p)}</span><TeamFlag name={store.teamName(i.team)} /></ItemTitle>
                <ItemDescription className="truncate text-[13px]"><span className="text-primary">O {line} {label}</span> <span className="text-muted-foreground">· {i.k}/{i.vals.length}</span></ItemDescription>
              </ItemContent>
              <ItemActions className="gap-3">
                <span className="grid justify-items-end text-right"><b className="text-base font-semibold tabular-nums text-primary">{pc(i.rate)}</b><span className="text-[11px] text-muted-foreground">fair {odds(i.rate ? 1 / i.rate : null)}</span></span>
                <MiniBars last={i.vals.slice(-10).map((v: number) => ({ v, s: v > line ? "hit" : v < line ? "miss" : "push" }))} line={line} />
              </ItemActions>
            </Link>
          </Item>
        </motion.li>))}
    </ul>
  );
}
