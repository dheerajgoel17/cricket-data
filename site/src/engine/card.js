// The share card of a page (1200x630): what a link preview shows. `cardFields` picks the words and numbers from the data files (never from a model), `renderCard` draws them.
// Used by api/og.js (the image) and api/share.js (the page a link preview reads). Plain ESM; the drawing library is loaded only when a card is drawn.
import { STATS } from "./rules.js";
import { bookName, overProb, teamKey } from "./lines.js";
import { playerPhotos, teamLogos } from "../lib/photos.js";
export { CARD_V, cardPath, cardQuery } from "./card-path.js";

const num = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const initials = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const when = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false }) + " UTC"; };
const whenShort = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false }); };
const abbr = (n) => { const w = String(n || "").replace(/\(W\)/i, "").trim().split(/\s+/).filter(Boolean); return (w.length > 1 ? w.map((x) => x[0]).join("") : (w[0] || "?")).slice(0, 3).toUpperCase(); };
const biggerPhoto = (urls) => (urls || []).map((u) => u.replace(/([?&]width=)\d+/, "$1800"));

/** The other side in a "A vs B" match string, using the player's team so a club name still matches. */
function otherSide(match, team) {
  const parts = String(match || "").split(/\s+vs\s+/i).map((s) => s.trim()).filter(Boolean);
  if (parts.length !== 2) return "";
  const k = teamKey(team);
  if (teamKey(parts[0]) === k) return parts[1];
  if (teamKey(parts[1]) === k) return parts[0];
  return parts[1];
}

const ROLE = { bat: "Batter", bowl: "Bowler", all: "All-rounder" };

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
    const pid = P.id[idx], indexTeam = data.index.teams?.[P.tm?.[idx]]?.n || "";
    const stat = STATS[q.stat] ? q.stat : null, line = num(q.line);
    const f = { kind: stat && line != null ? "prop" : "player", name, team: indexTeam, initials: initials(name), photos: biggerPhoto(playerPhotos(data.photos, pid)) };
    if (f.kind === "prop") {
      f.stat = STATS[stat].label; f.line = line; f.role = ROLE[STATS[stat].side] || "";
      const hits = (data.lines?.lines || []).filter((l) => l.pid === pid && l.stat === stat && Math.abs(l.line - line) < 0.01);
      const row = hits[0];
      if (row?.team) f.team = row.team;
      if (row) {
        f.match = row.match;
        f.fmt = row.fmt || "";
        f.opp = otherSide(row.match, f.team);
        f.start = row.start_utc || "";
        f.when = row.start_utc ? whenShort(row.start_utc) : "";
      }
      const prices = hits.flatMap((l) => (l.books || []).filter((b) => b.over > 1).map((b) => ({ over: b.over, under: b.under, book: bookName(b.source) })));
      const best = prices.sort((x, y) => y.over - x.over)[0];
      if (best) {
        f.price = best.over; f.book = best.book; f.books = prices.length;
        if (best.under > 1) { f.under = best.under; f.market = overProb(best.over, best.under); }
      }
      f.teamPhotos = teamLogos(data.photos, f.team);
      f.oppPhotos = f.opp ? teamLogos(data.photos, f.opp) : [];
      if (data.form?.[pid]) Object.assign(f, data.form[pid]); // last / hit, only when the caller already computed them from the data
    }
    return f;
  }
  const vidx = num(q.v);
  if (vidx != null) {
    const name = data.index?.venues?.[vidx];
    return name ? { kind: "venue", name } : null;
  }
  const fixtures = Array.isArray(data.fixtures) ? data.fixtures : [];
  const fx = fixtures.find((x) => x.id === q.f);
  return fx ? { kind: "fixture", a: fx.a, b: fx.b, venue: fx.venue || "", series: fx.series || "", when: when(fx.start) } : null;
}

/** The title and description of the page that carries the card (what a link preview prints under the picture). */
export function cardText(f, brand = "Fancy.cash") {
  if (!f) return null;
  if (f.kind === "prop") return { title: `${f.name}: ${f.stat.toLowerCase()} over ${f.line}${f.price ? ` at ${f.price.toFixed(2)}` : ""}`, description: `${f.name}${f.team ? ` (${f.team})` : ""}, ${f.stat.toLowerCase()} over ${f.line}${f.price ? `, listed ${f.price.toFixed(2)} at ${f.book}` : ""}${f.match ? ` in ${f.match}` : ""}. Hit rates and form on ${brand}.` };
  if (f.kind === "player") return { title: `${f.name}: stats, hit rates and form`, description: `${f.name}${f.team ? ` (${f.team})` : ""}: hit rates over any line, recent form and listed lines on ${brand}.` };
  if (f.kind === "venue") return { title: `${f.name}: ground stats`, description: `Runs, sixes, fours and match totals at ${f.name}. Free cricket ground stats on ${brand}.` };
  return { title: `${f.a} v ${f.b}: stats, props and listed lines`, description: `${f.a} v ${f.b}${f.when ? `, ${f.when}` : ""}${f.venue ? `, ${f.venue}` : ""}: player stats, hit rates and listed lines on ${brand}.` };
}

