/* eslint-disable @typescript-eslint/no-explicit-any */
import { STATS } from "@cricket/engine/rules.js";
import { FORMATS } from "@cricket/engine/util.js";

export interface Grid { fx: number[]; body: { p: number; map: Map<number, any>; xi: any; n: number }[]; def?: any }

/** StatsHub-style grid data: the team's last fixtures in a format, and each player's stat in them. Shared by fixture, team and trends pages. */
export async function collectGrid(store: any, teamIdx: number, fmtName: string, stat: string, nFx = 10): Promise<Grid> {
  nFx = Math.max(3, Math.min(30, Number(nFx) || 10));
  const fmt = FORMATS.indexOf(fmtName), M = store.M, def = (STATS as any)[stat];
  const fx: number[] = [];
  for (let m = store.n - 1; m >= 0 && fx.length < nFx; m--) if (M.f[m] === fmt && (M.a[m] === teamIdx || M.b[m] === teamIdx)) fx.push(m);
  fx.reverse();
  if (!fx.length) return { fx, body: [], def };
  const cutoff = M.d[fx[0]];
  const cand: number[] = [];
  for (let i = 0; i < store.P.id.length; i++) if (store.P.tm[i] === teamIdx && store.P.last[i] >= cutoff && ((store.P.fm[i] >> fmt) & 1)) cand.push(i);
  cand.sort((x, y) => store.P.n[y] - store.P.n[x]);
  const rows = await Promise.all(cand.slice(0, 22).map(async (p) => {
    const r = await store.playerRows(p);
    const list = (def.side === "bat" ? r.bat : r.bowl).filter((x: any) => x.fmt === fmt && x.t === teamIdx);
    return { p, map: new Map<number, any>(list.map((x: any) => [x.m, x])), xi: r.xi };
  }));
  const body = rows.map((r) => ({ ...r, n: fx.filter((m) => r.map.has(m)).length })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n).slice(0, 15);
  return { fx, body, def };
}
