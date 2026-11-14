// Pure helpers (no DOM) for image URLs, so they can be unit-tested. Data comes from data/photos.json:
//   { p: { "<Base player id>": "c:<Source A id>" | "w:<Commons file>" }, t: { "<folded team name>": "<Source A team id>" }, l: { "<folded event name>": "<Source A series id, newest season>" } }
/** The third-party image host is configuration, not code: VITE_IMG_CDN is set in the build environment. */
const cdn = () => (import.meta.env?.VITE_IMG_CDN ?? (typeof process !== "undefined" ? process.env.VITE_IMG_CDN : "")) || "";

export const fold = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const held = (photos, kind, id) => photos?.base && photos?.s?.[kind]?.includes(id);

/**
 * Base sides the source lists but older photos.json / crex_match caches omitted from `t`.
 * `photos.t` always wins; this only fills holes until the next photos rebuild (build.py re-matches A["teams"]).
 */
export const TEAM_FILL = {
  "abu dhabi": "DC", afghanistan: "Y", "afghanistan u19": "8E", ajman: "DF", "australia a": "Z8",
  "australia champions": "VK", "australia governor xi": "1LN", "bangladesh u19": "8J", "bangladesh u19 women": "NS",
  "brampton blazers": "6P", dubai: "DE", "eastern cape iinyathi": "JC", "eastern storm": "JF",
  "emirates blues": "DD", "emirates red": "R1", "england champions": "VL", fujairah: "DH",
  "garden route badgers": "J9", "india a": "6S", "india champions": "VJ", "limpopo impalas": "JD",
  "mississauga skyhawks": "RC", "montreal warriors": "2K", "mpumalanga rhinos": "JA",
  "north west dragons": "JE", "northern cape heat": "J8", "pakistan u19 women": "NR", rocks: "JG",
  sharjah: "DG", "south africa champions": "VN", "south africa emerging": "16R",
  "sri lanka u19 women": "NM", "toronto kings": "2I", tuskers: "JB", "united states": "CD",
  "united states of america": "CD", "vancouver guardians": "2J", "west indies champions": "VO",
};

/** Folded Base team name → Source A team id (`photos.t`, then TEAM_FILL for known holes). */
export function teamId(photos, name) {
  const raw = fold(name);
  // Prefer the full fold first (keeps "pakistan u19 women"); then the men's/unisex key (India (W) → india).
  const stripped = fold(String(name ?? "").replace(/\(w\)/i, "").replace(/\bwomen\b/i, ""));
  for (const key of [raw, stripped]) {
    if (!key) continue;
    const id = photos?.t?.[key] || TEAM_FILL[key];
    if (id) return id;
  }
  return null;
}

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
  const id = teamId(photos, name);
  if (!id) return [];
  return [held(photos, "t", id) ? `${photos.base}/teams/${id}.png` : null, `${cdn()}/Teams/${id}.png`].filter(Boolean);
}
export const teamLogo = (photos, name) => teamLogos(photos, name)[0] ?? null;

/** League logo URLs to try in order, by the event's name ("Indian Premier League"): the logo file of the league's newest season. */
export function leagueLogos(photos, name) {
  const id = photos?.l?.[fold(name)];
  if (!id) return [];
  return [held(photos, "l", id) ? `${photos.base}/leagues/${id}.png` : null, `${cdn()}/Series/${id}.png`].filter(Boolean);
}

/**
 * The team's kit picture (a shirt on its own, transparent): the player portrait is his face avatar standing in it. Two kits exist, the coloured limited-overs one
 * and the white Test one. Our own stored copy (`s.j`) first, the source second, and the portrait works without either.
 * No generic "AD" placeholder: that shirt looks like a real kit and misleads when the team is unmapped or its jersey 404s (e.g. Afghanistan → light-blue AD).
 */
export function teamJerseys(photos, name, test = false) {
  const id = teamId(photos, name);
  if (!id) return [];
  const kit = test ? "test" : "limited";
  return [
    photos?.base && photos?.s?.j?.includes(`${id}:${kit}`) ? `${photos.base}/jerseys/${kit}/${id}.png` : null,
    `${cdn()}/jersey/${kit}/org/${id}.png`,
  ].filter(Boolean);
}
