// National flag codes for flagcdn (and share text). Pure: no DOM.
// Crests/kits stay on photos.t; this is only the flagcdn fallback when the source has no logo.
import { fold } from "./photos.js";

/** Folded Base side name → ISO / flagcdn region code. */
export const FLAG_CODES = {
  england: "gb-eng", scotland: "gb-sct", wales: "gb-wls", ireland: "ie", india: "in", australia: "au",
  "new zealand": "nz", "south africa": "za", pakistan: "pk", "sri lanka": "lk", bangladesh: "bd",
  afghanistan: "af", zimbabwe: "zw", netherlands: "nl", nepal: "np", oman: "om",
  "united arab emirates": "ae", uae: "ae", "united states": "us", "united states of america": "us", usa: "us",
  canada: "ca", namibia: "na", kenya: "ke", uganda: "ug", tanzania: "tz", nigeria: "ng", ghana: "gh",
  botswana: "bw", malawi: "mw", rwanda: "rw", zambia: "zm", mozambique: "mz", singapore: "sg",
  malaysia: "my", "hong kong": "hk", japan: "jp", china: "cn", thailand: "th", indonesia: "id",
  philippines: "ph", qatar: "qa", kuwait: "kw", bahrain: "bh", "saudi arabia": "sa", saudi: "sa",
  bhutan: "bt", maldives: "mv", myanmar: "mm", cambodia: "kh", vanuatu: "vu", "papua new guinea": "pg",
  fiji: "fj", samoa: "ws", germany: "de", france: "fr", italy: "it", spain: "es", portugal: "pt",
  denmark: "dk", norway: "no", sweden: "se", finland: "fi", austria: "at", belgium: "be",
  switzerland: "ch", jersey: "je", guernsey: "gg", "isle of man": "im", gibraltar: "gi", malta: "mt",
  romania: "ro", bulgaria: "bg", serbia: "rs", greece: "gr", cyprus: "cy", israel: "il", turkey: "tr",
  argentina: "ar", brazil: "br", chile: "cl", peru: "pe", mexico: "mx", bermuda: "bm",
  "cayman islands": "ky", bahamas: "bs", belize: "bz", panama: "pa", suriname: "sr", hungary: "hu",
  czechia: "cz", "czech republic": "cz", estonia: "ee", luxembourg: "lu", poland: "pl", croatia: "hr",
  slovenia: "si", lesotho: "ls", eswatini: "sz", swaziland: "sz", "sierra leone": "sl", gambia: "gm",
  seychelles: "sc", korea: "kr", "south korea": "kr", cameroon: "cm", "costa rica": "cr", iran: "ir",
  "ivory coast": "ci", "cote d ivoire": "ci", mongolia: "mn", "st helena": "sh", "saint helena": "sh",
  uzbekistan: "uz", "timor leste": "tl", barbados: "bb", jamaica: "jm", guyana: "gy",
};

/** Strip women's / age / second-XI tags so "India A" and "Afghanistan U19" resolve to the parent flag.
 * After `fold`, "(W)" is already "w", so `\s+w$` covers India (W). */
const PARENT_STRIP = [
  /\s+women$/i,
  /\s+w$/i,
  /\s+u19(?:[\s-]*women)?$/i,
  /\s+under\s*19\b.*$/i,
  /\s+champions$/i,
  /\s+emerging$/i,
  /\s+governor\s+xi$/i,
  /\s+a$/i,
];

/**
 * flagcdn region code for a Base team name, or null.
 * Exact fold first, then parent-nation strips (U19 / A / Champions / Women). Never invents a club flag.
 */
export function flagCode(name) {
  let cur = fold(name);
  if (!cur) return null;
  const seen = new Set();
  for (let n = 0; n < 8 && cur && !seen.has(cur); n++) {
    seen.add(cur);
    const code = FLAG_CODES[cur];
    if (code) return code;
    let next = cur;
    for (const re of PARENT_STRIP) {
      const stripped = next.replace(re, "").replace(/\s+/g, " ").trim();
      if (stripped !== next) { next = stripped; break; }
    }
    if (next === cur) break;
    cur = next;
  }
  return FLAG_CODES[cur] || null;
}
