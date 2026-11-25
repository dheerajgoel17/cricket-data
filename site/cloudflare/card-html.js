// The share cards as HTML for Browser Run to screenshot (1200x630), the Cloudflare twin of the canvas drawing in engine/card.js (`drawProp`) and engine/fancy-poster.js (`renderFancyCard`):
// a black stats panel on the left, the player (or both crests) on brand green on the right. Fonts come from the site's own stylesheet (`css`, Satoshi + Barlow Condensed), the book logos from /books.
// Every figure is read from the same fields as the canvas card (never invented); a block with no data is left out.
import { bookLogoFile, bookLogoStem } from "@cricket/engine/books.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const https = (list) => (list || []).find((u) => /^https:\/\//.test(u)) || "";
const abbr = (n) => { const w = String(n || "").replace(/\(W\)/i, "").trim().split(/\s+/).filter(Boolean); return (w.length > 1 ? w.map((x) => x[0]).join("") : (w[0] || "?")).slice(0, 3).toUpperCase(); };

const MARK = `<svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3cf0a6"/><stop offset="1" stop-color="#1fb877"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="#1a1a1c"/><g fill="url(#bg)"><rect x="17" y="14" width="10" height="37" rx="5"/><rect x="17" y="14" width="25" height="10" rx="5"/><rect x="17" y="29.5" width="18" height="10" rx="5"/><circle cx="48.5" cy="19" r="6"/></g></svg>`;
const BRAND = `<div class="brand">${MARK}<b>Fancy.cash</b></div>`;

const CSS = `*{box-sizing:border-box}html,body{margin:0;padding:0;background:#0f0f0f}body{position:relative;width:1200px;height:630px;overflow:hidden;color:#fff;font-family:Satoshi,system-ui,sans-serif;font-weight:700}
.n{font-family:"Barlow Condensed",Satoshi,sans-serif;font-weight:700;text-transform:uppercase;line-height:1}.mut{color:#8e8e93}.g{color:#27da8e}.r{color:#ff4444}
.green{position:absolute;left:620px;top:0;width:580px;height:630px;background:#27da8e;overflow:hidden}
.brand{position:absolute;left:64px;top:48px;display:flex;align-items:center;gap:16px;font-size:35px;line-height:1}.abs{position:absolute}
.name{left:64px;top:122px;width:500px;font-size:54px;line-height:64px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meta{left:64px;top:188px;width:500px;font-size:22px;line-height:28px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.label{left:64px;top:228px;font-size:24px}.head{left:64px;top:252px;font-size:80px;white-space:nowrap}
.chip{display:inline-flex;align-items:center;height:52px;padding:0 18px;border-radius:14px;background:#1c1c1e}.chip img{height:28px;max-width:150px;object-fit:contain}.price{font-size:48px;margin-left:16px}.row{left:64px;top:352px;display:flex;align-items:center}
.sticker{position:absolute;right:64px;top:48px;width:200px;height:84px;border-radius:20px;background:#0f0f0f;text-align:center}.sticker .n:first-child{font-size:60px;padding-top:6px}.sticker .n+.n{font-size:14px;margin-top:4px}
.chart{left:64px;top:424px;width:470px;height:190px}.bars{position:relative;display:flex;gap:16px;margin-top:22px}.col{width:81px;text-align:center}.track{position:relative;height:68px;border-radius:8px;background:#1c1c1e;overflow:hidden}.fill{position:absolute;left:0;right:0;bottom:0;border-radius:8px}.fig{font-size:20px;line-height:22px;height:22px;margin-bottom:5px}.vs{margin-top:8px;font-size:15px;font-weight:500;color:#8e8e93;line-height:18px}.ln{position:absolute;left:-4px;right:-60px;border-top:2px dashed #fff}.lv{position:absolute;left:478px;font-size:18px;color:#8e8e93;transform:translateY(-50%)}`;

