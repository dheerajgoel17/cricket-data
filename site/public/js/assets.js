// Free image sources, loaded lazily in the browser (nothing is stored in the repo):
//  * team flags: flagcdn.com (national sides only)
//  * player photos: Wikidata (ESPNcricinfo id -> P18 image) served by Wikimedia Commons; initials are the fallback.
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

/** Round badge: flag if the side is a country, else initials. `cls` is "dot" (small) or "crest" (hero). */
export function teamBadge(name, cls = "dot") {
  const url = flagUrl(name, cls === "crest" ? 160 : 40);
  const el = h("span", { class: cls }, url ? null : initials(name));
  if (url) el.append(h("img", { src: url, alt: "", loading: "lazy", onerror: (e) => { e.target.remove(); el.textContent = initials(name); } }));
  return el;
}

// ---- player photos
const KEY = "cph1";
let cache = {};
try { cache = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { cache = {}; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* private mode */ } };
const pending = new Map();

/** Resolve photos for Cricinfo ids in one SPARQL call. Returns {id: url|null}. */
export async function photosFor(ids) {
  const need = ids.filter((i) => !(i in cache));
  if (need.length) {
    try {
      const q = `SELECT ?id ?img WHERE { VALUES ?id { ${need.map((i) => `"${i}"`).join(" ")} } ?p wdt:P2697 ?id; wdt:P18 ?img }`;
      const r = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`);
      if (r.ok) {
        const j = await r.json();
        for (const i of need) cache[i] = null;
        for (const b of j.results.bindings) cache[b.id.value] = b.img.value.replace(/^http:/, "https:") + "?width=240";
        save();
      }
    } catch { /* offline: initials stay */ }
  }
  return Object.fromEntries(ids.map((i) => [i, cache[i] ?? null]));
}

// Player photos are switched off for now (no reliable free source covers everyone): every player gets a neutral silhouette.
// To add real photos later, set PHOTOS_ENABLED and/or return a URL from `playerPhotoUrl(store, pidx)` (a licensed API, say).
const PHOTOS_ENABLED = false;
export const playerPhotoUrl = () => null;

const SILHOUETTE = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="15" r="7"/><path d="M5 40c1-9 7-14 15-14s14 5 15 14z"/></svg>';

/** Avatar for a player index: silhouette placeholder (photo when PHOTOS_ENABLED and a URL exists). */
export function playerBadge(store, pidx, cls = "dot") {
  const el = h("span", { class: `${cls} ph`, title: store.playerName(pidx), html: SILHOUETTE });
  if (PHOTOS_ENABLED) {
    const ci = store.index.cricinfo?.[pidx];
    if (ci) photosFor([ci]).then((m) => { if (m[ci]) el.replaceChildren(h("img", { src: m[ci], alt: store.playerName(pidx), loading: "lazy" })); });
  }
  return el;
}
