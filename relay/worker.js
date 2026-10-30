// A relay that runs on Cloudflare Workers, placed near Mumbai (`wrangler.jsonc` `placement.region`), for a source whose book refuses GitHub's US servers.
// It forwards one request to a host on its allow list and returns the answer as it came. It is not an open proxy: no x-relay-key header equal to RELAY_KEY
// gets a 403, and so does any host not in RELAY_ALLOW or RELAY_ALLOW_EXTRA (comma lists of domains, each also allowing its subdomains).
// The hosts and the key are Worker secrets, never in this file.
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export const same = (a, b) => {
  const enc = new TextEncoder();
  const x = enc.encode(String(a)), y = enc.encode(String(b));
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
};

export const allowList = (env) => [env?.RELAY_ALLOW, env?.RELAY_ALLOW_EXTRA].filter(Boolean).join(",");

export const allowed = (host, list) => String(list || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).some((d) => host === d || host.endsWith(`.${d}`));

export default {
  async fetch(request, env = {}, ctx = {}) {
    const fetchImpl = typeof ctx.fetch === "function" ? ctx.fetch : fetch;
    const key = env.RELAY_KEY || "";
    if (!key || !same(request.headers.get("x-relay-key") || "", key)) return new Response("forbidden", { status: 403 });
    let url;
    try { url = new URL(new URL(request.url).searchParams.get("u") || ""); } catch { return new Response("bad url", { status: 400 }); }
    if (url.protocol !== "https:" || !allowed(url.hostname.toLowerCase(), allowList(env))) return new Response("host not allowed", { status: 403 });
    const post = request.method === "POST";
    try {
      const r = await fetchImpl(url, {
        method: post ? "POST" : "GET", body: post ? await request.arrayBuffer() : undefined, redirect: "manual",
        headers: { "User-Agent": UA, Accept: "application/json", ...(post && request.headers.get("content-type") ? { "Content-Type": request.headers.get("content-type") } : {}) },
      });
      const headers = new Headers({ "Content-Type": r.headers.get("content-type") || "application/octet-stream", "Cache-Control": "no-store" });
      return new Response(r.body, { status: r.status, headers });
    } catch (e) {
      return new Response(`upstream error: ${String(e).slice(0, 100)}`, { status: 502 });
    }
  },
};
