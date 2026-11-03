// The one extra line a prop row may carry: a record worth a second look. Not every row has one. At the ground, and against this opponent, a player's record counts only from `GROUND_MIN`
// games (the same floor the Fancy rows use for "At the ground") and only when it is decisive: 70% or better, or 30% or worse. Anything in between says nothing the bars do not.
import { GROUND_MIN } from "@cricket/engine/fancy-edge.js";

export const KEY_HIGH = 0.7, KEY_LOW = 0.3;

export interface Note { label: string; record: string; side: "over" | "under" }
interface Rate { hits: number; played: number; p: number | null }

/** The side a decisive record is on (the line cleared in 70% or more of his games, or in 30% or fewer), else null. */
const key = (r?: Rate | null): "over" | "under" | null =>
  r && r.played >= GROUND_MIN && r.p != null ? (r.p >= KEY_HIGH ? "over" : r.p <= KEY_LOW ? "under" : null) : null;

/** The notes for a row: his record at the ground, then against this opponent, each only when it is a key point. `opp` is the opponent's short code. */
export function propNotes(r: { ven?: Rate | null; h2h?: Rate | null }, opp: string): Note[] {
  const out: Note[] = [];
  const g = key(r.ven);
  if (g) out.push({ label: "At the ground", record: `${g === "over" ? r.ven!.hits : r.ven!.played - r.ven!.hits} of ${r.ven!.played} ${g}`, side: g });
  const h = key(r.h2h);
  if (h) out.push({ label: `vs ${opp}`, record: `${h === "over" ? r.h2h!.hits : r.h2h!.played - r.h2h!.hits} of ${r.h2h!.played} ${h}`, side: h });
  return out;
}
