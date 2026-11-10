import { ASSISTANT_UA, BOT_UA, fromOurPage } from "./packages/engine/guard.js";
// Edge: block known scrapers on /data and /api (AI assistants too: they only get the share pages), require the gate cookie for /data JSON (except meta.json),
// and send link-preview crawlers the share HTML (so WhatsApp/Twitter see the card without running the app).
// Link-preview fetchers (not search indexers): they get the share HTML so they never have to run the app.
const PREVIEW = /twitterbot|facebookexternalhit|facebot|whatsapp|telegrambot|slackbot|linkedinbot|discordbot|pinterest|skypeuripreview|embedly|quora link preview|redditbot|vkshare|tumblr|bitlybot|flipboard|iframely|opengraph|microsoftpreview|cardyb|bridgy|mastodon|summaly|viber|line\//i;
export const CRAWLER = new RegExp(`${PREVIEW.source}|${ASSISTANT_UA.source}`, "i");

export const config = { matcher: ["/data/:path*", "/api/:path*", "/player/:path*", "/fixture/:path*", "/venue/:path*"] };

/** `/player/12?stat=runs&line=24.5` -> `player/12/runs/24.5` so a copied player-page URL still draws the prop, not an empty name card. */
export function crawlerSharePath(url) {
  const path = url.pathname.replace(/^\//, "");
  const stat = url.searchParams.get("stat");
  const line = url.searchParams.get("line");
  if (/^player\/\d+$/.test(path) && stat && Number.isFinite(Number(line))) return `${path}/${stat}/${line}`;
  return path;
}

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
    dest.searchParams.set("path", crawlerSharePath(url));
    return fetch(dest, { headers: req.headers });
  }
  if (ASSISTANT_UA.test(ua) && path !== "/api/share") return new Response("no", { status: 403, headers: { "Cache-Control": "private, no-store" } }); // an assistant reads the share pages above (the forward below is itself a request to /api/share, with the assistant's User-Agent), never the data or the gate
  if (path === "/api/gate") return;
  if (!ua || BOT_UA.test(ua)) return new Response("no", { status: 403, headers: { "Cache-Control": "private, no-store" } });
  if (!path.startsWith("/data/") || path === "/data/meta.json") return;
  const secret = (process.env.DATA_WRAP_KEY || "").trim();
  // api/og fetches matches.json + one player shard with this header (shards stay out of the function bundle).
  if (secret && req.headers.get("x-cd-k") === secret) return;
  if (!fromOurPage((h) => req.headers.get(h))) return new Response("no", { status: 403, headers: { "Cache-Control": "private, no-store" } }); // a script with a browser's User-Agent but not a page's request
  if (!secret) return;
  if (await cookieOk(secret, req.headers.get("cookie"))) return;
  return new Response("no", { status: 403, headers: { "Cache-Control": "private, no-store" } });
}
