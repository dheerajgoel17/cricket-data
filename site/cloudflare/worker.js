import gate from "../api/gate.js";
import geo from "../api/geo.js";
import inplay from "../api/inplay.js";
import { liveHandler } from "../api/live.js";
import { unwrapJson } from "../api/load-data.js";
import state from "../api/state.js";
import middleware from "../middleware.js";

const ttl = new Map([["/api/live", 15], ["/api/inplay", 15], ["/api/state", 10]]);
const routes = new Map([
  ["/api/gate", gate],
  ["/api/geo", geo],
]);

async function runHandler(handler, request) {
  const headers = new Headers();
  let status = 200;
  let body;
  const req = { method: request.method, headers: Object.fromEntries(request.headers), secure: true };
  req.headers["x-forwarded-for"] = request.headers.get("cf-connecting-ip") || "?";
  const res = {
    setHeader(name, value) { headers.set(name, value); },
    status(code) { status = code; return res; },
    json(value) { body = value; return res; },
  };
  await handler(req, res);
  return Response.json(body, { status, headers });
}

function sharePage(path) {
  const parts = path.split("/").filter(Boolean).slice(1);
  if (parts[0] === "pid") parts[0] = "player";
  if (!["player", "fixture", "venue"].includes(parts[0]) || !/^[\w-]+$/.test(parts[1] || "")) return "/";
  const query = parts[0] === "player" && parts[2] && parts[3]
    ? "?" + new URLSearchParams({ stat: parts[2], line: parts[3] }) : "";
  return "/" + parts.slice(0, 2).join("/") + query;
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
  if (!response.ok || !cache) return response;
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", `public, max-age=${ttl.get(path)}`);
  const out = new Response(response.body, { status: response.status, headers });
  ctx.waitUntil(cache.put(url.href, out.clone()));
  return out;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!env.DATA_WRAP_KEY?.trim() || process.env.DATA_WRAP_KEY !== env.DATA_WRAP_KEY) {
      return Response.json({ error: "Fallback is not configured" }, { status: 503 });
    }
    if (path.startsWith("/card/") || path === "/api/card" || path === "/api/og") {
      return new Response("Share image unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    if (path.startsWith("/share/") || path === "/api/share") {
      const target = path === "/api/share" ? "/share/" + (url.searchParams.get("path") || "") : path;
      return Response.redirect(new URL(sharePage(target), url), 302);
    }
    const denied = await middleware(request);
    if (denied) return denied;
    if (path.startsWith("/api/")) {
      if (ttl.has(path)) return snapshot(path, request, env, ctx);
      const handler = routes.get(path);
      return handler ? runHandler(handler, request) : Response.json({ error: "Not found" }, { status: 404 });
    }
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    headers.set("Cache-Control", path === "/data/meta.json" ? "public, max-age=60"
      : url.searchParams.has("v") ? "private, max-age=31536000, immutable" : "private, max-age=120");
    headers.set("X-Robots-Tag", "noindex, nofollow, nosnippet");
    return new Response(asset.body, { status: asset.status, headers });
  },
};
