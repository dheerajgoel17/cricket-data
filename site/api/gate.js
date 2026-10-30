// GET /api/gate -> {ok, k?}. Sets a short-lived cookie the Edge middleware checks before serving /data/*.
// Returns the wrap key so the browser can unwrap the small JSON files. Scraper UAs are refused. No key in the bundle.
import crypto from "node:crypto";

const BOT = /curl|wget|python-requests|scrapy|httpx|aiohttp|go-http-client|libwww|okhttp|java\/|phantomjs|headlesschrome|bytespider|gptbot|ccbot|claudebot|amazonbot|semrush|ahrefs|mj12bot|dotbot|dataforseo|petalsearch|ia_archiver|megaindex/i;
const hits = new Map();

function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 4000) hits.clear();
  return arr.length > 40;
}

export function sign(secret, exp) {
  const nonce = crypto.randomBytes(8).toString("hex");
  const mac = crypto.createHmac("sha256", secret).update(`${exp}.${nonce}`).digest("hex").slice(0, 32);
  return `${exp}.${nonce}.${mac}`;
}

export function verify(secret, token) {
  const [exp, nonce, mac] = String(token || "").split(".");
  if (!exp || !nonce || !mac || Number(exp) < Date.now() / 1000) return false;
  const want = crypto.createHmac("sha256", secret).update(`${exp}.${nonce}`).digest("hex").slice(0, 32);
  try { return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want)); } catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const ua = String(req.headers["user-agent"] || "");
  if (!ua || BOT.test(ua)) return res.status(403).json({ error: "no" });
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
  if (limited(ip)) return res.status(429).json({ error: "rate limit" });
  const secret = (process.env.DATA_WRAP_KEY || "").trim();
  if (secret) {
    const token = sign(secret, Math.floor(Date.now() / 1000) + 12 * 3600);
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader("Set-Cookie", `cdg=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${secure}`);
  }
  return res.status(200).json({ ok: true, k: secret || undefined });
}
