// The share card of a page (1200x630): what a link preview shows. `cardFields` picks the words and numbers from the data files (never from a model), `renderCard` draws them.
// Used by api/og.js (the image) and api/share.js (the page a link preview reads). Plain ESM; the drawing library is loaded only when a card is drawn.
import { STATS } from "./rules.js";
import { bookFormatFor, bookLinesFor, bookName, keepMsFor, overProb, teamKey } from "./lines.js";
import { playerPhotos, teamJerseys, teamLogos } from "./photos.js";
import { windowRate } from "./windows.js";
export { CARD_V, cardPath, cardQuery } from "./card-path.js";

const num = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const initials = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const when = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false }) + " UTC"; };
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
const LISTED_STATS = ["runs", "wickets", "fours", "sixes"];

const dateShort = (d) => {
  const x = new Date(`${String(d || "").slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(+x) ? "" : x.toLocaleString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};
const fmtAvg = (n) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1));

/**
 * Last five played innings vs the line (L5 mean, hit rate, last innings). `rows` are oldest → newest
 * `{ value, date, opp }`; DNP / VOID (`value == null`) never count. Numbers come from the rows, never invented.
 */
export function propForm(rows, line, teamName) {
  const entries = (rows || []).filter((r) => r && r.value != null && Number.isFinite(Number(r.value))).map((r) => ({
    value: Number(r.value),
    date: r.date,
    opp: typeof teamName === "function" ? teamName(r.opp) : (r.vs || r.opp || ""),
  }));
  if (!entries.length || !Number.isFinite(Number(line))) return {};
  const l5 = windowRate(entries, 5, Number(line));
  const last = entries[entries.length - 1];
  return {
    l5,
    hit: l5.p != null ? { p: l5.p, n: l5.played } : undefined,
    last: last ? { value: last.value, date: dateShort(last.date), vs: last.opp } : undefined,
    last5: entries.slice(-5).map((e) => ({ value: e.value, date: dateShort(e.date), vs: e.opp })),
  };
}

/** The line the books hang for this player (soonest match, runs first) so a /share/player/<idx> URL is not an empty name card. */
function listedLine(pid, doc) {
  for (const stat of LISTED_STATS) {
    const fmt = bookFormatFor(doc, pid, stat, undefined, keepMsFor("Test"));
    if (!fmt) continue;
    const b = bookLinesFor(doc, pid, stat, fmt, undefined, keepMsFor(fmt));
    if (b?.main && Number.isFinite(b.main.line)) return { stat, line: b.main.line };
  }
  return null;
}

/** A player id (8 hex characters) as his index in the player table, or null. */
const pidIndex = (pid, data) => { const i = /^[0-9a-f]{8}$/.test(String(pid ?? "")) ? data.index?.players?.id?.indexOf(pid) : -1; return i >= 0 ? i : null; };

/**
 * The fields of a card from the query: `p` (player index) or `pid` (his id) with optional `stat` and `line` for a prop, or `f` (fixture id).
 * `data` is { index, photos, lines, fixtures } as the site data files hold them. Returns null when nothing matches (the caller serves the plain site card).
 */
export function cardFields(q, data) {
  const idx = num(q.p) ?? pidIndex(q.pid, data);
  if (idx != null) {
    const P = data.index?.players;
    const name = P?.nm?.[idx];
    if (!name) return null;
    const pid = P.id[idx], indexTeam = data.index.teams?.[P.tm?.[idx]]?.n || "";
    let stat = STATS[q.stat] ? q.stat : null, line = num(q.line);
    if (stat == null || line == null) {
      const listed = listedLine(pid, data.lines); // a player URL with no line still shows his booked prop, not an empty name card
      if (listed) { stat = listed.stat; line = listed.line; }
    }
    const f = { kind: stat && line != null ? "prop" : "player", name, team: indexTeam, initials: initials(name), photos: biggerPhoto(playerPhotos(data.photos, pid)), idx };
    f.kitPhotos = teamJerseys(data.photos, indexTeam, false); // a prop card below swaps in the format's kit
    if (f.kind === "prop") {
      f.statKey = stat; f.stat = STATS[stat].label; f.line = line; f.role = ROLE[STATS[stat].side] || "";
      const hits = (data.lines?.lines || []).filter((l) => l.pid === pid && l.stat === stat && Math.abs(l.line - line) < 0.01);
      const row = hits[0];
      if (row?.team) f.team = row.team;
      if (row) {
        f.match = row.match;
        f.fmt = row.fmt || "";
        f.opp = otherSide(row.match, f.team);
      }
      const prices = hits.flatMap((l) => (l.books || []).filter((b) => b.over > 1).map((b) => ({ over: b.over, under: b.under, book: bookName(b.source), source: b.source })));
      const best = prices.sort((x, y) => y.over - x.over)[0];
      if (best) {
        f.price = best.over; f.book = best.book; f.source = best.source; f.books = prices.length;
        if (best.under > 1) { f.under = best.under; f.market = overProb(best.over, best.under); }
      }
      f.teamPhotos = teamLogos(data.photos, f.team);
      f.kitPhotos = teamJerseys(data.photos, f.team, f.fmt === "Test");
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

/**
 * Draws the card as a JPEG buffer (a fraction of the size of a PNG: link previews drop pictures over ~300 KB).
 * Fonts match the site: Satoshi for names/body (`bold` / `regular`), Barlow Condensed for figures (`num`) and the Fancy.cash wordmark (`brand`).
 * `photo` / `jersey` / `teamLogo` / `oppLogo` / `bookLogo` / `brandLogo` are image bytes or null.
 */
export async function renderCard(f, { photo = null, jersey = null, teamLogo = null, oppLogo = null, bookLogo = null, brandLogo = null, fonts = {} } = {}) {
  const { createCanvas, GlobalFonts, loadImage } = await import("@napi-rs/canvas");
  if (fonts.bold) GlobalFonts.registerFromPath(fonts.bold, "CardBold");
  if (fonts.regular) GlobalFonts.registerFromPath(fonts.regular, "CardRegular");
  if (fonts.num) GlobalFonts.registerFromPath(fonts.num, "CardNum");
  if (fonts.brand) GlobalFonts.registerFromPath(fonts.brand, "CardBrand");
  const bold = fonts.bold ? "CardBold" : "sans-serif";
  const reg = fonts.regular ? "CardRegular" : "sans-serif";
  const num = fonts.num ? "CardNum" : bold;
  const brand = fonts.brand ? "CardBrand" : bold;
  const c = createCanvas(1200, 630), g = c.getContext("2d");
  g.fillStyle = BG; g.fillRect(0, 0, 1200, 630);
  const text = (s, x, y, size, color, font = bold, align = "left", max = 0) => {
    g.font = `${size}px ${font}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = "alphabetic";
    let t = String(s ?? ""); if (max) while (g.measureText(t).width > max && t.length > 1) t = t.slice(0, -2) + "…";
    g.fillText(t, x, y); return g.measureText(t).width;
  };
  const img = await asImage(loadImage, photo);
  const kit = await asImage(loadImage, jersey);
  const teamImg = await asImage(loadImage, teamLogo);
  const oppImg = await asImage(loadImage, oppLogo);
  const bookImg = await asImage(loadImage, bookLogo);
  const brandImg = await asImage(loadImage, brandLogo);

  if (f.kind === "prop") drawProp(g, f, { img, kit, teamImg, oppImg, bookImg, text, bold, reg, num });
  else if (f.kind === "fixture" || f.kind === "venue") drawPlain(g, f, { text, bold, reg });
  else drawPlayer(g, f, { img, kit, text, bold, reg });
  drawBrand(g, text, brand, brandImg);
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

function drawPlayer(g, f, { img, kit, text, bold, reg }) {
  drawKitPortrait(g, f, img, kit, text, bold);
  text("PLAYER", 72, 150, 22, GREEN, reg, "left", 560);
  text(f.name, 72, 232, 72, "#ffffff", bold, "left", 580);
  text(f.team, 72, 284, 30, MUTED, reg, "left", 580);
  text("Hit rates, form and listed lines", 72, 420, 36, "#ffffff", reg, "left", 580);
  text("Free, with every price in decimal", 72, 468, 26, MUTED, reg, "left", 580);
}

function drawProp(g, f, { img, kit, teamImg, oppImg, bookImg, text, bold, reg, num }) {
  // Cricket-stats share card: name (Satoshi) → hero line + decimal price (condensed) → crests → L5 chart → metric pills. Portrait right.
  drawKitPortrait(g, f, img, kit, text, bold);
  const left = 64, col = 560;

  // Soft left rail so the type column reads as one composition against the portrait.
  g.fillStyle = "rgba(39,218,142,0.55)";
  g.fillRect(40, 96, 4, 430);

  text(f.name, left, 112, 52, "#ffffff", bold, "left", col);
  const meta = [f.fmt, f.role, f.team].filter(Boolean).join("  ·  ");
  if (meta) text(meta.toUpperCase(), left, 142, 18, MUTED, num, "left", col);

  // Hero: STAT + OVER line (condensed) beside the book chip and a big decimal price.
  text(String(f.stat || "").toUpperCase(), left, 188, 20, GREEN, num, "left", 220);
  const lineLabel = `OVER ${f.line}`;
  text(lineLabel, left, 248, 64, "#ffffff", num, "left", 320);
  if (f.price) {
    const priceX = left + 340;
    if (bookImg || f.book) {
      bookChip(g, { img: bookImg, name: f.book }, priceX, 198, bookImg ? 100 : Math.min(120, 20 + String(f.book || "").length * 10), 38, text, bold);
    }
    text(f.price.toFixed(2), priceX, 268, 56, GREEN, num, "left", 160);
  }

  drawMatchup(g, f, teamImg, oppImg, text, bold, left, 292);
  const vs = f.team && f.opp ? `${abbr(f.team)} v ${abbr(f.opp)}` : (f.opp ? `vs ${abbr(f.opp)}` : "");
  if (vs) text(vs, left + 128, 326, 22, MUTED, reg, "left", 360);

  const avg = f.l5 && Number.isFinite(Number(f.l5.mean)) ? Number(f.l5.mean) : null;
  const last = f.last && Number.isFinite(Number(f.last.value)) ? Number(f.last.value) : null;
  const hit = f.l5 && Number.isFinite(Number(f.l5.p)) ? Number(f.l5.p) : (f.hit && Number.isFinite(Number(f.hit.p)) ? Number(f.hit.p) : null);

  text("LAST 5", left, 368, 16, MUTED, num, "left", 120);
  if ((f.last5 && f.last5.length) || last != null) drawLast5(g, f, last, text, bold, reg, num, left, 380, 520, 128);

  // Metric pills — condensed figures, cricket scoreboard feel.
  let px = left;
  if (avg != null) px = metricPill(g, text, num, px, 580, "L5 AVG", fmtAvg(avg)) + 14;
  if (hit != null) metricPill(g, text, num, px, 580, "HIT", `${Math.round(hit * 100)}%`, hit >= 0.6 ? GREEN : hit < 0.4 ? RED : "#f5a524");
}

/** Compact label + condensed value in a tonal pill (share-card metrics only). */
function metricPill(g, text, num, x, y, k, v, tone = "#ffffff") {
  g.font = `28px ${num}`;
  const vw = g.measureText(String(v)).width;
  g.font = `14px ${num}`;
  const kw = g.measureText(String(k)).width;
  const w = Math.max(kw, vw) + 36, h = 52;
  g.fillStyle = "#1c1c1e";
  g.beginPath(); g.roundRect(x, y - 34, w, h, 12); g.fill();
  text(k, x + 18, y - 12, 14, MUTED, num, "left", w - 28);
  text(v, x + 18, y + 12, 28, tone, num, "left", w - 28);
  return x + w;
}

function drawMetric(g, { k, v, tone, img, chip }, x, y, text, bold, reg, max = 160) {
  text(String(k).toUpperCase(), x, y, 16, MUTED, reg, "left", max);
  if (img) { mark(g, img, x, y + 22, Math.min(max, 120), 26); return; }
  const color = tone === "up" ? GREEN : tone === "down" ? RED : "#ffffff";
  if (tone === "up" || tone === "down") {
    g.fillStyle = color;
    g.beginPath();
    if (tone === "up") { g.moveTo(x + 7, y + 18); g.lineTo(x + 14, y + 32); g.lineTo(x, y + 32); }
    else { g.moveTo(x + 7, y + 34); g.lineTo(x + 14, y + 20); g.lineTo(x, y + 20); }
    g.closePath(); g.fill();
    const w = text(v, x + 22, y + 48, 36, color, bold, "left", max - 22);
    if (chip) bookChip(g, chip, x + 22 + w + 12, y + 14, 82, 36, text, bold);
  } else {
    text(v, x, y + 48, 36, color, reg, "left", max);
  }
}

/** The bookmaker's mark on a white pill (logos are drawn for dark or light grounds, a white pill reads for all); its name when there is no logo file. */
function bookChip(g, { img, name }, x, y, w, h, text, bold) {
  g.fillStyle = "#ffffff"; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill();
  if (img) mark(g, img, x + 10, y + 6, w - 20, h - 12);
  else if (name) text(name, x + w / 2, y + h / 2 + 7, 18, BG, bold, "center", w - 14);
}

function drawGauge(g, f, hit, text, bold, cx, cy) {
  const r = 54, p = hit != null ? Math.max(0, Math.min(1, hit)) : (f.market != null ? Math.max(0, Math.min(1, f.market)) : 0.75);
  const tone = hit != null ? (p >= 0.6 ? GREEN : p < 0.4 ? RED : "#f5a524") : GREEN;
  const start = Math.PI * 0.75, span = Math.PI * 1.5;
  g.strokeStyle = HAIR; g.lineWidth = 8; g.lineCap = "round";
  g.beginPath(); g.arc(cx, cy, r, start, start + span); g.stroke();
  g.strokeStyle = tone;
  g.beginPath(); g.arc(cx, cy, r, start, start + span * p); g.stroke();
  if (f.price) text(f.price.toFixed(2), cx, cy + 8, 28, "#ffffff", bold, "center", 100);
  else if (hit != null) text(`${Math.round(hit * 100)}%`, cx, cy + 8, 28, "#ffffff", bold, "center", 100);
}

function drawMatchup(g, f, teamImg, oppImg, text, bold, x, y) {
  const r = 26;
  logo(g, teamImg, abbr(f.team), x + r, y + r, r, text, bold);
  text("vs", x + r * 2 + 28, y + r + 8, 20, MUTED, bold, "center", 40);
  if (f.opp) logo(g, oppImg, abbr(f.opp), x + r * 2 + 56 + r, y + r, r, text, bold);
}

function logo(g, img, letters, cx, cy, r, text, bold) {
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.closePath();
  g.fillStyle = "#ffffff"; g.fill();
  g.clip();
  if (img) {
    const pad = r * 0.18, box = (r - pad) * 2;
    const s = Math.min(box / img.width, box / img.height), w = img.width * s, h = img.height * s;
    g.drawImage(img, cx - w / 2, cy - r + pad, w, h); // sit at the tip of the circle so a crest is not cropped
  } else text(letters, cx, cy + 8, 18, GREEN, bold, "center", r * 2 - 8);
  g.restore();
  g.strokeStyle = HAIR; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
}

/** The book's own mark, top-right, inside the ~64 px inset X's 2:1 crop leaves. */
function drawBookTip(g, f, bookImg, text, bold) {
  const right = 1136, y = 36;
  if (bookImg) mark(g, bookImg, right, y, 180, 40, "right");
  else if (f.book) text(f.book, right, y + 28, 22, "#ffffff", bold, "right", 200);
}

function mark(g, img, x, y, maxW, maxH, align = "left") {
  const s = Math.min(maxW / img.width, maxH / img.height), w = img.width * s, h = img.height * s;
  g.drawImage(img, align === "right" ? x - w : x, y + (maxH - h) / 2, w, h);
}

/**
 * The player standing in his team's shirt, the way the site shows him: the face avatar and the shirt are the same width and the shirt rides up over the bottom third of the avatar,
 * so its collar hides the avatar's cut edge. Bottom-aligned on the right of the card over a soft green glow. Without a shirt it is the avatar alone; without a photo, the initials.
 */
function drawKitPortrait(g, f, img, kit, text, bold) {
  const w = 500, x = 640, bottom = 630;
  const glow = g.createRadialGradient(x + w / 2, 400, 0, x + w / 2, 400, 360);
  glow.addColorStop(0, "rgba(39,218,142,0.22)"); glow.addColorStop(1, "rgba(39,218,142,0)");
  g.fillStyle = glow; g.fillRect(560, 0, 640, 630);
  if (!img) {
    g.fillStyle = "#1c1c1e"; g.beginPath(); g.roundRect(x + 90, 150, 320, 400, 40); g.fill();
    text(f.initials, x + 250, 400, 140, GREEN, bold, "center");
    return;
  }
  const faceH = w * (img.height / img.width);
  if (!kit) { g.drawImage(img, x, bottom - faceH, w, faceH); return; }
  const kitH = w * (kit.height / kit.width), kitTop = faceH * 0.666; // the shirt covers the bottom third of the face picture
  const total = kitTop + kitH, top = bottom - total;
  g.drawImage(img, x, top, w, faceH);
  g.drawImage(kit, x, top + kitTop, w, kitH);
}

function drawPriceChip(g, f, bookImg, text, bold, right, y) {
  const price = f.price.toFixed(2);
  g.font = `22px ${bold}`;
  const tw = g.measureText(price).width, markW = bookImg ? Math.min(110, bookImg.width * (22 / bookImg.height)) + 12 : 0;
  const w = tw + markW + 36, h = 40, x = right - w;
  g.fillStyle = "#1c1c1e"; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill();
  g.strokeStyle = HAIR; g.lineWidth = 1; g.stroke();
  text(price, x + 18, y + 28, 22, "#ffffff", bold, "left", tw + 8);
  if (bookImg) mark(g, bookImg, x + w - 16, y + 9, 110, 22, "right");
}

/** Last five played innings vs the line. Default size is the small tip strip; prop cards pass a large chart box. Values use condensed figures. */
function drawLast5(g, f, last, text, bold, reg, num, x, y, chartW = 200, chartH = 64) {
  const bars = (f.last5 && f.last5.length ? f.last5 : [{ value: last }]).slice(-5);
  const vals = bars.map((b) => Number(b.value)).filter(Number.isFinite);
  if (!vals.length) return;
  const max = Math.max(f.line, ...vals, 1) * 1.2;
  const n = bars.length, gap = Math.max(8, Math.round(chartW * 0.035));
  const w = Math.max(26, Math.floor((chartW - gap * (n - 1)) / n));
  const total = n * w + (n - 1) * gap;
  const h = chartH;
  const lineY = y + h - (f.line / max) * h;
  bars.forEach((b, i) => {
    const v = Number(b.value);
    if (!Number.isFinite(v)) return;
    const bx = x + i * (w + gap);
    const fill = Math.max(4, (v / max) * h);
    g.fillStyle = "#1c1c1e"; g.beginPath(); g.roundRect(bx, y, w, h, 8); g.fill();
    const tone = v === f.line ? "#f5a524" : v > f.line ? GREEN : RED;
    g.fillStyle = tone;
    g.beginPath(); g.roundRect(bx, y + h - fill, w, fill, 8); g.fill();
    // Value sits above the fill when there is room; otherwise inside the bar in white.
    const above = fill < h - 28;
    text(String(v), bx + w / 2, above ? y + h - fill - 8 : y + h - fill + 22, above ? 22 : 20, above ? "#ffffff" : BG, num, "center", w + 8);
    if (b.vs) text(abbr(b.vs), bx + w / 2, y + h + 22, 15, MUTED, reg, "center", w + 12);
  });
  g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 2; g.setLineDash([5, 5]);
  g.beginPath(); g.moveTo(x - 4, lineY); g.lineTo(x + total + 8, lineY); g.stroke(); g.setLineDash([]);
  text(String(f.line), x + total + 12, lineY + 6, 18, MUTED, num);
}

/** Fancy.cash mark first, then the wordmark (Barlow Condensed Black) — top-right, inside the ~64 px inset X's 2:1 crop leaves. */
function drawBrand(g, text, brand, brandImg) {
  const size = 48, right = 1136, y = 36, sizeT = 28, gap = 14;
  g.font = `${sizeT}px ${brand}`;
  const fw = g.measureText("Fancy").width, dw = 8, cw = g.measureText("cash").width;
  const x0 = right - (size + gap + fw + dw + cw); // F mark leads the group
  if (brandImg) mark(g, brandImg, x0, y, size, size);
  else {
    g.save(); g.translate(x0, y); g.scale(size / 64, size / 64);
    const markFill = g.createLinearGradient(0, 0, 64, 64); markFill.addColorStop(0, "#3cf0a6"); markFill.addColorStop(1, "#1fb877");
    g.fillStyle = markFill; g.beginPath(); g.roundRect(0, 0, 64, 64, 15); g.fill();
    g.fillStyle = "#0f0f0f";
    for (const [bx, by, w, h] of [[17, 14, 10, 37], [17, 14, 25, 10], [17, 29.5, 18, 10]]) { g.beginPath(); g.roundRect(bx, by, w, h, 5); g.fill(); }
    g.beginPath(); g.arc(48.5, 19, 6, 0, Math.PI * 2); g.fill(); g.restore();
  }
  const tx = x0 + size + gap, ty = y + 34;
  text("Fancy", tx, ty, sizeT, "#ffffff", brand);
  text(".", tx + fw, ty, sizeT, GREEN, brand);
  text("cash", tx + fw + dw, ty, sizeT, "#ffffff", brand);
}
