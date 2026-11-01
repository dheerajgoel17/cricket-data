// Picks the pre-match fancy lines whose history-based edge is clearly positive and writes them to value_bets/out/fancy_alerts.json, which the match-state Worker posts to the Telegram
// channel (docs/OPERATIONS.md, "Fancy edge alerts"). Runs in the value-bets workflow after the pipeline has written book_lines.json and the site data has been built (plain JSON, not
// yet wrapped). The numbers are the engine's (`fancyEdgeAlerts`, the same scoring as the Match Fancy tab); this file only reads the inputs and writes the result.
//   node scripts/fancy-alerts.mjs --data ../site/public/data --lines ../value_bets/out/book_lines.json --out ../value_bets/out/fancy_alerts.json [--now 2026-11-01T10:00:00Z]
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ALERT, WINDOW, fancyEdgeAlerts } from "../packages/engine/fancy-edge.js";
import { createStore } from "../packages/engine/store.js";

/** The alert document for the built data in `dataDir` and the book lines file `linesPath`. `now` is the clock (ms), so a run can be replayed. */
export async function buildDoc({ dataDir, linesPath, now = Date.now() }) {
  const read = async (p) => JSON.parse(await readFile(p, "utf8"));
  const store = await createStore({ fetchJson: (p) => read(join(dataDir, p)) });
  const [doc, fixtures] = await Promise.all([read(linesPath), store.loadFixtures()]);
  if (!fixtures.length) throw new Error("no fixtures in the built data");
  const alerts = fancyEdgeAlerts({ store, doc, fixtures, now });
  return { generated_at_utc: new Date(now).toISOString().replace(/\.\d+Z$/, "Z"), window: WINDOW, min_edge: ALERT.MIN_EDGE, max_edge: ALERT.MAX_EDGE, min_games: ALERT.MIN_GAMES, per_match: ALERT.PER_MATCH, alerts };
}

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };

async function main() {
  const dataDir = arg("data"), linesPath = arg("lines"), out = arg("out");
  if (!dataDir || !linesPath || !out) throw new Error("usage: fancy-alerts.mjs --data DIR --lines FILE --out FILE [--now ISO]");
  const now = arg("now") ? Date.parse(arg("now")) : Date.now();
  if (!Number.isFinite(now)) throw new Error("--now is not a date");
  const doc = await buildDoc({ dataDir, linesPath, now });
  await writeFile(out, `${JSON.stringify(doc, null, 1)}\n`, "utf8");
  console.log(`fancy alerts: ${doc.alerts.length} for ${new Set(doc.alerts.map((a) => a.fixture_id || a.match)).size} matches -> ${out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().then(() => process.exit(0), (e) => { console.error(`fancy-alerts failed: ${e.message}`); process.exit(1); });