function shell(body, { css, script }) {
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; style-src 'unsafe-inline' https:; font-src https:; script-src 'unsafe-inline'">
${css ? `<link rel="stylesheet" href="${esc(css)}">` : ""}<style>${CSS}</style><body>${body}<script>${script || ""}(async()=>{try{await document.fonts.load('700 20px Satoshi');await document.fonts.load('500 20px Satoshi');await document.fonts.load('700 20px "Barlow Condensed"');await Promise.all([...document.images].map((i)=>i.complete?0:new Promise((r)=>{i.onload=i.onerror=r})));}catch(e){}document.body.dataset.ready="1"})()</script>`;
}

/** One bar chart of `bars` ([{ value, vs?, state? }]) against `line`; `colour(bar)` picks the bar's class. */
function chart(bars, line, colour, { width = 470, rowW = 81, gap = 16, trackH = 68, showVs = true } = {}) {
  const vals = bars.map((b) => Number(b.value)).filter(Number.isFinite);
  if (!vals.length) return "";
  const max = Math.max(line, ...vals, 1) * 1.2, ly = trackH - (line / max) * trackH;
  const cols = bars.map((b) => {
    const v = Number(b.value), cl = colour(b), h = Math.max(4, (v / max) * trackH);
    return `<div class="col" style="width:${rowW}px"><div class="fig n ${cl}">${esc(v)}</div><div class="track"><div class="fill" style="height:${h.toFixed(1)}px;background:${cl === "g" ? "#27da8e" : cl === "r" ? "#ff4444" : "#f5a524"}"></div></div>${showVs ? `<div class="vs">${esc(abbr(b.vs))}</div>` : ""}</div>`;
  }).join("");
  const top = 27 + ly;
  return `<div class="bars" style="gap:${gap}px;width:${width}px">${cols}<div class="ln" style="top:${top.toFixed(1)}px"></div><div class="lv n" style="top:${top.toFixed(1)}px">${esc(line)}</div></div>`;
}

function bookChip(origin, stem, name) {
  const file = stem && bookLogoFile(stem);
  return file ? `<span class="chip"><img src="${esc(origin)}/books/${esc(file)}" alt=""></span>` : (name ? `<span class="chip">${esc(name)}</span>` : "");
}

/** The prop card: `f` is `cardFields` + `attachForm`. */
export function propCardHtml(f, { origin = "", css = "" } = {}) {
  const face = https(f.photos), kit = https(f.kitPhotos);
  const meta = [f.team, f.fmt, f.opp ? `v ${f.opp}` : ""].filter(Boolean).join("  ·  ");
  const l5 = f.l5 && f.l5.played >= 3 ? f.l5 : null;
  const bars = (f.last5 || []).slice(-5);
  const colour = (b) => (Number(b.value) === f.line ? "a" : Number(b.value) > f.line ? "g" : "r");
  const stem = f.source ? bookLogoStem(f.source) : "";
  const body = `<div class="green">${face ? `<div class="abs" style="left:0;bottom:0;width:580px"><img id="face" src="${esc(face)}" style="display:block;width:580px">${kit ? `<img id="kit" src="${esc(kit)}" style="display:block;width:580px">` : ""}</div>` : `<div class="n abs" style="left:0;right:0;top:230px;text-align:center;font-size:160px;color:#0f0f0f">${esc(f.initials)}</div>`}
${l5 ? `<div class="sticker"><div class="n g">${l5.hits}/${l5.played}</div><div class="n mut">OVER IN LAST ${l5.played}</div></div>` : ""}</div>
${BRAND}
<div class="abs name">${esc(f.name)}</div>${meta ? `<div class="abs meta mut">${esc(meta)}</div>` : ""}
<div class="abs label n g">${esc(String(f.stat || ""))}</div><div class="abs head n">OVER ${esc(f.line)}</div>
${f.price ? `<div class="abs row">${bookChip(origin, stem, f.book)}<span class="price n g">${f.price.toFixed(2)}</span></div>` : ""}
${bars.length ? `<div class="abs chart"><div class="n mut" style="font-size:20px">LAST 5 INNINGS</div>${chart(bars, f.line, colour)}</div>` : ""}`;
  return shell(body, { css, script: `{const w=()=>{const k=document.getElementById('kit'),a=document.getElementById('face');if(k&&a)k.style.marginTop=-(a.offsetHeight*.334)+'px'};window.addEventListener('load',w);document.querySelectorAll('img').forEach((i)=>i.addEventListener('load',w))}` });
}

