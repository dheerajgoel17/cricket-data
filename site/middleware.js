// Edge: block known scrapers on /data and /api, require the gate cookie for /data JSON (except meta.json),
// and send link-preview crawlers the share HTML (so WhatsApp/Twitter see the card without running the app).
const BOT = /curl|wget|python-requests|scrapy|httpx|aiohttp|go-http-client|libwww|okhttp|java\/|phantomjs|headlesschrome|bytespider|gptbot|ccbot|claudebot|amazonbot|semrush|ahrefs|mj12bot|dotbot|dataforseo|petalsearch|ia_archiver|megaindex/i;
// Link-preview fetchers (not search indexers): they get the share HTML so they never have to run the app.
export const CRAWLER = /twitterbot|facebookexternalhit|facebot|whatsapp|telegrambot|slackbot|linkedinbot|discordbot|pinterest|skypeuripreview|embedly|quora link preview|redditbot|vkshare|tumblr|bitlybot|flipboard|iframely|opengraph|microsoftpreview|cardyb|bridgy|mastodon|summaly|viber|line\//i;

export const config = { matcher: ["/data/:path*", "/api/:path*", "/player/:path*", "/fixture/:path*", "/venue/:path*"] };

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
  if (CRAWLER.test(ua) && /^(?:\/player\/|\/fixture\/|\/venue\/)/.test(path)) {
    const dest = new URL("/api/share", url.origin);
    dest.searchParams.set("path", path.replace(/^\//, ""));
    return fetch(dest, { headers: req.headers });
  }
  if (path === "/api/gate") return;
  if (!ua || BOT.test(ua)) return new Response("no", { status: 403, headers: { "Cache-Control": "private, no-store" } });
  if (!path.startsWith("/data/") || path === "/data/meta.json") return;
  const secret = (process.env.DATA_WRAP_KEY || "").trim();
  if (!secret) return;
  if (await cookieOk(secret, req.headers.get("cookie"))) return;
  return new Response("no", { status: 403, headers: { "Cache-Control": "private, no-store" } });
}
