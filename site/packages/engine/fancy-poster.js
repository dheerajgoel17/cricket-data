// The shareable Match Fancy poster (1080x1350, 4:5), the fancy twin of poster.js: one market of one fixture, from the engine's own `marketRow` (the numbers the Match Fancy tab shows).
// Rows: sides + crests / market and scope / Over and Under tiles (line, best price, book) / stat row (hit rate of the better side, at the ground, fair price) / last ten results against the line / brand.
import { drawBrand, visibleBounds } from "./brand-draw.js";
import { MATCH_KEYS, TEAM_KEYS, fancyInputs, fancySample, marketRow, parseFm } from "./fancy-edge.js";
import { bookName } from "./lines.js";
import { FORMATS } from "./util.js";

const W = 1080, H = 1350, M = 44;
const GREEN = "#27da8e", RED = "#ff4444", AMBER = "#f5a524", MUTED = "#8e8e93", BG = "#0f0f0f", HAIR = "#2c2c2e", PANEL = "#161618";
const pct = (p) => `${Math.round(p * 100)}%`;
const tone = (p) => (p >= 0.6 ? GREEN : p < 0.4 ? RED : AMBER);
const labelOf = (key, scope) => [...(scope < 0 ? MATCH_KEYS : TEAM_KEYS)].find(([k]) => k === key)?.[1] ?? key.replace(/_/g, " ");

/** The poster's fields for `fm` (+ `sc`, the team index or -1) of fixture `id`, or null when the fixture, the market or its books are not there. `doc` is lines.json, `fixtures` the schedule rows. */
export function fancyPosterFields(store, doc, fixtures, { id, fm, sc = -1, lastN = 10 }) {
  const f = (fixtures || []).find((x) => x.id === id);
  if (!f || !(f.a_ix >= 0) || !(f.b_ix >= 0)) return null;
  const { key, inn } = parseFm(fm), scope = Number.isFinite(Number(sc)) ? Number(sc) : -1;
  const { ground, teams } = fancyInputs(store, f);
  const teamName = scope >= 0 ? teams.find(([, i]) => i === scope)?.[0] ?? null : null;
  if (scope >= 0 && !teamName) return null;
  const ms = fancySample(store, { fmt: FORMATS.indexOf(f.fmt), gender: f.gender === "female" ? 1 : 0, teams, scope, lastN });
  const startMs = Date.parse(f.start);
  const r = ms.length ? marketRow({ store, doc, fxInfo: { a: f.a, b: f.b, fmt: f.fmt, startMs }, ms, scope, teamName, key, ground, inn }) : null;
  if (!r) return null;
  const mine = r.side === "over" ? r.over : r.under;
  return { kind: "fancy", id, key, inn, scope, label: labelOf(key, scope), team: teamName, a: f.a, b: f.b, fmt: f.fmt, series: f.series || "", female: f.gender === "female", batFirst: r.batFirst,
    line: r.line, overLine: r.overLine, underLine: r.underLine, over: r.over, under: r.under, overBook: r.overBook ? bookName(r.overBook) : "", underBook: r.underBook ? bookName(r.underBook) : "",
    side: r.side, edge: r.edge, hits: r.hits, played: r.played, chance: r.chance, fair: r.chance > 0 && mine ? 1 / r.chance : null, at: r.at, last: r.last };
}

async function asImage(loadImage, buf) { if (!buf) return null; try { return await loadImage(buf); } catch { return null; } }
let mk = null;

