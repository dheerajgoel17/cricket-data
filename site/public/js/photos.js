// Pure helpers (no DOM) for image URLs, so they can be unit-tested. Data comes from data/photos.json:
//   { p: { "<player idx>": "c:<CREX id>" | "w:<Commons file>" }, t: { "<folded team name>": "<CREX team id>" } }
export const CREX_CDN = "https://cricketvectors.akamaized.net";

export const fold = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Player photo URL (CREX first, Wikimedia Commons otherwise) or null. */
export function playerPhoto(photos, pidx) {
  const v = photos?.p?.[pidx];
  if (!v) return null;
  return v.startsWith("c:") ? `${CREX_CDN}/players/org/${v.slice(2)}.png` : `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(v.slice(2))}?width=240`;
}

/** Team logo URL from CREX by display name ("India", "India (W)", "Mumbai Indians"), or null. */
export function teamLogo(photos, name) {
  const key = fold(String(name).replace(/\(w\)/i, "").replace(/\bwomen\b/i, ""));
  const id = photos?.t?.[key];
  return id ? `${CREX_CDN}/Teams/${id}.png` : null;
}
