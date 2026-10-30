// GET /share/player/<idx>[/<stat>/<line>]  or  /share/fixture/<id>  or  /share/venue/<idx>
// (vercel.json rewrites to /api/share?path=...) -> a tiny page link previews read:
// the title, description and the dynamic card. People who open it are sent on to the real page by a script: no meta refresh,
// which some link-preview crawlers follow and then read the real page's tags instead.
import { cardFields, cardPath, cardText } from "../src/engine/card.js";
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
<meta name="description" content="${esc(text.description)}" /><meta name="robots" content="noindex, follow" /><link rel="canonical" href="${esc(page)}" />
${tags}<link rel="image_src" href="${esc(image)}" />
</head><body><p><a href="${esc(page)}">${esc(text.title)}</a></p><script>location.replace(${JSON.stringify(page)})</script></body></html>`);
}
