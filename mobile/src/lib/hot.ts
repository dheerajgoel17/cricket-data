/* eslint-disable @typescript-eslint/no-explicit-any */
// Hot props: every priced line of a day scored against the player's history (hit rate over the last 5 / 10 games, this year, against today's opponent, at the ground), as the
// site's `useHotRows` does (site/src/components/app/hot-props.tsx, a React hook and so not importable). The scoring itself is the shared engine; this is the same loop around it.
import { bookLinesFor, bookQuotes, keepMsFor, lineScope, sameFixture } from "@cricket/engine/lines.js";
import { venueStem } from "@cricket/engine/markets.js";
import { runPlan } from "@cricket/engine/plan.js";
import { barState, windowRate } from "@cricket/engine/windows.js";
import { span } from "@/lib/perf";
import { byShard, hotDay, hotLines, matchChipId, norm, pool, type HotScope } from "@site/lib/hot-lines";

export const MAX_ROWS = 30;
/** Player files fetched at a time: several at once (they are latency-bound), few enough that the first ones land early. */
const SHARDS_AT_ONCE = 8;
/** Rows already scored are shown at most this often while the rest are still coming. */
const PUBLISH_MS = 1200;

export type Quote = { source: string; name: string; line: number; over: number | null; under: number | null; best: boolean; underAt?: { line: number; price: number }; underOnly?: boolean };
export interface Row {
  comp: string; day: number; idx: number; pid: string; inn: number; name: string; bookName: string; settled?: number | null; stored?: number | null; team: string; opp: string; stat: string;
  line: number; fmt: string; match: string; start: string; over: number; under: number; quotes: Quote[]; prior: number | null; l5: any; l10: any; season: any; h2h: any; ven: any; venue: string;
  edge: number | null; side?: "over" | "under"; last: { v: number | null; s: string }[]; max: number;
}

const rest = () => new Promise<void>((r) => setTimeout(r, REST_MS));
// A screen refreshes every 16 ms. Scoring is all synchronous work: after FRAME_MS of it the loop rests for REST_MS, so on a slow phone the JS thread is busy a third of the time at most and
// touches, scrolls and re-renders always get their turn (the lines take longer to all arrive, and the rows appear as they do).
const FRAME_MS = 6, REST_MS = 12;

/** The rows for one day of priced lines, or for one match (`scope`: `{ day }` or `{ teams, archive }`). `onRows` is given the rows so far while the player files are still coming in. */
export async function scoreHotRows({ store, rz, lines, fixtures, scope, now = Date.now(), onRows }: { store: any; rz: any; lines: any[]; fixtures: any[]; scope: HotScope; now?: number; onRows?: (rows: Row[]) => void }): Promise<Row[]> {
  const todays = hotLines(lines || [], scope, now);
  // one row per player, stat and match: a series has several matches between the same sides, each priced on its own
  const keys = new Map<string, any>();
  for (const l of todays) keys.set(`${l.pid}|${l.stat}|${l.fmt}|${matchChipId(l.match, l.start_utc, l.fmt)}|${lineScope(l)}`, l);
  const year = String(new Date().getFullYear());
  const out: Row[] = [];
  let plan = 0, shardMs = 0;
  const tAll = Date.now();
  const score = async (l: any) => {
    const idx = store.P.id.indexOf(l.pid);
    const inn = lineScope(l);
    const chip = matchChipId(l.match, l.start_utc, l.fmt);
    const b = bookLinesFor({ lines: todays.filter((x: any) => matchChipId(x.match, x.start_utc, x.fmt) === chip) }, l.pid, l.stat, l.fmt, now, keepMsFor(l.fmt), inn);
    if (idx < 0 || !b) return;
    const main = b.main, over = Math.max(...main.books.map((x: any) => x.over || 0)), under = Math.max(...main.books.map((x: any) => x.under || 0));
    const tp = Date.now();
    const r: any = await runPlan(store, rz, { kind: "player_prop", stat: l.stat, line: main.line, side: "over", filters: { format: l.fmt, team_innings: inn || null, innings: null }, split_by: [] }, { playerIdx: idx });
    plan += Date.now() - tp;
    const entries: any[] = r?.ok ? r.chart?.entries || [] : [];
    if (!entries.length) return;
    const [a, c] = String(b.match).split(/\s+vs\s+/i);
    const opp = norm(l.team) === norm(a) ? c : a;
    const l5 = windowRate(entries, 5, main.line), l10 = windowRate(entries, 10, main.line);
    const season = windowRate(entries.filter((e) => String(e.date).startsWith(year)), 0, main.line);
    const h2h = windowRate(entries.filter((e) => norm(e.opp) === norm(opp)), 0, main.line);
    const venue = String((fixtures || []).find((f: any) => sameFixture({ match: b.match, start_utc: b.start_utc, fmt: l.fmt }, f))?.venue || "");
    const ven = windowRate(venue ? entries.filter((e) => venueStem(e.venueName) === venueStem(venue)) : [], 0, main.line); // his games at the match's ground (the data spells a ground several ways)
    const last = entries.slice(-10).map((e) => ({ v: e.value as number | null, s: barState(e, main.line) as string }));
    // once the match itself is in the data its result is his latest game: same opponent, within a day of the start
    const lastE = entries[entries.length - 1];
    const settled: number | null | undefined = lastE && norm(lastE.opp) === norm(opp) && Math.abs(Date.parse(String(lastE.date)) - Date.parse(String(b.start_utc).slice(0, 10))) <= 86400e3 ? lastE.value : undefined;
    out.push({
      comp: String(b.competition || l.competition || ""), day: hotDay(b.start_utc, l.fmt, now), idx, pid: l.pid, inn,
      name: /^[0-9a-f]{8}$/.test(store.playerName(idx)) ? l.book_name || store.playerName(idx) : store.playerName(idx), bookName: l.book_name || "", team: l.team, opp, stat: l.stat, line: main.line,
      fmt: l.fmt, match: b.match, start: b.start_utc, over, under, quotes: bookQuotes(b.lines), l5, l10, season, h2h, ven, venue, prior: main.prob ?? null, edge: null, last, settled, stored: l.result ?? null,
      max: Math.max(main.line * 1.5, ...last.map((x) => x.v ?? 0), 1),
    });
  };
  // A file's lines are scored as soon as it is in, a few plans at once, giving the main thread back in between so the screen stays alive while the batch runs.
  let published = 0, sliceStart = Date.now();
  await pool(byShard([...keys.values()], (pid) => store.P.id.indexOf(pid), (i) => store.shardOf(i)), SHARDS_AT_ONCE, async (g) => {
    const ts = Date.now();
    await store.shard(g.shard).catch(() => {});
    shardMs += Date.now() - ts; // a file that does not load costs its own rows (the plan answers "not ok" for them), not the screen
    for (const l of g.lines) { await score(l); if (Date.now() - sliceStart >= FRAME_MS) { await rest(); sliceStart = Date.now(); } }
    if (out.length >= MAX_ROWS && Date.now() - published >= PUBLISH_MS) { published = Date.now(); onRows?.([...out]); }
  });
  span("scoreHotRows", tAll, `lines=${keys.size} rows=${out.length} runPlanMs=${plan} shardWaitMs(sum)=${shardMs}`);
  return out;
}
