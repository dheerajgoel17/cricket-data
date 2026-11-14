/** Standalone catalogue hostname (design.fancy.cash). Product app stays on its own host. */
export const DESIGN_SYSTEM_HOST = import.meta.env.VITE_DESIGN_SYSTEM_HOST || "design.fancy.cash";

/** Product site origin for Saved / search results / tab destinations from the catalogue host. */
export const PRODUCT_ORIGIN = String(import.meta.env.VITE_SITE_URL || "https://fancy.cash").replace(/\/+$/, "");

export function isDesignHost(hostname = typeof location !== "undefined" ? location.hostname : ""): boolean {
  return hostname === DESIGN_SYSTEM_HOST;
}

/** Catalogue routes that stay on the design host (everything else hands off to the product site). */
export function isDesignCataloguePath(pathname: string): boolean {
  return pathname === "/" || pathname === "/search" || pathname.startsWith("/docs/") || pathname === "/design-system";
}

/** Open a product app path (player, saved, props, …) from the design host. */
export function goProduct(path: string) {
  const to = path.startsWith("/") ? path : `/${path}`;
  location.assign(PRODUCT_ORIGIN + to);
}
