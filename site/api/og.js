// GET /card/player/<idx>[/<stat>/<line>].jpg  or  /card/fixture/<id>.jpg (rewritten to this function), or /api/og?p=<player index>[&stat=runs&line=24.5] / ?f=<fixture id>  -> the share card (JPEG, 1200x630) a link preview shows.
// The words and numbers come from the site's data files shipped with the function (never from a model); the player's photo is fetched from the image host.
// L5 form reads matches.json + one player shard over HTTP from this deploy's /data (not bundled: Functions Storage).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cardFields, cardQuery, propForm, renderCard } from "@cricket/engine/card.js";
import { dominantFormat } from "@cricket/engine/props.js";
import { STATS } from "@cricket/engine/rules.js";
import { createStore } from "@cricket/engine/store.js";
import { fmtIndex } from "@cricket/engine/util.js";
import { bookLogoStem } from "@cricket/engine/books.js";
import { loadData, unwrapJson } from "./load-data.js";

// Same as the site: Satoshi for names/body; Barlow Condensed for figures and the Fancy.cash wordmark.
const FONTS = {
  bold: "fonts/satoshi/Satoshi-Bold.woff",
  regular: "fonts/satoshi/Satoshi-Medium.woff",
  num: "node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff",
  brand: "node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-900-normal.woff",
};
const PHOTO_MS = 1500; // face + kit; still short enough for X, long enough for the CDN
const FORM_MS = 2500; // L5 from the player shard; skip it rather than miss X's crawl window
const OG_UA = "fancy-cash-og/1.0";
let storeCache = null;

/** Origin that serves /data/*.json for this deploy (tests set SHARE_DATA_BASE). */
export function dataOrigin() {
  const base = (process.env.SHARE_DATA_BASE || "").trim();
  if (base) return base.replace(/\/$/, "");
  const host = (process.env.VERCEL_URL || "").trim();
  return host ? `https://${host}` : null;
}

/** Fetch one relative path under /data (matches.json or p/NN.json). Not read from disk — keeps player shards out of the function bundle. */
export async function fetchStoreJson(rel) {
  const origin = dataOrigin();
  if (!origin) throw new Error("no data origin");
  const secret = (process.env.DATA_WRAP_KEY || "").trim();
  const headers = { "user-agent": OG_UA };
  if (secret) headers["x-cd-k"] = secret;
  const r = await fetch(`${origin}/data/${rel}`, { headers, cache: "no-store" });
  if (!r.ok) throw new Error(`${rel}: HTTP ${r.status}`);
  return unwrapJson(await r.json(), secret);
}

async function loadStore() {
  if (storeCache) return storeCache;
  try {
    storeCache = await createStore({ fetchJson: fetchStoreJson });
    return storeCache;
  } catch { return null; }
}

/** L5 / last / hit rate from this player's shard in one format (never mixed). Times out so a slow shard does not drop the JPEG. */
async function attachForm(f) {
  if (f.kind !== "prop" || f.idx == null || !f.statKey) return f;
  const store = await loadStore();
  if (!store) return f;
  const def = STATS[f.statKey];
  if (!def) return f;
  const all = await store.playerRows(f.idx);
  const side = def.side === "bowl" ? all.bowl : def.side === "all" ? store.pointsRows(all) : all.bat;
  let fmtIdx = fmtIndex(f.fmt);
  if (fmtIdx < 0) fmtIdx = dominantFormat(side);
  if (fmtIdx == null || fmtIdx < 0) return f;
  const rows = side.filter((r) => r.fmt === fmtIdx && r[def.key] != null).map((r) => ({ value: r[def.key], date: r.date, opp: r.opp }));
  return { ...f, ...propForm(rows, f.line, (i) => store.teamName(i, true)) };
}

function withTimeout(p, ms, fallback) {
  return Promise.race([p, new Promise((r) => setTimeout(() => r(fallback), ms))]);
}

/** The book's mark from public/books (same files the site badges use). Resolves every stem in bookLogoStem. */
function readBookMark(source) {
  const stem = bookLogoStem(source);
  if (!stem) return null;
  for (const ext of ["svg", "png", "jpg", "webp"]) {
    try { return readFileSync(join(process.cwd(), "public/books", `${stem}.${ext}`)); } catch { /* the next extension, or the name */ }
  }
  return null;
}

export { bookLogoStem as bookStem };

function readBrand() {
  try { return readFileSync(join(process.cwd(), "public/icon-192.png")); } catch { return null; }
}

/** Absolute image URL: Source CDN paths are host-relative when VITE_IMG_CDN is unset in the function. */
function absPhotoUrl(u) {
  const s = String(u || "");
  if (/^https?:\/\//i.test(s)) return s;
  const cdn = (process.env.VITE_IMG_CDN || "").replace(/\/$/, "");
  if (cdn && s.startsWith("/")) return `${cdn}${s}`;
  return "";
}

async function firstPhoto(urls) {
  const list = (urls || []).map(absPhotoUrl).filter(Boolean);
  if (!list.length) return null;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), PHOTO_MS);
  try {
    const buf = await Promise.any(list.map(async (u) => {
      const r = await fetch(u, { signal: ac.signal });
      if (!r.ok || !/^image\//.test(r.headers.get("content-type") || "")) throw new Error("skip");
      return Buffer.from(await r.arrayBuffer());
    }));
    ac.abort();
    return buf;
  } catch { return null; } finally { clearTimeout(t); }
}

function sendJpeg(res, img) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Content-Disposition", 'inline; filename="card.jpg"');
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=3600");
  res.setHeader("CDN-Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
  res.setHeader("Vercel-CDN-Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
  res.setHeader("Content-Length", String(img.length));
  res.end(img);
}

async function plainJpeg() {
  const { createCanvas } = await import("@napi-rs/canvas");
  const c = createCanvas(1200, 630), g = c.getContext("2d");
  g.fillStyle = "#0f0f0f"; g.fillRect(0, 0, 1200, 630);
  return c.toBuffer("image/jpeg", 82);
}

export default async function handler(req, res) {
  if (req.method === "HEAD") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Disposition", 'inline; filename="card.jpg"');
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.end();
  }
  try {
    const q = req.query || {};
    let f = cardFields(q.path != null ? cardQuery(q.path) : q, loadData()); // /card/<path>.jpg (vercel.json) or the plain query
    if (!f) return sendJpeg(res, await plainJpeg());
    f = await withTimeout(attachForm(f), FORM_MS, f);
    const [photo, jersey, teamLogo, oppLogo] = await Promise.all([firstPhoto(f.photos), firstPhoto(f.kitPhotos), firstPhoto(f.teamPhotos), firstPhoto(f.oppPhotos)]);
    const img = await renderCard(f, {
      photo, jersey, teamLogo, oppLogo,
      bookLogo: readBookMark(f.source),
      brandLogo: readBrand(),
      fonts: {
        bold: join(process.cwd(), FONTS.bold),
        regular: join(process.cwd(), FONTS.regular),
        num: join(process.cwd(), FONTS.num),
        brand: join(process.cwd(), FONTS.brand),
      },
    });
    sendJpeg(res, img);
  } catch {
    try { sendJpeg(res, await plainJpeg()); } catch { res.statusCode = 500; return res.end(); }
  }
}
