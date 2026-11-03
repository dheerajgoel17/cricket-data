// Mumbai hop on Cloudflare Workers (`wrangler.jsonc` placement aws:ap-south-1). Free only — no paid VPS / proxy.
// Forwards one request to a host on its allow list. Wrong key or unlisted host → 403.
// Upstream fingerprints rotate per call (`relay/browser.js`). Optional x-relay-origin / referer / cookie / ua overrides.
import { upstreamHeaders as buildUpstream } from "./browser.js";

export const same = (a, b) => {
  const enc = new TextEncoder();
  const x = enc.encode(String(a)), y = enc.encode(String(b));
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
};

export const allowList = (env) => [env?.RELAY_ALLOW, env?.RELAY_ALLOW_EXTRA, env?.RELAY_ALLOW_FEEDG].filter(Boolean).join(",");

export const allowed = (host, list) => String(list || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).some((d) => host === d || host.endsWith(`.${d}`));

export const upstreamHeaders = (url, request, post) => buildUpstream(
  url,
  (name) => request.headers.get(name) || "",
  post,
  post ? (request.headers.get("content-type") || "application/x-www-form-urlencoded") : "",
);

export default {
  async fetch(request, env = {}, ctx = {}) {
    const fetchImpl = typeof ctx.fetch === "function" ? ctx.fetch : fetch;
    const key = env.RELAY_KEY || "";
    if (!key || !same(request.headers.get("x-relay-key") || "", key)) return new Response("forbidden", { status: 403 });

    const here = new URL(request.url);
    if (here.searchParams.get("health") === "1" || here.pathname === "/health") {
      const cf = request.cf || {};
      return Response.json({
        ok: true,
        colo: cf.colo || null,
        country: cf.country || null,
        region: cf.region || null,
        asOrganization: cf.asOrganization || null,
        placement: "aws:ap-south-1",
      }, { headers: { "Cache-Control": "no-store" } });
    }

    let url;
    try { url = new URL(here.searchParams.get("u") || ""); } catch { return new Response("bad url", { status: 400 }); }
    if (url.protocol !== "https:") return new Response("bad url", { status: 400 });
    const host = url.hostname.toLowerCase();
    if (!allowed(host, allowList(env))) return new Response(`host not allowed:${host}`, { status: 403 });

    const post = request.method === "POST";
    try {
      const r = await fetchImpl(url, {
        method: post ? "POST" : "GET",
        body: post ? await request.arrayBuffer() : undefined,
        redirect: "manual",
        headers: upstreamHeaders(url, request, post),
      });
      const headers = new Headers({
        "Content-Type": r.headers.get("content-type") || "application/octet-stream",
        "Cache-Control": "no-store",
        "x-relay-upstream-status": String(r.status),
        "x-relay-colo": String((request.cf && request.cf.colo) || ""),
      });
      const sc = r.headers.get("set-cookie");
      if (sc) headers.set("x-relay-set-cookie", sc.slice(0, 500));
      return new Response(r.body, { status: r.status, headers });
    } catch (e) {
      return new Response(`upstream error: ${String(e).slice(0, 100)}`, { status: 502 });
    }
  },
};
