/* eslint-disable @typescript-eslint/no-explicit-any */
// What a fixture card shows, worked out as the site's FixtureCard does (site/src/components/app/fixture-card.tsx, a React component and so not importable):
// the live feed's word, the scores, the status line. `playState` mirrors site/src/lib/play-state.ts. Moves into the engine with the rail composition in Phase 1.
import { clockStartedMs, liveBlurb, sessionLabel, teamScore } from "@cricket/engine/live.js";
import { hasTime, startsIn } from "@/lib/format";
import { fixtureStart, fixtureState, type RailItem } from "@/lib/rail";

/** What a started match says in place of its score when neither the schedule nor the live feed lists it. */
export const NO_SCORE = "Score not available from our source";
/** A match whose time has passed and whose live row still says "upcoming" is delayed for this long, then the live row is no longer trusted. */
const DELAYED_MS = 24 * 3600e3;

export type PlayState = "live" | "started" | "delayed" | "final" | "upcoming";

/**
 * Where a fixture is, from evidence: `live` needs a score, the live feed calling the match live, or the schedule's own Live (the clock alone never makes a match live); a started
 * match with none of those is `started`: no LIVE badge, no score columns, "Score not available from our source".
 */
export function playState(f: any, match: any, now = Date.now()): { state: PlayState; hasScore: boolean } {
  const hasScore = [f.a, f.b].some((t) => teamScore(match, t)?.display);
  const timed = hasTime(f), ms = fixtureStart(f).getTime() - now;
  const word = fixtureState(f, match?.status, now);
  const state: PlayState =
    match?.status === "final" || (!match && word === "final") ? "final"
      : !hasScore && match?.status === "upcoming" && timed && ms <= 0 && ms > -DELAYED_MS ? "delayed"
        : hasScore || word === "live" ? "live"
          : word === "started" || (timed && ms <= 0 && ms > -clockStartedMs(f.fmt)) ? "started"
            : "upcoming";
  return { state, hasScore };
}

export interface CardSide { name: string; score: any | null; lost: boolean }
export interface CardModel { live: boolean; final: boolean; delayed: boolean; started: boolean; session: string; status: string; sides: CardSide[]; hasScore: boolean; timed: boolean; when: Date }

export function cardModel(item: Pick<RailItem, "fixture" | "live">, now = Date.now()): CardModel {
  const f = item.fixture, match = item.live;
  const when = fixtureStart(f), ms = when.getTime() - now, timed = hasTime(f);
  const liveScores = [teamScore(match, f.a), teamScore(match, f.b)];
  // `cardScores`: side scores precomputed from history (a ground page's past games) when the live feed has none, same as the site's FixtureCard
  const scores = f.cardScores?.[0]?.display || f.cardScores?.[1]?.display ? f.cardScores : liveScores;
  const played = playState(f, match, now);
  const state = played.state, hasScore = played.hasScore || scores !== liveScores;
  const [final, delayed, live, started] = [state === "final", state === "delayed", state === "live", state === "started"];
  const blurb = liveBlurb(match);
  const session = sessionLabel(blurb) || match?.session || "";
  const status = blurb || (final ? f.result || "Match completed" : live ? "Match in progress" : started ? NO_SCORE : delayed ? "Start delayed" : timed ? startsIn(ms) : "Start time to be confirmed");
  const winner = final ? [f.a, f.b].find((t: string) => status.toLowerCase().includes(`${t.toLowerCase()} won`)) : undefined;
  const sides = [f.a, f.b].map((name: string, k: number) => ({ name, score: scores[k], lost: !!winner && name !== winner }));
  return { live, final, delayed, started, session, status, sides, hasScore, timed, when };
}
