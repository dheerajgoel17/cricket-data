// The shareable player poster (1080x1350, 4:5): the numbers of `cardFields` + `propForm` laid out as a stat sheet. Same data as the 1200x630 link card, drawn by api/og.js (`?poster=1`).
// Rows: header (name, team, format, crests, portrait) / stat grid + book lines box / one big bar chart against the line / brand. A block with no data shows "--" or is left out, never an empty label.
import { drawBrand, visibleBounds } from "./brand-draw.js";
const W = 1080, H = 1350, M = 44;
const GREEN = "#27da8e", RED = "#ff4444", AMBER = "#f5a524", MUTED = "#8e8e93", BG = "#0f0f0f", HAIR = "#2c2c2e", PANEL = "#161618";

const abbr = (n) => { const w = String(n || "").replace(/\(W\)/i, "").trim().split(/\s+/).filter(Boolean); return (w.length > 1 ? w.map((x) => x[0]).join("") : (w[0] || "?")).slice(0, 3).toUpperCase(); };
const pct = (p) => `${Math.round(p * 100)}%`;
const fmtAvg = (n) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1));
const tone = (p) => (p >= 0.6 ? GREEN : p < 0.4 ? RED : AMBER);

async function asImage(loadImage, buf) { if (!buf) return null; try { return await loadImage(buf); } catch { return null; } }

