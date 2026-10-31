// GET /share/player/<idx>[/<stat>/<line>]  or  /share/fixture/<id>  or  /share/venue/<idx>
// (vercel.json rewrites to /api/share?path=...) -> a tiny page link previews read:
// the title, description and the dynamic card. The JPEG is in the body too (tap it for the real page).
// No meta-refresh and no location.replace: crawlers that run scripts would follow those and then read the app shell.
import { cardFields, cardPath, cardText } from "@cricket/engine/card.js";
import { shareMetas } from "../src/lib/seo.js";
import { loadData } from "./og.js";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "player/12/runs/24.5" -> { query for the card, path of the real page }; null for anything else. */
export function parseShare(path) {
  let raw = String(path || "");
  try { raw = decodeURIComponent(raw); } catch { /* keep raw */ }
  const seg = raw.split("/").filter(Boolean);
  if (seg[0] === "player" && /^\d+$/.test(seg[1] || "")) {
    const withLine = seg[2] && seg[3] && Number.isFinite(Number(seg[3]));
    return { card: withLine ? { p: seg[1], stat: seg[2], line: seg[3] } : { p: seg[1] }, page: `/player/${seg[1]}${withLine ? `?stat=${encodeURIComponent(seg[2])}&line=${encodeURIComponent(seg[3])}` : ""}` };
  }
  if (seg[0] === "fixture" && seg[1]) return { card: { f: seg[1] }, page: `/fixture/${encodeURIComponent(seg[1])}` };
  if (seg[0] === "venue" && /^\d+$/.test(seg[1] || "")) return { card: { v: seg[1] }, page: `/venue/${seg[1]}` };
  return null;
}

export default function handler(req, res) {
  const parsed = parseShare(req.query?.path);
  const fields = parsed && cardFields(parsed.card, loadData());
  const text = cardText(fields);
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  const origin = host ? `https://${String(host).split(",")[0]}` : "";
  if (!parsed || !text || !origin) { res.statusCode = 302; res.setHeader("Location", "/"); return res.end(); }
  const page = `${origin}${parsed.page}`;
  const share = `${origin}/share/${String(req.query.path || "").replace(/^\/+/, "")}`;
  const image = `${origin}${cardPath(parsed.card)}`;
  const title = `${text.title} | Fancy.cash`;
  const tags = shareMetas({ title, description: text.description, url: share, image, alt: text.title })
    .map(([attr, key, value]) => `<meta ${attr}="${key}" content="${esc(value)}" />`).join("");
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>${esc(title)}</title>
<meta name="description" content="${esc(text.description)}" /><meta name="robots" content="noindex, follow, max-image-preview:large" /><link rel="canonical" href="${esc(share)}" />
${tags}<link rel="image_src" href="${esc(image)}" />
</head><body style="margin:0;background:#0f0f0f">
<a href="${esc(page)}"><img src="${esc(image)}" width="1200" height="630" alt="${esc(text.title)}" style="width:100%;max-width:1200px;height:auto;display:block" /></a>
</body></html>`);
}
