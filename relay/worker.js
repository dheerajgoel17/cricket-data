// A relay that runs on Cloudflare Workers, placed near Mumbai (`wrangler.jsonc` `placement.region`), for a source whose book refuses GitHub's US servers.
// It forwards one request to a host on its allow list and returns the answer as it came. It is not an open proxy: no x-relay-key header equal to RELAY_KEY
// gets a 403, and so does any host not in RELAY_ALLOW or RELAY_ALLOW_EXTRA (comma lists of domains, each also allowing its subdomains).
// The hosts and the key are Worker secrets, never in this file.
//
// Upstream calls look like a Chromium browser in India (Accept-Language en-IN, full Sec-CH / Sec-Fetch, Origin + Referer of the target host).
// Optional caller headers (passed through when set): x-relay-origin, x-relay-referer, x-relay-cookie, x-relay-ua — so a probe can try variants without redeploying.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

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

/** Browser-like headers for the upstream host. Caller overrides win when non-empty. */
export const upstreamHeaders = (url, request, post) => {
  const host = url.hostname;
  const origin = (request.headers.get("x-relay-origin") || "").trim() || `https://${host}`;
  const referer = (request.headers.get("x-relay-referer") || "").trim() || `${origin}/`;
  const ua = (request.headers.get("x-relay-ua") || "").trim() || UA;
  const cookie = (request.headers.get("x-relay-cookie") || "").trim();
  const h = {
    "User-Agent": ua,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    Origin: origin,
    Referer: referer,
    "Sec-CH-UA": `"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"`,
    "Sec-CH-UA-Mobile": "?0",
    "Sec-CH-UA-Platform": `"Windows"`,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    ...(post ? { "Content-Type": request.headers.get("content-type") || "application/x-www-form-urlencoded" } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
  };
  return h;
};

export default {
  async fetch(request, env = {}, ctx = {}) {
    const fetchImpl = typeof ctx.fetch === "function" ? ctx.fetch : fetch;
    const key = env.RELAY_KEY || "";
    if (!key || !same(request.headers.get("x-relay-key") || "", key)) return new Response("forbidden", { status: 403 });

    const here = new URL(request.url);
    // Health: confirms the Worker is up and which colo answered (no upstream). Key still required.
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
      // Forward a short Set-Cookie hint so a probe can warm a session (not a full jar).
      const sc = r.headers.get("set-cookie");
      if (sc) headers.set("x-relay-set-cookie", sc.slice(0, 500));
      return new Response(r.body, { status: r.status, headers });
    } catch (e) {
      return new Response(`upstream error: ${String(e).slice(0, 100)}`, { status: 502 });
    }
  },
};
