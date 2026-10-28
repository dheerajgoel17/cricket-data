// The share card of a page (1200x630): what a link preview shows. `cardFields` picks the words and numbers from the data files (never from a model), `renderCard` draws them.
// Used by api/og.js (the image) and api/share.js (the page a link preview reads). Plain ESM; the drawing library is loaded only when a card is drawn.
import { STATS } from "./rules.js";
import { bookName } from "./lines.js";
import { playerPhotos } from "../lib/photos.js";

const num = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const initials = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const when = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false }) + " UTC"; };

/**
 * The fields of a card from the query: `p` (player index) with optional `stat` and `line` for a prop, or `f` (fixture id).
 * `data` is { index, photos, lines, fixtures } as the site data files hold them. Returns null when nothing matches (the caller serves the plain site card).
 */
export function cardFields(q, data) {
  const idx = num(q.p);
  if (idx != null) {
    const P = data.index?.players;
    const name = P?.nm?.[idx];
    if (!name) return null;
    const pid = P.id[idx], team = data.index.teams?.[P.tm?.[idx]]?.n || "";
    const stat = STATS[q.stat] ? q.stat : null, line = num(q.line);
    const f = { kind: stat && line != null ? "prop" : "player", name, team, initials: initials(name), photos: playerPhotos(data.photos, pid) };
    if (f.kind === "prop") {
      f.stat = STATS[stat].label; f.line = line;
      const hits = (data.lines?.lines || []).filter((l) => l.pid === pid && l.stat === stat && Math.abs(l.line - line) < 0.01);
      const prices = hits.flatMap((l) => (l.books || []).filter((b) => b.over > 1).map((b) => ({ over: b.over, book: bookName(b.source) })));
      const best = prices.sort((x, y) => y.over - x.over)[0];
      if (best) { f.price = best.over; f.book = best.book; f.books = prices.length; }
      if (hits[0]) f.match = hits[0].match;
    }
    return f;
  }
  const fx = (data.fixtures || []).find((x) => x.id === q.f);
  return fx ? { kind: "fixture", a: fx.a, b: fx.b, venue: fx.venue || "", series: fx.series || "", when: when(fx.start) } : null;
}

/** The title and description of the page that carries the card (what a link preview prints under the picture). */
export function cardText(f, brand = "Fancy.cash") {
  if (!f) return null;
  if (f.kind === "prop") return { title: `${f.name}: over ${f.line} ${f.stat.toLowerCase()}${f.price ? ` at ${f.price.toFixed(2)}` : ""}`, description: `${f.name}${f.team ? ` (${f.team})` : ""}, over ${f.line} ${f.stat.toLowerCase()}${f.price ? `, best price ${f.price.toFixed(2)} at ${f.book}` : ""}${f.match ? ` in ${f.match}` : ""}. Hit rates, fair price and every book's line on ${brand}.` };
  if (f.kind === "player") return { title: `${f.name}: stats, hit rates and form`, description: `${f.name}${f.team ? ` (${f.team})` : ""}: hit rates over any line, recent form and every bookmaker's prop price on ${brand}.` };
  return { title: `${f.a} v ${f.b}: player props, hit rates and book lines`, description: `${f.a} v ${f.b}${f.when ? `, ${f.when}` : ""}${f.venue ? `, ${f.venue}` : ""}: player props, hit rates, fair prices and every bookmaker's line on ${brand}.` };
}

const GREEN = "#27da8e";

