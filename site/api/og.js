// GET /card/player/<idx>[/<stat>/<line>].jpg  or  /card/fixture/<id>.jpg (rewritten to this function), or /api/og?p=<player index>[&stat=runs&line=24.5] / ?f=<fixture id>  -> the share card (JPEG, 1200x630) a link preview shows.
// The words and numbers come from the site's data files shipped with the function (never from a model); the player's photo is fetched from the image host.
// L5 form reads matches.json + one player shard over HTTP from this deploy's /data (not bundled: Functions Storage).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cardFields, cardQuery, propForm, renderCard } from "@cricket/engine/card.js";
import { renderPoster } from "@cricket/engine/poster.js";
import { fancyPosterFields, renderFancyPoster } from "@cricket/engine/fancy-poster.js";
import { teamLogos } from "@cricket/engine/photos.js";
import { dominantFormat } from "@cricket/engine/props.js";
import { STATS } from "@cricket/engine/rules.js";
import { createStore } from "@cricket/engine/store.js";
import { Resolver } from "@cricket/engine/resolve.js";
import { runPlan } from "@cricket/engine/plan.js";
import { fmtIndex } from "@cricket/engine/util.js";
import { bookLogoFile, bookLogoStem, setBookManifest } from "@cricket/engine/books.js";
import { loadData, unwrapJson } from "./load-data.js";

// Same as the site: Satoshi for names/body; Barlow Condensed for figures and the Fancy.cash wordmark.
const FONTS = {
  bold: "fonts/satoshi/Satoshi-Bold.woff",
  regular: "fonts/satoshi/Satoshi-Medium.woff",
  num: "node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff",
  brand: "node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-900-normal.woff",
};
const PHOTO_MS = 1500; // face + kit; still short enough for X, long enough for the CDN
const FORM_MS = 3500; // L5 from the player shard; skip it rather than miss X's crawl window
const OG_UA = "fancy-cash-og/1.0";
let storeCache = null;

