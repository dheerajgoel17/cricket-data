// Pure helpers (no DOM) for image URLs, so they can be unit-tested. Data comes from data/photos.json:
//   { p: { "<Base player id>": "c:<Source A id>" | "w:<Commons file>" }, t: { "<folded team name>": "<Source A team id>" } }
/** The third-party image host is configuration, not code: VITE_IMG_CDN is set in the build environment. */
const cdn = () => (import.meta.env?.VITE_IMG_CDN ?? (typeof process !== "undefined" ? process.env.VITE_IMG_CDN : "")) || "";

export const fold = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const held = (photos, kind, id) => photos?.base && photos?.s?.[kind]?.includes(id);

/** Image URLs to try in order for a player: our own copy (Supabase Storage) first, then Source A, then Commons. */
export function playerPhotos(photos, pid) {
  const v = photos?.p?.[pid];
  if (!v) return [];
  if (v.startsWith("w:")) return [`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(v.slice(2))}?width=240`];
  const id = v.slice(2);
  return [held(photos, "p", id) ? `${photos.base}/players/${id}.png` : null, `${cdn()}/players/org/${id}.png`].filter(Boolean);
}
export const playerPhoto = (photos, pid) => playerPhotos(photos, pid)[0] ?? null;

/** Team logo URLs to try in order, by display name ("India", "India (W)", "Mumbai Indians"). */
export function teamLogos(photos, name) {
  const key = fold(String(name).replace(/\(w\)/i, "").replace(/\bwomen\b/i, ""));
  const id = photos?.t?.[key];
  if (!id) return [];
  return [held(photos, "t", id) ? `${photos.base}/teams/${id}.png` : null, `${cdn()}/Teams/${id}.png`].filter(Boolean);
}
export const teamLogo = (photos, name) => teamLogos(photos, name)[0] ?? null;

/**
 * The team's kit picture (a shirt on its own, transparent): the player portrait is his face avatar standing in it. Two kits exist, the coloured limited-overs one
 * and the white Test one. Our own stored copy (`s.j`) first, the source second, and the portrait works without either.
 */
export function teamJerseys(photos, name, test = false) {
  const key = fold(String(name).replace(/\(w\)/i, "").replace(/\bwomen\b/i, ""));
  const kit = test ? "test" : "limited";
  const url = (id) => [photos?.base && photos?.s?.j?.includes(`${id}:${kit}`) ? `${photos.base}/jerseys/${kit}/${id}.png` : null, `${cdn()}/jersey/${kit}/org/${id}.png`];
  const id = photos?.t?.[key];
  // the team's own shirt, then the source's plain placeholder shirt (what its own pages fall back to when a team has none)
  return [...(id ? url(id) : []), ...url("AD")].filter(Boolean);
}
