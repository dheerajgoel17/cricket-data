// The share card of a page (1200x630): what a link preview shows. `cardFields` picks the words and numbers from the data files (never from a model), `renderCard` draws them.
// Used by api/og.js (the image) and api/share.js (the page a link preview reads). Plain ESM; the drawing library is loaded only when a card is drawn.
import { STATS } from "./rules.js";
import { bookFormatFor, bookLinesFor, bookName, keepMsFor, overProb, teamKey } from "./lines.js";
import { bookLogoStem, bookVariant } from "./books.js";
import { brandWidth, drawBrand as drawBrandGroup, visibleBounds } from "./brand-draw.js";
import { playerPhotos, teamJerseys, teamLogos } from "./photos.js";
import { windowRate } from "./windows.js";
import { atGround } from "./next-match.js";
import { fairOdds } from "./stats.js";
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
 * Form of one prop: last five played innings vs the line (L5 mean, hit rate, last innings), the calendar-year hit rate,
 * fair odds (1 / hit rate of the biggest sample) and his games at the match's ground. `rows` are oldest → newest
 * `{ value, date, opp, venueName }`; DNP / VOID (`value == null`) never count. Numbers come from the rows, never invented.
 * `opts`: `year` (calendar year of the match), `ground` (its venue name), `opp` (the other side: his record against it).
 */
