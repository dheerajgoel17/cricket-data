/** Google AdSense runs on stats pages only. Pages that show book prices, props, fancy lines or value edges, and the pages around them, never load the ad script
 *  (AdSense restricts gambling-related content). The script is added at run time, never in index.html, so a prebuilt page does not carry it. */
export const CLIENT = "ca-pub-2168706546154604";
const ALLOWED = [/^\/leagues?(\/|$)/, /^\/competitions$/, /^\/teams?(\/|$)/, /^\/venue\//, /^\/players$/, /^\/glossary$/, /^\/about$/];

export const adsAllowed = (pathname: string) => ALLOWED.some((r) => r.test(pathname));

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

/** The ad unit shown at the foot of an ad page: the slot id of a display unit made in AdSense (a public id, the repository variable `ADSENSE_SLOT`, inlined at build as `VITE_ADSENSE_SLOT`). Unset: no unit is drawn (Auto ads, if switched on in AdSense, still place ads themselves). */
export const AD_SLOT = String(import.meta.env.VITE_ADSENSE_SLOT || "").trim().replace(/[^0-9]/g, "");
