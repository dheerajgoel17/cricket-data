// GET /card/player/<idx>[/<stat>/<line>].jpg  or  /card/fixture/<id>.jpg (rewritten to this function), or /api/og?p=<player index>[&stat=runs&line=24.5] / ?f=<fixture id>  -> the share card (JPEG, 1200x630) a link preview shows.
// The words and numbers come from the site's data files shipped with the function (never from a model); the player's photo is fetched from the image host.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cardFields, cardQuery, renderCard } from "../src/engine/card.js";

const FILES = { index: "index.json", photos: "photos.json", lines: "lines.json", fixtures: "fixtures.json" };
const FONTS = { bold: "node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff", regular: "node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-500-normal.woff" };
const PHOTO_MS = 800; // X gives up after a couple of seconds; a slow photo must not stall the JPEG
let cache = null;

/** Same XOR-SHA256 wrap as src/engine/wrap.js, sync so the function can read photos.json / fixtures.json the deploy wrapped. */
function unwrapJson(doc, secret) {
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

export const loadData = () => {
  if (cache) return cache;
  const dir = process.env.SHARE_DATA_DIR || join(process.cwd(), "public/data");
  const secret = (process.env.DATA_WRAP_KEY || "").trim();
  cache = Object.fromEntries(Object.entries(FILES).map(([k, f]) => {
    try { return [k, unwrapJson(JSON.parse(readFileSync(join(dir, f), "utf8")), secret)]; } catch { return [k, null]; }
  }));
  return cache;
};

/** The book's mark from public/books (same files the site badges use). Stem is [a-z0-9] only so a source string cannot leave that folder. */
function readBookMark(source) {
  const stem = String(source || "").replace(/^(.*\S)\s+(Premium|Fancy)$/i, "$1").toLowerCase();
  if (!/^[a-z0-9]+$/.test(stem)) return null;
  for (const ext of ["svg", "png", "jpg", "webp"]) {
    try { return readFileSync(join(process.cwd(), "public/books", `${stem}.${ext}`)); } catch { /* the next extension, or the name */ }
  }
  return null;
}

async function firstPhoto(urls) {
  const list = (urls || []).filter((x) => /^https?:\/\//.test(x));
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
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
  res.setHeader("CDN-Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
  res.setHeader("Vercel-CDN-Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
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
    const f = cardFields(q.path != null ? cardQuery(q.path) : q, loadData()); // /card/<path>.jpg (vercel.json) or the plain query
    if (!f) return sendJpeg(res, await plainJpeg());
    const [photo, teamLogo, oppLogo] = await Promise.all([firstPhoto(f.photos), firstPhoto(f.teamPhotos), firstPhoto(f.oppPhotos)]);
    const img = await renderCard(f, {
      photo, teamLogo, oppLogo,
      bookLogo: readBookMark(f.source),
      fonts: { bold: join(process.cwd(), FONTS.bold), regular: join(process.cwd(), FONTS.regular) },
    });
    sendJpeg(res, img);
  } catch {
    try { sendJpeg(res, await plainJpeg()); } catch { res.statusCode = 500; return res.end(); }
  }
}
