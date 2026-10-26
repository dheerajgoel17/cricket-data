// Pure helpers (no DOM) for image URLs, so they can be unit-tested. Data comes from data/photos.json:
//   { p: { "<Cricsheet player id>": "c:<CREX id>" | "w:<Commons file>" }, t: { "<folded team name>": "<CREX team id>" } }
export const CREX_CDN = "https://cricketvectors.akamaized.net";

export const fold = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const held = (photos, kind, id) => photos?.base && photos?.s?.[kind]?.includes(id);

/** Image URLs to try in order for a player: our own copy (Supabase Storage) first, then CREX, then Commons. */
export function playerPhotos(photos, pid) {
  const v = photos?.p?.[pid];
  if (!v) return [];
  if (v.startsWith("w:")) return [`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(v.slice(2))}?width=240`];
  const id = v.slice(2);
  return [held(photos, "p", id) ? `${photos.base}/players/${id}.png` : null, `${CREX_CDN}/players/org/${id}.png`].filter(Boolean);
}
export const playerPhoto = (photos, pid) => playerPhotos(photos, pid)[0] ?? null;

/** Team logo URLs to try in order, by display name ("India", "India (W)", "Mumbai Indians"). */
export function teamLogos(photos, name) {
  const key = fold(String(name).replace(/\(w\)/i, "").replace(/\bwomen\b/i, ""));
  const id = photos?.t?.[key];
  if (!id) return [];
  return [held(photos, "t", id) ? `${photos.base}/teams/${id}.png` : null, `${CREX_CDN}/Teams/${id}.png`].filter(Boolean);
}
export const teamLogo = (photos, name) => teamLogos(photos, name)[0] ?? null;
