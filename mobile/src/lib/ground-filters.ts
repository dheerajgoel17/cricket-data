import { FORMATS } from "@cricket/engine/util.js";
import { filterGames, majorityFormat, type GenderFilter } from "@site/lib/ground";

type GroundMatch = { fmt?: string; gender?: string };

export function groundMatchFilters<T extends GroundMatch>(games: T[], format: string, gender: GenderFilter) {
  const eligible = filterGames(games, "", gender) as T[];
  const formats: [string, string, number][] = [];
  for (const fmt of FORMATS) {
    const count = filterGames(eligible, fmt, "").length;
    if (count) formats.push([fmt, fmt, count]);
  }
  const activeFmt = formats.some(([fmt]) => fmt === format) ? format : majorityFormat(eligible);
  const list = filterGames(eligible, activeFmt, "") as T[];
  const both = games.some((f) => f.gender === "female") && games.some((f) => f.gender !== "female");
  return { formats, activeFmt, list, both };
}