/** PNG buffer of the poster for `fancyPosterFields`. `aLogo` / `bLogo` are image bytes or null (the side's letters then). */
export async function renderFancyPoster(f, { aLogo = null, bLogo = null, fonts = {} } = {}) {
  const { createCanvas, GlobalFonts, loadImage } = await import("@napi-rs/canvas");
  mk = createCanvas;
  if (fonts.bold) GlobalFonts.registerFromPath(fonts.bold, "CardBold");
  if (fonts.regular) GlobalFonts.registerFromPath(fonts.regular, "CardRegular");
  if (fonts.num) GlobalFonts.registerFromPath(fonts.num, "CardNum");
  const bold = fonts.bold ? "CardBold" : "sans-serif", reg = fonts.regular ? "CardRegular" : "sans-serif", num = fonts.num ? "CardNum" : bold;
  const c = createCanvas(W, H), g = c.getContext("2d");
  g.fillStyle = BG; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 120, 0, W / 2, 120, 640);
  glow.addColorStop(0, "rgba(39,218,142,0.16)"); glow.addColorStop(1, "rgba(39,218,142,0)");
  g.fillStyle = glow; g.fillRect(0, 0, W, 700);
  const text = (s, x, y, size, color, font = bold, align = "left", max = 0) => {
    g.font = `${size}px ${font}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = "alphabetic";
    let t = String(s ?? ""); if (max) while (g.measureText(t).width > max && t.length > 1) t = t.slice(0, -2) + "…";
    g.fillText(t, x, y); return g.measureText(t).width;
  };
  const [ai, bi] = await Promise.all([aLogo, bLogo].map((b) => asImage(loadImage, b)));

  // sides
  text([f.series, f.fmt].filter(Boolean).join(" · "), W / 2, 70, 28, MUTED, reg, "center", W - 2 * M);
  crest(g, ai, f.a, 250, 200, 150, text, bold);
  text("v", W / 2, 218, 34, MUTED, bold, "center");
  crest(g, bi, f.b, W - 250, 200, 150, text, bold);
  text(f.a, 250, 318, 30, "#ffffff", bold, "center", 400);
  text(f.b, W - 250, 318, 30, "#ffffff", bold, "center", 400);
  g.fillStyle = HAIR; g.fillRect(0, 356, W, 2);

  // the market
  text(f.label, W / 2, 440, 68, "#ffffff", bold, "center", W - 2 * M);
  text([f.team || "Whole match", f.batFirst ? "If bats first" : ""].filter(Boolean).join(" · "), W / 2, 488, 30, MUTED, reg, "center", W - 2 * M);

  // over / under tiles: each side's own line, best price and book; the better side outlined
  const tw = (W - 2 * M - 24) / 2;
  [["OVER", f.overLine, f.over, f.overBook, "over"], ["UNDER", f.underLine, f.under, f.underBook, "under"]].forEach(([name, line, price, book, side], i) => {
    const x = M + i * (tw + 24), y = 526, h = 250, on = f.side === side;
    g.fillStyle = PANEL; g.beginPath(); g.roundRect(x, y, tw, h, 26); g.fill();
    g.strokeStyle = on ? GREEN : HAIR; g.lineWidth = on ? 3 : 2; g.stroke();
    text(name, x + 32, y + 56, 28, on ? GREEN : MUTED, num);
    text(line != null ? String(line) : "--", x + 32, y + 150, 92, line != null ? "#ffffff" : MUTED, num, "left", tw - 64);
    text(price ? price.toFixed(2) : "--", x + 32, y + 214, 56, price ? (on ? GREEN : "#ffffff") : MUTED, num);
    if (book) text(String(book).toUpperCase(), x + tw - 32, y + 214, 24, MUTED, num, "right", tw / 2 - 40);
  });

  // stat row
  const sideName = f.side === "over" ? "OVER" : "UNDER", won = (s) => (f.side === "over" ? s.over : s.under);
  const cells = [
    [`${sideName} HIT · L${f.played}`, f.played ? pct(f.hits / f.played) : "--", f.played ? tone(f.hits / f.played) : MUTED, f.played ? `${f.hits}/${f.played}` : ""],
    ["AT GROUND", f.at ? pct(won(f.at) / f.at.n) : "--", f.at ? tone(won(f.at) / f.at.n) : MUTED, f.at ? `${won(f.at)}/${f.at.n}` : ""],
    [`FAIR · ${sideName}`, f.fair ? f.fair.toFixed(2) : "--", "#ffffff", ""],
  ];
  const cw = (W - 2 * M) / 3;
  cells.forEach(([label, value, color, sub], i) => {
    const x = M + i * cw;
    text(label, x, 850, 26, MUTED, num, "left", cw - 16);
    const w = text(value, x, 912, 58, value === "--" ? MUTED : color, num, "left", cw - 16);
    if (sub) text(sub, x + w + 10, 912, 26, MUTED, num, "left", cw - w - 30);
  });
  g.fillStyle = HAIR; g.fillRect(0, 950, W, 2);

  // last results against the line
  const bars = (f.last || []).slice(-10);
  if (bars.length) {
    const ct = 1010, cb = 1230, x0 = 130, x1 = W - M, n = bars.length, gap = 12, bw = Math.floor((x1 - x0 - gap * (n - 1)) / n);
    const ymax = Math.max(f.line, ...bars.map((b) => b.v), 1) * 1.15, ly = cb - (f.line / ymax) * (cb - ct);
    text("LAST", M, ct - 8, 24, MUTED, num);
    bars.forEach((b, i) => {
      const x = x0 + i * (bw + gap), fill = Math.max(0, (b.v / ymax) * (cb - ct));
      const good = b.s === "push" ? null : f.side === "over" ? b.s === "hit" : b.s === "miss";
      g.fillStyle = good == null ? AMBER : good ? GREEN : RED;
      g.beginPath(); g.roundRect(x, cb - fill, bw, fill, 6); g.fill();
      text(String(b.v), x + bw / 2, cb - 12, 32, fill >= 48 ? BG : "#ffffff", num, "center", bw + gap);
    });
    g.fillStyle = "#ffffff"; g.fillRect(x0 - 20, ly - 1, x1 - x0 + 20, 2);
    text(String(f.line), M, ly + 10, 30, "#ffffff", num);
  }
  drawBrand(g, M, H - 100, 52, bold);
  return c.toBuffer("image/png");
}

function crest(g, img, letters, cx, cy, box, text, bold) {
  if (img) {
    const v = img.__vis || (img.__vis = visibleBounds(mk, img)), k = Math.min(box / v.sw, box / v.sh), w = v.sw * k, h = v.sh * k;
    g.drawImage(img, v.sx, v.sy, v.sw, v.sh, cx - w / 2, cy - h / 2, w, h);
  } else text(String(letters || "?").replace(/\(W\)/i, "").trim().split(/\s+/).map((x) => x[0]).join("").slice(0, 3).toUpperCase(), cx, cy + box * 0.17, box * 0.5, MUTED, bold, "center", box);
}
