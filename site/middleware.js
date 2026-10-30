// Edge: block known scrapers on /data and /api, and require the gate cookie for /data JSON (except meta.json).
const BOT = /curl|wget|python-requests|scrapy|httpx|aiohttp|go-http-client|libwww|okhttp|java\/|phantomjs|headlesschrome|bytespider|gptbot|ccbot|claudebot|amazonbot|semrush|ahrefs|mj12bot|dotbot|dataforseo|petalsearch|ia_archiver|megaindex/i;

export const config = { matcher: ["/data/:path*", "/api/:path*"] };

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function cookieOk(secret, cookie) {
  const m = /(?:^|;\s*)cdg=([^;]+)/.exec(cookie || "");
  if (!m) return false;
  const [exp, nonce, mac] = m[1].split(".");
  if (!exp || !nonce || !mac || Number(exp) < Date.now() / 1000) return false;
  return (await hmacHex(secret, `${exp}.${nonce}`)) === mac;
}

export default async function middleware(req) {
  const url = new URL(req.url);
  const path = url.pathname;
  const ua = req.headers.get("user-agent") || "";
  if (path === "/api/gate") return;
  if (!ua || BOT.test(ua)) return new Response("no", { status: 403, headers: { "Cache-Control": "private, no-store" } });
  if (!path.startsWith("/data/") || path === "/data/meta.json") return;
  const secret = (process.env.DATA_WRAP_KEY || "").trim();
  if (!secret) return;
  if (await cookieOk(secret, req.headers.get("cookie"))) return;
  return new Response("no", { status: 403, headers: { "Cache-Control": "private, no-store" } });
}
