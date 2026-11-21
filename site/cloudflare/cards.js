import { timingSafeEqual } from "node:crypto";
import { cardFields, cardQuery, cardText } from "@cricket/engine/card.js";
import { parseCardLink, posterPath } from "@cricket/engine/card-link.js";
import { fancyPosterFields } from "@cricket/engine/fancy-poster.js";
import { createStore } from "@cricket/engine/store.js";
import { STATS } from "@cricket/engine/rules.js";
import { handleShare, isPerson, parseShare } from "../api/share.js";
import { unwrapJson } from "../api/load-data.js";

const missing = () => new Response(null, { status: 404 });
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function normalizeCard(url) {
  const path = url.pathname.startsWith("/card/") ? url.pathname : url.searchParams.get("path");
  let query;
  try { query = path ? cardQuery(path) : Object.fromEntries(url.searchParams); } catch { return null; }
  const out = new URLSearchParams();
  if (/^\d{1,6}$/.test(query.p || "")) out.set("p", String(Number(query.p)));
  else if (/^[0-9a-f]{8}$/.test(query.pid || "")) out.set("pid", query.pid);
  else if (/^\d{1,6}$/.test(query.v || "")) out.set("v", String(Number(query.v)));
  else if (/^[\w-]{1,140}$/.test(query.f || "")) out.set("f", query.f);
  else return null;
  const player = out.has("p") || out.has("pid");
  if (player && Object.hasOwn(STATS, query.stat) && query.line && Number.isFinite(Number(query.line))) {
    out.set("stat", query.stat);
    out.set("line", String(Number(query.line)));
  }
  if (query.poster === "1" && player) out.set("poster", "1");
  else if (query.poster === "1" && out.has("f") && /^[\w-]{1,100}$/.test(query.fm || "")) {
    out.set("poster", "1");
    out.set("fm", query.fm);
    out.set("sc", /^-?\d{1,6}$/.test(query.sc || "") ? String(Number(query.sc)) : "-1");
  }
  return out;
}

export async function media(request, env, ctx, sharePath) {
  const url = new URL(request.url);
  if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405 });
  if (sharePath != null) {
    const parsed = parseShare(sharePath);
    if (!parsed) return Response.redirect(new URL("/", url), 302);
    if (isPerson(Object.fromEntries(request.headers))) return new Response(null, { status: 302, headers: { Location: parsed.page, "Cache-Control": "no-store" } });
    if (sharePath.length > 300) return missing();
    url.pathname = "/api/share";
    url.search = new URLSearchParams({ path: sharePath }).toString();
    return env.CARDS.getByName("share").fetch(url.href);
  }

  const bot = url.pathname === "/api/card";
  if (bot) {
    const want = Buffer.from(env.CARD_API_KEY?.trim() || "");
    const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") || "")?.[1];
    const given = Buffer.from(bearer ?? url.searchParams.get("key") ?? "");
    if (!want.length) return Response.json({ error: "card api is off" }, { status: 503 });
    if (given.length !== want.length || !timingSafeEqual(given, want)) return Response.json({ error: "bad key" }, { status: 401 });
    const link = parseCardLink(url.searchParams.get("link"));
    if (!link) return Response.json({ error: "invalid card link" }, { status: 400 });
    url.search = new URL(posterPath(link), url).search;
  }
  const query = normalizeCard(url);
  if (!query) return missing();
  url.pathname = "/api/og";
  url.search = query.toString();
  const cache = globalThis.caches?.default;
  const hit = await cache?.match(url.href);
  const response = hit || await env.CARDS.getByName(url.search).fetch(url.href);
  if (!hit && response.ok && cache && response.headers.get("cache-control")?.includes("public")) {
    ctx.waitUntil(cache.put(url.href, response.clone()));
  }
  if (bot || request.method === "HEAD") {
    const headers = new Headers(response.headers);
    if (bot) headers.set("Cache-Control", "private, no-store");
    return new Response(request.method === "HEAD" ? null : response.body, { status: response.status, headers });
  }
  return response;
}

