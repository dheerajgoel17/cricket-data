// GET /card/player/<idx>[/<stat>/<line>].jpg  or  /card/fixture/<id>.jpg (rewritten to this function), or /api/og?p=<player index>[&stat=runs&line=24.5] / ?f=<fixture id>  -> the share card (JPEG, 1200x630) a link preview shows.
// The words and numbers come from the site's data files shipped with the function (never from a model); the player's photo is fetched from the image host.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cardFields, cardQuery, renderCard } from "../src/engine/card.js";

const FILES = { index: "index.json", photos: "photos.json", lines: "lines.json", fixtures: "fixtures.json" };
const FONTS = { bold: "node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff", regular: "node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-500-normal.woff" };
const PHOTO_MS = 3000;
let cache = null;

export const loadData = () => (cache ??= Object.fromEntries(Object.entries(FILES).map(([k, f]) => { try { return [k, JSON.parse(readFileSync(join(process.env.SHARE_DATA_DIR || join(process.cwd(), "public/data"), f), "utf8"))]; } catch { return [k, null]; } })));

async function firstPhoto(urls) {
  for (const u of urls.filter((x) => /^https?:\/\//.test(x))) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(PHOTO_MS) });
      if (r.ok && /^image\//.test(r.headers.get("content-type") || "")) return Buffer.from(await r.arrayBuffer());
    } catch { /* the next copy, or initials */ }
  }
  return null;
}

export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const f = cardFields(q.path != null ? cardQuery(q.path) : q, loadData()); // /card/<path>.jpg (vercel.json) or the plain query
    if (!f) {
      const png = readFileSync(join(process.cwd(), "public/og.png"));
      res.statusCode = 200;
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, s-maxage=3600");
      return res.end(png);
    }
    const img = await renderCard(f, { photo: f.photos ? await firstPhoto(f.photos) : null, fonts: { bold: join(process.cwd(), FONTS.bold), regular: join(process.cwd(), FONTS.regular) } });
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.end(img);
  } catch {
    try {
      const png = readFileSync(join(process.cwd(), "public/og.png"));
      res.statusCode = 200;
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, s-maxage=60");
      return res.end(png);
    } catch { res.statusCode = 500; return res.end(); }
  }
}