/** PNG buffer of the poster for a prop field set (`cardFields` + `propForm`). Image arguments are bytes or null. */
export async function renderPoster(f, { photo = null, jersey = null, teamLogo = null, oppLogo = null, bookMarks = {}, fonts = {} } = {}) {
  const { createCanvas, GlobalFonts, loadImage } = await import("@napi-rs/canvas");
  mk = createCanvas;
  if (fonts.bold) GlobalFonts.registerFromPath(fonts.bold, "CardBold");
  if (fonts.regular) GlobalFonts.registerFromPath(fonts.regular, "CardRegular");
  if (fonts.num) GlobalFonts.registerFromPath(fonts.num, "CardNum");
  if (fonts.brand) GlobalFonts.registerFromPath(fonts.brand, "CardBrand");
  const bold = fonts.bold ? "CardBold" : "sans-serif", reg = fonts.regular ? "CardRegular" : "sans-serif";
  const num = fonts.num ? "CardNum" : bold, brand = fonts.brand ? "CardBrand" : bold;
  const c = createCanvas(W, H), g = c.getContext("2d");
  g.fillStyle = BG; g.fillRect(0, 0, W, H);
  const text = (s, x, y, size, color, font = bold, align = "left", max = 0) => {
    g.font = `${size}px ${font}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = "alphabetic";
    let t = String(s ?? ""); if (max) while (g.measureText(t).width > max && t.length > 1) t = t.slice(0, -2) + "…";
    g.fillText(t, x, y); return g.measureText(t).width;
  };
  const [face, kit, teamImg, oppImg] = await Promise.all([photo, jersey, teamLogo, oppLogo].map((b) => asImage(loadImage, b)));
  const marks = Object.fromEntries(await Promise.all(Object.entries(bookMarks || {}).map(async ([k, v]) => [k, await asImage(loadImage, v)])));

  portrait(g, f, face, kit, text, bold);
  // header
  text(f.name, M, 92, 62, "#ffffff", bold, "left", 540);
  text(f.team, M, 142, 30, MUTED, reg, "left", 540);
  text([f.fmt, f.role].filter(Boolean).join(" · "), M, 184, 30, MUTED, reg, "left", 540);
  crest(g, teamImg, abbr(f.team), M + 85, 330, 170, text, bold, 130); // full-size crests, no container
  if (f.opp) { text("v", M + 170 + 24, 340, 30, MUTED, bold, "center", 40); crest(g, oppImg, abbr(f.opp), M + 170 + 48 + 85, 330, 170, text, bold, 130); }
  g.fillStyle = HAIR; g.fillRect(0, 440, W, 2);

  // stat grid: label row / value row, three columns
  const cx = [M, 250, 456], cws = [196, 196, 274];
  const cell = (col, row, label, value, color = "#ffffff", opts = {}) => {
    const ly = 512 + row * 120, vy = ly + 52, x = cx[col], cw = cws[col];
    text(label, x, ly, 26, MUTED, num, "left", cw);
    let vx = x;
    if (opts.arrow) { tri(g, x, vy - 6, opts.arrow === "up", color); vx = x + 34; }
    const w = text(value, vx, vy, opts.size || 46, value === "--" ? MUTED : color, opts.font || num, "left", cw - (vx - x));
    if (opts.sub) text(opts.sub, vx + w + 10, vy, 24, MUTED, num, "left", cw - (vx - x) - w - 10);
  };
  const season = f.season;
  cell(0, 0, `${f.year || ""} AVG`, season?.mean != null ? fmtAvg(season.mean) : "--", season?.mean != null ? (season.mean > f.line ? GREEN : RED) : MUTED, season?.mean != null ? { arrow: season.mean > f.line ? "up" : "down" } : {});
  cell(1, 0, "LINE", `Over ${f.line}`);
  cell(2, 0, "PROP", f.stat || "--", "#ffffff", { font: bold, size: 27 });
  cell(0, 1, `${f.year || ""} HIT RATE`, season?.p != null ? pct(season.p) : "--", season?.p != null ? tone(season.p) : MUTED, season?.p != null ? { arrow: season.p >= 0.5 ? "up" : "down", sub: `${season.hits}/${season.played}` } : {});
  cell(1, 1, f.fair ? `FAIR · ${f.fair.label}` : "FAIR", f.fair?.odds ? f.fair.odds.toFixed(2) : "--");
  cell(2, 1, f.book ? `LISTED · ${String(f.book).toUpperCase()}` : "LISTED", f.price ? f.price.toFixed(2) : "--", GREEN);
  const l5p = f.l5?.p;
  cell(0, 2, "LAST 5 HIT", l5p != null ? pct(l5p) : "--", l5p != null ? tone(l5p) : MUTED, l5p != null ? { sub: `${f.l5.hits}/${f.l5.played}` } : {});
  cell(1, 2, f.h2h ? `VS ${abbr(f.h2h.name)}` : "VS OPP", f.h2h?.p != null ? pct(f.h2h.p) : "--", f.h2h?.p != null ? tone(f.h2h.p) : MUTED, f.h2h?.p != null ? { sub: `${f.h2h.hits}/${f.h2h.played}` } : {});
  const ag = f.atGround;
  cell(2, 2, ag ? `AT ${String(ag.name).toUpperCase()}` : "AT GROUND", ag?.p != null ? pct(ag.p) : "--", ag?.p != null ? tone(ag.p) : MUTED, ag?.p != null ? { sub: `${ag.hits}/${ag.played}` } : {});

  // book lines: every line the books list, best over price at each, the one on show outlined
  const bl = (f.bookLines || []).slice(0, 4);
  if (bl.length > 1) {
    const bx = 740, by = 470, bw = W - M - bx, bh = 64 + bl.length * 80 + 4;
    g.fillStyle = PANEL; g.beginPath(); g.roundRect(bx, by, bw, bh, 26); g.fill();
    g.strokeStyle = HAIR; g.lineWidth = 2; g.stroke();
    text(f.bookTitle || "BOOK LINES", bx + 24, by + 46, 24, MUTED, num);
    bl.forEach((b, i) => {
      const y = by + 112 + i * 80, on = !!b.best;
      if (on) { g.strokeStyle = GREEN; g.lineWidth = 2; g.beginPath(); g.roundRect(bx + 12, y - 44, bw - 24, 78, 14); g.stroke(); }
      text(String(b.line), bx + 28, y, 38, "#ffffff", num, "left", 120);
      text(b.price.toFixed(2), bx + bw - 28, y, 38, on ? GREEN : MUTED, num, "right", 100);
      const mk = marks[b.stem]; // the book's own logo; its name only when there is no logo file
      if (mk) chip(g, mk, bx + 28, y + 6, 130, 22); else text(String(b.book || ""), bx + 28, y + 22, 16, MUTED, reg, "left", bw - 56);
    });
  }

  // chart: his last games against the line
  const bars = (f.recent && f.recent.length ? f.recent : f.last5 || []).slice(-8);
  if (bars.length) {
    const ct = 890, cb = 1140, x0 = 150, x1 = W - M, n = bars.length, gap = 14;
    const bw = Math.floor((x1 - x0 - gap * (n - 1)) / n);
    const ymax = Math.max(f.line, ...bars.map((b) => b.value), 1) * 1.15;
    const ly = cb - (f.line / ymax) * (cb - ct);
    text("0", M, cb, 30, MUTED, num);
    bars.forEach((b, i) => {
      const x = x0 + i * (bw + gap), fill = Math.max(0, (b.value / ymax) * (cb - ct));
      g.fillStyle = b.value === f.line ? AMBER : b.value > f.line ? GREEN : RED;
      g.beginPath(); g.roundRect(x, cb - fill, bw, fill, 6); g.fill();
      text(String(b.value), x + bw / 2, cb - 12, 40, fill >= 56 ? BG : "#ffffff", num, "center", bw);
      text(b.date || "", x + bw / 2, cb + 40, 24, MUTED, reg, "center", bw + gap);
      text(abbr(b.vs), x + bw / 2, cb + 76, 24, MUTED, reg, "center", bw + gap);
    });
    g.fillStyle = "#ffffff"; g.fillRect(x0 - 24, ly - 1, x1 - x0 + 24, 2); // the line
    text(String(f.line), M, ly - 10, 34, "#ffffff", num);
  }

  // the site's own brand, as its header draws it
  drawBrand(g, M, H - 100, 52, bold);
  return c.toBuffer("image/png");
}

function tri(g, x, y, up, color) {
  g.fillStyle = color; g.beginPath();
  if (up) { g.moveTo(x + 11, y - 22); g.lineTo(x + 22, y); g.lineTo(x, y); } else { g.moveTo(x + 11, y); g.lineTo(x + 22, y - 22); g.lineTo(x, y - 22); }
  g.closePath(); g.fill();
}

let mk = null; // createCanvas, set when a picture is drawn (the logo-trimming scratch canvas)
/** A team crest at full size in a `box` x `boxH` area: the logo alone (no circle, tile or padding), contained; the team's letters when there is no image. */
function crest(g, img, letters, cx, cy, box, text, bold, boxH = box) {
  if (img) {
    const v = img.__vis || (img.__vis = visibleBounds(mk, img)), k = Math.min(box / v.sw, boxH / v.sh), w = v.sw * k, h = v.sh * k;
    g.drawImage(img, v.sx, v.sy, v.sw, v.sh, cx - w / 2, cy - h / 2, w, h);
  } else text(letters, cx, cy + boxH * 0.17, boxH * 0.5, MUTED, bold, "center", box);
}

/** A bookmaker's logo alone (no pill), fitted in maxW x h. */
function chip(g, img, x, y, maxW, h) {
  const k = Math.min(maxW / img.width, h / img.height);
  g.drawImage(img, x, y, img.width * k, img.height * k);
}

/** Face and shirt as the site stacks them (shirt over the bottom third of the face), bottom-aligned at the header's rule, clipped to the header. */
function portrait(g, f, img, kit, text, bold) {
  const w = 460, x = 580, bottom = 440;
  g.save(); g.beginPath(); g.rect(0, 0, W, bottom); g.clip();
  const glow = g.createRadialGradient(x + w / 2, 250, 0, x + w / 2, 250, 320);
  glow.addColorStop(0, "rgba(39,218,142,0.22)"); glow.addColorStop(1, "rgba(39,218,142,0)");
  g.fillStyle = glow; g.fillRect(480, 0, 600, bottom);
  if (!img) { text(f.initials || "?", x + w / 2, 290, 150, GREEN, bold, "center"); g.restore(); return; }
  const faceH = w * (img.height / img.width);
  if (!kit) g.drawImage(img, x, bottom - faceH, w, faceH);
  else {
    const kitH = w * (kit.height / kit.width), kitTop = faceH * 0.666, top = bottom - (kitTop + kitH);
    g.drawImage(img, x, top, w, faceH); g.drawImage(kit, x, top + kitTop, w, kitH);
  }
  g.restore();
}