function cardHtml(f, text, portrait) {
  const details = f.kind === "fancy"
    ? [["Over", f.over], ["Under", f.under], ["Line", f.line], ["Hit rate", f.played ? `${f.hits}/${f.played}` : null]]
    : [["Line", f.line], ["Best price", f.price], ["Book", f.book], ["Team", f.team]];
  const tiles = details.filter(([, value]) => value != null && value !== "").map(([label, value]) => `<div><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join("");
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; style-src 'unsafe-inline'">
<style>*,*:before{box-sizing:border-box}body{margin:0;background:#0f0f0f;color:#fff;font:24px system-ui,sans-serif}
main{min-height:100vh;padding:7vw;display:flex;flex-direction:column;justify-content:center;background:radial-gradient(ellipse at top right,#14523c,transparent 55%),#0f0f0f}
header{color:#27da8e;font-size:34px;font-weight:800;margin-bottom:24px}h1{font-size:clamp(44px,5.5vw,72px);line-height:1.02;margin:0 0 22px;overflow-wrap:anywhere}p{margin:0;color:#d4d4d8}
section{display:flex;gap:30px;align-items:center}article{flex:1}img{width:24vw;height:26vw;object-fit:contain;border-radius:20px}
aside{display:flex;flex-wrap:wrap;gap:12px;margin-top:32px}aside div{padding:16px 22px;background:#191b1a;border:1px solid #343634;border-radius:14px;max-width:100%}small,strong{display:block}small{color:#aaa}strong{color:#27da8e;font-size:30px}</style>
<main><header>Fancy.cash</header><section><article><h1>${esc(text.title)}</h1><p>${esc(text.description)}</p></article>${portrait ? `<img src="${esc(portrait)}" alt="">` : ""}</section>${tiles ? `<aside>${tiles}</aside>` : ""}</main>`;
}

export class Cards {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.rendering = null;
  }

  async json(name) {
    const r = await this.env.ASSETS.fetch(new Request(`https://assets.invalid/data/${name}.json`));
    if (!r.ok) throw new Error("card data unavailable");
    return unwrapJson(await r.json(), this.env.DATA_WRAP_KEY);
  }

  data() {
    return this.dataPromise ||= Promise.all(["index", "photos", "lines", "fixtures"].map(async (key) => [key, await this.json(key)]))
      .then(Object.fromEntries).catch((e) => { this.dataPromise = null; throw e; });
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/api/share") {
      const path = url.searchParams.get("path");
      const headers = new Headers();
      let response;
      const res = { statusCode: 200, setHeader: (k, v) => headers.set(k, v), end: (body) => { response = new Response(body, { status: res.statusCode, headers }); } };
      handleShare({ query: { path }, headers: {} }, res, await this.data(), url.origin);
      return response;
    }
    const saved = await this.ctx.storage.get("image");
    if (saved && Date.now() < saved.until) return new Response(saved.bytes, { headers: saved.headers });
    this.rendering ||= this.render(Object.fromEntries(url.searchParams)).finally(() => { this.rendering = null; });
    const image = await this.rendering;
    return image ? new Response(image.bytes, { headers: image.headers }) : missing();
  }

  async render(query) {
    const data = await this.data();
    const poster = query.poster === "1";
    const fancy = poster && query.f && query.fm;
    let f, text;
    if (fancy) {
      const store = await createStore({ fetchJson: (path) => this.json(path.replace(/\.json$/, "")) });
      f = fancyPosterFields(store, data.lines, data.fixtures, { id: query.f, fm: query.fm, sc: query.sc });
      if (f) text = { title: f.label, description: [`${f.a} v ${f.b}`, f.team, f.series].filter(Boolean).join(" · ") };
    } else {
      f = cardFields(query, data);
      text = cardText(f);
    }
    if (!text || (poster && f.kind !== "prop" && f.kind !== "fancy")) return null;
    const photo = f.photos?.find((value) => /^https:\/\//.test(value));
    const width = poster ? 1080 : 1200, height = poster ? 1350 : 630;
    const type = poster ? "png" : "jpeg";
    const options = {
      html: cardHtml(f, text, photo),
      viewport: { width, height },
      screenshotOptions: { type, ...(poster ? {} : { quality: 80 }), clip: { x: 0, y: 0, width, height } },
    };
    let r = await this.env.BROWSER.quickAction("screenshot", options);
    if (r.status === 429 || r.status >= 500) {
      await r.body?.cancel();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      r = await this.env.BROWSER.quickAction("screenshot", options);
    }
    if (!r.ok || !r.headers.get("content-type")?.startsWith(`image/${type}`)) throw new Error("card rendering unavailable");
    const image = {
      bytes: await r.arrayBuffer(),
      headers: { "Content-Type": `image/${type}`, "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=600" },
      until: Date.now() + 600_000,
    };
    await this.ctx.storage.put("image", image);
    await this.ctx.storage.setAlarm(image.until + 60_000);
    return image;
  }

  async alarm() {
    const image = await this.ctx.storage.get("image");
    if (image && Date.now() >= image.until) await this.ctx.storage.delete("image");
  }
}
