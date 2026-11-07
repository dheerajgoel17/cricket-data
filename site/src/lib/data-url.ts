// `/data/index.json` -> `/data/index.json?v=ab12cd34ef`: the build puts a content hash for every data file on the page (`window.__DV`, `scripts/data-manifest.mjs`).
// A versioned URL never changes its bytes, so the browser keeps it (vercel.json); with no manifest (dev, tests, a file the build did not hash) the plain URL is used.
declare global { interface Window { __DV?: Record<string, string>; __gate?: Promise<Response | null> } }

export function dataUrl(url: string, manifest: Record<string, string> | undefined = typeof window === "undefined" ? undefined : window.__DV): string {
  if (!manifest) return url;
  const key = /(?:^|\/)data\/(.+)$/.exec(url)?.[1];
  const h = key ? manifest[key] : undefined;
  return h ? `${url}?v=${h}` : url;
}
