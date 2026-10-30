// How a player has done on the chart's line at the next match's ground and against that opponent.
// Numbers come from the same chart entries the page already shows (this format, filters applied); DNP / VOID never count.
import { teamKey } from "./lines.js";
import { venueStem } from "./markets.js";
import { fairOdds } from "./stats.js";
import { windowRate } from "./windows.js";

/** The games on the chart that were at this ground (the first comma-part of the name: "Allan Border Field, Brisbane" = "Allan Border Field"). */
export function atGround(entries, ground) {
  if (!ground) return [];
  const want = venueStem(ground);
  return (entries || []).filter((e) => venueStem(e.venueName) === want);
}

/** The games on the chart against this side. "(W)" / "Women" fold, so Sydney Sixers Women is the same opponent as Sydney Sixers. */
export function vsSide(entries, opp) {
  if (!opp) return [];
  const want = teamKey(opp);
  return (entries || []).filter((e) => teamKey(e.opp) === want);
}

function withFair(r) {
  return { ...r, fair: fairOdds(r.p) };
}

/**
 * Hit rate, n and fair decimal odds on `line` / `side` at the next ground and against the next opponent.
 * `here.played` 0 means he has no counted innings there (not that the rate is 0).
 */
export function nextMatchRates(entries, next, line, side = "over") {
  return {
    here: withFair(windowRate(atGround(entries, next?.ground), 0, line, side)),
    versus: withFair(windowRate(vsSide(entries, next?.opp), 0, line, side)),
  };
}
