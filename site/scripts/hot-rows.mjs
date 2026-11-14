// Scores the priced pre-match lines against the players' history and writes the history part of every row to hot-rows.json beside the built data, so the apps skip the player files and
// the scoring pass on a cold start (docs/PROJECT_GUIDE.md 5.11). Runs in the site workflow after the data is built. The numbers are the engine's (`scoreLine`, the same code the phone runs); this file
// only reads the inputs, loops over the lines and writes the result. A row is kept under `lineKey`; its prices are the phone's own books, so only the history is stored.
//   node scripts/hot-rows.mjs --data ../site/public/data --lines ../value_bets/out/book_lines.json [--out FILE] [--now 2026-11-01T10:00:00Z]
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { booksOf, groupByChip, historyRecord, isLiveLine, lineKey, scoreLine } from "../packages/engine/hot-rows.js";
import { keepMsFor } from "../packages/engine/lines.js";
import { Resolver } from "../packages/engine/resolve.js";
import { createStore } from "../packages/engine/store.js";

/** The lines Home and the fixture pages can list: priced, pre-match, started within the keep window or starting in the next 11 days (the apps list 10 local days; a viewer's day edge is a day wide). */
export function wantedLines(lines, now) {
  return lines.filter((l) => {
    const t = Date.parse(l.start_utc);
    return l.start_utc && l.books?.length && !isLiveLine(l) && Number.isFinite(t) && t > now - keepMsFor(l.fmt) && t < now + 11 * 864e5;
  });
}

/** The published document for the built data in `dataDir` and the book lines file `linesPath`. `now` is the clock (ms), so a run can be replayed. */
export async function buildDoc({ dataDir, linesPath, now = Date.now() }) {
  const read = async (p) => JSON.parse(await readFile(p, "utf8"));
  const store = await createStore({ fetchJson: (p) => read(join(dataDir, p)) });
  const [doc, fixtures, meta, namesFile] = await Promise.all([
    read(linesPath), store.loadFixtures(), read(join(dataDir, "meta.json")),
    read(join(dataDir, "names.json")).catch(() => ({})),
  ]);
  if (!fixtures.length) throw new Error("no fixtures in the built data");
  const names = namesFile && typeof namesFile === "object" ? namesFile : {};
  const rz = new Resolver(store);
  const year = String(new Date(now).getUTCFullYear());
  const all = wantedLines(doc.lines || [], now);
  const byChip = groupByChip(all);
  // one row per key: several book lines of one player and stat (other lines, other books) are one row, scored on the books' main line
  const want = [...new Map(all.map((l) => [lineKey(l), l])).values()];
  const byShard = new Map();
  for (const l of want) { const i = store.P.id.indexOf(l.pid); if (i >= 0) { const s = store.shardOf(i); (byShard.get(s) ?? byShard.set(s, []).get(s)).push(l); } }
  const rows = {};
  let scored = 0, skipped = want.length - [...byShard.values()].reduce((n, g) => n + g.length, 0); // a player the data does not have is skipped
  for (const [shard, group] of byShard) {
    await store.shard(shard);
    for (const l of group) {
      if (!booksOf(l, byChip, now)) { skipped++; continue; }
      const r = await scoreLine({ store, rz, l, byChip, fixtures, now, year, names });
      if (r) { rows[lineKey(l)] = historyRecord(r); scored++; } else skipped++;
    }
  }
  return { v: 1, generated_at_utc: new Date(now).toISOString().replace(/\.\d+Z$/, "Z"), lines_generated_at_utc: doc.generated_at_utc ?? null, build: meta.built_at ?? null, lines: want.length, scored, skipped, rows };
}

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };

async function main() {
  const dataDir = arg("data"), linesPath = arg("lines");
  if (!dataDir || !linesPath) throw new Error("usage: hot-rows.mjs --data DIR --lines FILE [--out FILE] [--now ISO]");
  const out = arg("out") || join(dataDir, "hot-rows.json");
  const now = arg("now") ? Date.parse(arg("now")) : Date.now();
  if (!Number.isFinite(now)) throw new Error("--now is not a date");
  const t0 = Date.now();
  const doc = await buildDoc({ dataDir, linesPath, now });
  const text = JSON.stringify(doc);
  await writeFile(out, text, "utf8");
  console.log(`hot rows: ${doc.scored} of ${doc.lines} priced lines scored (${doc.skipped} skipped), ${(text.length / 1024).toFixed(0)} KB, ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().then(() => process.exit(0), (e) => { console.error(`hot-rows failed: ${e.message}`); process.exit(1); });
