/* eslint-disable @typescript-eslint/no-explicit-any */
import { clockStartedMs, teamScore } from "@cricket/engine/live.js";
import { fixtureState } from "@/hooks/useEngine";
import { fixtureStart } from "@/lib/format";

/** A match whose time has passed and whose live row still says "upcoming" is delayed for this long, then the live row is no longer trusted. */
export const DELAYED_MS = 24 * 3600e3;

/** What a match card or header says about play: `live` (play is on), `started` (its start has passed, no word that play is on), `delayed`, `final`, `upcoming`. */
export type PlayState = "live" | "started" | "delayed" | "final" | "upcoming";

/**
 * Where a fixture is, from evidence. `live` needs a score, the live feed calling the match live, or the schedule's own Live: the clock alone never makes a match live. A started
 * match with none of those (the books price it, no source lists it) is `started`: no LIVE badge, no score columns, "Score not available from our source". The fixture's published
 * `Started` status and a start that has passed on the clock (shortly, when the schedule is behind the live feed) both give it.
 * @param match the live feed's row for this fixture, if it has one
 */
export function playState(f: any, match: any, now = Date.now()): { state: PlayState; hasScore: boolean } {
  const hasScore = [f.a, f.b].some((t) => teamScore(match, t)?.display);
  const timed = f.start.length > 10, ms = fixtureStart(f).getTime() - now;
  const word = fixtureState(f, match?.status);
  const state: PlayState =
    match?.status === "final" || (!match && word === "final") ? "final"
      : !hasScore && match?.status === "upcoming" && timed && ms <= 0 && ms > -DELAYED_MS ? "delayed"
        : hasScore || word === "live" ? "live"
          : word === "started" || (timed && ms <= 0 && ms > -clockStartedMs(f.fmt)) ? "started"
            : "upcoming";
  return { state, hasScore };
}