export function propForm(rows, line, teamName, opts = {}) {
  // every game, DNP / VOID included (value null): the windows count them the way the site's row does (the last 5 games, of which those he played)
  const entries = (rows || []).filter(Boolean).map((r) => ({
    value: r.value != null && Number.isFinite(Number(r.value)) ? Number(r.value) : null,
    date: r.date,
    opp: typeof teamName === "function" ? teamName(r.opp) : (r.vs || r.opp || ""),
    venueName: r.venueName || "",
  }));
  const playedOnly = entries.filter((e) => e.value != null);
  if (!playedOnly.length || !Number.isFinite(Number(line))) return {};
  const ln = Number(line);
  const l5 = windowRate(entries, 5, ln);
  const last = playedOnly[playedOnly.length - 1];
  const out = {
    l5,
    hit: l5.p != null ? { p: l5.p, n: l5.played } : undefined,
    last: last ? { value: last.value, date: dateShort(last.date), vs: last.opp } : undefined,
    last5: entries.slice(-5).filter((e) => e.value != null).map((e) => ({ value: e.value, date: dateShort(e.date), vs: e.opp })),
  };
  const year = String(opts.year || "");
  if (year) {
    const sr = windowRate(entries.filter((e) => String(e.date || "").startsWith(year)), 0, ln);
    if (sr.played) out.season = { year, p: sr.p, played: sr.played, hits: sr.hits, mean: sr.mean };
  }
  out.recent = playedOnly.slice(-8).map((e) => ({ value: e.value, date: dateShort(e.date), vs: e.opp })); // the poster's big chart
  const l10 = windowRate(entries, 10, ln);
  if (l10.played) out.l10 = { p: l10.p, played: l10.played, hits: l10.hits };
  if (opts.opp) {
    const want = teamKey(opts.opp), h = windowRate(entries.filter((e) => teamKey(e.opp) === want), 0, ln);
    if (h.played) out.h2h = { name: opts.opp, p: h.p, played: h.played, hits: h.hits };
  }
  const basis = out.season && out.season.played >= 5 ? { p: out.season.p, label: year } : l5.played >= 3 ? { p: l5.p, label: "L5" } : null;
  if (basis && basis.p > 0) out.fair = { odds: fairOdds(basis.p), label: basis.label };
  const here = atGround(playedOnly, opts.ground);
  if (here.length) {
    const r = windowRate(here, 0, ln);
    out.atGround = { name: String(opts.ground).split(",")[0].trim(), bars: here.slice(-5).map((e) => ({ value: e.value, vs: e.opp })), played: r.played, hits: r.hits, p: r.p };
  }
  return out;
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
    const f = { kind: stat && line != null ? "prop" : "player", name, team: indexTeam, initials: initials(name), photos: biggerPhoto(playerPhotos(data.photos, pid)), idx, pid };
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
      const prices = hits.flatMap((l) => (l.books || []).filter((b) => b.over > 1 && !/^fancy$/i.test(bookVariant(b.source) || "")).map((b) => ({ over: b.over, under: b.under, book: bookName(b.source), source: b.source })));
      const best = prices.sort((x, y) => y.over - x.over)[0];
      if (best) {
        f.price = best.over; f.book = best.book; f.source = best.source; f.books = prices.length;
        if (best.under > 1) { f.under = best.under; f.market = overProb(best.over, best.under); }
      }
      const start = Date.parse(row?.start_utc || "");
      if (Number.isFinite(start)) f.year = String(new Date(start).getUTCFullYear());
      const fx = Number.isFinite(start) ? (Array.isArray(data.fixtures) ? data.fixtures : []).find((x) => Math.abs(Date.parse(x.start) - start) < 90 * 60e3 && x.venue && (teamKey(x.a) === teamKey(f.team) || teamKey(x.b) === teamKey(f.team))) : null;
      if (fx) f.ground = fx.venue;
      // every line the books list for this stat in this match, best over price at each: differing book lines side by side. `bookLinesFor` is what the page's ladder reads (a fixture the books spell several ways is one match)
      const lf = f.fmt || bookFormatFor(data.lines, pid, stat, undefined, keepMsFor("Test")) || "";
      const bk = lf ? bookLinesFor(data.lines, pid, stat, lf, Number.isFinite(start) ? start - 3600e3 : Date.now(), keepMsFor(lf), 0, { start: row?.start_utc, line, stat }) : null;
      // Premium / exchange prices only: a book's Fancy market is a different bet from the line, so it is not set beside it
      const comparable = (l) => (l.books || []).filter((b) => b.over > 1 && !/^fancy$/i.test(bookVariant(b.source) || ""));
      const byLine = (bk?.lines || []).map((l) => {
        const top = comparable(l).sort((x, y) => y.over - x.over)[0];
        return top ? { line: l.line, price: top.over, book: bookName(top.source), stem: bookLogoStem(top.source), best: Math.abs(l.line - line) < 0.01 } : null;
      }).filter(Boolean).sort((x, y) => Math.abs(x.line - line) - Math.abs(y.line - line)).slice(0, 4).sort((x, y) => x.line - y.line);
      const here = (bk?.lines || []).find((l) => Math.abs(l.line - line) < 0.01);
      const atLine = here ? comparable(here).sort((x, y) => y.over - x.over).slice(0, 4).map((b, i) => ({ line: here.line, price: b.over, book: bookName(b.source), stem: bookLogoStem(b.source), best: i === 0 })) : [];
      // several lines: each line's best price; one line: each book's price at it (never two rows from one book's other market)
      if (byLine.length > 1) { f.bookLines = byLine; f.bookTitle = "BOOK LINES"; }
      else if (atLine.length > 1) { f.bookLines = atLine; f.bookTitle = `BOOKS AT ${line}`; }
      else f.bookLines = [];
      f.female = fx?.gender === "female"; // a women's fixture: the women's sides' own logos (the "<name> women" team), not the men's
      const side = (n) => (f.female && !/\bwomen\b|\(w\)/i.test(n) ? `${n} Women` : n);
      f.teamPhotos = teamLogos(data.photos, side(f.team));
      f.kitPhotos = teamJerseys(data.photos, f.team, f.fmt === "Test");
      f.oppPhotos = f.opp ? teamLogos(data.photos, side(f.opp)) : [];
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
export async function renderCard(f, { photo = null, jersey = null, teamLogo = null, oppLogo = null, bookLogo = null, bookMarks = {}, brandLogo = null, fonts = {} } = {}) {
  const { createCanvas, GlobalFonts, loadImage } = await import("@napi-rs/canvas");
  mk = createCanvas;
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
  const marks = Object.fromEntries(await Promise.all(Object.entries(bookMarks || {}).map(async ([k, v]) => [k, await asImage(loadImage, v)])));

  if (f.kind === "prop") drawProp(g, f, { img, kit, teamImg, oppImg, bookImg, marks, text, bold, reg, num });
  else if (f.kind === "fixture" || f.kind === "venue") drawPlain(g, f, { text, bold, reg });
  else drawPlayer(g, f, { img, kit, text, bold, reg });
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

function drawPlayer(g, f, { img, kit, text, bold, reg }) {
  drawKitPortrait(g, f, img, kit, text, bold);
  text("PLAYER", 72, 150, 22, GREEN, reg, "left", 560);
  text(f.name, 72, 232, 72, "#ffffff", bold, "left", 580);
  text(f.team, 72, 284, 30, MUTED, reg, "left", 580);
  text("Hit rates, form and listed lines", 72, 420, 36, "#ffffff", reg, "left", 580);
  text("Free, with every price in decimal", 72, 468, 26, MUTED, reg, "left", 580);
}

function drawProp(g, f, { img, kit, teamImg, oppImg, bookImg, marks = {}, text, bold, reg, num }) {
  // Share card on a 64 px margin grid: left column x 64..624 (three equal tiles per row, 13 px gutters), portrait right. Baselines: name 98, meta 128, stat 178, hero 240,
  // tile rows 272 / 340 (56 px tall), chart labels 430, chart tracks 462..514 (figures above, opponents 536), book strip 552..600. A block with no data is skipped, never left as an empty label.
  drawKitPortrait(g, f, img, kit, text, bold);
  const L = 64, COL = 560, GAP = 13, TW = Math.floor((COL - 2 * GAP) / 3);

  text(f.name, L, 98, 54, "#ffffff", bold, "left", COL);
  const meta = [f.fmt, f.role, f.team].filter(Boolean).join("  ·  ");
  if (meta) text(meta.toUpperCase(), L, 128, 18, MUTED, num, "left", COL);

  text(String(f.stat || "").toUpperCase(), L, 178, 20, GREEN, num, "left", 260);
  const hero = text(`OVER ${f.line}`, L, 240, 64, "#ffffff", num, "left", 330);
  if (f.opp) { // matchup: the two crests at full size, no container, centred on the hero line
    const bw = 84, bh = 60, x0 = L + Math.max(hero, 190) + 30, cy = 216;
    crest(g, teamImg, abbr(f.team), x0 + bw / 2, cy, bw, text, bold, bh);
    text("v", x0 + bw + 14, cy + 7, 20, MUTED, bold, "center", 24);
    crest(g, oppImg, abbr(f.opp), x0 + bw + 28 + bw / 2, cy, bw, text, bold, bh);
  }

  // Tiles: one grid, filled in reading order (fair, listed, hit rates, records); a missing figure leaves no hole
  const avg = f.l5 && Number.isFinite(Number(f.l5.mean)) ? Number(f.l5.mean) : null;
  const l5p = f.l5 && Number.isFinite(Number(f.l5.p)) ? Number(f.l5.p) : (f.hit && Number.isFinite(Number(f.hit.p)) ? Number(f.hit.p) : null);
  const tone = (p) => (p >= 0.6 ? GREEN : p < 0.4 ? RED : "#f5a524");
  const rate = (r) => `${Math.round(r.p * 100)}% · ${r.hits}/${r.played}`;
  const tiles = [];
  if (f.fair?.odds) tiles.push({ k: `FAIR · ${f.fair.label}`, v: f.fair.odds.toFixed(2) });
  if (f.price) tiles.push({ k: "LISTED", v: f.price.toFixed(2), tone: GREEN, logo: true });
  if (l5p != null) tiles.push({ k: "L5 HIT", v: `${Math.round(l5p * 100)}%`, tone: tone(l5p) });
  if (f.season?.p != null) tiles.push({ k: `${f.season.year} HIT`, v: rate(f.season), tone: tone(f.season.p) });
  if (f.h2h?.p != null) tiles.push({ k: `VS ${abbr(f.h2h.name)}`, v: rate(f.h2h), tone: tone(f.h2h.p) });
  if (f.atGround?.p != null) tiles.push({ k: `AT ${String(f.atGround.name).toUpperCase()}`, v: rate(f.atGround), tone: tone(f.atGround.p) });
  else if (avg != null) tiles.push({ k: "L5 AVG", v: fmtAvg(avg) });
  tiles.slice(0, 6).forEach((t, i) => {
    const x = L + (i % 3) * (TW + GAP), y = 272 + Math.floor(i / 3) * 68;
    g.fillStyle = "#1c1c1e"; g.beginPath(); g.roundRect(x, y, TW, 56, 12); g.fill();
    text(t.k, x + 16, y + 22, 13, MUTED, num, "left", TW - 32);
    const vw = text(t.v, x + 16, y + 47, 28, t.tone || "#ffffff", num, "left", TW - 32);
    if (t.logo && (bookImg || f.book)) {
      const room = TW - 32 - vw - 10;
      if (room > 40) bookChip(g, { img: bookImg, name: f.book }, x + TW - 16 - Math.min(room, 84), y + 26, Math.min(room, 84), 22, text, bold);
    }
  });

  // Charts: his last five, and his games at this ground
  const bars = f.last5 && f.last5.length ? f.last5 : (f.last && Number.isFinite(Number(f.last.value)) ? [{ value: f.last.value }] : []);
  if (bars.length) {
    text("LAST 5", L, 430, 16, MUTED, num, "left", 120);
    drawLast5(g, { line: f.line, last5: bars }, null, text, bold, reg, num, L, 462, 232, 52);
  }
  if (f.atGround?.bars?.length) {
    const gx = L + 296, a = f.atGround;
    text(`AT ${String(a.name || "GROUND").toUpperCase()}${a.played ? `  ·  ${a.hits}/${a.played} HIT` : ""}`, gx, 430, 16, MUTED, num, "left", 250);
    drawLast5(g, { line: f.line, last5: a.bars }, null, text, bold, reg, num, gx, 462, 232, 52);
  }

  // Book strip: each listed line with its best over price (or each book's price at the line), the best outlined
  const bl = f.bookLines || [];
  if (bl.length > 1) {
    const w = Math.floor((COL - GAP * (bl.length - 1)) / bl.length);
    bl.forEach((b, i) => {
      const x = L + i * (w + GAP), on = !!b.best;
      g.fillStyle = "#1c1c1e"; g.beginPath(); g.roundRect(x, 552, w, 48, 12); g.fill();
      if (on) { g.strokeStyle = GREEN; g.lineWidth = 2; g.beginPath(); g.roundRect(x, 552, w, 48, 12); g.stroke(); }
      const mk = marks[b.stem];
      if (mk) bookChipMark(g, mk, x + 14, 559, w - 28, 15); else text(String(b.book || "").toUpperCase(), x + 14, 572, 12, MUTED, num, "left", w - 28);
      text(String(b.line), x + 14, 593, 24, "#ffffff", num, "left", w * 0.5);
      text(b.price.toFixed(2), x + w - 14, 593, 22, on ? GREEN : MUTED, num, "right", w * 0.5);
    });
  }
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

/** The bookmaker's logo alone, no container, fitted in w x h; its name when there is no logo file. */
function bookChip(g, { img, name }, x, y, w, h, text, bold) {
  if (img) mark(g, img, x, y, w, h);
  else if (name) text(name, x, y + h / 2 + 7, 20, "#ffffff", bold, "left", w);
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

let mk = null; // createCanvas, set when a picture is drawn (the logo-trimming scratch canvas)
/** A team crest at full size in a `box` x `boxH` area: the logo alone (no circle, tile or padding), contained; the team's letters when there is no image. */
function crest(g, img, letters, cx, cy, box, text, bold, boxH = box) {
  if (img) {
    const v = img.__vis || (img.__vis = visibleBounds(mk, img)), k = Math.min(box / v.sw, boxH / v.sh), w = v.sw * k, h = v.sh * k;
    g.drawImage(img, v.sx, v.sy, v.sw, v.sh, cx - w / 2, cy - h / 2, w, h);
  } else text(letters, cx, cy + boxH * 0.17, boxH * 0.5, MUTED, bold, "center", box);
}

/** A bookmaker's logo alone (no pill), fitted in maxW x h. */
function bookChipMark(g, img, x, y, maxW, h) {
  const k = Math.min(maxW / img.width, h / img.height);
  g.drawImage(img, x, y, img.width * k, img.height * k);
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
    text(String(v), bx + w / 2, y - 7, 20, tone, num, "center", w + 8); // the figure rides above the track, clear of the dashed line
    if (b.vs) text(abbr(b.vs), bx + w / 2, y + h + 22, 15, MUTED, reg, "center", w + 12);
  });
  g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 2; g.setLineDash([5, 5]);
  g.beginPath(); g.moveTo(x - 4, lineY); g.lineTo(x + total + 8, lineY); g.stroke(); g.setLineDash([]);
  text(String(f.line), x + total + 12, lineY + 6, 18, MUTED, num);
}

/** The site's own brand (`engine/brand-draw.js`), top-right inside the ~64 px inset X's 2:1 crop leaves. */
function drawBrand(g, text, bold) {
  const size = 48, right = 1136;
  drawBrandGroup(g, right - brandWidth(g, size, bold), 36, size, bold);
}
