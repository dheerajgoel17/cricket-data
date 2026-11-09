// Shared Chromium-in-India fingerprints for the free Mumbai hops (Vercel bom1 + Cloudflare Worker).
// Rotate per upstream call so a book does not see one sticky bot UA. No paid proxy / VPS.
const PROFILES = [
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    ch: `"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"`,
    platform: `"Windows"`,
    mobile: "?0",
    lang: "en-IN,en;q=0.9,hi;q=0.8",
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    ch: `"Google Chrome";v="132", "Chromium";v="132", "Not_A Brand";v="24"`,
    platform: `"Windows"`,
    mobile: "?0",
    lang: "en-IN,en;q=0.9,hi-IN;q=0.8,hi;q=0.7",
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    ch: `"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"`,
    platform: `"macOS"`,
    mobile: "?0",
    lang: "en-IN,en;q=0.9",
  },
  {
    ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    ch: `"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"`,
    platform: `"Android"`,
    mobile: "?1",
    lang: "en-IN,en;q=0.9,hi;q=0.8",
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    ch: `"Chromium";v="130", "Google Chrome";v="130", "Not_A Brand";v="24"`,
    platform: `"Windows"`,
    mobile: "?0",
    lang: "hi-IN,hi;q=0.9,en-IN;q=0.8,en;q=0.7",
  },
];

export const pickProfile = (rand = Math.random) => PROFILES[Math.floor(rand() * PROFILES.length) % PROFILES.length];

/** Match Sec-CH to a caller-supplied UA when it names a Chrome major; else keep the picked profile's ch. */
export const chForUa = (ua, fallback) => {
  const m = String(ua || "").match(/Chrome\/(\d+)/);
  if (!m) return fallback;
  const v = m[1];
  return `"Google Chrome";v="${v}", "Chromium";v="${v}", "Not_A Brand";v="24"`;
};

export const platformForUa = (ua, fallback) => {
  const s = String(ua || "");
  if (/Android/i.test(s)) return `"Android"`;
  if (/iPhone|iPad/i.test(s)) return `"iOS"`;
  if (/Mac OS X/i.test(s)) return `"macOS"`;
  if (/Linux/i.test(s) && !/Android/i.test(s)) return `"Linux"`;
  return fallback;
};

export const mobileForUa = (ua, fallback) => (/Mobile|Android/i.test(String(ua || "")) ? "?1" : fallback);

/**
 * Browser-like upstream headers. Caller overrides (x-relay-*) win when non-empty.
 * `get` reads a header name → string (Request or Node IncomingMessage style).
 */
export const upstreamHeaders = (url, get, post, contentType) => {
  const host = url.hostname;
  const origin = String(get("x-relay-origin") || "").trim() || `https://${host}`;
  const referer = String(get("x-relay-referer") || "").trim() || `${origin}/`;
  const cookie = String(get("x-relay-cookie") || "").trim();
  const overrideUa = String(get("x-relay-ua") || "").trim();
  const accept = String(get("x-relay-accept") || "").trim();
  const csrf = String(get("x-relay-csrf") || "").trim();
  const ct = String(get("x-relay-ct") || "").trim();
  const ctd = String(get("x-relay-ct-d") || "").trim();
  const dest = String(get("x-relay-dest") || "").trim();
  const mode = String(get("x-relay-mode") || "").trim();
  const site = String(get("x-relay-site") || "").trim();
  const p = pickProfile();
  const ua = overrideUa || p.ua;
  return {
    "User-Agent": ua,
    Accept: accept || "application/json, text/plain, */*",
    "Accept-Language": p.lang,
    "Accept-Encoding": "gzip, deflate, br",
    Origin: origin,
    Referer: referer,
    "Sec-CH-UA": chForUa(ua, p.ch),
    "Sec-CH-UA-Mobile": mobileForUa(ua, p.mobile),
    "Sec-CH-UA-Platform": platformForUa(ua, p.platform),
    "Sec-Fetch-Dest": dest || "empty",
    "Sec-Fetch-Mode": mode || "cors",
    "Sec-Fetch-Site": site || "same-site",
    ...(post && contentType ? { "Content-Type": contentType } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
    ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    ...(ct ? { "x-ct": ct } : {}),
    ...(ctd ? { "x-ct-d": ctd } : {}),
  };
};

export { PROFILES };
