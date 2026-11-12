import { teamKey } from "@cricket/engine/live.js";

/** Representative team colors for fixture backgrounds. Women's and age-group sides share the parent team's tint. */
const TEAM_COLORS: Record<string, string> = {
  afghanistan: "#2563eb",
  australia: "#facc15",
  bangladesh: "#15803d",
  england: "#2563eb",
  india: "#2563eb",
  ireland: "#22c55e",
  netherlands: "#f97316",
  newzealand: "#64748b",
  pakistan: "#22c55e",
  scotland: "#6366f1",
  southafrica: "#16a34a",
  srilanka: "#3b82f6",
  westindies: "#be185d",
  zimbabwe: "#dc2626",
  adelaidestrikers: "#38bdf8",
  brisbaneheat: "#14b8a6",
  hobarthurricanes: "#a855f7",
  melbournerenegades: "#ef4444",
  melbournestars: "#22c55e",
  perthscorchers: "#f97316",
  sydneysixers: "#ec4899",
  sydneythunder: "#84cc16",
  chennaisuperkings: "#eab308",
  delhicapitals: "#3b82f6",
  gujarattitans: "#6366f1",
  kolkataknightriders: "#8b5cf6",
  lucknowsupergiants: "#38bdf8",
  mumbaiindians: "#2563eb",
  punjabkings: "#ef4444",
  rajasthanroyals: "#ec4899",
  royalchallengersbengaluru: "#dc2626",
  sunrisershyderabad: "#f97316",
};

export function fixtureTeamBackground(first: string, second: string) {
  const tint = (name: string) => {
    const color = TEAM_COLORS[teamKey(name).replace(/u19$/, "")];
    return color ? `color-mix(in srgb, var(--card) 80%, ${color})` : "var(--card)";
  };
  return `linear-gradient(105deg, ${tint(first)}, var(--card) 52%, ${tint(second)})`;
}
