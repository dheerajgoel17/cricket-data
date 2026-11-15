/**
 * Curated side → accent hex for hero-bound washes (web HeroWash / app EntityHeroWash).
 * Keys match `teamKey` folding (SAME_SIDE + women strip). Unknown sides return null; UI may fall back to brand primary.
 */
import { SAME_SIDE } from "./util.js";

/** Same fold as `teamKey` in lines.js / live.js — keep equal so kit side names resolve. */
export function accentKey(n) {
  const k = String(n || "")
    .toLowerCase()
    .replace(/\(w\)|women'?s?|\sw$/g, "")
    .replace(/[^a-z0-9]/g, "");
  return SAME_SIDE[k] || k;
}

/** Mid-saturation kit-ish accents (washes apply alpha in UI). Never true black. */
const ACCENTS = {
  // Internationals
  india: "#1B4F9C",
  australia: "#01875F",
  england: "#1A2B5C",
  newzealand: "#1A3A32",
  southafrica: "#007A4D",
  pakistan: "#01411C",
  srilanka: "#0A5C8A",
  bangladesh: "#006A4E",
  westindies: "#7B002C",
  afghanistan: "#C8102E",
  ireland: "#169B62",
  scotland: "#0065BD",
  netherlands: "#C44D00",
  zimbabwe: "#C8102E",
  namibia: "#003580",
  unitedarabemirates: "#C8102E",
  usa: "#0A3161",
  nepal: "#DC143C",
  oman: "#C8102E",
  // IPL
  mumbaiindians: "#004BA0",
  chennaysuperkings: "#B8860B",
  royalchallengersbangalore: "#C8102E",
  royalchallengersbengaluru: "#C8102E",
  kolkataknightriders: "#3A225D",
  delhicapitals: "#004C93",
  rajasthanroyals: "#254AA5",
  sunrisershyderabad: "#D35400",
  punjabkings: "#C8102E",
  gujarattitans: "#1C3A5F",
  lucknowsupergiants: "#6B2D8B",
  // BBL / major franchises
  sydneysixers: "#E6007E",
  sydneythunder: "#7AC143",
  melbournestars: "#00A9E0",
  melbournerenegades: "#C8102E",
  perthscorchers: "#F15A22",
  adelaidestrikers: "#0077C8",
  hobarthurricanes: "#6C2C91",
  brisbaneheat: "#00A9CE",
  // SA20 / PSL samples
  sunriserseasterncape: "#D35400",
  joburgsuperkings: "#B8860B",
  micapetown: "#004BA0",
  paarlroyals: "#254AA5",
  pretoriacapitols: "#C8102E",
  islamabadunited: "#C8102E",
  lahoreqalandars: "#006A4E",
  karachikings: "#004BA0",
  peshawarzalmi: "#F5A524",
  multansultans: "#007A4D",
  quettagladiators: "#6B2D8B",
};

/** Curated accent hex for a side display name, or null when unmapped. */
export function entityAccent(name) {
  const k = accentKey(name);
  return ACCENTS[k] || null;
}
