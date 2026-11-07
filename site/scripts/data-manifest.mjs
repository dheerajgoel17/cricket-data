// A short content hash for every data file the page fetches, so its URL changes exactly when its bytes do (`/data/index.json?v=ab12cd34ef`).
// The browser can then keep a versioned file for good (see site/vercel.json) and a hourly deploy that changed nothing in it costs a returning visitor no request.
// meta.json is left out (a small file read to learn what changed, kept for 60 s). Plain Node, no dependencies: run by the Vite build and by the tests.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

/** `{ "index.json": "ab12cd34ef", "p/12.json": "…" }` for every .json under `dir` except meta.json; {} when the folder is missing. */
export function dataManifest(dir) {
  const out = {};
  let files;
  try { files = [...walk(dir)]; } catch { return out; }
  for (const f of files.sort()) {
    const rel = relative(dir, f).split(sep).join("/");
    if (!rel.endsWith(".json") || rel === "meta.json") continue;
    out[rel] = createHash("sha1").update(readFileSync(f)).digest("hex").slice(0, 10);
  }
  return out;
}

/**
 * The script the built page carries in its head: the manifest, and the gate request started at once so the cookie and the key are already on their way while the app's scripts download
 * (the data files need the cookie, and the page used to ask for it only after its scripts had run).
 */
export function headScript(manifest) {
  const m = JSON.stringify(manifest).replace(/</g, "\\u003c");
  return `<script>window.__DV=${m};try{window.__gate=fetch("/api/gate",{credentials:"same-origin",cache:"no-store"}).catch(function(){return null})}catch(e){}</script>`;
}
