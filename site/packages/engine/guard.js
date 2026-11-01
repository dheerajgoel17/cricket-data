// The "is this request from our own page" check the data gate uses. A browser tells the server where a request came from (Sec-Fetch-Site); a plain script usually does not.
// Modern Chrome, Edge and Firefox always send it, so one of those without it is a script wearing a browser's User-Agent. Safari older than 16.4 and other odd clients never send it and are let through.
// Plain ESM, no Node APIs: used by the Edge middleware and the /api/gate function.

/** `get(name)` returns a header value or null/undefined (a Headers.get, or a lookup on Node's lowercase header object). */
export function fromOurPage(get) {
  const site = String(get("sec-fetch-site") || "").toLowerCase();
  if (site) return site === "same-origin" || site === "same-site";
  return !/\b(Chrome|Chromium|Edg|Firefox|FxiOS|CriOS)\//.test(String(get("user-agent") || ""));
}
