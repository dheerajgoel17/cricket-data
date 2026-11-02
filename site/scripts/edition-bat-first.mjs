// What the site's engine says about every edition's bat-first win %, for the data guard (src/cricket_site/guard.py) to recount from the match list.
//   node scripts/edition-bat-first.mjs <built data dir>   ->  JSON [{ event, name, g, f, ids, decided, pct }]
// `ids` are the edition's matches (the engine decides which matches make an edition), `decided` and `pct` its own bat-first count. No DOM, no network.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createStore } from "../packages/engine/store.js";
import { editionSummary, editionsOf } from "../packages/engine/tournament.js";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: node scripts/edition-bat-first.mjs <built data dir>");
  process.exit(2);
}
const store = await createStore({ fetchJson: async (p) => JSON.parse(await readFile(join(dir, p), "utf8")) });
const out = [];
for (let e = 0; e < store.events.length; e++) {
  for (const ed of editionsOf(store, e)) {
    const s = editionSummary(store, ed);
    out.push({ event: store.events[e], name: ed.name, g: ed.g, f: ed.f, ids: ed.ms.map((m) => store.M.id[m]), decided: s.decided, pct: s.batFirstWinPct });
  }
}
process.stdout.write(JSON.stringify(out));
