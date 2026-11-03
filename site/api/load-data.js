// Shared by api/og and api/share: the small JSON files needed to build a card's words (never player shards).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FILES = { index: "index.json", photos: "photos.json", lines: "lines.json", fixtures: "fixtures.json" };

/** Same XOR-SHA256 wrap as packages/engine/wrap.js, sync so the function can read photos.json / fixtures.json the deploy wrapped. */
export function unwrapJson(doc, secret) {
  if (!doc || doc.v !== 1 || !doc.ct || !doc.iv || !secret) return doc;
  const key = createHash("sha256").update(secret, "utf8").digest();
  const iv = Buffer.from(doc.iv, "base64"), ct = Buffer.from(doc.ct, "base64");
  const ks = Buffer.alloc(ct.length);
  for (let i = 0, off = 0; off < ct.length; i++) {
    const ctr = Buffer.alloc(4); ctr.writeUInt32BE(i);
    const block = createHash("sha256").update(Buffer.concat([key, iv, ctr])).digest();
    const n = Math.min(32, ct.length - off);
    block.copy(ks, off, 0, n); off += n;
  }
  const raw = Buffer.alloc(ct.length);
  for (let i = 0; i < ct.length; i++) raw[i] = ct[i] ^ ks[i];
  return JSON.parse(raw.toString("utf8"));
}

let cache = null;

/** index / photos / lines / fixtures from SHARE_DATA_DIR or public/data (shipped via vercel.json includeFiles). */
export function loadData() {
  if (cache) return cache;
  const dir = process.env.SHARE_DATA_DIR || join(process.cwd(), "public/data");
  const secret = (process.env.DATA_WRAP_KEY || "").trim();
  cache = Object.fromEntries(Object.entries(FILES).map(([k, f]) => {
    try { return [k, unwrapJson(JSON.parse(readFileSync(join(dir, f), "utf8")), secret)]; } catch { return [k, null]; }
  }));
  return cache;
}

/** Clear the in-process cache (tests). */
export function resetLoadDataCache() {
  cache = null;
}
