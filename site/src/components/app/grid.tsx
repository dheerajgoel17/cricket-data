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
import { heatClass, heatStep } from "@/lib/heat";
import { PlayerBadge, TeamBadge, TeamFlag } from "./badges";
import { EmptyNote, Muted } from "./page";
import { MiniBars } from "./mini-bars";

/** Players down, the team's last fixtures across. A cell is the stat value; colour is a heat step from how far it sits from the line. */
export function GridTable({ g, teamIdx, line }: { g: Grid; teamIdx: number; line: number }) {
  const { store } = useData(), M = store.M;
  if (!g.fx.length) return <Muted>No fixtures for this format.</Muted>;
  return (
    <Card className="overflow-x-auto rounded-2xl border-0 py-0 shadow-none ring-1 ring-hairline">
      <table className="w-full text-callout">
        <thead><tr className="border-b border-hairline text-muted-foreground">
          <th className="sticky left-0 z-10 bg-card px-3 py-tight text-left text-footnote font-medium">Player</th><th className="px-2 text-footnote font-medium">Hit</th>
          {g.fx.map((m) => { const opp = M.a[m] === teamIdx ? M.b[m] : M.a[m]; return <th key={m} className="px-1 py-tight font-normal"><div className="grid justify-items-center gap-hair text-caption"><TeamBadge name={store.teamName(opp, true)} size="xs" />{shortDate(M.d[m])}</div></th>; })}
        </tr></thead>
        <tbody>{g.body.map(({ p, map, xi }) => {
          const vals = g.fx.filter((m) => map.has(m)).map((m) => map.get(m)[g.def.key]);
          const k = vals.filter((v: number) => v > line).length;
          return (
            <tr key={p} className="border-b border-hairline last:border-b-0">
              <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-3 py-tight"><Link to={`/player/${p}`} className="flex items-center gap-tight hover:text-primary"><PlayerBadge idx={p} size="xs" />{store.playerName(p)}</Link></td>
              <td className="px-2 text-center font-semibold text-primary">{vals.length ? `${k}/${vals.length}` : "–"}</td>
              {g.fx.map((m) => { const x = map.get(m); return (
                <td key={m} className="px-1 py-hair text-center">{x ? <span className={cn("inline-block min-w-8 rounded-md px-1.5 py-hair font-semibold", heatClass(heatStep(x[g.def.key], line)))}>{x[g.def.key]}</span>
                  : xi?.has(m) && store.M.xq?.[m] !== 0 ? <span title="In the XI but did not bat/bowl: bet void" className="rounded-md border border-dashed border-amber/60 px-1 text-caption text-amber">VOID</span> : <span className="text-muted-foreground">–</span>}</td>); })}
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
          className="relative after:absolute after:bottom-0 after:left-[calc(var(--gutter)+3.5rem)] after:right-0 after:h-px after:bg-hairline last:after:hidden">
          <Item asChild size="sm" className="rounded-none border-0 px-gutter py-snug transition-colors active:bg-card">
            <Link to={`/player/${i.p}`}>
              <ItemMedia><PlayerBadge idx={i.p} size="md" /></ItemMedia>
              <ItemContent className="min-w-0 gap-hair">
                <ItemTitle className="max-w-full"><span className="truncate">{store.playerName(i.p)}</span><TeamFlag name={store.teamName(i.team)} /></ItemTitle>
                <ItemDescription className="truncate text-footnote"><span className="text-primary">O {line} {label}</span> <span className="text-muted-foreground">· {i.k}/{i.vals.length}</span></ItemDescription>
              </ItemContent>
              <ItemActions className="gap-snug">
                <span className="grid justify-items-end text-right"><b className="text-body font-semibold tabular-nums text-primary">{pc(i.rate)}</b><span className="text-caption text-muted-foreground">fair {odds(i.rate ? 1 / i.rate : null)}</span></span>
                <MiniBars last={i.vals.slice(-10).map((v: number) => ({ v, s: v > line ? "hit" : v < line ? "miss" : "push" }))} line={line} />
              </ItemActions>
            </Link>
          </Item>
        </motion.li>))}
    </ul>
  );
}
