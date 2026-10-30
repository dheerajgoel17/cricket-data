/** Google Analytics 4. Loads on its own — no cookie banner. Ads cookies stay off.
 *  Measurement id comes from VITE_GA_MEASUREMENT_ID (GitHub secret, inlined at build). */

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export function resolveGaId(raw?: string) {
  const id = (raw ?? "").trim();
  return id.startsWith("G-") ? id : "";
}

export const GA_ID = resolveGaId(import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined);

const BOT = /bot|crawl|spider|slurp|headless|preview|facebookexternal|linkedinbot|slackbot|discordbot|whatsapp|telegram|python-requests|curl\/|wget\/|playwright|puppeteer|lighthouse|pagespeed|webdriver/i;

let geo: { country?: string; region?: string } = {};

type Nav = { userAgent?: string; language?: string; platform?: string; userAgentData?: { brands?: { brand: string }[]; platform?: string }; webdriver?: boolean };
type Loc = { href?: string; search?: string };
type Doc = { referrer?: string; title?: string };

export function audienceParams(nav: Nav = typeof navigator === "undefined" ? {} : navigator, loc: Loc = typeof location === "undefined" ? {} : location, doc: Doc = typeof document === "undefined" ? {} : document) {
  const ua = nav.userAgent || "";
  let src = "", medium = "none", campaign = "";
  try {
    const q = new URL(loc.href || "https://x.invalid").searchParams;
    src = q.get("utm_source") || "";
    medium = q.get("utm_medium") || "";
    campaign = q.get("utm_campaign") || "";
  } catch { /* keep empty source */ }
  if (!src) {
    const ref = doc.referrer || "";
    if (ref) {
      try { src = new URL(ref).hostname || "referral"; medium = "referral"; } catch { src = "referral"; medium = "referral"; }
    } else { src = "direct"; medium = "none"; }
  }
  const ch = nav.userAgentData;
  return {
    page_referrer: doc.referrer || "",
    traffic_source: src,
    traffic_medium: medium,
    traffic_campaign: campaign,
    device_category: /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop",
    browser: ch?.brands?.[0]?.brand || "",
    os: ch?.platform || nav.platform || "",
    language: nav.language || "",
    is_bot: BOT.test(ua) || !!nav.webdriver ? 1 : 0,
    country: geo.country || "",
    region: geo.region || "",
  };
}

async function loadGeo() {
  try {
    const r = await fetch("/api/geo", { cache: "no-store" });
    if (r.ok) geo = await r.json();
  } catch { /* offline or blocked */ }
}

export function initGa(id = GA_ID) {
  if (!id || typeof document === "undefined" || document.getElementById("ga4")) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  window.gtag("js", new Date());
  window.gtag("config", id, { send_page_view: false });
  const s = document.createElement("script");
  s.id = "ga4";
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
  loadGeo().then(() => {
    if (geo.country && typeof window.gtag === "function") window.gtag("set", "user_properties", { country: geo.country, region: geo.region || "" });
  });
}

export function trackPage(path: string) {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", { ...audienceParams(), page_path: path, page_location: window.location.href, page_title: document.title });
}

export function track(name: string, params?: Record<string, string | number | boolean>) {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", name, { ...audienceParams(), ...(params || {}) });
}
