// Free image sources, loaded lazily in the browser: Source A's public image CDN (ids matched at build time, see photos.ts),
// flagcdn.com flags for national sides, Wikimedia Commons photos via Wikidata, then initials / a silhouette.
export { playerPhotos, teamLogos } from "@/lib/photos.js";

export interface Photos { p?: Record<string, string>; t?: Record<string, string>; base?: string; s?: Record<string, string[]> }

const FLAGS: Record<string, string> = {
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
  Eswatini: "sz", "Sierra Leone": "sl", Gambia: "gm", Seychelles: "sc", Saudi: "sa", Korea: "kr", "South Korea": "kr",
};

export const flagUrl = (name: string, w = 80) => {
  const code = FLAGS[String(name).replace(/\s*\(W\)$/, "").replace(/\s+Women$/, "")];
  return code ? `https://flagcdn.com/w${w}/${code}.png` : null;
};

export async function loadPhotos(base = "/data/"): Promise<Photos> {
  try { return await (await fetch(`${base}photos.json`)).json(); } catch { return {}; }
}
