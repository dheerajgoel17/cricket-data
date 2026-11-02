// How a player has done on the chart's line at the next match's ground and against that opponent.
// Numbers come from the same chart entries the page already shows (this format, filters applied); DNP / VOID never count.
import { keepUntil, teamKey } from "./lines.js";
import { venueStem } from "./markets.js";
import { fairOdds } from "./stats.js";
import { windowRate } from "./windows.js";

/**
 * The nearest booked match still in the keep window (24 h, 6 days for a Test; a finished Test goes 24 h after it ended, see `keepUntil`), including one that has started
 * or just finished. Null when none. Same window Hot props uses, so the two pages agree. `endOf(line)` gives { final, finalAt } for a line's match (default: not known).
 * @param {(line: any) => ({ final?: boolean, finalAt?: string | number } | undefined)} [endOf]
 */
export function pickPricedMatch(doc, pid, fmt, now = Date.now(), endOf = () => undefined) {
  return (doc?.lines || [])
    .filter((l) => l.pid === pid && l.fmt === fmt && l.books?.length && l.start_utc && keepUntil(fmt, Date.parse(l.start_utc), endOf(l)) > now)
    .sort((x, y) => Date.parse(x.start_utc) - Date.parse(y.start_utc))[0] || null;
}

/**
 * upcoming / live / final for the player-page match card. The live feed's word wins; with none, the keep window
 * (24 h T20, 6 days Test: no result is known without a word) still counts as in play, then it is treated as finished.
 */
export function matchPhase(startUtc, now, status, fmt) {
  const startMs = Date.parse(startUtc);
  if (status === "live") return "live";
  if (status === "final") return "final";
  if (!(startMs <= now)) return "upcoming";
  return now < keepUntil(fmt, startMs) ? "live" : "final";
}

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
