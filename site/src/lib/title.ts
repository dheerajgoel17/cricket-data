import { useEffect } from "react";
import { fullTitle, pageMeta, BRAND } from "./seo.js";

const meta = (attr: "name" | "property", key: string, value: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute("content", value);
};

/** Sets the document title (one call per page render is fine). The description, canonical link and share tags follow it in `syncMeta`. */
export function setTitle(t: string) { if (typeof document !== "undefined") document.title = fullTitle(t); }
export const useTitle = (t: string) => useEffect(() => { document.title = fullTitle(t); }, [t]);

/** Brings the description, canonical link, robots hint and Open Graph / Twitter tags in line with the current path and title. */
export function syncMeta(pathname: string) {
  if (typeof document === "undefined") return;
  const { description, noindex } = pageMeta(pathname, document.title);
  const url = `${location.origin}${pathname === "/" ? "/" : pathname.replace(/\/+$/, "")}`;
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
  link.href = url;
  meta("name", "description", description);
  meta("name", "robots", noindex ? "noindex, follow" : "index, follow, max-image-preview:large");
  meta("property", "og:title", document.title);
  meta("property", "og:description", description);
  meta("property", "og:url", url);
  meta("property", "og:site_name", BRAND);
  meta("name", "twitter:title", document.title);
  meta("name", "twitter:description", description);
}

/** Keeps the meta tags in step with the route and with the title, which a page may set later, once its data is in. */
export function useMetaSync(pathname: string) {
  useEffect(() => {
    syncMeta(pathname);
    const el = document.head.querySelector("title");
    if (!el) return;
    const mo = new MutationObserver(() => syncMeta(pathname));
    mo.observe(el, { childList: true, characterData: true, subtree: true });
    return () => mo.disconnect();
  }, [pathname]);
}
