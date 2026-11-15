// Writes src/tokens.generated.css from packages/tokens/tokens.json. `--check` fails when the committed file is stale (used by the tests).
import { readFileSync, writeFileSync } from "node:fs";
import { tokensCss } from "../packages/tokens/css.js";
import { tokensDtcg } from "../packages/tokens/dtcg.js";

const tokens = JSON.parse(readFileSync(new URL("../packages/tokens/tokens.json", import.meta.url), "utf8"));
const out = new URL("../src/tokens.generated.css", import.meta.url);
const css = tokensCss(tokens);
const dtcgOut = new URL("../packages/tokens/tokens.dtcg.json", import.meta.url);
const dtcg = JSON.stringify(tokensDtcg(tokens), null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (readFileSync(out, "utf8") !== css) { console.error("tokens.generated.css is stale: run `npm run tokens`"); process.exit(1); }
  if (readFileSync(dtcgOut, "utf8") !== dtcg) { console.error("tokens.dtcg.json is stale: run `npm run tokens`"); process.exit(1); }
} else { writeFileSync(out, css); writeFileSync(dtcgOut, dtcg); }
