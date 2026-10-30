// GET /share/player/<idx>[/<stat>/<line>]  or  /share/fixture/<id>  or  /share/venue/<idx>
// (vercel.json rewrites to /api/share?path=...) -> a tiny page link previews read:
// the title, description and the dynamic card. People who open it are sent on to the real page by a script: no meta refresh,
// which some link-preview crawlers follow and then read the real page's tags instead.
import { cardFields, cardPath, cardText } from "../src/engine/card.js";
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
  const jpeg = image.includes(".jpg");
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>${esc(title)}</title>
<meta name="description" content="${esc(text.description)}" /><meta name="robots" content="noindex, follow" /><link rel="canonical" href="${esc(page)}" />
<meta property="og:type" content="website" /><meta property="og:site_name" content="Fancy.cash" /><meta property="og:locale" content="en" />
<meta property="og:title" content="${esc(title)}" /><meta property="og:description" content="${esc(text.description)}" />
<meta property="og:url" content="${esc(share)}" /><meta property="og:image" content="${esc(image)}" /><meta property="og:image:secure_url" content="${esc(image)}" />
<meta property="og:image:type" content="${jpeg ? "image/jpeg" : "image/png"}" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="${esc(title)}" /><meta name="twitter:description" content="${esc(text.description)}" />
<meta name="twitter:image" content="${esc(image)}" /><meta name="twitter:image:alt" content="${esc(text.title)}" />
</head><body><p><a href="${esc(page)}">${esc(text.title)}</a></p><script>location.replace(${JSON.stringify(page)})</script></body></html>`);
}
