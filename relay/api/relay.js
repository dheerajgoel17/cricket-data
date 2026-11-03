// Feed G (ReddyBook) Mumbai hop: Vercel Hobby pinned to bom1 (`vercel.json`). Cloudflare Workers still serve Feed H
// (`relay/worker.js`). This is the path that worked for Feed G in late Oct 2026 before the hop moved to Cloudflare.
// Forwards one request to a host on RELAY_ALLOW / RELAY_ALLOW_EXTRA and returns the answer as it came. Not an open
// proxy: wrong x-relay-key or an unlisted host → 403. Hosts and key are Vercel env vars, never in this file.
import { timingSafeEqual } from "node:crypto";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

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

function upstreamHeaders(url, req, post) {
  const host = url.hostname;
  const origin = String(req.headers["x-relay-origin"] || "").trim() || `https://${host}`;
  const referer = String(req.headers["x-relay-referer"] || "").trim() || `${origin}/`;
  const ua = String(req.headers["x-relay-ua"] || "").trim() || UA;
  const cookie = String(req.headers["x-relay-cookie"] || "").trim();
  return {
    "User-Agent": ua,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
    Origin: origin,
    Referer: referer,
    "Sec-CH-UA": `"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"`,
    "Sec-CH-UA-Mobile": "?0",
    "Sec-CH-UA-Platform": `"Windows"`,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    ...(post && req.headers["content-type"] ? { "Content-Type": req.headers["content-type"] } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
  };
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
