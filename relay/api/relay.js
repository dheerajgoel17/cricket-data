// A relay that runs in Mumbai (relay/vercel.json pins the region), for a source whose book refuses GitHub's US servers. It forwards one request to a host on an allow list and returns the answer
// as it came. It is not an open proxy: no x-relay-key header equal to RELAY_KEY (a Vercel environment variable) gets a 403, and so does any host not in RELAY_ALLOW (a comma list of domains,
// each also allowing its subdomains). The hosts and the key are configuration of the relay's Vercel project, never in this file.
import { timingSafeEqual } from "node:crypto";

const UA = "Mozilla/5.0 (compatible; cricket-props-relay/0.1)";

export const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

export const allowed = (host, list) => String(list || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).some((d) => host === d || host.endsWith(`.${d}`));

async function readBody(req) {
  const parts = [];
  for await (const c of req) parts.push(c);
  return Buffer.concat(parts);
}

export default async function handler(req, res, fetchImpl = fetch) {
  const key = process.env.RELAY_KEY || "";
  if (!key || !same(req.headers["x-relay-key"] || "", key)) { res.statusCode = 403; return res.end("forbidden"); }
  let url;
  try { url = new URL(String(req.query?.u || "")); } catch { res.statusCode = 400; return res.end("bad url"); }
  if (url.protocol !== "https:" || !allowed(url.hostname.toLowerCase(), process.env.RELAY_ALLOW)) { res.statusCode = 403; return res.end("host not allowed"); }
  const post = req.method === "POST";
  try {
    const r = await fetchImpl(url, { method: post ? "POST" : "GET", body: post ? await readBody(req) : undefined, redirect: "manual",
      headers: { "User-Agent": UA, Accept: "application/json", ...(post && req.headers["content-type"] ? { "Content-Type": req.headers["content-type"] } : {}) } });
    res.statusCode = r.status;
    res.setHeader("Content-Type", r.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    res.statusCode = 502;
    res.end(`upstream error: ${String(e).slice(0, 100)}`);
  }
}
