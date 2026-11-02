/* eslint-disable @typescript-eslint/no-explicit-any */
// What a fixture card shows, worked out as the site's FixtureCard does (site/src/components/app/fixture-card.tsx, a React component and so not importable):
// the live feed's word, the scores, the status line. Moves into the engine with the rail composition in Phase 1.
import { clockLiveMs, liveBlurb, sessionLabel, teamScore } from "@cricket/engine/live.js";
import { hasTime, startsIn } from "@/lib/format";
import { fixtureStart, fixtureState, type RailItem } from "@/lib/rail";

export interface CardSide { name: string; score: any | null; lost: boolean }
export interface CardModel { live: boolean; final: boolean; delayed: boolean; session: string; status: string; sides: CardSide[]; hasScore: boolean; timed: boolean; when: Date }

export function cardModel(item: Pick<RailItem, "fixture" | "live">, now = Date.now()): CardModel {
  const f = item.fixture, match = item.live;
  const when = fixtureStart(f), ms = when.getTime() - now, timed = hasTime(f);
  const clockLive = timed && ms <= 0 && ms > -clockLiveMs(f.fmt);
  const scores = [teamScore(match, f.a), teamScore(match, f.b)];
  const hasScore = scores.some((s) => s?.display);
  const final = match?.status === "final" || (!match && fixtureState(f, undefined, now) === "final");
  // the live feed says the match has not started although its time has passed (rain, a late toss): it is delayed, not in play
  const delayed = !final && !hasScore && match?.status === "upcoming" && ms <= 0 && ms > -24 * 3600e3;
  const live = !final && !delayed && (hasScore || clockLive || fixtureState(f, match?.status, now) === "live");
  const blurb = liveBlurb(match);
  const session = sessionLabel(blurb) || match?.session || "";
  const status = blurb || (final ? f.result || "Match completed" : live ? "Match in progress" : delayed ? "Start delayed" : timed ? startsIn(ms) : "Start time to be confirmed");
  const winner = final ? [f.a, f.b].find((t: string) => status.toLowerCase().includes(`${t.toLowerCase()} won`)) : undefined;
  const sides = [f.a, f.b].map((name: string, k: number) => ({ name, score: scores[k], lost: !!winner && name !== winner }));
  return { live, final, delayed, session, status, sides, hasScore, timed, when };
}
