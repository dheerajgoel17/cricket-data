// Feed G Mumbai hop: Vercel Hobby pinned to bom1 (`vercel.json`). Free only — no paid VPS / proxy.
// Cloudflare Workers (`relay/worker.js`) still serve Feed H. Forwards one request to a host on the allow list.
// Wrong x-relay-key or an unlisted host → 403. Upstream fingerprints rotate per call (`relay/browser.js`).
import { timingSafeEqual } from "node:crypto";
import { upstreamHeaders as buildUpstream } from "../browser.js";

export const same = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

export const allowList = () => [process.env.RELAY_ALLOW, process.env.RELAY_ALLOW_EXTRA, process.env.RELAY_ALLOW_FEEDG].filter(Boolean).join(",");

export const allowed = (host, list) => String(list || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  .some((d) => host === d || host.endsWith(`.${d}`));

async function readBody(req) {
  const parts = [];
  for await (const c of req) parts.push(c);
  return Buffer.concat(parts);
}

const headerGet = (req) => (name) => {
  const h = req.headers || {};
  return h[name] ?? h[name.toLowerCase()] ?? "";
};

function upstreamHeaders(url, req, post) {
  return buildUpstream(url, headerGet(req), post, post ? (req.headers?.["content-type"] || "") : "");
}

export default async function handler(req, res, fetchImpl = fetch) {
  const key = process.env.RELAY_KEY || "";
  if (!key || !same(req.headers["x-relay-key"] || "", key)) {
    res.statusCode = 403;
    return res.end("forbidden");
  }
  let url;
  try {
    url = new URL(String(req.query?.u || ""));
  } catch {
    res.statusCode = 400;
    return res.end("bad url");
  }
  if (url.protocol !== "https:") {
    res.statusCode = 400;
    return res.end("bad url");
  }
  const host = url.hostname.toLowerCase();
  if (!allowed(host, allowList())) {
    res.statusCode = 403;
    return res.end(`host not allowed:${host}`);
  }
  const post = req.method === "POST";
  try {
    const r = await fetchImpl(url, {
      method: post ? "POST" : "GET",
      body: post ? await readBody(req) : undefined,
      redirect: "manual",
      headers: upstreamHeaders(url, req, post),
    });
    res.statusCode = r.status;
    res.setHeader("Content-Type", r.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("x-relay-upstream-status", String(r.status));
    const sc = r.headers.get("set-cookie");
    if (sc) res.setHeader("x-relay-set-cookie", sc.slice(0, 500));
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    res.statusCode = 502;
    res.end(`upstream error: ${String(e).slice(0, 100)}`);
  }
}
