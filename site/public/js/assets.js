// Free image sources, loaded lazily in the browser (nothing is stored in the repo):
//  * team logos and player photos: CREX's public image CDN (ids from CREX's sitemaps, matched at build time), see photos.js
//  * fallbacks: flagcdn.com flags for national sides, Wikimedia Commons photos via Wikidata, then initials / a silhouette
import { playerPhotos, teamLogos } from "./photos.js";
import { h } from "./ui.js";

const FLAGS = {
  England: "gb-eng", Scotland: "gb-sct", Wales: "gb-wls", Ireland: "ie", India: "in", Australia: "au", "New Zealand": "nz",
  "South Africa": "za", Pakistan: "pk", "Sri Lanka": "lk", Bangladesh: "bd", Afghanistan: "af", Zimbabwe: "zw", Netherlands: "nl",
  Nepal: "np", Oman: "om", "United Arab Emirates": "ae", UAE: "ae", "United States of America": "us", USA: "us", Canada: "ca",
  Namibia: "na", Kenya: "ke", Uganda: "ug", Tanzania: "tz", Nigeria: "ng", Ghana: "gh", Botswana: "bw", Malawi: "mw", Rwanda: "rw",
  Zambia: "zm", Mozambique: "mz", Singapore: "sg", Malaysia: "my", "Hong Kong": "hk", Japan: "jp", China: "cn", Thailand: "th",
  Indonesia: "id", Philippines: "ph", Qatar: "qa", Kuwait: "kw", Bahrain: "bh", "Saudi Arabia": "sa", Bhutan: "bt", Maldives: "mv",
  Myanmar: "mm", Cambodia: "kh", Vanuatu: "vu", "Papua New Guinea": "pg", Fiji: "fj", Samoa: "ws", Germany: "de", France: "fr",
  Italy: "it", Spain: "es", Portugal: "pt", Denmark: "dk", Norway: "no", Sweden: "se", Finland: "fi", Austria: "at", Belgium: "be",
  Switzerland: "ch", Jersey: "je", Guernsey: "gg", "Isle of Man": "im", Gibraltar: "gi", Malta: "mt", Romania: "ro", Bulgaria: "bg",
  Serbia: "rs", Greece: "gr", Cyprus: "cy", Israel: "il", Turkey: "tr", Argentina: "ar", Brazil: "br", Chile: "cl", Peru: "pe",
  Mexico: "mx", Bermuda: "bm", "Cayman Islands": "ky", Bahamas: "bs", Belize: "bz", Panama: "pa", Suriname: "sr", Hungary: "hu",
  Czechia: "cz", "Czech Republic": "cz", Estonia: "ee", Luxembourg: "lu", Poland: "pl", Croatia: "hr", Slovenia: "si", Lesotho: "ls",
  Eswatini: "sz", Sierra_Leone: "sl", "Sierra Leone": "sl", Gambia: "gm", Seychelles: "sc", Saudi: "sa", Korea: "kr", "South Korea": "kr",
};

export const flagUrl = (name, w = 80) => {
  const code = FLAGS[String(name).replace(/\s*\(W\)$/, "").replace(/\s+Women$/, "")];
  return code ? `https://flagcdn.com/w${w}/${code}.png` : null;
};

export const initials = (n) => String(n).replace(/\(W\)/, "").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();

/** Round badge: CREX logo when we know the team, else a flag, else initials. `cls` is "dot" (small) or "crest" (hero). */
export function teamBadge(name, cls = "dot") {
  const flag = flagUrl(name, cls === "crest" ? 160 : 40);
  const urls = [...teamLogos(photos, name), flag].filter(Boolean);
  const el = h("span", { class: cls }, urls.length ? null : initials(name));
  const show = (i) => {
    if (i >= urls.length) { el.textContent = initials(name); return; }
    const img = h("img", { src: urls[i], alt: "", loading: "lazy", onerror: () => { img.remove(); show(i + 1); } });
    el.replaceChildren(img);
  };
  if (urls.length) show(0);
  return el;
}

// ---- player photos: data/photos.json maps player index -> Wikimedia Commons file (built daily from Wikidata, free licences).
// Players without one (roughly: everyone but internationals and stars) get a silhouette. Swap in a licensed API later via `playerPhotoUrl`.
const SILHOUETTE = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="15" r="7"/><path d="M5 40c1-9 7-14 15-14s14 5 15 14z"/></svg>';
let photos = null;
export async function loadPhotos(base = "data/") {
  try { photos = await (await fetch(`${base}photos.json`)).json(); } catch { photos = {}; }
}
export const playerPhotoUrl = (store, pidx) => playerPhotos(photos, pidx)[0] ?? null;

/** Avatar for a player index: photo when we have one, silhouette otherwise. */
export function playerBadge(store, pidx, cls = "dot") {
  const urls = playerPhotos(photos, pidx);
  const el = h("span", { class: `${cls} ph`, title: store.playerName(pidx), html: SILHOUETTE });
  const show = (i) => {
    if (i >= urls.length) return; // the silhouette stays
    const img = h("img", { src: urls[i], alt: store.playerName(pidx), loading: "lazy", onerror: () => { img.remove(); show(i + 1); } });
    el.append(img);
  };
  show(0);
  return el;
}
