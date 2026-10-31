// Writes src/tokens.generated.css from packages/tokens/tokens.json. `--check` fails when the committed file is stale (used by the tests).
import { readFileSync, writeFileSync } from "node:fs";
import { tokensCss } from "../packages/tokens/css.js";

const tokens = JSON.parse(readFileSync(new URL("../packages/tokens/tokens.json", import.meta.url), "utf8"));
const out = new URL("../src/tokens.generated.css", import.meta.url);
const css = tokensCss(tokens);
if (process.argv.includes("--check")) {
  if (readFileSync(out, "utf8") !== css) { console.error("tokens.generated.css is stale: run `npm run tokens`"); process.exit(1); }
} else writeFileSync(out, css);
