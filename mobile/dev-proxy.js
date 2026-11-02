// Dev only, for the browser preview (`npm run web`): a browser cannot send the app's own user agent or read the gate cookie, so Metro answers
// `/__site/*` itself, doing the gate call and the cookie on the server side and passing the unwrap key back in `X-Cd-K`. Native builds never use this.
const UA = "FancyCash/preview (web)";
const site = () => String(process.env.EXPO_PUBLIC_SITE_URL || "").replace(/\/$/, "");
let cookie = "";
let key = "";

async function gate() {
  const r = await fetch(`${site()}/api/gate`, { headers: { "user-agent": UA } });
  cookie = (r.headers.get("set-cookie") || "").split(";")[0];
  key = r.headers.get("x-cd-k") || "";
}

async function forward(path, retry = true) {
  const r = await fetch(site() + path, { headers: { "user-agent": UA, accept: "application/json", ...(cookie ? { cookie } : {}) } });
  if (r.status === 403 && retry) { await gate(); return forward(path, false); }
  return r;
}

module.exports = function withSiteProxy(middleware) {
  return async (req, res, next) => {
    if (!req.url.startsWith("/__site/")) return middleware(req, res, next);
    try {
      const path = req.url.slice("/__site".length);
      if (path.split("?")[0] === "/api/gate") {
        if (!key) await gate();
        res.writeHead(200, { "content-type": "application/json", "x-cd-k": key, "cache-control": "no-store" });
        return res.end('{"ok":true}');
      }
      if (!cookie) await gate();
      const r = await forward(path);
      res.writeHead(r.status, { "content-type": r.headers.get("content-type") || "application/json", "cache-control": "no-store" });
      return res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) {
      res.writeHead(502);
      return res.end(String(e));
    }
  };
};
