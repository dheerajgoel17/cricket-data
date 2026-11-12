/** Google AdSense: script loads at run time on allowlisted paths only, never in index.html.
 *  Live units mount via `AdSlot` (manual creative overrides AdSense; empty slots render nothing). */
import { slotForPath } from "@/lib/ad-slots";

export const CLIENT = "ca-pub-2168706546154604";

/** Paths that may load the AdSense script and fall back to a network unit when no manual creative is set. */
export const adsAllowed = (pathname: string) => slotForPath(pathname) != null;

let loaded = false;
/** Called on every route change. Once the script is in, it cannot be taken out, so leaving for a page without ads is a full page load (without the script). */
export function syncAds(pathname: string) {
  if (typeof document === "undefined") return;
  if (adsAllowed(pathname)) {
    if (loaded) return;
    loaded = true;
    const s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
    document.head.appendChild(s);
  } else if (loaded) {
    window.location.assign(pathname + window.location.search);
  }
}

/** Display unit id ("stats footer" in AdSense console; reused for top strips). Public id. `VITE_ADSENSE_SLOT` / `ADSENSE_SLOT` replaces it, or `none` to draw no unit. */
const DEFAULT_SLOT = "3081954637";
export const slotFrom = (v: unknown) => { const t = String(v ?? "").trim(); return t.toLowerCase() === "none" ? "" : t.replace(/[^0-9]/g, "") || DEFAULT_SLOT; };
export const AD_SLOT = slotFrom(import.meta.env.VITE_ADSENSE_SLOT);
