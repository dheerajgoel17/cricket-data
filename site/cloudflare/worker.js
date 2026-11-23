import { LIVE_SCORE_TTL_MS } from "@cricket/engine/live.js";
import gate from "../api/gate.js";
import adsAdmin from "../api/ads-admin.js";
import geo from "../api/geo.js";
import inplay from "../api/inplay.js";
import { liveHandler } from "../api/live.js";
import { unwrapJson } from "../api/load-data.js";
import state from "../api/state.js";
import middleware, { CRAWLER, crawlerSharePath } from "../middleware.js";
import { media } from "./cards.js";
export { Cards } from "./cards.js";

const ttl = new Map([["/api/live", LIVE_SCORE_TTL_MS / 1000], ["/api/inplay", 15], ["/api/state", 10]]);
const routes = new Map([
  ["/api/gate", gate],
  ["/api/geo", geo],
  ["/api/ads-admin", adsAdmin],
]);

async function runHandler(handler, request) {
  const headers = new Headers();
  let status = 200;
  let body;
  const req = { method: request.method, headers: Object.fromEntries(request.headers), secure: true };
  if (handler === adsAdmin && request.method === "POST") {
    const reader = request.body?.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    req.body = "";
    while (reader) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 8192) {
        await reader.cancel();
        return Response.json({ error: "Request too large" }, { status: 413 });
      }
      req.body += decoder.decode(part.value, { stream: true });
    }
    req.body += decoder.decode();
  }
  req.headers["x-forwarded-for"] = request.headers.get("cf-connecting-ip") || "?";
  const res = {
    setHeader(name, value) { headers.set(name, value); },
    status(code) { status = code; return res; },
    json(value) { body = value; return res; },
  };
  await handler(req, res);
  return Response.json(body, { status, headers });
}

// One object per feed shares a prepared response across visitors and edge locations.
export class Snapshots {
  constructor(_ctx, env) {
    this.cache = null;
    this.pending = null;
    this.handlers = new Map([
      ["/api/inplay", inplay],
      ["/api/state", state],
      ["/api/live", liveHandler(async () => {
        const response = await env.ASSETS.fetch(new Request("https://assets.invalid/data/identity.json"));
        return response.ok ? unwrapJson(await response.json(), env.DATA_WRAP_KEY) : null;
      })],
    ]);
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    const handler = this.handlers.get(path);
    if (!handler || request.method !== "GET") return new Response(null, { status: 405 });
    if (!this.cache || Date.now() >= this.cache.expires) {
      this.pending ||= (async () => {
        const response = await runHandler(handler, request);
        return {
          body: await response.text(),
          status: response.status,
          headers: [...response.headers],
          expires: Date.now() + (response.ok ? ttl.get(path) * 1000 : 1000),
        };
      })().finally(() => { this.pending = null; });
      this.cache = await this.pending;
    }
    const { body, status, headers } = this.cache;
    return new Response(body, { status, headers });
  }
}

async function snapshot(path, request, env, ctx) {
  if (request.method !== "GET") return Response.json({ error: "GET only" }, { status: 405 });
  const url = new URL(path, request.url);
  const cache = globalThis.caches?.default;
  const cached = await cache?.match(url.href);
  if (cached) return cached;
  const response = await env.SNAPSHOTS.getByName(path).fetch(url.href);
  if (!response.ok || !cache || response.headers.get("Cache-Control") === "no-store") return response;
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", `public, max-age=${ttl.get(path)}`);
  const out = new Response(response.body, { status: response.status, headers });
  ctx.waitUntil(cache.put(url.href, out.clone()));
  return out;
}

const NO_STORE = { "Cache-Control": "no-store" };

// `not_found_handling` is "none", so only a path with no static file reaches the Worker (existing assets are served, uncounted, by the assets layer).
// A page route (no file extension: /props, /player/12) gets the app shell; anything else that is missing (a chunk of an older build, a stale data file) is a real 404 that no cache may keep,
// because the single-page fallback used to answer those with HTML that a long-lived cache entry then held under a hashed URL for a year.
async function page(request, env, url) {
  if (!["GET", "HEAD"].includes(request.method)) return new Response("Not found", { status: 404, headers: NO_STORE });
  const asset = await env.ASSETS.fetch(request);
  if (asset.status !== 404) return asset;
  if (/\.[A-Za-z0-9]+$/.test(url.pathname) || /^\/(assets|books|\.well-known)\//.test(url.pathname)) return new Response("Not found", { status: 404, headers: NO_STORE });
  const shell = await env.ASSETS.fetch(new Request(new URL("/", url), request));
  const headers = new Headers(shell.headers);
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  return new Response(shell.body, { status: shell.status, headers });
}

// The build lists the content hash of every data file (`data-manifest.json`, the same values the page carries as `window.__DV`).
// A `?v=` URL is kept as immutable only when it names the bytes this deploy holds: a page of the previous build (or a deploy still rolling out)
// asking for its own hash gets the current file once, uncached, and never leaves an old body behind under a new hashed URL.
const manifests = new WeakMap(); // one read per deploy (a new deploy is a new isolate)
function loadManifest(env) {
  if (!manifests.has(env.ASSETS)) {
    const read = env.ASSETS.fetch(new Request("https://assets.invalid/data-manifest.json"))
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((m) => { if (!m) manifests.delete(env.ASSETS); return m; });
    manifests.set(env.ASSETS, read);
  }
  return manifests.get(env.ASSETS);
}

async function dataFile(request, env, url) {
  const asset = await env.ASSETS.fetch(request);
  const headers = new Headers(asset.headers);
  const v = url.searchParams.get("v");
  let cache = url.pathname === "/data/meta.json" ? "public, max-age=60" : "private, max-age=120";
  if (asset.status !== 200) cache = "no-store";
  else if (v) {
    const m = await loadManifest(env);
    cache = m && m[url.pathname.slice("/data/".length)] === v ? "private, max-age=31536000, immutable" : "no-store";
  }
  headers.set("Cache-Control", cache);
  headers.set("X-Robots-Tag", "noindex, nofollow, nosnippet");
  return new Response(asset.body, { status: asset.status, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!env.DATA_WRAP_KEY?.trim() || process.env.DATA_WRAP_KEY !== env.DATA_WRAP_KEY) {
      return Response.json({ error: "Fallback is not configured" }, { status: 503 });
    }
    if (path.startsWith("/card/") || path === "/api/card" || path === "/api/og") {
      try { return await media(request, env, ctx); }
      catch {
        if (path.startsWith("/card/")) return Response.redirect(new URL("/og.png", url), 302);
        return Response.json({ error: "Card rendering temporarily unavailable" }, { status: 503 });
      }
    }
    if (path.startsWith("/share/") || path === "/api/share") {
      return media(request, env, ctx, path === "/api/share" ? url.searchParams.get("path") || "" : path.slice(7));
    }
    if (CRAWLER.test(request.headers.get("user-agent") || "") && /^\/(?:player|fixture|venue)\//.test(path)) {
      return media(request, env, ctx, crawlerSharePath(url));
    }
    if (!path.startsWith("/data/") && !path.startsWith("/api/")) return page(request, env, url);
    const denied = await middleware(request);
    if (denied) return denied;
    if (path.startsWith("/api/")) {
      if (ttl.has(path)) return snapshot(path, request, env, ctx);
      const handler = routes.get(path);
      return handler ? runHandler(handler, request) : Response.json({ error: "Not found" }, { status: 404 });
    }
    return dataFile(request, env, url);
  },
};
