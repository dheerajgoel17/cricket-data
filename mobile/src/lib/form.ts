/* eslint-disable @typescript-eslint/no-explicit-any */
import { teamForm } from "@cricket/engine/form.js";
import { FORMATS } from "@cricket/engine/util.js";

/** Each side's last `n` results in a format (never mixed), oldest first: `{ name, idx, games }`; a side the data does not know is left out. */
export function recentForms(store: any, teams: [string, number][], fmt: string, n = 5) {
  const fmtIdx = FORMATS.indexOf(fmt);
  return teams.filter(([, i]) => i >= 0).map(([name, i]) => ({ name, idx: i, games: teamForm(store, i, fmtIdx, n) as any[] }));
}
