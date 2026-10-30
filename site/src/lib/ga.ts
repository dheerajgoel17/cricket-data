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

export function initGa(id = GA_ID) {
  if (!id || typeof document === "undefined" || document.getElementById("ga4")) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  window.gtag("js", new Date());
  window.gtag("config", id, { send_page_view: false, anonymize_ip: true });
  const s = document.createElement("script");
  s.id = "ga4";
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

export function trackPage(path: string) {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", { page_path: path, page_location: window.location.href, page_title: document.title });
}

export function track(name: string, params?: Record<string, string | number | boolean>) {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", name, params || {});
}