/** Draws the card as a PNG buffer. `photo` is image bytes or null (initials are drawn); `fonts` are { regular, bold } file paths. */
export async function renderCard(f, { photo = null, fonts = {} } = {}) {
  const { createCanvas, GlobalFonts, loadImage } = await import("@napi-rs/canvas");
  if (fonts.bold) GlobalFonts.registerFromPath(fonts.bold, "CardBold");
  if (fonts.regular) GlobalFonts.registerFromPath(fonts.regular, "CardRegular");
  const bold = fonts.bold ? "CardBold" : "sans-serif", reg = fonts.regular ? "CardRegular" : "sans-serif";
  const c = createCanvas(1200, 630), g = c.getContext("2d");
  g.fillStyle = "#0f0f0f"; g.fillRect(0, 0, 1200, 630);
  const glow = g.createRadialGradient(1020, 60, 0, 1020, 60, 760);
  glow.addColorStop(0, "rgba(39,218,142,0.28)"); glow.addColorStop(1, "rgba(39,218,142,0)");
  g.fillStyle = glow; g.fillRect(0, 0, 1200, 630);
  const text = (s, x, y, size, color, font = bold, align = "left", max = 0) => {
    g.font = `${size}px ${font}`; g.fillStyle = color; g.textAlign = align;
    let t = String(s); if (max) while (g.measureText(t).width > max && t.length > 1) t = t.slice(0, -2) + "…";
    g.fillText(t, x, y);
  };
  const chip = (s, x, y, size = 30) => {
    g.font = `${size}px ${bold}`; const w = g.measureText(s).width + 44;
    g.fillStyle = GREEN; g.beginPath(); g.roundRect(x, y, w, size + 24, (size + 24) / 2); g.fill();
    text(s, x + 22, y + size + 4, size, "#0f0f0f"); return w;
  };
  if (f.kind === "fixture") {
    text(f.series || "Cricket", 70, 120, 34, "#a6a6a6", reg, "left", 1060);
    text(f.a, 70, 270, 110, "#ffffff", bold, "left", 1060);
    text("v", 70, 360, 60, GREEN);
    text(f.b, 70, 470, 110, "#ffffff", bold, "left", 1060);
    text([f.when, f.venue].filter(Boolean).join("  ·  "), 70, 540, 32, "#a6a6a6", reg, "left", 1060);
  } else {
    let img = null;
    if (photo) { try { img = await loadImage(photo); } catch { img = null; } }
    const cx = 270, cy = 315, r = 190;
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.closePath(); g.clip();
    g.fillStyle = "#1c1c1c"; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    if (img) { const s = Math.max((r * 2) / img.width, (r * 2) / img.height), w = img.width * s, h = img.height * s; g.drawImage(img, cx - w / 2, cy - r + (r * 2 - h) * 0.15, w, h); }
    else text(f.initials, cx, cy + 50, 150, GREEN, bold, "center");
    g.restore();
    g.strokeStyle = GREEN; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, r + 8, 0, Math.PI * 2); g.stroke();
    const x = 530, w = 600;
    text(f.name, x, 230, 86, "#ffffff", bold, "left", w);
    text(f.team, x, 285, 36, "#a6a6a6", reg, "left", w);
    if (f.kind === "prop") {
      text(`Over ${f.line}`, x, 420, 120, GREEN, bold, "left", w);
      text(f.stat, x, 475, 44, "#ffffff", reg, "left", w);
      if (f.price) { const cw = chip(`${f.price.toFixed(2)}  ${f.book}`, x, 505, 32); if (f.books > 1) text(`+${f.books - 1} more`, x + cw + 20, 545, 28, "#a6a6a6", reg); }
    } else {
      text("Hit rates, form and book lines", x, 400, 52, "#ffffff", reg, "left", w);
    }
  }
  // brand mark and name, bottom right
  g.save(); g.translate(930, 548); g.scale(0.9, 0.9);
  const mark = g.createLinearGradient(0, 0, 64, 64); mark.addColorStop(0, "#3cf0a6"); mark.addColorStop(1, "#1fb877");
  g.fillStyle = mark; g.beginPath(); g.roundRect(0, 0, 64, 64, 15); g.fill();
  g.fillStyle = "#0f0f0f";
  for (const [x, y, w, h] of [[17, 14, 10, 37], [17, 14, 25, 10], [17, 29.5, 18, 10]]) { g.beginPath(); g.roundRect(x, y, w, h, 5); g.fill(); }
  g.beginPath(); g.arc(48.5, 19, 6, 0, Math.PI * 2); g.fill(); g.restore();
  text("Fancy", 1000, 592, 44, "#ffffff", bold); const fw = (g.font = `44px ${bold}`, g.measureText("Fancy").width);
  text(".", 1000 + fw, 592, 44, GREEN, bold); text("cash", 1000 + fw + 12, 592, 44, "#ffffff", bold);
  return c.toBuffer("image/png");
}
