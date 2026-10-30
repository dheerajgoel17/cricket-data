// GET /api/geo -> country/region from the edge request headers (no body, no cookie). Used so analytics can split real visitors from empty geo.
export default function handler(req, res) {
  const h = req.headers || {};
  const g = (k) => String(h[k] || h[k.toLowerCase()] || "").trim();
  const country = (g("x-vercel-ip-country") || g("cf-ipcountry") || g("cloudfront-viewer-country")).toUpperCase();
  const region = (g("x-vercel-ip-country-region") || g("cf-region-code")).toUpperCase();
  res.setHeader("Cache-Control", "private, no-store");
  res.status(200).json({ country, region });
}
