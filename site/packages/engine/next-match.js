// How a player has done on the chart's line at the next match's ground and against that opponent.
// Numbers come from the same chart entries the page already shows (this format, filters applied); DNP / VOID never count.
import { keepMsFor, teamKey } from "./lines.js";
import { venueStem } from "./markets.js";
import { fairOdds } from "./stats.js";
import { windowRate } from "./windows.js";

/**
 * The side to show for kit, crest and hero label: the match he is filed under when we know one
 * (book line / nextMatch.team), else his profile team. Empty strings do not win.
 */
export function matchSide(nextTeam, indexTeam) {
  const next = String(nextTeam || "").trim();
  return next || String(indexTeam || "").trim();
}

/**
 * Index of a team in `store.teams` by display name (SAME_SIDE / Women fold via teamKey), or `fallback` when none match.
 */
export function teamIndexByName(teams, name, fallback = -1) {
  const want = teamKey(name);
  if (!want || !Array.isArray(teams)) return fallback;
  const i = teams.findIndex((t) => teamKey(t?.n) === want);
  return i >= 0 ? i : fallback;
}

/**
 * The booked match the player page should show still in the keep window (24 h, 6 days for a Test), including one that
 * has started or just finished. Null when none. Same window Hot props uses, so the two pages agree.
 * When he is priced on two games of this format at once (international ODI and a List A club game), `prefer` from the
 * shared link (`{ start?, line?, stat? }`) picks the match that link opened from: kick-off first, else the line (and
 * optionally that stat), else the soonest — same rule as `ofBookMatch` in lines.js.
 */
export function pickPricedMatch(doc, pid, fmt, now = Date.now(), prefer = null) {
  const keep = keepMsFor(fmt);
  const open = (doc?.lines || []).filter((l) => l.pid === pid && l.fmt === fmt && l.books?.length && l.start_utc && Date.parse(l.start_utc) > now - keep);
  if (!open.length) return null;
  let pool = open;
  if (prefer?.stat) {
    const s = open.filter((l) => l.stat === prefer.stat);
    if (s.length) pool = s;
  }
  const preferStart = prefer?.start ? Date.parse(prefer.start) : NaN;
  if (Number.isFinite(preferStart)) {
    // exact kick-off, or another stamp of the same fixture a few minutes off — not a different game hours away (club List A vs the international)
    const exact = pool.find((l) => Date.parse(l.start_utc) === preferStart);
    if (exact) return exact;
    const near = pool.reduce((best, l) => (!best || Math.abs(Date.parse(l.start_utc) - preferStart) < Math.abs(Date.parse(best.start_utc) - preferStart) ? l : best), null);
    if (near && Math.abs(Date.parse(near.start_utc) - preferStart) < 2 * 3600e3) return near;
  }
  if (prefer?.line != null && Number.isFinite(+prefer.line)) {
    const want = +prefer.line;
    const hit = pool.filter((l) => Math.abs(l.line - want) < 0.01);
    if (hit.length) return hit.sort((x, y) => Date.parse(x.start_utc) - Date.parse(y.start_utc))[0];
  }
  return pool.sort((x, y) => Date.parse(x.start_utc) - Date.parse(y.start_utc))[0] || null;
}

/**
 * upcoming / live / final for the player-page match card. The live feed's word wins; with none, the keep window
 * (24 h T20, 6 days Test) still counts as in play, then it is treated as finished.
 */
export function matchPhase(startUtc, now, status, fmt) {
  const startMs = Date.parse(startUtc);
  if (status === "live") return "live";
  if (status === "final") return "final";
  if (!(startMs <= now)) return "upcoming";
  return now - startMs < keepMsFor(fmt) ? "live" : "final";
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
