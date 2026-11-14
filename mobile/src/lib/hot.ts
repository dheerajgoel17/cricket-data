/* eslint-disable @typescript-eslint/no-explicit-any */
// Hot props: every priced line of a day scored against the player's history (hit rate over the last 5 / 10 games, this year, against today's opponent, at the ground), as the
// site's `useHotRows` does (site/src/components/app/hot-props.tsx, a React hook and so not importable). The scoring itself is the shared engine; this is the same loop around it.
import { booksOf, groupByChip, lineKey, scoreLine, seedRow } from "@cricket/engine/hot-rows.js";
import { prioritizeHotGroups, shouldPublishHot } from "@/lib/hot-priority";
import { span } from "@/lib/perf";
import { byShard, hotDay, hotLines, pool, type HotScope } from "@site/lib/hot-lines";

export const MAX_ROWS = 30;
/** Player files fetched at a time: several at once (they are latency-bound), few enough that the first ones land early. */
const SHARDS_AT_ONCE = 8;
/** The first scored row is shown at once; after that, rows already scored are shown at most this often while the rest are still coming. */
const PUBLISH_MS = 600;

export type Quote = { source: string; name: string; line: number; over: number | null; under: number | null; best: boolean; underAt?: { line: number; price: number }; underOnly?: boolean; live?: boolean; opened?: number };
export interface Row {
  comp: string; day: number; idx: number; pid: string; inn: number; name: string; bookName: string; settled?: number | null; stored?: number | null; team: string; opp: string; stat: string;
  line: number; fmt: string; match: string; start: string; over: number; under: number; quotes: Quote[]; prior: number | null; l5: any; l10: any; season: any; h2h: any; ven: any; venue: string;
  edge: number | null; side?: "over" | "under"; last: { v: number | null; s: string }[]; max: number;
}

const rest = () => new Promise<void>((r) => setTimeout(r, REST_MS));
// A screen refreshes every 16 ms. Scoring is all synchronous work: after FRAME_MS of it the loop rests for REST_MS, so on a slow phone the JS thread is busy two thirds of the time at most and
// touches, scrolls and re-renders always get their turn (the lines take longer to all arrive, and the rows appear as they do).
const FRAME_MS = 8, REST_MS = 4;

/** The rows for one day of priced lines, or for one match (`scope`: `{ day }` or `{ teams, archive }`). `onRows` is given the rows so far while the player files are still coming in. */
export async function scoreHotRows({ store, rz, loadStore, lines, fixtures, scope, now = Date.now(), onRows, seed, names = null }: { store?: any; rz?: any; loadStore?: () => Promise<{ store: any; rz: any }>; lines: any[]; fixtures: any[]; scope: HotScope; now?: number; onRows?: (rows: Row[]) => void; seed?: Record<string, any> | null; names?: Record<string, string> | null }): Promise<Row[]> {
  const todays = hotLines(lines || [], scope, now);
  // one row per player, stat and match: a series has several matches between the same sides, each priced on its own. A live line is a row of its own beside the pre-match one (that stays: it is the bet we settle).
  const keys = new Map<string, any>();
  for (const l of todays) keys.set(lineKey(l), l);
  const year = String(new Date().getFullYear());
  const out: Row[] = [];
  const byChip = groupByChip(todays);
  let plan = 0, shardMs = 0;
  const tAll = Date.now();
  // lines the published file already scored (the history part; the prices are the books' own, now) need no player files and no plan: they are rows at once
  const todo: any[] = [];
  for (const l of keys.values()) {
    const row = seed ? seedRow({ store, l, b: booksOf(l, byChip, now), rec: seed[lineKey(l)], names }) : null;
    if (row) out.push({ ...row, day: hotDay(row.start, l.fmt, now) }); else todo.push(l);
  }
  if (out.length) onRows?.([...out]);
  if (!todo.length) { span("scoreHotRows", tAll, `lines=${keys.size} rows=${out.length} seeded=${out.length}`); return out; }
  if (!store) ({ store, rz } = await loadStore!());
  const score = async (l: any) => {
    const tp = Date.now();
    const r = await scoreLine({ store, rz, l, byChip, fixtures, now, year, names });
    plan += Date.now() - tp;
    if (r) out.push({ ...r, day: hotDay(r.start, l.fmt, now) });
  };
  // A file's lines are scored as soon as it is in, a few plans at once, giving the main thread back in between so the screen stays alive while the batch runs.
  let published = 0, sliceStart = Date.now();
  // matches already on come first, so the rows the screen leads with are the first scored
  await pool(prioritizeHotGroups(byShard(todo, (pid) => store.P.id.indexOf(pid), (i) => store.shardOf(i)), now), SHARDS_AT_ONCE, async (g) => {
    const ts = Date.now();
    await store.shard(g.shard).catch(() => {});
    shardMs += Date.now() - ts; // a file that does not load costs its own rows (the plan answers "not ok" for them), not the screen
    for (const l of g.lines) { await score(l); if (Date.now() - sliceStart >= FRAME_MS) { await rest(); sliceStart = Date.now(); } }
    if (shouldPublishHot(out.length, published, Date.now(), 1, PUBLISH_MS)) { published = Date.now(); onRows?.([...out]); }
  });
  span("scoreHotRows", tAll, `lines=${keys.size} rows=${out.length} runPlanMs=${plan} shardWaitMs(sum)=${shardMs}`);
  return out;
}