const GREEN = "#27da8e";
const RED = "#ff4444";
const MUTED = "#8e8e93";
const BG = "#0f0f0f";
const HAIR = "#2c2c2e";

async function asImage(loadImage, buf) {
  if (!buf) return null;
  try { return await loadImage(buf); } catch { return null; }
}

/** Draws the card as a JPEG buffer (a fraction of the size of a PNG: link previews drop pictures over ~300 KB). `photo` / `teamLogo` / `oppLogo` are image bytes or null. */
export async function renderCard(f, { photo = null, teamLogo = null, oppLogo = null, fonts = {} } = {}) {
  const { createCanvas, GlobalFonts, loadImage } = await import("@napi-rs/canvas");
  if (fonts.bold) GlobalFonts.registerFromPath(fonts.bold, "CardBold");
  if (fonts.regular) GlobalFonts.registerFromPath(fonts.regular, "CardRegular");
  const bold = fonts.bold ? "CardBold" : "sans-serif", reg = fonts.regular ? "CardRegular" : "sans-serif";
  const c = createCanvas(1200, 630), g = c.getContext("2d");
  g.fillStyle = BG; g.fillRect(0, 0, 1200, 630);
  const text = (s, x, y, size, color, font = bold, align = "left", max = 0) => {
    g.font = `${size}px ${font}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = "alphabetic";
    let t = String(s ?? ""); if (max) while (g.measureText(t).width > max && t.length > 1) t = t.slice(0, -2) + "…";
    g.fillText(t, x, y); return g.measureText(t).width;
  };
  const img = await asImage(loadImage, photo);
  const teamImg = await asImage(loadImage, teamLogo);
  const oppImg = await asImage(loadImage, oppLogo);

  if (f.kind === "prop") drawProp(g, f, { img, teamImg, oppImg, text, bold, reg });
  else if (f.kind === "fixture" || f.kind === "venue") drawPlain(g, f, { text, bold, reg });
  else drawPlayer(g, f, { img, text, bold, reg });
  drawBrand(g, text, bold);
  return jpegUnder(c);
}

/** WhatsApp only shows the large preview when the JPEG stays under ~300 KB; Facebook/X/LinkedIn allow far more. Baseline JPEG, step the quality down until it fits. */
function jpegUnder(c, max = 300 * 1024) {
  let best = c.toBuffer("image/jpeg", 82);
  if (best.length <= max) return best;
  for (const q of [74, 66, 58, 50]) {
    const buf = c.toBuffer("image/jpeg", q);
    if (buf.length <= max) return buf;
    best = buf;
  }
  return best;
}

function drawPlain(g, f, { text, bold, reg }) {
  const glow = g.createRadialGradient(1020, 60, 0, 1020, 60, 760);
  glow.addColorStop(0, "rgba(39,218,142,0.28)"); glow.addColorStop(1, "rgba(39,218,142,0)");
  g.fillStyle = glow; g.fillRect(0, 0, 1200, 630);
  text(f.kind === "venue" ? "Ground stats" : (f.series || "Cricket"), 72, 120, 34, MUTED, reg, "left", 1056);
  if (f.kind === "venue") {
    text(f.name, 72, 320, 72, "#ffffff", bold, "left", 1056);
    text("Runs, sixes, fours and match totals", 72, 420, 36, MUTED, reg, "left", 1056);
  } else {
    text(f.a, 72, 260, 100, "#ffffff", bold, "left", 1056);
    text("v", 72, 350, 56, GREEN);
    text(f.b, 72, 450, 100, "#ffffff", bold, "left", 1056);
    text([f.when, f.venue].filter(Boolean).join("  ·  "), 72, 510, 32, MUTED, reg, "left", 1056);
  }
}

function drawPlayer(g, f, { img, text, bold, reg }) {
  drawPortrait(g, f, img, text, bold);
  text(f.name, 72, 210, 64, "#ffffff", bold, "left", 620);
  text(f.team, 72, 260, 28, MUTED, reg, "left", 620);
  text("Stats, form and listed lines", 72, 400, 36, "#ffffff", reg, "left", 620);
}

function drawProp(g, f, { img, teamImg, oppImg, text, bold, reg }) {
  drawPortrait(g, f, img, text, bold);
  const left = 72, max = 620;
  text(f.name, left, 88, 52, "#ffffff", bold, "left", max);
  text(f.team, left, 126, 24, MUTED, reg, "left", max);
  const sub = [f.role, f.fmt].filter(Boolean).join("  ·  ");
  if (sub) text(sub, left, 154, 20, MUTED, reg, "left", max);
  drawMatchup(g, f, teamImg, oppImg, text, bold, left, 172);

  const last = f.last && Number.isFinite(Number(f.last.value)) ? Number(f.last.value) : null;
  const hit = f.hit && Number.isFinite(Number(f.hit.p)) ? Number(f.hit.p) : null;
  const y1 = 250;
  const cols = last != null
    ? [{ k: "Last", v: String(last), tone: last > f.line ? "up" : last < f.line ? "down" : "" }, { k: "Line", v: String(f.line) }, { k: "Prop", v: f.stat }]
    : [{ k: "Line", v: String(f.line) }, { k: "Prop", v: f.stat }, { k: "Price", v: f.price ? f.price.toFixed(2) : "–", tone: "up" }];
  cols.forEach((c, i) => drawMetric(g, c, left + i * 150, y1, text, bold, reg, 140));
  drawGauge(g, f, hit, text, bold, reg, 640, 286);

  const y2 = 360;
  const opp = f.opp ? `vs ${abbr(f.opp)}${f.when ? ` · ${f.when}` : ""}` : (f.match || "");
  const row2 = [
    hit != null ? { k: "Hit rate", v: `${Math.round(hit * 100)}%`, tone: hit >= 0.6 ? "up" : hit < 0.4 ? "down" : "" } : { k: "Format", v: f.fmt || "—" },
    last != null || hit != null ? { k: "Format", v: f.fmt || "—" } : { k: "Listed", v: f.book || "—" },
    { k: "Opponent", v: opp || "—" },
  ];
  row2.forEach((c, i) => drawMetric(g, c, left + i * 150, y2, text, bold, reg, i === 2 ? 280 : 140));

  if (last != null) drawLastBar(g, f, last, text, bold, reg, left, 448);
  if (f.price) drawPriceChip(g, f, text, bold, 1128, 548);
}

function drawMetric(g, { k, v, tone }, x, y, text, bold, reg, max = 160) {
  text(String(k).toUpperCase(), x, y, 16, MUTED, reg, "left", max);
  const color = tone === "up" ? GREEN : tone === "down" ? RED : "#ffffff";
  if (tone === "up" || tone === "down") {
    g.fillStyle = color;
    g.beginPath();
    if (tone === "up") { g.moveTo(x + 7, y + 18); g.lineTo(x + 14, y + 32); g.lineTo(x, y + 32); }
    else { g.moveTo(x + 7, y + 34); g.lineTo(x + 14, y + 20); g.lineTo(x, y + 20); }
    g.closePath(); g.fill();
    text(v, x + 22, y + 48, 36, color, bold, "left", max - 22);
  } else {
    text(v, x, y + 48, 36, color, bold, "left", max);
  }
}

function drawGauge(g, f, hit, text, bold, reg, cx, cy) {
  const r = 54, p = hit != null ? Math.max(0, Math.min(1, hit)) : (f.market != null ? Math.max(0, Math.min(1, f.market)) : 0.75);
  const tone = hit != null ? (p >= 0.6 ? GREEN : p < 0.4 ? RED : "#f5a524") : GREEN;
  const start = Math.PI * 0.75, span = Math.PI * 1.5;
  g.strokeStyle = HAIR; g.lineWidth = 8; g.lineCap = "round";
  g.beginPath(); g.arc(cx, cy, r, start, start + span); g.stroke();
  g.strokeStyle = tone;
  g.beginPath(); g.arc(cx, cy, r, start, start + span * p); g.stroke();
  if (f.price) text(f.price.toFixed(2), cx, cy + 8, 28, "#ffffff", bold, "center", 100);
  else if (hit != null) text(`${Math.round(hit * 100)}%`, cx, cy + 8, 28, "#ffffff", bold, "center", 100);
  text(f.book || "Listed", cx, cy + 78, 16, MUTED, reg, "center", 120);
}

function drawMatchup(g, f, teamImg, oppImg, text, bold, x, y) {
  const r = 26;
  logo(g, teamImg, abbr(f.team), x + r, y + r, r, text, bold);
  text("vs", x + r * 2 + 28, y + r + 8, 20, MUTED, bold, "center", 40);
  if (f.opp) logo(g, oppImg, abbr(f.opp), x + r * 2 + 56 + r, y + r, r, text, bold);
}

function logo(g, img, letters, cx, cy, r, text, bold) {
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.closePath(); g.clip();
  g.fillStyle = "#1c1c1e"; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  if (img) {
    const s = Math.max((r * 2) / img.width, (r * 2) / img.height), w = img.width * s, h = img.height * s;
    g.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  } else text(letters, cx, cy + 8, 18, GREEN, bold, "center", r * 2 - 8);
  g.restore();
  g.strokeStyle = HAIR; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
}

function drawPortrait(g, f, img, text, bold) {
  const x = 720, w = 480;
  if (img) {
    const s = Math.max(w / img.width, 630 / img.height), dw = img.width * s, dh = img.height * s;
    g.drawImage(img, x + (w - dw) / 2, (630 - dh) * 0.08, dw, dh);
  } else {
    g.fillStyle = "#1c1c1e"; g.fillRect(x + 40, 80, 400, 470);
    text(f.initials, x + 240, 360, 140, GREEN, bold, "center");
  }
  const fade = g.createLinearGradient(x - 30, 0, x + 200, 0);
  fade.addColorStop(0, BG); fade.addColorStop(0.55, "rgba(15,15,15,0.55)"); fade.addColorStop(1, "rgba(15,15,15,0)");
  g.fillStyle = fade; g.fillRect(x - 30, 0, 260, 630);
  const bot = g.createLinearGradient(0, 500, 0, 630);
  bot.addColorStop(0, "rgba(15,15,15,0)"); bot.addColorStop(1, "rgba(15,15,15,0.92)");
  g.fillStyle = bot; g.fillRect(x, 500, w, 130);
}

function drawPriceChip(g, f, text, bold, right, y) {
  const label = `${f.price.toFixed(2)}  ${f.book}`;
  g.font = `22px ${bold}`;
  const w = g.measureText(label).width + 36, h = 40, x = right - w;
  g.fillStyle = "#1c1c1e"; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill();
  g.strokeStyle = HAIR; g.lineWidth = 1; g.stroke();
  text(label, x + w / 2, y + 28, 22, "#ffffff", bold, "center", w - 16);
}

function drawLastBar(g, f, last, text, bold, reg, x, y) {
  const max = Math.max(last, f.line, 1) * 1.15;
  const h = 70, w = 64, fill = Math.max(6, (last / max) * h), lineY = y + h - (f.line / max) * h;
  const over = last > f.line;
  g.fillStyle = "#1c1c1e"; g.beginPath(); g.roundRect(x, y, w, h, 8); g.fill();
  g.fillStyle = over ? GREEN : RED;
  g.beginPath(); g.roundRect(x, y + h - fill, w, fill, 8); g.fill();
  g.strokeStyle = "#ffffff"; g.lineWidth = 2; g.setLineDash([4, 4]);
  g.beginPath(); g.moveTo(x - 4, lineY); g.lineTo(x + w + 48, lineY); g.stroke(); g.setLineDash([]);
  text(String(f.line), x + w + 10, lineY + 6, 16, MUTED, reg);
  text(String(last), x + w / 2, y + h - fill - 8, 18, "#ffffff", bold, "center", w);
  const cap = [f.last?.date, f.last?.vs ? `@${abbr(f.last.vs)}` : (f.opp ? `@${abbr(f.opp)}` : "")].filter(Boolean).join(" ");
  if (cap) text(cap, x, y + h + 22, 16, MUTED, reg, "left", 280);
}

function drawBrand(g, text, bold) {
  g.save(); g.translate(72, 548); g.scale(0.68, 0.68);
  const mark = g.createLinearGradient(0, 0, 64, 64); mark.addColorStop(0, "#3cf0a6"); mark.addColorStop(1, "#1fb877");
  g.fillStyle = mark; g.beginPath(); g.roundRect(0, 0, 64, 64, 15); g.fill();
  g.fillStyle = BG;
  for (const [x, y, w, h] of [[17, 14, 10, 37], [17, 14, 25, 10], [17, 29.5, 18, 10]]) { g.beginPath(); g.roundRect(x, y, w, h, 5); g.fill(); }
  g.beginPath(); g.arc(48.5, 19, 6, 0, Math.PI * 2); g.fill(); g.restore();
  text("Fancy", 128, 592, 34, "#ffffff", bold); const fw = (g.font = `34px ${bold}`, g.measureText("Fancy").width);
  text(".", 128 + fw, 592, 34, GREEN, bold); text("cash", 128 + fw + 10, 592, 34, "#ffffff", bold);
}