/** The Match Fancy market card: `ff` is `fancyPosterFields`. */
export function fancyCardHtml(ff, { origin = "", css = "", aLogo = "", bLogo = "" } = {}) {
  const tiles = [["OVER", ff.overLine, ff.over, ff.overBook, ff.overStem, "over"], ["UNDER", ff.underLine, ff.under, ff.underBook, ff.underStem, "under"]].map(([name, line, price, book, stem, side]) => {
    const on = ff.side === side, file = stem && bookLogoFile(stem);
    return `<div style="position:relative;width:242px;height:168px;border-radius:20px;background:#1c1c1e;${on ? "box-shadow:inset 0 0 0 3px #27da8e;" : ""}"><div class="abs n ${on ? "g" : "mut"}" style="left:22px;top:18px;font-size:20px">${name}</div>
<div class="abs n" style="left:22px;top:44px;font-size:70px;${line == null ? "color:#8e8e93" : ""}">${line != null ? esc(line) : "--"}</div>
<div class="abs n ${price ? (on ? "g" : "") : "mut"}" style="left:22px;top:112px;font-size:36px">${price ? price.toFixed(2) : "--"}</div>
<div class="abs" style="right:22px;top:118px">${file ? `<img src="${esc(origin)}/books/${esc(file)}" style="height:24px;max-width:90px;object-fit:contain" alt="">` : book ? `<span class="n mut" style="font-size:16px">${esc(book)}</span>` : ""}</div></div>`;
  }).join("");
  const bars = (ff.last || []).slice(-10);
  const colour = (b) => (b.s === "push" ? "a" : (ff.side === "over" ? b.s === "hit" : b.s === "miss") ? "g" : "r");
  const vals = bars.map((b) => b.v), max = Math.max(ff.line, ...vals, 1) * 1.15, H = 106, ly = H - (ff.line / max) * H;
  const cols = bars.map((b) => `<div style="flex:1;position:relative;height:${H}px"><div class="abs" style="left:0;right:0;bottom:0;border-radius:4px;height:${Math.max(0, (b.v / max) * H).toFixed(1)}px;background:${{ g: "#27da8e", r: "#ff4444", a: "#f5a524" }[colour(b)]}"></div></div>`).join("");
  const won = (s) => (ff.side === "over" ? s.over : s.under), side = ff.side === "over" ? "OVER" : "UNDER";
  const pills = [ff.at ? ["AT GROUND", `${won(ff.at)}/${ff.at.n}`] : null, ff.fair ? [`FAIR ${side}`, ff.fair.toFixed(2)] : null].filter(Boolean)
    .map(([k, v], i) => `<div class="abs" style="left:${30 + i * 266}px;top:500px;width:250px;height:90px;border-radius:20px;background:#0f0f0f;padding:14px 22px"><div class="n mut" style="font-size:18px">${k}</div><div class="n" style="font-size:44px;margin-top:6px">${v}</div></div>`).join("");
  const crest = (src, letters, x) => `<div class="abs" style="left:${x - 95}px;top:175px;width:190px;height:190px;display:flex;align-items:center;justify-content:center">${src ? `<img src="${esc(src)}" style="width:190px;height:190px;object-fit:contain" alt="">` : `<span class="n" style="font-size:90px;color:#0f0f0f">${esc(abbr(letters))}</span>`}</div>`;
  const body = `<div class="green">${crest(aLogo, ff.a, 150)}${crest(bLogo, ff.b, 430)}<div class="abs" style="left:0;width:580px;top:250px;text-align:center;font-size:40px;color:#0f0f0f">v</div>
<div class="abs" style="left:30px;width:240px;top:380px;text-align:center;font-size:30px;color:#0f0f0f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(ff.a)}</div><div class="abs" style="left:310px;width:240px;top:380px;text-align:center;font-size:30px;color:#0f0f0f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(ff.b)}</div>
${ff.played ? `<div class="sticker"><div class="n g">${ff.hits}/${ff.played}</div><div class="n mut">${side} IN LAST ${ff.played}</div></div>` : ""}${pills}</div>
${BRAND}<div class="abs name">${esc(ff.label)}</div><div class="abs meta mut">${esc([ff.team || "Whole match", ff.batFirst ? "If bats first" : "", ff.fmt].filter(Boolean).join("  ·  "))}</div>
<div class="abs" style="left:64px;top:244px;display:flex;gap:16px">${tiles}</div>
${bars.length ? `<div class="abs n mut" style="left:64px;top:438px;font-size:20px">LAST ${bars.length}</div><div class="abs" style="left:64px;top:484px;width:460px;height:${H}px"><div style="display:flex;gap:8px;height:${H}px">${cols}</div><div class="abs" style="left:-4px;right:-6px;top:${ly.toFixed(1)}px;border-top:2px dashed #fff"></div><div class="abs n mut" style="left:466px;top:${(ly - 10).toFixed(1)}px;font-size:18px">${esc(ff.line)}</div></div>` : ""}`;
  return shell(body, { css });
}