/** Origin that serves /data/*.json for this deploy (tests set SHARE_DATA_BASE). */
export function dataOrigin() {
  const base = (process.env.SHARE_DATA_BASE || "").trim();
  if (base) return base.replace(/\/$/, "");
  // the production domain first: the per-deployment address sits behind Vercel Authentication, answers with an HTML login page and leaves every card without its form
  const host = (process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "").trim();
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
  const opts = { year: f.year || String(new Date().getUTCFullYear()), ground: f.ground, opp: f.opp };
  // the same games the site's row reads: the plan's chart (one format, the stat's own rows), so the card and the row say the same numbers
  try {
    const r = await runPlan(store, new Resolver(store), { kind: "player_prop", stat: f.statKey, line: f.line, side: "over", filters: { format: f.fmt || null, team_innings: null, innings: null }, split_by: [] }, { playerIdx: f.idx });
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

let namesCache = null;
/** The source's full names (names.json by player id); {} when it cannot be read in time. */
async function loadNames() {
  if (namesCache) return namesCache;
  try { namesCache = await fetchStoreJson("names.json"); } catch { return {}; }
  return namesCache;
}

function withTimeout(p, ms, fallback) { // a rejected `p` is the fallback too (never an unhandled rejection that takes the process down)
  return Promise.race([Promise.resolve(p).catch(() => fallback), new Promise((r) => setTimeout(() => r(fallback), ms))]);
}

let manifestRead = false;
/** The book's mark from public/books (same files the site badges use). Resolves every stem in bookLogoStem. */
function readBookMark(source) {
  if (!manifestRead) { // the published book list (public/books/books.json) is the table: a new book needs no code change here
    manifestRead = true;
    try { setBookManifest(JSON.parse(readFileSync(join(process.cwd(), "public/books/books.json"), "utf8"))); } catch { /* the built-in table */ }
  }
  const stem = bookLogoStem(source);
  if (!stem) return null;
  const file = bookLogoFile(stem);
  if (file) { try { return readFileSync(join(process.cwd(), "public/books", file)); } catch { /* the extensions below */ } }
  for (const ext of ["svg", "png", "jpg", "webp"]) {
    try { return readFileSync(join(process.cwd(), "public/books", `${stem}.${ext}`)); } catch { /* the next extension, or the name */ }
  }
  return null;
}

export { bookLogoStem as bookStem };

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
    if (q.poster && q.f && q.fm) { // the 4:5 Match Fancy poster: one market of one fixture (/fixture/<id>/fancy?fm=&sc=)
      const data = loadData(), store = await loadStore();
      const ff = store && data.fixtures && data.lines ? fancyPosterFields(store, data.lines, data.fixtures, { id: String(q.f), fm: String(q.fm), sc: q.sc }) : null;
      if (!ff) { res.statusCode = 404; res.setHeader("Cache-Control", "no-store"); return res.end(); }
      const side = (n) => (ff.female && !/\bwomen\b|\(w\)/i.test(n) ? `${n} Women` : n);
      const [aLogo, bLogo] = await Promise.all([firstPhoto(teamLogos(data.photos, side(ff.a))), firstPhoto(teamLogos(data.photos, side(ff.b)))]);
      const png = await renderFancyPoster(ff, { aLogo, bLogo, fonts: { bold: join(process.cwd(), FONTS.bold), regular: join(process.cwd(), FONTS.regular), num: join(process.cwd(), FONTS.num) } });
      res.statusCode = 200;
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
      res.setHeader("Content-Length", String(png.length));
      return res.end(png);
    }
    let f = cardFields(q.path != null ? cardQuery(q.path) : q, loadData()); // /card/<path>.jpg (vercel.json) or the plain query
    if (!f) return sendJpeg(res, await plainJpeg());
    const names = await withTimeout(loadNames(), 1500, {});
    if (f.pid && names && names[f.pid]) f.name = names[f.pid]; // the full name the site shows ("Maia Bouchier"), not the scorecard's initials
    f = await withTimeout(attachForm(f), FORM_MS, f);
    const [photo, jersey, teamLogo, oppLogo] = await Promise.all([firstPhoto(f.photos), firstPhoto(f.kitPhotos), firstPhoto(f.teamPhotos), firstPhoto(f.oppPhotos)]);
    if (q.poster && f.kind === "prop" && !f.bookLines?.length && f.price) f.bookLines = [{ line: f.line, price: f.price, book: f.book, stem: bookLogoStem(f.source), best: true }], f.bookTitle = `BOOKS AT ${f.line}`; // one book is still a box on the right, so the sheet is not lopsided
    const bookMarks = {}; // each listed book's own logo, by stem (the file the site's badges use)
    for (const b of f.bookLines || []) if (b.stem && !bookMarks[b.stem]) { const m = readBookMark(b.stem); if (m) bookMarks[b.stem] = m; }
    const fonts = {
      bold: join(process.cwd(), FONTS.bold),
      regular: join(process.cwd(), FONTS.regular),
      num: join(process.cwd(), FONTS.num),
      brand: join(process.cwd(), FONTS.brand),
    };
    if (q.poster && f.kind === "prop") { // the 4:5 shareable sheet (Share on the player page): same fields, drawn as a PNG
      const png = await renderPoster(f, { photo, jersey, teamLogo, oppLogo, bookMarks, fonts });
      res.statusCode = 200;
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", f.season || f.l5 ? "public, max-age=300, s-maxage=600" : "public, max-age=0, s-maxage=30"); // a poster that came out without its form is not kept for ten minutes
      res.setHeader("Content-Length", String(png.length));
      return res.end(png);
    }
    const img = await renderCard(f, {
      photo, jersey, teamLogo, oppLogo,
      bookLogo: readBookMark(f.source),
      bookMarks,
      fonts,
    });
    sendJpeg(res, img);
  } catch {
    try { sendJpeg(res, await plainJpeg()); } catch { res.statusCode = 500; return res.end(); }
  }
}
