// The form of a prop card (L5 / last five / hit rates), read from the stats store in one format, never mixed. Shared by api/og.js (Node) and the Cloudflare card renderer.
import { propForm } from "./card.js";
import { dominantFormat } from "./props.js";
import { STATS } from "./rules.js";
import { Resolver } from "./resolve.js";
import { runPlan } from "./plan.js";
import { fmtIndex } from "./util.js";

/** L5 / last / hit rate from this player's shard in one format (never mixed). Times out so a slow shard does not drop the JPEG. */
export async function attachForm(f, store) {
  if (f.kind !== "prop" || f.idx == null || !f.statKey || !store) return f;
  const def = STATS[f.statKey];
  if (!def) return f;
  const play = f.side === "under" ? "under" : "over";
  const opts = { year: f.year || String(new Date().getUTCFullYear()), ground: f.ground, opp: f.opp, side: play };
  // the same games the site's row reads: the plan's chart (one format, the stat's own rows), so the card and the row say the same numbers
  try {
    const r = await runPlan(store, new Resolver(store), { kind: "player_prop", stat: f.statKey, line: f.line, side: play, filters: { format: f.fmt || null, team_innings: null, innings: null }, split_by: [] }, { playerIdx: f.idx });
    const entries = r?.ok ? r.chart?.entries || [] : [];
    if (entries.length) return { ...f, ...propForm(entries.map((e) => ({ value: e.value, date: e.date, opp: e.opp, venueName: e.venueName })), f.line, (n) => n, opts) };
  } catch { /* fall back to the rows below */ }
  const all = await store.playerRows(f.idx);
  const side = def.side === "bowl" ? all.bowl : def.side === "all" ? store.pointsRows(all) : all.bat;
  let fmtIdx = fmtIndex(f.fmt);
  if (fmtIdx < 0) fmtIdx = dominantFormat(side);
  if (fmtIdx == null || fmtIdx < 0) return f;
  const rows = side.filter((r) => r.fmt === fmtIdx && r[def.key] != null).map((r) => ({ value: r[def.key], date: r.date, opp: r.opp, venueName: store.venueName(r.v) }));
  return { ...f, ...propForm(rows, f.line, (i) => store.teamName(i, true), opts) };
}
