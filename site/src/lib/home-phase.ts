import { liveForFixture } from "@/engine/live.js";
import { keepMsFor } from "@/engine/lines.js";

/** The three buckets the home floating bar switches: a match in play, one yet to start, one that has a result. */
export type HomePhase = "live" | "pre" | "final";
export const HOME_PHASES: [HomePhase, string][] = [["live", "In play"], ["pre", "Pre-match"], ["final", "Resulted"]];

export function isHomePhase(v: unknown): v is HomePhase {
  return v === "live" || v === "pre" || v === "final";
}

/** Map the rail's live / upcoming / final word onto the bar's labels. */
export function phaseOf(state: "live" | "final" | "upcoming"): HomePhase {
  return state === "upcoming" ? "pre" : state;
}

/**
 * Which bucket a Hot props row belongs in. The live feed's word first; a start still in the future (or a delayed match the feed still
 * calls upcoming) is pre-match; a start that has passed and is still inside the keep window (24 h, 6 days for a Test) is in play, so a
 * Test the schedule dropped still sits in In play; older than that is resulted.
 */
export function lineHomePhase(r: { match: string; start: string; fmt?: string }, liveDoc: unknown, now = Date.now()): HomePhase {
  const [a, b] = String(r.match).split(/\s+vs\s+/i);
  const m = liveForFixture(liveDoc, { a, b, start: r.start, fmt: r.fmt });
  if (m?.status === "live") return "live";
  if (m?.status === "final") return "final";
  const t = Date.parse(r.start);
  if (m?.status === "upcoming" || (Number.isFinite(t) && t > now)) return "pre";
  if (Number.isFinite(t) && now - t < keepMsFor(r.fmt)) return "live";
  return "final";
}

export function countPhases<T>(items: T[], of: (x: T) => HomePhase): Record<HomePhase, number> {
  const n = { live: 0, pre: 0, final: 0 };
  for (const x of items) n[of(x)] += 1;
  return n;
}

/** Honour a tap on the bar; with no tap, open In play when anything is on, else Pre-match, else Resulted. An empty board stays on In play so the first paint is not Resulted. */
export function pickHomePhase(counts: Record<HomePhase, number>, requested?: string): HomePhase {
  if (isHomePhase(requested)) return requested;
  if (counts.live) return "live";
  if (counts.pre) return "pre";
  return counts.final ? "final" : "live";
}
